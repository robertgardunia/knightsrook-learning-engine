import type { DefaultRenderingPipeline, Scene } from "@babylonjs/core"

/**
 * Ported near-verbatim from knightsrook-garage/src/utils/depthAwareGlow.js.
 *
 * Drop-in replacement for Babylon's GlowLayer that respects scene depth.
 * The standard GlowLayer renders emissive meshes in a separate pass that
 * ignores occlusion, causing glow to bleed through walls and geometry.
 * This configures the DefaultRenderingPipeline's bloom instead, which
 * operates on the final rendered image — since that image already has
 * correct depth/occlusion, bloom only affects pixels actually visible.
 *
 * For meshes that should glow, set a high emissive value; bloomThreshold
 * controls which pixels are bright enough to bloom.
 */
export interface DepthAwareGlow {
  enabled: boolean
  threshold: number
  weight: number
  kernel: number
  scale: number
}

export interface DepthAwareGlowOptions {
  threshold?: number
  weight?: number
  kernel?: number
  scale?: number
}

export function setupDepthAwareGlow(
  scene: Scene,
  pipeline: DefaultRenderingPipeline,
  opts: DepthAwareGlowOptions = {},
): DepthAwareGlow {
  const { threshold = 0.8, weight = 0.15, kernel = 48, scale = 0.5 } = opts

  pipeline.bloomEnabled = true
  pipeline.bloomThreshold = threshold
  pipeline.bloomWeight = weight
  pipeline.bloomKernel = kernel
  pipeline.bloomScale = scale

  scene.metadata = scene.metadata ?? {}
  scene.metadata.depthAwareGlow = true

  return {
    get enabled() {
      return pipeline.bloomEnabled
    },
    set enabled(v: boolean) {
      pipeline.bloomEnabled = v
    },
    get threshold() {
      return pipeline.bloomThreshold
    },
    set threshold(v: number) {
      pipeline.bloomThreshold = v
    },
    get weight() {
      return pipeline.bloomWeight
    },
    set weight(v: number) {
      pipeline.bloomWeight = v
    },
    get kernel() {
      return pipeline.bloomKernel
    },
    set kernel(v: number) {
      pipeline.bloomKernel = v
    },
    get scale() {
      return pipeline.bloomScale
    },
    set scale(v: number) {
      pipeline.bloomScale = v
    },
  }
}
