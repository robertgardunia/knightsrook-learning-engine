import type { Camera, Mesh, Scene, TransformNode } from "@babylonjs/core"

/**
 * NEW (per spec). Every downloaded room GLB has a different scale, origin, and
 * lighting rig; without a spawn-node convention, each new room costs an hour of
 * manual nudging — spec calls this "most likely silent tax on the assembly
 * number." The contract: every room GLB must contain an empty/transform node
 * named per RoomConfig.spawnNode. This module finds it and auto-frames from it.
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

/** Auto-frame pass: positions the active camera relative to the spawn node. */
export function autoFrameFromSpawn(camera: Camera, spawnNode: TransformNode, meshes: Mesh[]): void {
  // TODO: compute a bounding-box-aware frame once the first real room GLB lands.
  // Placeholder keeps the contract explicit without guessing at camera math
  // against zero real assets.
  void camera
  void spawnNode
  void meshes
}
