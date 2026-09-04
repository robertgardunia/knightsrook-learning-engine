"""
Batch-convert every FBX under a source directory to animation-only GLBs.

Usage:
  blender --background --python scripts/batch-fbx2glb.py -- <src_dir> <out_dir>

Recurses src_dir for *.fbx, writes <out_dir>/<basename>.glb for each — flat
output, so source filenames must be unique (this is a stand-in for the
config-driven manifest tool discussed in project:learning-demo:spec; for now
it's a directory-scan batch job, not yet manifest-driven).
"""
import bpy
import os
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


if __name__ == '__main__':
    argv = sys.argv
    argv = argv[argv.index('--') + 1:] if '--' in argv else []

    if len(argv) < 2:
        print("Usage: blender --background --python batch-fbx2glb.py -- <src_dir> <out_dir>")
        sys.exit(1)

    src_dir, out_dir = argv[0], argv[1]
    os.makedirs(out_dir, exist_ok=True)

    fbx_files = []
    for root, _dirs, files in os.walk(src_dir):
        for f in files:
            if f.lower().endswith('.fbx'):
                fbx_files.append(os.path.join(root, f))
    fbx_files.sort()

    print(f'Found {len(fbx_files)} FBX files under {src_dir}')

    for fbx_path in fbx_files:
        base = os.path.splitext(os.path.basename(fbx_path))[0]
        out_path = os.path.join(out_dir, f'{base}.glb')
        print(f'\n=== {os.path.basename(fbx_path)} -> {os.path.basename(out_path)} ===')
        try:
            convert(fbx_path, out_path)
            size_kb = os.path.getsize(out_path) / 1024
            print(f'  Written: {out_path} ({size_kb:.0f} KB)')
        except Exception as e:
            print(f'  FAILED: {e}')

    print('\nAll done.')
