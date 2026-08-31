# animations/

Shared animation clip libraries, if a set of gesture/idle clips ever gets
extracted separately from individual avatar GLBs (e.g. a common ActorCore
rig's clips reused across multiple avatars sharing the same CC_Base_* rig).

```
animations/
  actorcore-gesture-pack/
    clips.glb
```

Not populated yet — right now every avatar GLB carries its own clips inline,
addressed by exact clip index via `AnimationSlots` (never name regex — see
`packages/shared-types/src/course-package.ts`). Only split clips out here if
multiple avatars genuinely share one rig and duplication becomes a real cost.
