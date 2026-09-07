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

**Revision from the original spec:** the first real GLB, like most
Sketchfab downloads, had no `SpawnPoint` node — re-exporting every downloaded
asset just to add an empty defeats the point of this convention. `main.ts`
calls `findOrSynthesizeSpawnNode()` instead of the strict `findSpawnNode()`:
if the named node is missing, it synthesizes one at the room's bounding-box
center and logs a console warning (never silent). Author a real spawn node
when you control the export (e.g. a custom-modeled room, or adding one to a
downloaded asset in Blender); rely on the synthesized fallback otherwise.
`findSpawnNode()` still exists and still throws for callers that need to
enforce a real authored node.

The spawn node is floor-level (feet position), not eye level — the avatar's
root sits there directly, and `playerCamera.ts` adds its own eye-height
offset on top of it for the camera specifically. It also carries facing
direction: `getSpawnWorldYaw()` reads the node's Y-axis rotation and the
player camera spawns facing that direction. Shape is purely cosmetic in the
DCC tool (Plain Axes, Arrows, a cylinder — whatever's easiest to aim) and has
no effect on export; only position and rotation matter.

## Avatar spawn point

A second, optional named node (`RoomConfig.avatarSpawnNode`) marks where the
mentor avatar stands, same convention as the player's spawn node. Omit it and
`main.ts` falls back to a fixed offset in front of the player spawn instead —
fine for the primitive capsule stand-in, but a real placement is worth
authoring once there's a real avatar GLB.

Unlike the player spawn, this node's position is used **as-authored**, not
run through `snapToFloor()` — that function always raycasts straight down
and overrides Y with the nearest floor collider below, which is correct for
the player (never trap the camera in a slightly-embedded empty) but would
silently cancel out any deliberate height on this node (a raised platform,
etc.). `main.ts` separately measures the avatar's actual mesh hierarchy
bounding box after positioning and nudges Y so his feet sit exactly on that
authored height — correcting for the avatar model's own local origin not
necessarily being exactly at foot level, without re-clamping him to the
floor the way `snapToFloor` would.

## Room-scale camera: WASD + gravity, not an orbit

`packages/client/src/scene/playerCamera.ts` is a first-person `UniversalCamera`
(WASD + mouse-look + real gravity/ellipsoid collision), ported from
`knightsrook-garage/src/garage/camera.js`. An orbiting `ArcRotateCamera` was
tried first and is the wrong tool for this: its `checkCollisions` only
guards the panned target, not the eye position derived from radius/zoom, so
it doesn't stop the camera clipping through geometry the way a real
walkthrough needs.

## Collision meshes

`markRoomMeshesCollidable()` in `roomConvention.ts` decides which room
meshes become solid (`scene.collisionsEnabled` + `mesh.checkCollisions`),
ported from garage's keyword whitelist/blacklist
(`knightsrook-garage/src/garage/unityGarageLoader.js`) with one addition
garage's convention has no answer for: a generic Sketchfab import's meshes
are usually named `Object_0`, `Object_1`, ... — the whitelist matches
nothing. In that case meshes above a size threshold (currently 1.5m
bounding-box diagonal) are used instead, so small decorative/overlapping
parts (buttons, cable runs, panel details) don't end up solid and wedge the
player between colliders. Whitelist matches and the size fallback are
additive, not either/or.

Naming keywords (case-insensitive substring match on the mesh name):

- **Whitelist** — `wall`, `floor`, `pillar`, `column`, `door`, `collider`,
  `barrier`, `base`. Name a purpose-built collision proxy with `collider` in
  it (e.g. `FloorCollider`) to use a smooth stand-in for collision instead of
  a highly-detailed visual mesh that's awkward to collide against directly.
- **Blacklist** (wins over everything, including the size fallback) —
  `decal`, `paint`, `mark`, `line`, `stripe`, `arrow`, `logo`, `sign`,
  `label`, `text`, `nocollide`. Put `nocollide` in a mesh's name to exclude
  it explicitly regardless of size — e.g. the detailed visual floor being
  replaced by a `FloorCollider` proxy for actual collision.
