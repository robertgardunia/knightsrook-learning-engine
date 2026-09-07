"""
Convert a CC (Character Creator) FBX export into the mentor avatar's GLB.

Steps:
  1. Strip metallic channel from all Principled BSDF materials.
  2. Fix mirrored UVs on body/skin meshes (FBX import artifact).
  3. Fix beard/sideburn jaw skinning, if present.
  4. Strip ALL shape keys — this project has no viseme/lip-sync system,
     dialogue is closed-captioned (see project:learning-demo:spec).
  5. Compress textures to 1024px (this project's decided avatar texture
     budget for browser delivery — see project:learning-demo:spec research-open #8).
  6. Clear FBX animations; link animation clips from source GLB/FBX files via
     NLA (no baking — avoids coordinate-system mismatches between FBX and GLB).
  7. Export GLB with animations.

Ported from knightsrook-garage/scripts/fbx2glb-curry-garage.py — that file
had no remaining character-specific logic (the Curry-only hacks all lived in
cc4Materials.js instead, which correctCCMaterials.ts already dropped).

Usage:
  blender --background --python scripts/fbx2glb-avatar.py -- <input.fbx> <output.glb> [anim1.glb] [anim2.glb] ... [max_tex_size]

Each anim arg becomes one NLA-linked action — animation clip order determines
the AnimationSlots index order in the finished GLB's animationGroups array.
"""
import bpy
import sys

MESHES_TO_DELETE = ('boxers', 'eyeocclusion', 'tearline')


def delete_unwanted_meshes():
    to_delete = [
        o for o in bpy.data.objects
        if o.type in ('MESH', 'ARMATURE') and any(k in o.name.lower() for k in MESHES_TO_DELETE)
    ]
    for obj in to_delete:
        print(f"  DELETE {obj.name}")
        bpy.data.objects.remove(obj, do_unlink=True)


EYE_OVERLAY_MATERIALS = ('cornea', 'eyemoisture')


def delete_eye_overlay_faces():
    """Garage's CC4 characters have separate EyeOcclusion/TearLine mesh
    objects that get deleted outright — that always fixed a broken/washed-out
    eye look. This CC3+/Transformer export has no such separate objects
    (everything's merged into CC_Base_Body with material slots instead), so
    the equivalent fix is deleting the faces assigned to the analogous
    overlay materials (Cornea, EyeMoisture) rather than whole objects."""
    import bmesh

    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue
        target_indices = {
            i for i, slot in enumerate(obj.material_slots)
            if slot.material and slot.material.name.lower() in EYE_OVERLAY_MATERIALS
        }
        if not target_indices:
            continue

        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.faces.ensure_lookup_table()
        to_delete = [f for f in bm.faces if f.material_index in target_indices]
        print(f"  {obj.name}: deleting {len(to_delete)} eye-overlay faces")
        bmesh.ops.delete(bm, geom=to_delete, context='FACES')
        bm.to_mesh(obj.data)
        bm.free()


def strip_metallic():
    for mat in bpy.data.materials:
        if not mat.use_nodes or not mat.node_tree:
            continue
        for node in mat.node_tree.nodes:
            if node.type != 'BSDF_PRINCIPLED':
                continue
            metallic_in = node.inputs.get('Metallic')
            if not metallic_in:
                continue
            for link in list(mat.node_tree.links):
                if link.to_socket == metallic_in:
                    mat.node_tree.links.remove(link)
            metallic_in.default_value = 0.0


def normalize_specular():
    """CC/Daz eye materials (Cornea, EyeMoisture) bake an unusually high
    Specular IOR Level into the Principled BSDF — glTF export turns that into
    a KHR_materials_specular specularColorFactor way outside normal PBR range
    (observed: 2.0), which blows the thin transparent eye-overlay layers out
    to solid white and masks the iris/pupil/sclera underneath. Reset to
    Blender's own default (0.5, -> glTF specularFactor 1.0) on every
    material — same blanket normalization approach as strip_metallic()."""
    for mat in bpy.data.materials:
        if not mat.use_nodes or not mat.node_tree:
            continue
        for node in mat.node_tree.nodes:
            if node.type != 'BSDF_PRINCIPLED':
                continue
            spec_in = node.inputs.get('Specular IOR Level') or node.inputs.get('Specular')
            if not spec_in:
                continue
            for link in list(mat.node_tree.links):
                if link.to_socket == spec_in:
                    mat.node_tree.links.remove(link)
            spec_in.default_value = 0.5
            print(f"  Normalized specular: {mat.name}")


BODY_MESHES = ('cc_base_body', 'sideburns')
SKIN_MATERIALS = ('std_skin_head', 'std_skin_body', 'std_skin_arm', 'std_skin_leg')


def fix_mirrored_uvs():
    """Flip U on skin material faces only — not the whole body mesh.

    CC_Base_Body is one mesh with many material slots (skin, eyes, nails,
    tongue, teeth...) sharing the same UV layer. Only the skin texture is
    mirrored by FBX import; blindly flipping the entire mesh's UV layer also
    moves the eye material faces' UV island, which isn't symmetric in its
    texture atlas — landing the sample on blank padding instead of the
    sclera/iris art and rendering the eyes flat white. Clothing UVs are left
    untouched either way, same as before."""
    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue
        if not any(k in obj.name.lower() for k in BODY_MESHES):
            continue
        uv_layer = obj.data.uv_layers.active
        if not uv_layer:
            continue
        skin_slot_indices = {
            i for i, slot in enumerate(obj.material_slots)
            if slot.material and slot.material.name.lower() in SKIN_MATERIALS
        }
        flipped = 0
        for poly in obj.data.polygons:
            if poly.material_index not in skin_slot_indices:
                continue
            for loop_index in poly.loop_indices:
                uv_layer.data[loop_index].uv[0] = 1.0 - uv_layer.data[loop_index].uv[0]
            flipped += 1
        print(f"  UV-flipped (U) on {flipped} skin-material faces: {obj.name}")


def fix_beard_jaw_skinning():
    armature = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    if not armature:
        print("  No armature found — skipping beard fix")
        return
    jaw_bone = 'CC_Base_JawRoot'
    if jaw_bone not in armature.data.bones:
        print(f"  Bone {jaw_bone} not found — skipping beard fix")
        return
    found = False
    for obj in bpy.data.objects:
        if obj.type != 'MESH' or 'sideburn' not in obj.name.lower():
            continue
        found = True
        arm_mod = next((m for m in obj.modifiers if m.type == 'ARMATURE'), None)
        if not arm_mod:
            arm_mod = obj.modifiers.new('Armature', 'ARMATURE')
        arm_mod.object = armature
        obj.vertex_groups.clear()
        jaw_vg = obj.vertex_groups.new(name=jaw_bone)
        all_verts = [v.index for v in obj.data.vertices]
        jaw_vg.add(all_verts, 1.0, 'REPLACE')
        print(f"  {obj.name}: re-weighted {len(all_verts)} verts -> {jaw_bone}")
    if not found:
        print("  No sideburn/beard mesh found — nothing to fix")


def strip_all_shape_keys():
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and obj.data.shape_keys:
            n = len(obj.data.shape_keys.key_blocks)
            bpy.context.view_layer.objects.active = obj
            obj.shape_key_clear()
            print(f"  STRIP shape keys: {obj.name} ({n} removed)")


def compress_textures(max_size):
    for img in bpy.data.images:
        if img.size[0] == 0 or img.size[1] == 0:
            continue
        w, h = img.size
        if max(w, h) <= max_size:
            continue
        scale = max_size / max(w, h)
        img.scale(int(w * scale), int(h * scale))
        print(f"  Resized {img.name}: {w}x{h} -> {int(w*scale)}x{int(h*scale)}")


def is_bind_pose(name):
    n = name.lower()
    return 't-pose' in n or 'tpose' in n or 'default' in n or 'bind' in n


def clear_animations(armature):
    if armature.animation_data:
        for track in list(armature.animation_data.nla_tracks or []):
            armature.animation_data.nla_tracks.remove(track)
        armature.animation_data.action = None
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def strip_root_motion_tracks(action):
    """ActorCore motion files bake the source performer's own bone lengths
    and proportions into per-bone position/scale fcurves — applying those
    directly onto a differently-proportioned character's rig moves bones to
    where the SOURCE actor's would be, not this character's, distorting the
    mesh around them (confirmed 2026-09-07: this was tearing the shirt's
    underarm seam open — clean with animations stripped, broken with this
    clip linked). animationMixer.ts's runtime retargeting path already
    strips these via its filterRootMotion option; this is the equivalent
    fix for the Blender-side NLA-baking path, which had no such filter."""
    removed = 0
    for fcurve in list(action.fcurves):
        prop = fcurve.data_path.split('.')[-1]
        if prop in ('location', 'scale'):
            action.fcurves.remove(fcurve)
            removed += 1
    print(f"  Stripped {removed} position/scale fcurve(s) from '{action.name}' (rotation kept)")


def link_animation_from_source(char_name, source_file):
    """Import one source GLB/FBX and link its first usable action directly to
    the character armature via NLA. No frame-by-frame baking — avoids
    coordinate-system mismatches between FBX and GLB."""
    pre_objs = set(o.name for o in bpy.data.objects)
    pre_actions = set(a.name for a in bpy.data.actions)

    print(f"  Importing: {source_file}")
    if source_file.lower().endswith(('.glb', '.gltf')):
        bpy.ops.import_scene.gltf(filepath=source_file)
    else:
        bpy.ops.import_scene.fbx(filepath=source_file)

    new_actions = [a for a in bpy.data.actions
                   if a.name not in pre_actions and not is_bind_pose(a.name)]

    if not new_actions:
        print(f"  WARNING: no usable actions in {source_file}")
        for obj in list(bpy.data.objects):
            if obj.name not in pre_objs:
                bpy.data.objects.remove(obj, do_unlink=True)
        return False

    char_arm = bpy.data.objects[char_name]
    if not char_arm.animation_data:
        char_arm.animation_data_create()

    # One clip per source file — take the longest non-bind-pose action.
    action = max(new_actions, key=lambda a: a.frame_range[1] - a.frame_range[0])
    strip_root_motion_tracks(action)
    frame_start = int(action.frame_range[0])
    track = char_arm.animation_data.nla_tracks.new()
    track.name = action.name
    track.strips.new(action.name, frame_start, action)
    print(f"  Linked: {action.name}  ({int(action.frame_range[1] - action.frame_range[0]) + 1} frames)")

    for obj in list(bpy.data.objects):
        if obj.name not in pre_objs:
            bpy.data.objects.remove(obj, do_unlink=True)

    nla_actions = {strip.action.name
                   for obj in bpy.data.objects if obj.animation_data
                   for track in (obj.animation_data.nla_tracks or [])
                   for strip in track.strips if strip.action}
    for a in list(bpy.data.actions):
        if a.name not in nla_actions:
            bpy.data.actions.remove(a)

    return True


def convert(input_path, output_path, anim_sources, max_size=1024):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=input_path)

    print("\n[1] Deleting unwanted meshes...")
    delete_unwanted_meshes()

    print("\n[1b] Deleting eye-overlay faces (Cornea/EyeMoisture)...")
    delete_eye_overlay_faces()

    # [1c] Body-under-clothing deletion is now handled at the source in CC5
    # (Modify > Edit Mesh > Sculpt > Show Mesh Brush > Hide), which is the
    # correct place to fix it — CC5's own Auto Hide Mesh deliberately skips
    # wrist/neck/shoulder joints, and the manual brush is the documented
    # touch-up tool for exactly those excluded zones. Not calling
    # delete_body_faces_under_clothing() here to avoid stacking a second,
    # cruder deletion pass on top of a fix that's already correct.

    print("\n[2] Stripping metallic channel...")
    strip_metallic()

    print("\n[2b] Normalizing specular...")
    normalize_specular()

    print("\n[3] Fixing mirrored UVs...")
    fix_mirrored_uvs()

    print("\n[4] Fixing beard jaw skinning...")
    fix_beard_jaw_skinning()

    print("\n[5] Stripping all shape keys...")
    strip_all_shape_keys()

    print(f"\n[6] Compressing textures to {max_size}px...")
    compress_textures(max_size)

    if anim_sources:
        char_arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
        if char_arm:
            print("\n[7] Clearing FBX animations...")
            clear_animations(char_arm)
            print("\n[8] Linking animation clips from source...")
            for src in anim_sources:
                link_animation_from_source(char_arm.name, src)
        else:
            print("  WARNING: no character armature found — skipping animation link")

    print("\n[9] Exporting GLB...")
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_animations=True,
        export_skins=True,
        export_morph=False,
        export_apply=False,
        export_image_format='JPEG',
        export_jpeg_quality=90,
    )
    print(f"\nDone: {input_path} -> {output_path}")


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(argv) < 2:
        print("Usage: blender --background --python fbx2glb-avatar.py -- input.fbx output.glb [anim1.glb] [anim2.glb] ... [max_size]")
        sys.exit(1)

    input_path = argv[0]
    output_path = argv[1]
    anim_sources = []
    max_size = 1024

    for arg in argv[2:]:
        try:
            max_size = int(arg)
        except ValueError:
            anim_sources.append(arg)

    convert(input_path, output_path, anim_sources, max_size)
