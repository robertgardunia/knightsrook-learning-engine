import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline"
import { SSAO2RenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline.js"
import type { Scene } from "@babylonjs/core"

import { setupDepthAwareGlow, type DepthAwareGlow } from "./depthAwareGlow"

/**
 * Ported near-verbatim from knightsrook-garage/src/garage/lighting.js's
 * setupPostProcessing (the HDR variant, not the non-HDR one in the same
 * file used by the main garage scene for a different reason — this one is
 * the fully generic, room-agnostic version with no garage-specific
 * geometry, unlike setupLighting()'s sun/shop-fixture rig which is tuned
 * to the garage's actual layout and isn't a good candidate for blind
 * reuse here).
 */
export interface PostProcessingResult {
  pipeline: DefaultRenderingPipeline
  glow: DepthAwareGlow
  ssao: SSAO2RenderingPipeline | null
}

export function setupPostProcessing(scene: Scene): PostProcessingResult {
  const pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, scene.cameras)

  pipeline.fxaaEnabled = true
  pipeline.imageProcessingEnabled = true
  pipeline.imageProcessing.contrast = 1.08
  pipeline.imageProcessing.exposure = 1.0
  pipeline.imageProcessing.toneMappingEnabled = true
  pipeline.imageProcessing.toneMappingType = 1 // ACES

  // Depth-aware bloom glow (replaces GlowLayer)
  const glow = setupDepthAwareGlow(scene, pipeline, {
    threshold: 0.82,
    weight: 0.08,
    kernel: 48,
    scale: 0.5,
  })

  pipeline.chromaticAberrationEnabled = false

  pipeline.grainEnabled = true
  pipeline.grain.intensity = 5
  pipeline.grain.animated = true

  pipeline.depthOfFieldEnabled = false
  pipeline.samples = 8

  // SSAO2 — darkens corners/crevices so adjacent white surfaces are
  // distinguishable. Room-agnostic (no garage-specific maxZ tuning needed
  // for a single-room scene the way garage caps it against its exterior
  // vista geometry).
  let ssao: SSAO2RenderingPipeline | null = null
  try {
    ssao = new SSAO2RenderingPipeline("ssao2", scene, { ssaoRatio: 0.5, blurRatio: 1.0 }, scene.cameras, true)
    ssao.radius = 0.48
    ssao.totalStrength = 0.18
    ssao.base = 0.08
    ssao.maxZ = 100
    ssao.minZAspect = 0.2
  } catch (e) {
    console.warn("[postProcessing] SSAO2 init failed:", e)
  }

  scene.metadata = scene.metadata ?? {}
  scene.metadata.renderPipeline = pipeline
  scene.metadata.glow = glow
  scene.metadata.ssao = ssao

  return { pipeline, glow, ssao }
}
