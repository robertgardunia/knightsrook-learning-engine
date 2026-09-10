import { AnimationGroup, SceneLoader, TransformNode, type AbstractMesh, type Mesh, type Scene } from "@babylonjs/core"

import type { AnimationSlots } from "@learning-engine/shared-types"

import { applyAnimation, buildCharNodes, type ApplyAnimationOptions, type BoneGroup } from "./animationMixer"
import { correctCCMaterials } from "./ccMaterialCorrection"
import { DEFAULT_VISEME_MAP, DEFAULT_VISEME_TIMING, initVisemeController } from "./visemeController"

const ANIM_BASE = "/assets/animations/actorcore/"

/**
 * Per-layer options for layered animation playback. Extends the core
 * ApplyAnimationOptions with layer-specific concerns.
 */
export interface LayerPlayOptions {
  /** Which bone group this layer drives. "full" = whole skeleton (base layer). */
  boneGroup?: BoneGroup
  /** Mirror L↔R at retarget time — no separate mirrored GLB needed. */
  mirrorX?: boolean
  /** Loop the clip. Defaults to false for overlay layers, true for base. */
  loop?: boolean
  /** Animation playback speed. */
  speedRatio?: number
  /** Cross-fade duration in ms. 0 = instant cut. */
  fadeDuration?: number
  /** Additional bones to exclude (legacy seam-reduction filter). */
  filterBones?: string[]
}

/**
 * GLB-backed mentor avatar. Mesh + skeleton + morph targets only — no
 * animations baked in. All clips are retargeted at runtime from the actorcore
 * library via animationMixer.ts, matching garage's bodyAnimFile/bodyTalkFiles
 * pattern. AnimationSlots holds filenames, not indices.
 *
 * ## Layered animation
 * Named layers run simultaneously. The "base" layer drives the whole skeleton
 * (idle/walk). Overlay layers ("upper", "arms", etc.) target a bone sub-set so
 * they only override the bones they animate — the base fills in the rest.
 * Higher-priority layers should be started after the base so Babylon evaluates
 * them last and their values win.
 */
export class AvatarController {
  readonly root: TransformNode
  private readonly slots: AnimationSlots
  private readonly scene: Scene
  private readonly charResult: Parameters<typeof applyAnimation>[1]

  /** Named animation layers running concurrently. "base" = full-body idle/walk. */
  private layers = new Map<string, AnimationGroup>()

  // Keep currentGroup as an alias for the "base" layer for backward compat
  // with the existing crossfadeToSlot / playSlot call-sites in main.ts.
  private get currentGroup(): AnimationGroup | null {
    return this.layers.get("base") ?? null
  }
  private set currentGroup(g: AnimationGroup | null) {
    if (g) this.layers.set("base", g)
    else this.layers.delete("base")
  }

  private constructor(
    root: TransformNode,
    slots: AnimationSlots,
    scene: Scene,
    charResult: AvatarController["charResult"],
  ) {
    this.root = root
    this.slots = slots
    this.scene = scene
    this.charResult = charResult
  }

  static async create(
    scene: Scene,
    glbUrl: string,
    slots: AnimationSlots,
    onProgress?: (loaded: number, total?: number) => void,
  ): Promise<AvatarController> {
    const url = new URL(glbUrl, window.location.origin)
    const dir = url.pathname.slice(0, url.pathname.lastIndexOf("/") + 1)
    const file = url.pathname.slice(url.pathname.lastIndexOf("/") + 1)

    const result = await SceneLoader.ImportMeshAsync("", dir, file, scene, (event) => {
      onProgress?.(event.loaded, event.total || undefined)
    })
    correctCCMaterials(result.meshes)

    // Stop any animation groups baked into the GLB — we don't use them.
    result.animationGroups?.forEach((g) => { try { g.stop(); g.dispose() } catch { /* ok */ } })

    const root = (result.meshes[0] as Mesh) ?? new TransformNode("avatar-root", scene)
    result.meshes.forEach((m) => (m.isVisible = false))

    const charResult = {
      meshes: result.meshes,
      transformNodes: scene.transformNodes.filter((tn) => {
        let p = tn.parent
        while (p) { if (p === root) return true; p = p.parent }
        return false
      }),
      skeletons: (result.skeletons ?? []).filter((s): s is NonNullable<typeof s> => s != null),
    }

    initVisemeController({
      rootMesh: root as AbstractMesh,
      characterConfig: {
        visemeMeshName: null,
        visemeSetSuffix: "",
        teethSuffix: "",
        visemeOffset: 0,
        visemeTiming: DEFAULT_VISEME_TIMING,
        visemeMap: DEFAULT_VISEME_MAP,
      },
    })

    const avatar = new AvatarController(root, slots, scene, charResult)
    await avatar.playSlot("idle")
    result.meshes.forEach((m) => (m.isVisible = true))

    return avatar
  }

  /**
   * Play an animation clip on a named layer, cross-fading from whatever that
   * layer is currently playing. Layers run concurrently — an "arms" layer can
   * play a PADD-grab while the "base" layer continues the idle walk cycle.
   *
   * @param file     Path relative to /assets/animations/actorcore/
   * @param layerName  Layer identifier — "base" for full-body, or any string
   *                   for an overlay (e.g. "upper", "arms")
   * @param opts     Playback options including boneGroup, mirrorX, loop, fade
   */
  async playLayer(file: string, layerName: string, opts: LayerPlayOptions = {}): Promise<void> {
    const {
      boneGroup = "full",
      mirrorX = false,
      loop = layerName === "base",
      speedRatio = 1,
      fadeDuration = 400,
      filterBones = ["clavicle", "scapula"],
    } = opts

    const outgoing = this.layers.get(layerName) ?? null

    const applyOpts: ApplyAnimationOptions = {
      loop,
      filterRootMotion: true,
      noHide: true,
      filterBones,
      boneGroup,
      mirrorX,
      speedRatio,
    }

    const incoming = await applyAnimation(ANIM_BASE + file, this.charResult, `avatar_${layerName}`, this.scene, applyOpts)
    if (!incoming) return

    this.layers.set(layerName, incoming)

    if (fadeDuration <= 0 || !outgoing) {
      incoming.setWeightForAllAnimatables(1)
      if (outgoing) try { outgoing.stop(); outgoing.dispose() } catch { /* ok */ }
      return
    }

    incoming.setWeightForAllAnimatables(0)
    const start = performance.now()
    return new Promise((resolve) => {
      const obs = this.scene.onBeforeRenderObservable.add(() => {
        const t = Math.min(1, (performance.now() - start) / fadeDuration)
        incoming.setWeightForAllAnimatables(t)
        outgoing.setWeightForAllAnimatables(1 - t)
        if (t >= 1) {
          this.scene.onBeforeRenderObservable.remove(obs)
          try { outgoing.stop(); outgoing.dispose() } catch { /* ok */ }
          resolve()
        }
      })
    })
  }

  /**
   * Stop a named layer, optionally fading it out over `fadeDuration` ms.
   */
  stopLayer(layerName: string, fadeDuration = 0): Promise<void> {
    const group = this.layers.get(layerName)
    this.layers.delete(layerName)
    if (!group) return Promise.resolve()

    if (fadeDuration <= 0) {
      try { group.stop(); group.dispose() } catch { /* ok */ }
      return Promise.resolve()
    }

    const start = performance.now()
    const startWeight = group.animatables[0]?.weight ?? 1
    return new Promise((resolve) => {
      const obs = this.scene.onBeforeRenderObservable.add(() => {
        const t = Math.min(1, (performance.now() - start) / fadeDuration)
        group.setWeightForAllAnimatables(startWeight * (1 - t))
        if (t >= 1) {
          this.scene.onBeforeRenderObservable.remove(obs)
          try { group.stop(); group.dispose() } catch { /* ok */ }
          resolve()
        }
      })
    })
  }

  /**
   * Cross-fade from the current base animation to a new slot over `durationMs`.
   * Both groups play simultaneously; weights ramp linearly on each render frame.
   */
  async crossfadeToSlot(slot: keyof AnimationSlots, durationMs = 600): Promise<void> {
    const entry = this.slots[slot]
    if (!entry) return
    const file = Array.isArray(entry) ? entry[Math.floor(Math.random() * entry.length)] : entry

    await this.playLayer(file, "base", {
      boneGroup: "full",
      loop: slot === "idle",
      fadeDuration: durationMs,
    })
  }

  async playSlot(slot: keyof AnimationSlots): Promise<void> {
    const entry = this.slots[slot]
    if (!entry) return

    const file = Array.isArray(entry) ? entry[Math.floor(Math.random() * entry.length)] : entry

    await this.playLayer(file, "base", {
      boneGroup: "full",
      loop: slot === "idle",
      fadeDuration: 0,
    })
  }

  /**
   * Show/hide meshes by case-insensitive name substring — e.g. a hand prop
   * (tricorder) baked into the avatar GLB, parented to a hand bone in
   * Blender/CC5 rather than positioned at runtime, toggled on only when the
   * lesson actually wants him holding it.
   */
  setMeshVisible(namePattern: string, visible: boolean): void {
    const pattern = namePattern.toLowerCase()
    const matches = (this.charResult.meshes as AbstractMesh[]).filter(
      (m) => (m as AbstractMesh).name?.toLowerCase().includes(pattern),
    )
    if (matches.length === 0) {
      console.warn(`[avatar] no mesh matching "${namePattern}" to set visibility on`)
      return
    }
    matches.forEach((m) => { (m as AbstractMesh).isVisible = visible })
  }
}
