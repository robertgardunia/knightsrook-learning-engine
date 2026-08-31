import { Color3, type AbstractMesh } from "@babylonjs/core"

/**
 * Per-mesh visibility ramp + emissive wash, ported conceptually from the
 * garage's arrival transition (marked WRITTEN, reusable, in the spec).
 *
 * Three gotchas the spec calls out explicitly — preserved here:
 * (a) transparencyMode must be forced to ALPHABLEND (2) during the ramp and
 *     restored in a `finally`, because cc4Materials.js forces eye/cornea
 *     OPAQUE (0) or they vanish while fading.
 * (b) emissive must be captured and lerped, never assigned outright, because
 *     cc4Materials.js zeroes emissiveColor at runtime.
 * (c) this is a POST-load transition — call it only after the character's
 *     bytes are fully loaded and out of loadProgress's shared denominator, or
 *     the progress needle runs backward mid-load.
 */
export async function playArrivalTransition(meshes: AbstractMesh[], durationMs = 800): Promise<void> {
  const originalTransparency = new Map<AbstractMesh, number>()
  const originalEmissive = new Map<AbstractMesh, Color3>()

  try {
    for (const mesh of meshes) {
      const mat = mesh.material as { transparencyMode?: number; emissiveColor?: Color3 } | null
      if (!mat) continue
      if (mat.transparencyMode !== undefined) {
        originalTransparency.set(mesh, mat.transparencyMode)
        mat.transparencyMode = 2 // ALPHABLEND
      }
      if (mat.emissiveColor) {
        originalEmissive.set(mesh, mat.emissiveColor.clone())
      }
      mesh.visibility = 0
    }

    const steps = 30
    const stepMs = durationMs / steps
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      for (const mesh of meshes) {
        mesh.visibility = t
        const mat = mesh.material as { emissiveColor?: Color3 } | null
        const original = originalEmissive.get(mesh)
        if (mat?.emissiveColor && original) {
          // lerp toward original — never assign outright (see gotcha b)
          Color3.LerpToRef(new Color3(1, 1, 1), original, t, mat.emissiveColor)
        }
      }
      await new Promise((resolve) => setTimeout(resolve, stepMs))
    }
  } finally {
    for (const mesh of meshes) {
      const mat = mesh.material as { transparencyMode?: number } | null
      const original = originalTransparency.get(mesh)
      if (mat && original !== undefined) mat.transparencyMode = original
      mesh.visibility = 1
    }
  }
}
