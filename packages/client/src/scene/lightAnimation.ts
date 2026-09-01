import { PBRMaterial } from "@babylonjs/core"
import type { Mesh, Scene } from "@babylonjs/core"

/**
 * Subtle sine-wave pulse on every material that already has a real emissive
 * value (the room's blue strip lights, teal glow panels, green terminal —
 * whatever the artist actually lit up), rather than a name-keyword
 * convention like markRoomMeshesCollidable's — emissive intensity is a real
 * structural signal already on the material, no guessing needed. Same
 * technique knightsrook-garage/src/garage/unityStationSetup.js uses for its
 * activity-disc pulse (sine wave via scene.registerBeforeRender, phase
 * randomized per instance so lights don't all pulse in lockstep) — that
 * code is UI-disc-specific, not reusable as-is, but the idiom is worth
 * matching rather than inventing a different animation approach.
 *
 * Confirmed by inspecting the raw glTF: this room has no actual light
 * nodes (no KHR_lights_punctual) — every strip/panel/terminal that reads
 * as "lit" is just a material with emissiveFactor + KHR_materials_
 * emissive_strength, not a real illumination source. Nothing else to
 * target for a "lights" effect; pulsing these materials' intensity IS the
 * whole effect.
 */
export function animateEmissiveLights(scene: Scene, meshes: Mesh[]): void {
  const seen = new Set<PBRMaterial>()

  for (const mesh of meshes) {
    const material = mesh.material
    if (!(material instanceof PBRMaterial)) continue
    if (seen.has(material)) continue
    if (material.emissiveColor.equalsFloats(0, 0, 0)) continue
    seen.add(material)
  }

  for (const material of seen) {
    const baseIntensity = material.emissiveIntensity || 1
    let time = Math.random() * Math.PI * 2
    const speed = 1.2 + Math.random() * 0.6
    const depth = 0.15 // +/-15% intensity swing — subtle, not a strobe

    scene.onBeforeRenderObservable.add(() => {
      const deltaSeconds = scene.getEngine().getDeltaTime() / 1000
      time += speed * deltaSeconds
      material.emissiveIntensity = baseIntensity * (1 + Math.sin(time) * depth)
    })
  }

  console.info(`[lightAnimation] pulsing ${seen.size} emissive material(s).`)
}
