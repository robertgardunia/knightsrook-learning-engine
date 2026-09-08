import { UniversalCamera, Vector3 } from "@babylonjs/core"
import type { Scene } from "@babylonjs/core"

/**
 * Ported near-verbatim from knightsrook-garage/src/garage/camera.js's
 * setupCamera — WASD + mouse-look UniversalCamera with real gravity/ellipsoid
 * collision, not an orbiting ArcRotateCamera. The garage version already
 * solved "walk a learner through a 3D room without clipping through walls";
 * an ArcRotateCamera's checkCollisions only guards its panned target, not
 * the eye position derived from radius/zoom, so it was the wrong camera
 * type for this from the start. Position is parameterized (the room's own
 * spawn point) instead of garage's hardcoded coordinates — everything else
 * (speed, sensibility, inertia, fov, ellipsoid) matches garage's tuned
 * values, since those numbers were already dialed in there. NOT ported:
 * garage's `camera.inputs.attached.mouse.invertY = true` — that property
 * doesn't exist on Babylon 7's FreeCameraMouseInput at all (checked the
 * type defs), so it's a silent no-op there (garage is plain JS, so nothing
 * ever caught it); porting a dead line seemed worse than dropping it.
 *
 * One divergence from garage: garage's camera spawn coordinate IS the eye
 * position directly (its hardcoded (2.81, 1.87, -3.54) bakes in eye height
 * — no separate floor-vs-eye convention there). This project's spawn nodes
 * are floor-level by convention (see room-convention.md — the avatar's
 * root sits there too, with its own body/head offset upward from it), so
 * the camera needs its own eye-height offset added on top of that floor
 * point at spawn time. That's the only divergence — applyGravity, ellipsoid,
 * and everything else matches garage exactly.
 *
 * A previous version of this file locked Y with a manual
 * onBeforeRenderObservable override instead of applyGravity, reasoning that
 * a flat room with no ramps/steps shouldn't need gravity recomputing a
 * constant every frame. That turned out to actively fight Babylon's own
 * collision resolution — forcing Y outside of collision's own update cycle
 * left the camera's position and the collision system disagreeing about
 * where it actually was, which surfaced as walking straight through the
 * avatar's collider and then getting stuck (2026-09-07). Garage's collision
 * has always worked correctly with applyGravity=true and no manual override;
 * matching that exactly rather than re-inventing height handling.
 */
const ELLIPSOID = new Vector3(0.45, 0.81, 0.45)
const EYE_HEIGHT = 1.7

export function setupPlayerCamera(
  scene: Scene,
  canvas: HTMLCanvasElement,
  floorSpawnPosition: Vector3,
  spawnYaw = 0,
): UniversalCamera {
  const fixedEyeY = floorSpawnPosition.y + EYE_HEIGHT
  const eyePosition = new Vector3(floorSpawnPosition.x, fixedEyeY, floorSpawnPosition.z)
  const camera = new UniversalCamera("playerCamera", eyePosition, scene)
  camera.rotation = new Vector3(0, spawnYaw, 0)
  camera.attachControl(canvas, true)

  camera.keysUp = [87] // W
  camera.keysDown = [83] // S
  camera.keysLeft = [65] // A
  camera.keysRight = [68] // D

  camera.speed = 0.09
  camera.angularSensibility = 10000
  camera.inertia = 0.92
  camera.fov = 0.9
  camera.minZ = 0.1
  camera.maxZ = 5000

  camera.checkCollisions = true
  camera.applyGravity = true
  camera.ellipsoid = ELLIPSOID.clone()

  canvas.addEventListener("click", () => {
    canvas.requestPointerLock?.()
  })

  return camera
}
