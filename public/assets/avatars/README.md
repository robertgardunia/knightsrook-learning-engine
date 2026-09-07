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

A tricorder prop is attached directly in Blender/CC5 (parented to the right
hand bone, screen textured with a themed LCARS-style readout — see
`archive/st-demo/LCARS-26/biolab.html`) and baked into this same GLB rather
than positioned at runtime. `AvatarController.setMeshVisible(namePattern,
visible)` shows/hides it by mesh name substring for whichever lesson beats
should have him holding it.

Material correction lives in `packages/client/src/avatar/ccMaterialCorrection.ts`
(ported from garage's `cc4Materials.js`, ADR in `docs/reuse-log.md` #4) —
applied automatically by `AvatarController.create`, not something a course
author needs to touch. `scripts/fbx2glb-avatar.py` handles the Blender-side
half of the pipeline (mesh cleanup, UV fixes, eye-overlay deletion, specular
normalization, root-motion-track stripping on linked animation clips, texture
compression) — see that script's own header comment for the full step list.

**Root motion tracks matter for linked clips**: ActorCore/CC-rig animation
files bake the source performer's own bone lengths into per-bone position/
scale tracks, which distort a differently-proportioned character's mesh if
applied directly (confirmed 2026-09-07 — this was tearing open a seam at the
underarm). `fbx2glb-avatar.py` strips those, keeping rotation only, same as
`animationMixer.ts`'s `filterRootMotion` option does for the separate runtime
retargeting path.
