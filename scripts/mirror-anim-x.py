"""
Mirror a skeletal animation GLB left↔right and export as a new GLB.

Works by swapping paired L/R bone fcurves and negating the rotation axes
that flip under X-mirror for CC5/ActorCore rigs (Y and Z rotation components
stay the same; X and W components of the quaternion negate on the swapped side).

Usage:
  blender --background --python scripts/mirror-anim-x.py -- input.glb output.glb
"""
import bpy
import sys
import re

# CC5 bone name pairs — left bone name → right bone name (without side suffix)
# The script swaps fcurves between paired bones and negates the mirror axes.
CC5_MIRROR_RE = re.compile(r'_(L|R)_')


def mirror_bone_name(name: str) -> str | None:
    """Return the mirrored bone name, or None if not a paired bone."""
    def swap(m):
        return '_R_' if m.group(1).upper() == 'L' else '_L_'
    new_name = CC5_MIRROR_RE.sub(swap, name, count=1)
    return new_name if new_name != name else None


def mirror_action(action):
    # Build a map of existing fcurves by (data_path, array_index)
    fc_map = {(fc.data_path, fc.array_index): fc for fc in action.fcurves}

    processed = set()
    for fc in list(action.fcurves):
        dp = fc.data_path
        # Extract bone name from data_path like: pose.bones["CC_Base_L_Upperarm"].rotation_quaternion
        m = re.search(r'pose\.bones\["([^"]+)"\]\.(\w+)', dp)
        if not m:
            continue
        bone_name = m.group(1)
        prop = m.group(2)
        mirror_name = mirror_bone_name(bone_name)
        if not mirror_name:
            continue
        pair_key = tuple(sorted([bone_name, mirror_name]))
        if pair_key in processed:
            continue
        processed.add(pair_key)

        mirror_dp = dp.replace(f'"{bone_name}"', f'"{mirror_name}"')

        for ai in range(4 if 'quaternion' in prop else 3):
            fc_l = fc_map.get((dp, ai))
            fc_r = fc_map.get((mirror_dp, ai))

            # Collect keyframe data
            kf_l = [(k.co[0], k.co[1]) for k in fc_l.keyframe_points] if fc_l else []
            kf_r = [(k.co[0], k.co[1]) for k in fc_r.keyframe_points] if fc_r else []

            # For quaternion: negate X (index 1) and W (index 0) components on swap.
            # For euler: negate Y (index 1) and Z (index 2).
            if 'quaternion' in prop:
                negate = ai in (2, 3)  # mirror X-axis: negate Y and Z, keep W and X
            elif 'euler' in prop or 'rotation' in prop:
                negate = ai in (1, 2)  # mirror X-axis: negate Y and Z euler components
            else:
                negate = False

            def apply_kfs(fc, kfs, neg):
                if not fc:
                    return
                for i, kp in enumerate(fc.keyframe_points):
                    if i < len(kfs):
                        kp.co[1] = (-kfs[i][1] if neg else kfs[i][1])
                fc.update()

            # Swap: write R's original data onto L's fcurve, and vice versa
            apply_kfs(fc_l, kf_r, negate)
            apply_kfs(fc_r, kf_l, negate)

    print(f"  Mirrored action: {action.name}")


def convert(input_path: str, output_path: str):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=input_path)

    for action in bpy.data.actions:
        mirror_action(action)

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_animations=True,
        export_skins=True,
        export_apply=False,
    )
    print(f"Done: {input_path} -> {output_path}")


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(argv) < 2:
        print("Usage: blender --background --python mirror-anim-x.py -- input.glb output.glb")
        sys.exit(1)
    convert(argv[0], argv[1])
