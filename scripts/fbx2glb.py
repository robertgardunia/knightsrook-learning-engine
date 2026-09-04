"""
Convert an ActorCore/CC-rig animation FBX to a standalone animation-only GLB
(armature + keyframes, no mesh/materials) for the client's animationMixer.ts
to load and retarget onto any character skeleton by bone name.

Ported from knightsrook-garage/scripts/fbx2glb.py — same conversion, no
project-specific assumptions in the original.

Usage:
  blender --background --python scripts/fbx2glb.py -- input.fbx output.glb
"""
import bpy
import sys


def convert(input_path, output_path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=input_path)

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_animations=True,
        export_nla_strips=False,
        export_def_bones=False,
        export_current_frame=False,
        export_skins=True,
        export_morph=False,
        export_materials='NONE',
        export_texcoords=False,
        export_normals=False,
        use_selection=False,
    )

    print(f"Converted: {input_path} -> {output_path}")


if __name__ == '__main__':
    argv = sys.argv
    argv = argv[argv.index('--') + 1:] if '--' in argv else []

    if len(argv) < 2:
        print("Usage: blender --background --python fbx2glb.py -- input.fbx output.glb")
        sys.exit(1)

    convert(argv[0], argv[1])
