import { AnimationGroup, SceneLoader, TransformNode, type Mesh, type Scene } from "@babylonjs/core"

import type { AnimationSlots } from "@learning-engine/shared-types"

import { correctCCMaterials } from "./ccMaterialCorrection"

/**
 * Real GLB-backed mentor avatar — the CC5-exported counterpart to
 * PrimitiveStandIn. AnimationSlots are exact clip indices into the GLB's own
 * baked animationGroups (see shared-types course-package.ts), not filenames —
 * course authors pick indices once in Character Creator's timeline, no
 * name-matching heuristics at runtime.
 *
 * A separate animationMixer.ts exists for clips that DON'T come baked into
 * this GLB (an external ActorCore library animation retargeted onto this
 * same rig) — e.g. future per-station "doing things" idles. This controller
 * only plays what's already in the character's own file.
 */
export class AvatarController {
  readonly root: TransformNode
  private readonly animationGroups: AnimationGroup[]
  private readonly slots: AnimationSlots
  private readonly defaultSpeedRatio: number
  private readonly speedRatios: Partial<Record<keyof AnimationSlots, number>>
  private currentGroup: AnimationGroup | null = null

  private constructor(
    root: TransformNode,
    animationGroups: AnimationGroup[],
    slots: AnimationSlots,
    defaultSpeedRatio: number,
    speedRatios: Partial<Record<keyof AnimationSlots, number>>,
  ) {
    this.root = root
    this.animationGroups = animationGroups
    this.slots = slots
    this.defaultSpeedRatio = defaultSpeedRatio
    this.speedRatios = speedRatios
  }

  static async create(
    scene: Scene,
    glbUrl: string,
    slots: AnimationSlots,
    onProgress?: (loaded: number, total?: number) => void,
    options: { animationSpeedRatio?: number; animationSpeedRatios?: Partial<Record<keyof AnimationSlots, number>> } = {},
  ): Promise<AvatarController> {
    const url = new URL(glbUrl, window.location.origin)
    const dir = url.pathname.slice(0, url.pathname.lastIndexOf("/") + 1)
    const file = url.pathname.slice(url.pathname.lastIndexOf("/") + 1)

    const result = await SceneLoader.ImportMeshAsync("", dir, file, scene, (event) => {
      onProgress?.(event.loaded, event.total || undefined)
    })
    correctCCMaterials(result.meshes)

    const root = (result.meshes[0] as Mesh) ?? new TransformNode("avatar-root", scene)
    const animationGroups = result.animationGroups ?? []

    // Hidden until the idle slot's first animated frame renders — no bind
    // pose flash (see animationMixer.ts / garage's characterLoader.js for
    // the same guarantee on retargeted clips).
    result.meshes.forEach((m) => (m.isVisible = false))

    const avatar = new AvatarController(
      root,
      animationGroups,
      slots,
      options.animationSpeedRatio ?? 1.0,
      options.animationSpeedRatios ?? {},
    )
    await avatar.playSlot("idle")
    result.meshes.forEach((m) => (m.isVisible = true))

    return avatar
  }

  async playSlot(slot: keyof AnimationSlots): Promise<void> {
    const index = this.slots[slot]
    const group = this.animationGroups[index]
    if (!group) {
      console.warn(`[avatar] no animation group at index ${index} for slot "${slot}"`)
      return
    }
    if (group === this.currentGroup) return

    this.currentGroup?.stop()
    const speedRatio = this.speedRatios[slot] ?? this.defaultSpeedRatio
    // Babylon's glTF loader auto-starts baked animation groups on import at
    // speedRatio 1 — by the time this runs, the group may already be
    // _isStarted, which makes start()'s speedRatio argument a silent no-op
    // (it early-returns without reading it at all). The property setter
    // works regardless of started state, so set it explicitly rather than
    // trusting start()'s parameter.
    if (!group.isPlaying) group.start(true, speedRatio)
    group.speedRatio = speedRatio
    // CC bakes a bind-pose reference frame at 0 — skip past it.
    group.goToFrame(group.from + 1)
    this.currentGroup = group
  }
}
