# animations/

Shared animation clip libraries — one GLB per clip, not a combined multi-clip
file, since `packages/client/src/avatar/animationMixer.ts` loads and caches
external clips one file at a time and retargets by bone name onto whichever
character skeleton needs it (as opposed to a clip baked directly into an
avatar's own GLB and addressed by exact index via `AnimationSlots` — see
`packages/shared-types/src/course-package.ts` — which is how the base idle
clip works today).

```
animations/
  actorcore/
    manifest.json
    main-idle.glb
    arrogant-stand-idle-m.glb
    ...
```

`actorcore/` holds the raw ActorCore purchased-motion library, converted from
FBX via `scripts/batch-fbx2glb.py` (bulk) or `scripts/fbx2glb.py` (single
clip) — animation-only GLBs (armature + keyframes, no mesh/materials).
`manifest.json` catalogs every clip with a category (idle/talk/gesture/
station-interaction/walk/combat/misc) and an `enabled` flag — most of this
batch came from general ActorCore packs and includes clips irrelevant to a
sci-fi-lab mentor (combat/stealth motions); `enabled: false` means present on
disk but not offered by default, not deleted.

Not yet wired into the mentor's animation slots beyond the one idle clip
`AvatarController` uses today — this library exists for the planned mentor
mobility/station-interaction work (see `project:learning-demo:spec`), and for
the standalone CC-pipeline tool (an "anim-viewer, generalized" per that same
spec note) that will eventually let a non-dev assign clips to slots via this
manifest instead of a developer editing code.
