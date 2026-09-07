# scripts/

Headless Blender CLI tools for the avatar/animation pipeline (CC5 → GLB).
Run via `blender --background --python scripts/<name>.py -- <args>` — see
each script's own header comment for its exact usage and arguments.

- **`fbx2glb-avatar.py`** — converts a Character Creator FBX export into the
  mentor avatar's GLB: mesh cleanup, UV fixes, eye-overlay-material deletion,
  specular normalization, shape-key stripping, texture compression, animation-
  clip linking, and root-motion-track stripping on linked clips (see
  `public/assets/avatars/README.md` for why that last one matters).
- **`fbx2glb.py`** — converts a single ActorCore/CC-rig animation FBX into a
  standalone animation-only GLB (armature + keyframes, no mesh/materials).
- **`batch-fbx2glb.py`** — runs `fbx2glb.py`'s conversion over every FBX
  found under a source directory, for bulk-converting a whole downloaded
  ActorCore library at once. See `public/assets/animations/README.md`.

Not yet the config-driven, non-developer-usable tool described in
`project:learning-demo:spec` (an "anim-viewer, generalized" per that note) —
these are still developer-run CLI scripts with hardcoded per-character logic
where a character-specific step is genuinely needed (e.g. which material
slots count as "skin" for the UV fix). Building that standalone tool is
tracked as a follow-up, not started yet.
