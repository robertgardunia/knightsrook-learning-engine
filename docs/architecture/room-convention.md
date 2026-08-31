# Room convention

Every room GLB used by this engine must contain a named empty/transform node
that marks the intended player/camera spawn point. `RoomConfig.spawnNode` in
the course package names it; `packages/client/src/scene/roomConvention.ts`
looks it up at load time and throws a clear error if it's missing, rather than
silently defaulting to the GLB's origin.

Why this exists: every downloaded room GLB has a different scale, origin, and
lighting rig. Without this convention, each new room costs roughly an hour of
manual camera/lighting nudging per the spec — flagged as the most likely
silent tax on the assembly-time claim this whole project measures.

Default node name convention: `SpawnPoint`. Course packages may override via
`RoomConfig.spawnNode` if a downloaded asset can't be re-exported with that
exact name.

Auto-framing (camera placement relative to the spawn node, accounting for the
room's actual bounding box) is not yet implemented — `autoFrameFromSpawn()` is
a stub until the first real room GLB is in hand to test camera math against.
