import { AnimationGroup, SceneLoader, TransformNode, type AbstractMesh, type Mesh, type Scene } from "@babylonjs/core"

import type { AnimationSlots } from "@learning-engine/shared-types"

import { applyAnimation, buildCharNodes } from "./animationMixer"
import { correctCCMaterials } from "./ccMaterialCorrection"
import { DEFAULT_VISEME_MAP, DEFAULT_VISEME_TIMING, initVisemeController } from "./visemeController"

const ANIM_BASE = "/assets/animations/actorcore/"

/**
 * GLB-backed mentor avatar. Mesh + skeleton + morph targets only — no
 * animations baked in. All clips are retargeted at runtime from the actorcore
 * library via animationMixer.ts, matching garage's bodyAnimFile/bodyTalkFiles
 * pattern. AnimationSlots holds filenames, not indices.
 */
export class AvatarController {
  readonly root: TransformNode
  private readonly slots: AnimationSlots
  private readonly scene: Scene
  private readonly charResult: Parameters<typeof applyAnimation>[1]
  private currentGroup: AnimationGroup | null = null

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

  async playSlot(slot: keyof AnimationSlots): Promise<void> {
    const entry = this.slots[slot]
    if (!entry) return

    // For talk, pick a random file if an array is provided — matches garage's
    // random talk clip selection in animationLoop.js.
    const file = Array.isArray(entry) ? entry[Math.floor(Math.random() * entry.length)] : entry

    if (this.currentGroup) {
      try { this.currentGroup.stop() } catch { /* ok */ }
      this.currentGroup = null
    }

    const group = await applyAnimation(
      ANIM_BASE + file,
      this.charResult,
      `avatar_${slot}`,
      this.scene,
      { loop: slot === "idle", filterRootMotion: true, noHide: true },
    )

    if (group) this.currentGroup = group
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
