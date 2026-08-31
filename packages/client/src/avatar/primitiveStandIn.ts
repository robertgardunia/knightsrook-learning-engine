import { Color3, MeshBuilder, Scene, StandardMaterial, TransformNode } from "@babylonjs/core"

import type { AnimationSlots } from "@learning-engine/shared-types"

/**
 * NEW (per spec). First-class fallback, not a placeholder awaiting rescue: an
 * environment must be assemblable and demonstrable before any character GLB
 * exists. Capsule body + sphere head, procedural idle/talk/gesture driven by
 * simple transforms rather than skeletal animation clips.
 */
export class PrimitiveStandIn {
  readonly root: TransformNode
  private talking = false

  constructor(scene: Scene, name: string) {
    this.root = new TransformNode(`${name}-root`, scene)

    const body = MeshBuilder.CreateCapsule(`${name}-body`, { height: 1.6, radius: 0.3 }, scene)
    body.position.y = 0.8
    body.parent = this.root

    const head = MeshBuilder.CreateSphere(`${name}-head`, { diameter: 0.4 }, scene)
    head.position.y = 1.75
    head.parent = this.root

    const material = new StandardMaterial(`${name}-mat`, scene)
    material.diffuseColor = new Color3(0.6, 0.6, 0.65)
    body.material = material
    head.material = material

    scene.onBeforeRenderObservable.add(() => {
      if (!this.talking) return
      const t = performance.now() / 150
      head.position.y = 1.75 + Math.sin(t) * 0.02
    })
  }

  async playSlot(slot: keyof AnimationSlots): Promise<void> {
    this.talking = slot === "talk" || slot === "explain"
    // TODO: greet/point gestures — simple rotation/translation tweens once the
    // real interaction UX is designed. idle/talk cover the MVP demo need.
  }
}
