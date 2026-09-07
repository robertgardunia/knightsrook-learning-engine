import type { AbstractMesh } from "@babylonjs/core"

/**
 * Corrects material properties that Blender's glTF exporter gets wrong for
 * Character Creator (CC3+/CC4/CC5) exports: it forces every material to
 * OPAQUE regardless of source blend mode, so hair/scalp/eyelash/cornea
 * render as solid cards instead of alpha-cut or alpha-blended.
 *
 * Ported from knightsrook-garage/src/utils/cc4Materials.js. Garage's version
 * also carried one specific character's ("Curry") UV-offset hacks — dropped
 * here as genuinely one-off, not a CC-export quirk.
 */
export function correctCCMaterials(meshes: AbstractMesh[]): void {
  const seen = new Set<unknown>()
  for (const mesh of meshes) {
    const mat = mesh.material as any
    if (!mat || seen.has(mat)) continue
    seen.add(mat)

    const name = (mat.name || "").toLowerCase()

    // "clap" = CC's hair-cap base mesh — needs BLEND not ALPHATEST (alpha never reaches 255)
    const isHair = /hair|strand|bang|fringe|pony|bun|lock/i.test(name) && !/clap/i.test(name)
    const isScalp = /scalp/i.test(name)
    const needsBlend =
      isScalp ||
      name.includes("eyelash") ||
      name.includes("tearline") ||
      name.includes("transparency") ||
      name.includes("occlusion") ||
      name.includes("cornea")

    if (isHair) {
      mat.transparencyMode = 1 // ALPHATEST — no depth-sort issues; MSAA smooths edges
      mat.alphaCutOff = 0.25
      mat.backFaceCulling = false
      mat.needDepthPrePass = false
      mat.separateCullingPass = false
    } else if (needsBlend) {
      mat.transparencyMode = 2 // ALPHABLEND — scalp/eyelash/tearline need soft alpha blend
      mat.backFaceCulling = false
      mat.needDepthPrePass = false
      mat.separateCullingPass = true
    } else {
      mat.transparencyMode = 0 // OPAQUE
    }

    // roughness=1.0 on everything, hair included — CC bakes specular into the
    // albedo map, not a PBR roughness workflow.
    if (mat.metallic !== undefined) mat.metallic = 0
    if (mat.roughness !== undefined) mat.roughness = 1.0
    if (mat.metallicF0Factor !== undefined) mat.metallicF0Factor = 0
    if (mat.emissiveColor) mat.emissiveColor.set(0, 0, 0)

    // Sclera renders too stark/bright white under this scene's lighting —
    // the texture and material are otherwise untinted (no baseColorFactor),
    // so the raw texture brightness comes through at full strength. A slight
    // tint reads as a natural off-white instead.
    if (name === "sclera" && mat.albedoColor) {
      mat.albedoColor.set(0.85, 0.82, 0.8)
    }

    // NOTE: previously forced clothing double-sided here to test whether a
    // visible "hole" near the armpit/shoulder was just a culled backface.
    // Reverted — suspect it was actually causing a different artifact: with
    // backface culling off, an overlapping/self-intersecting fold in the
    // conformed cloth mesh (invisible in CC5, which only ever renders front
    // faces) exposes its own inner surface, flatly lit and wrong-shaded.
    // See project:learning-demo:spec for the investigation.
  }
}
