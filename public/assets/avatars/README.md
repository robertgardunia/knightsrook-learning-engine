# avatars/

Character GLBs (CC3+/CC5 → glTF exports, via Daz → CC5 Transformer → Blender).
One subfolder per avatar:

```
avatars/
  vulcan-tvek/
    avatar.glb
```

Export at **1K texture resolution, not 4K**, for browser delivery — decided
2026-08-31, see `project:learning-demo:research-open` #8. Let normal maps
carry detail rather than shipping 4K albedo/normal/roughness maps.

`vulcan-tvek/avatar.glb` is the first real avatar — the precursor-demo's
Vulcan mentor (T'Vek), Daz Genesis 8 Male → CC5 Transformer → Blender →
glTF, converted via `scripts/fbx2glb-avatar.py`. Baked with a single idle
animation clip (see `AnimationSlots.idle` in course.json) linked in from
`public/assets/animations/actorcore/`; talk/greet/explain/point clips are
not sourced yet — `AvatarController.playSlot` warns and no-ops for missing
slot indices rather than erroring.

Material correction lives in `packages/client/src/avatar/ccMaterialCorrection.ts`
(ported from garage's `cc4Materials.js`, ADR in `docs/reuse-log.md` #4) —
applied automatically by `AvatarController.create`, not something a course
author needs to touch. `scripts/fbx2glb-avatar.py` handles the Blender-side
half of the pipeline (mesh cleanup, UV fixes, eye-overlay deletion, specular
normalization, texture compression, animation linking) — see that script's
own header comment for the full step list.
