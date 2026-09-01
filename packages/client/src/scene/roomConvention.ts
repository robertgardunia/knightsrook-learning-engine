import { Mesh, Quaternion, Ray, TransformNode, Vector3 } from "@babylonjs/core"
import type { Scene } from "@babylonjs/core"

/**
 * Only meshes with "collider" in the name are ever collidable. No
 * whitelist-by-other-keywords, no size-threshold fallback — those were
 * heuristics stacked on top of garage's keyword-whitelist pattern to guess
 * at collision for generically-named Sketchfab meshes, and in practice
 * they kept guessing wrong on this room (wedged the player between
 * overlapping decorative parts, then didn't fix it once a floor proxy was
 * added because other large meshes were still auto-included). Explicit
 * beats guessed: author a purpose-built proxy mesh (e.g. `FloorCollider`,
 * `WallCollider`) for anything that should be solid, name it with
 * "collider" in it, and only that mesh becomes collidable. Nothing is
 * collidable by default.
 *
 * A collider mesh is a collision-only proxy by definition — it's never
 * meant to render, so it's hidden automatically here rather than requiring
 * a separate "mark this invisible" step in the DCC tool on top of naming it.
 */
export function markRoomMeshesCollidable(scene: Scene, meshes: Mesh[]): void {
  scene.collisionsEnabled = true

  const collidable = meshes.filter((m) => m.name.toLowerCase().includes("collider"))
  for (const mesh of collidable) {
    mesh.checkCollisions = true
    mesh.isVisible = false
  }

  console.info(
    `[roomConvention] ${collidable.length}/${meshes.length} room meshes marked collidable ` +
      `(name contains "collider"): ${collidable.map((m) => m.name).join(", ") || "(none)"}`,
  )
}

/**
 * NEW (per spec). Every downloaded room GLB has a different scale, origin, and
 * lighting rig; without a spawn-node convention, each new room costs an hour of
 * manual nudging — spec calls this "most likely silent tax on the assembly
 * number." The contract: every room GLB must contain an empty/transform node
 * named per RoomConfig.spawnNode. This module finds it and auto-frames from it.
 *
 * In practice (confirmed against the first real room GLB, a Sketchfab
 * download): most downloaded assets do NOT have this node, and re-exporting
 * every Sketchfab find just to add an empty is exactly the "hour of manual
 * nudging" this convention exists to avoid. So this throws only when there is
 * no way to frame the room at all; findOrSynthesizeSpawnNode below is the
 * normal path and logs loudly (not silently) when it falls back.
 */
export function findSpawnNode(scene: Scene, spawnNodeName: string): TransformNode {
  const node = scene.getTransformNodeByName(spawnNodeName)
  if (!node) {
    throw new Error(
      `Room GLB is missing the required spawn node "${spawnNodeName}" — ` +
        `see docs/architecture/room-convention.md`,
    )
  }
  return node
}

/**
 * Looks for the named spawn node; if absent, synthesizes one from the room's
 * bounding box center so an un-authored (e.g. straight-from-Sketchfab) GLB is
 * still viewable. Logs a warning either way it falls back, per the
 * room-convention doc's "never silently default" rule — the difference from
 * the old stub is that this is now a real, working fallback, not a missing
 * feature.
 */
export function findOrSynthesizeSpawnNode(scene: Scene, spawnNodeName: string, meshes: Mesh[]): TransformNode {
  const node = scene.getTransformNodeByName(spawnNodeName)
  if (node) return node

  console.warn(
    `Room GLB has no "${spawnNodeName}" node — synthesizing a spawn point from ` +
      `the room's bounding box center. Re-export with a real spawn node when ` +
      `possible; see docs/architecture/room-convention.md.`,
  )

  const bounds = computeSceneBounds(meshes)
  const synthesized = new TransformNode(spawnNodeName, scene)
  synthesized.position = Vector3.Center(bounds.min, bounds.max)
  return synthesized
}

/**
 * spawnNode.position is LOCAL to its parent. A spawn node properly authored
 * inside the room's own hierarchy (as it should be) needs its parent chain's
 * transform applied to get an actual world-space point to place the camera
 * or avatar at — using .position directly here silently placed things
 * wrong for any spawn node with a real parent (it only ever looked right
 * for the degenerate case of an unparented node, where local == world).
 */
export function getSpawnWorldPosition(spawnNode: TransformNode): Vector3 {
  spawnNode.computeWorldMatrix(true)
  return spawnNode.getAbsolutePosition().clone()
}

/**
 * Snaps a spawn point's Y to the actual collidable floor surface directly
 * beneath it via a downward raycast, rather than trusting the authored
 * empty's Y to be pixel-perfectly on the floor. Standard game-engine
 * pattern for spawn points, and not a one-off fix: a spawn empty placed
 * even slightly below the true floor surface embeds the camera's collision
 * ellipsoid in the floor mesh, which can both misreport height (observed:
 * spawns low, "steps up" to the correct height on the first move as the
 * player's ellipsoid pushes free of the overlap) and in worse cases lock
 * movement up entirely if the overlap is severe enough. Must run AFTER
 * markRoomMeshesCollidable — it only raycasts against meshes already
 * marked checkCollisions, so it snaps to the same surface the player will
 * actually stand on, not just the nearest visible mesh.
 *
 * Falls back to the raycast's origin height (no snap) if nothing collidable
 * is hit within range — e.g. a room with no floor collider at all yet.
 */
export function snapToFloor(scene: Scene, position: Vector3, maxDropMeters = 5): Vector3 {
  const origin = position.clone()
  origin.y += 0.5 // start slightly above, in case the raw position is already at/under the floor
  const ray = new Ray(origin, new Vector3(0, -1, 0), maxDropMeters + 0.5)
  const hit = scene.pickWithRay(ray, (m) => m.isPickable !== false && (m as Mesh).checkCollisions === true)

  if (!hit?.hit || !hit.pickedPoint) {
    console.warn(
      `[roomConvention] snapToFloor found no collidable mesh below (${position.x.toFixed(1)}, ` +
        `${position.y.toFixed(1)}, ${position.z.toFixed(1)}) — using the spawn node's raw Y instead.`,
    )
    return position
  }

  return new Vector3(position.x, hit.pickedPoint.y, position.z)
}

/**
 * World-space yaw (rotation around Y, i.e. which way the empty is facing
 * when viewed from above) baked into the spawn node — same "read the whole
 * parent chain's transform, not just the node's own local values" concern
 * as getSpawnWorldPosition. Only yaw, not full 3D orientation: the player
 * camera only has a facing direction, not a roll/pitch a level designer
 * would set on a spawn point.
 */
export function getSpawnWorldYaw(spawnNode: TransformNode): number {
  spawnNode.computeWorldMatrix(true)
  const rotationQuaternion = new Quaternion()
  spawnNode.getWorldMatrix().decompose(undefined, rotationQuaternion, undefined)
  // +PI: an empty's authored "forward" axis and Babylon's camera-forward
  // (+Z at rotation.y = 0) are opposite by convention — confirmed by
  // observed 180-degree-off facing direction, not derived from spec.
  return rotationQuaternion.toEulerAngles().y + Math.PI
}

function computeSceneBounds(meshes: Mesh[]): { min: Vector3; max: Vector3 } {
  let min = new Vector3(Infinity, Infinity, Infinity)
  let max = new Vector3(-Infinity, -Infinity, -Infinity)

  for (const mesh of meshes) {
    const info = mesh.getBoundingInfo()
    min = Vector3.Minimize(min, info.boundingBox.minimumWorld)
    max = Vector3.Maximize(max, info.boundingBox.maximumWorld)
  }

  if (!isFinite(min.x)) {
    min = Vector3.Zero()
    max = Vector3.Zero()
  }

  return { min, max }
}
