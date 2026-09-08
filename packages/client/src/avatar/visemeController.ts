/**
 * Viseme Render Controller — Lip sync morph target application.
 * Ported near-verbatim from knightsrook-garage/src/systems/avatarChatOM/
 * controllers/visemeRenderController.js (+ the morph/bone helpers it pulls
 * from boneUtils.js, inlined below since this project has no boneUtils.js
 * equivalent yet). Scoped decay: only viseme-owned morphs decay every tick,
 * so this doesn't fight micro-expression/prosody/gaze/breathing controllers
 * if/when those get ported too.
 */
import { Quaternion } from "@babylonjs/core"
import type { AbstractMesh, Bone, MorphTargetManager, TransformNode } from "@babylonjs/core"

export interface VisemeTiming {
  fadeIn: number
  fadeOut: number
  decay: number
  strength: number
  jawScale: number
  lipScale: number
  additiveMax: number
}

export interface CharacterVisemeConfig {
  visemeMeshName?: string | null
  visemeSetSuffix: string
  teethSuffix: string
  visemeOffset: number
  visemeTiming: VisemeTiming
  visemeMap: Record<string, Record<string, number>>
}

// Phoneme → CC4 ExPlus morph weight map, ported from garage's
// avatarChatOM/index.js DEFAULT_CHARACTER_CONFIG.visemeMap.
export const DEFAULT_VISEME_MAP: Record<string, Record<string, number>> = {
  AA: { V_Open: 0.64, V_Lip_Open: 0.29, V_Wide: 0.2, Jaw_Open: 0.5, Tongue_Down: 0.14, Cheek_Suck_L: 0.06, Cheek_Suck_R: 0.06 },
  AE: { V_Open: 0.64, V_Lip_Open: 0.29, V_Wide: 0.52, Jaw_Open: 0.45 },
  AH: { V_Open: 0.64, V_Lip_Open: 0.29, Jaw_Open: 0.5, Tongue_Down: 0.14 },
  AO: { V_Open: 0.25, V_Lip_Open: 0.29, V_Tight_O: 0.38, Jaw_Open: 0.4, Mouth_Pucker_Up_L: 0.04, Mouth_Pucker_Up_R: 0.04 },
  AW: { V_Open: 0.4, V_Lip_Open: 0.29, V_Wide: 0.46, Jaw_Open: 0.45, Mouth_Stretch_L: 0.22, Mouth_Stretch_R: 0.22 },
  AY: { V_Open: 0.5, V_Lip_Open: 0.29, Jaw_Open: 0.45, Tongue_Tip_Up: 0.14, V_Wide: 0.34 },
  EH: { V_Open: 0.45, V_Lip_Open: 0.29, V_Wide: 0.85, Jaw_Open: 0.4, Mouth_Shrug_Lower: 0.14 },
  ER: { V_Open: 0.3, V_Lip_Open: 0.29, V_Tight: 0.05, Jaw_Open: 0.25, Tongue_Roll: 0.18, Mouth_Tighten_L: 0.04, Mouth_Tighten_R: 0.04 },
  EY: { V_Open: 0.35, V_Lip_Open: 0.29, V_Wide: 0.85, Jaw_Open: 0.3 },
  IH: { V_Open: 0.45, V_Lip_Open: 0.29, V_Wide: 0.85, Jaw_Open: 0.3 },
  IY: { V_Open: 0.35, V_Lip_Open: 0.29, V_Wide: 1.0, Jaw_Open: 0.2, Tongue_Tip_Up: 0.21 },
  OW: { V_Open: 0.25, V_Lip_Open: 0.29, V_Tight_O: 0.38, Jaw_Open: 0.3, Mouth_Pucker_Down_L: 0.04, Mouth_Pucker_Down_R: 0.04 },
  OY: { V_Open: 0.25, V_Lip_Open: 0.29, V_Tight_O: 0.38, Jaw_Open: 0.3, Mouth_Funnel_Down_L: 0.06, Mouth_Funnel_Down_R: 0.06 },
  UH: { V_Open: 0.3, V_Lip_Open: 0.29, V_Tight_O: 0.3, Jaw_Open: 0.3 },
  UW: { V_Lip_Open: 0.29, V_Tight: 0.38, V_Tight_O: 0.33, Jaw_Open: 0.15 },
  B: { V_Lip_Open: 0.29, V_Explosive: 0.64, Jaw_Open: 0.1, Mouth_Press_L: 0.12, Mouth_Press_R: 0.12 },
  CH: { V_Open: 0.35, V_Lip_Open: 0.29, V_Affricate: 0.64, Jaw_Open: 0.4, Tongue_Tip_Up: 0.14 },
  D: { V_Open: 0.3, V_Lip_Open: 0.29, Jaw_Open: 0.2, Tongue_Tip_Up: 0.28 },
  DH: { V_Open: 0.65, V_Lip_Open: 0.29, V_Dental_Lip: 0.55, Jaw_Open: 0.25, Tongue_Out: 0.18 },
  F: { V_Open: 0.15, V_Lip_Open: 0.29, V_Dental_Lip: 1.15, Jaw_Open: 0.1, Mouth_Press_L: 0.12, Mouth_Press_R: 0.12 },
  G: { V_Open: 0.3, V_Lip_Open: 0.29, Jaw_Open: 0.2, Tongue_In: 0.21 },
  HH: { V_Open: 0.5, V_Lip_Open: 0.29, Jaw_Open: 0.5 },
  JH: { V_Open: 0.35, V_Lip_Open: 0.29, V_Affricate: 0.64, Jaw_Open: 0.3, Tongue_Tip_Up: 0.21 },
  K: { V_Open: 0.3, V_Lip_Open: 0.29, Jaw_Open: 0.2, Tongue_In: 0.28 },
  L: { V_Open: 0.3, V_Lip_Open: 0.29, V_Dental_Lip: 0.14, Jaw_Open: 0.2, Tongue_Tip_Up: 0.35 },
  M: { V_Explosive: 0.4, Jaw_Open: 0.05, Mouth_Close: 0.08 },
  N: { V_Open: 0.6, V_Lip_Open: 0.29, Jaw_Open: 0.15, Tongue_Tip_Up: 0.28 },
  NG: { V_Open: 0.6, V_Lip_Open: 0.29, V_Wide: 0.25, Jaw_Open: 0.15, Tongue_In: 0.28 },
  P: { V_Explosive: 0.28, Jaw_Open: 0.05, Mouth_Press_L: 0.12, Mouth_Press_R: 0.12 },
  R: { V_Tight: 0.06, Jaw_Open: 0.15, Tongue_Roll: 0.28, Mouth_Tighten_L: 0.06, Mouth_Tighten_R: 0.06 },
  S: { V_Affricate: 0.28, Jaw_Open: 0.1, Tongue_Narrow: 0.08 },
  SH: { V_Affricate: 0.28, Jaw_Open: 0.15, Mouth_Funnel_Up_L: 0.08, Mouth_Funnel_Up_R: 0.08 },
  T: { V_Tight: 0.06, Jaw_Open: 0.1, Tongue_Tip_Up: 0.28 },
  TH: { V_Dental_Lip: 0.2, Jaw_Open: 0.15, Tongue_Out: 0.18 },
  V: { V_Lip_Open: 0.35, Jaw_Open: 0.1, Mouth_Tighten_L: 0.06, Mouth_Tighten_R: 0.06 },
  W: { V_Tight_O: 0.06, Jaw_Open: 0.1, Mouth_Pucker_Up_L: 0.06, Mouth_Pucker_Up_R: 0.06 },
  Y: { V_Affricate: 0.21, Jaw_Open: 0.15, Tongue_Tip_Up: 0.21, V_Wide: 0.22 },
  Z: { V_Affricate: 0.28, Jaw_Open: 0.1, Tongue_Narrow: 0.08 },
  ZH: { V_Affricate: 0.28, Jaw_Open: 0.1, Mouth_Tighten_L: 0.06, Mouth_Tighten_R: 0.06, Nose_Nostril_Dilate_L: 0.49, Nose_Nostril_Dilate_R: 0.49 },
  default: { V_Open: 0, V_Wide: 0, Jaw_Open: 0, Mouth_Tighten_L: 0, Mouth_Tighten_R: 0 },
}

export const DEFAULT_VISEME_TIMING: VisemeTiming = {
  fadeIn: 0.04,
  fadeOut: 0.04,
  decay: 0.55,
  strength: 1.0,
  jawScale: 0.65,
  lipScale: 0.85,
  additiveMax: 0.85,
}

// ── boneUtils.js equivalents (inlined — no shared boneUtils module here yet) ──

interface MorphMeshEntry {
  mesh: AbstractMesh
  dict: Record<string, number>
  mgr: MorphTargetManager
}

function buildMorphDict(mesh: AbstractMesh): Record<string, number> {
  const dict: Record<string, number> = {}
  const mgr = mesh.morphTargetManager
  if (!mgr) return dict
  for (let i = 0; i < mgr.numTargets; i++) {
    dict[mgr.getTarget(i).name] = i
  }
  return dict
}

function collectMorphMeshes(rootMesh: AbstractMesh): MorphMeshEntry[] {
  const results: MorphMeshEntry[] = []
  const allMeshes = rootMesh.getChildMeshes ? rootMesh.getChildMeshes(false) : []
  const candidates = rootMesh.morphTargetManager ? [rootMesh, ...allMeshes] : allMeshes
  for (const mesh of candidates) {
    const mgr = mesh.morphTargetManager
    if (!mgr || mgr.numTargets === 0) continue
    results.push({ mesh, dict: buildMorphDict(mesh), mgr })
  }
  return results
}

function getMorphInfluence(mgr: MorphTargetManager, index: number): number {
  return mgr.getTarget(index).influence
}

function setMorphInfluence(mgr: MorphTargetManager, index: number, value: number): void {
  mgr.getTarget(index).influence = value
}

// ── Module-level state ──────────────────────────────────────────────────────

let _rootMesh: AbstractMesh | null = null
let _characterConfig: CharacterVisemeConfig | null = null

let _jawBone: TransformNode | Bone | null = null
let _jawBaseQuat: Quaternion | null = null
const JAW_AMOUNT_RAD = 0.4
const JAW_DRIVE = 0.9
const JAW_GLOBAL = 0.85
let _currentJawInfluence = 0
const JAW_SMOOTH_UP = 0.035
const JAW_SMOOTH_DOWN = 0.06

let lastVisemeUpdate = 0
const VISEME_TICK = 1 / 60

let cachedMeshes: MorphMeshEntry[] = []
let cachedVisemeMorphNames = new Set<string>()

let _lowerTeethMesh: AbstractMesh | null = null
let _lowerTeethDict: Record<string, number> | null = null
let _lowerTeethMgr: MorphTargetManager | null = null
let _lowerTeethSkeleton: unknown = null

const SKIP_DECAY = new Set(["Eye_Blink_L", "Eye_Blink_R"])

function buildVisemeMorphSet(visemeMap: Record<string, Record<string, number>> | undefined, suffix: string): Set<string> {
  const names = new Set<string>()
  if (!visemeMap) return names
  for (const visemeSet of Object.values(visemeMap)) {
    for (const morphName of Object.keys(visemeSet)) {
      names.add(morphName + suffix)
    }
  }
  return names
}

function rebuildCache(): void {
  cachedMeshes = []
  _lowerTeethMesh = null
  _lowerTeethDict = null
  _lowerTeethMgr = null
  _lowerTeethSkeleton = null

  if (_rootMesh) {
    const allMorphMeshes = collectMorphMeshes(_rootMesh)
    const cfg = _characterConfig
    const visemeMeshName = cfg?.visemeMeshName || null

    if (visemeMeshName) {
      cachedMeshes = allMorphMeshes.filter(({ mesh }) => mesh.name === visemeMeshName)
      if (cachedMeshes.length === 0) {
        console.warn(`[viseme] visemeMeshName "${visemeMeshName}" not found, falling back to all meshes`)
        cachedMeshes = allMorphMeshes
      }
    } else {
      cachedMeshes = allMorphMeshes
    }

    cachedMeshes = cachedMeshes.filter(({ mesh }) => !/upper.*teeth|Std_Upper_Teeth/i.test(mesh.name))

    const allChildren = _rootMesh.getChildMeshes ? _rootMesh.getChildMeshes(false) : []
    const LOWER_TEETH_RE = /lower.*teeth|teeth.*lower|Std_Lower_Teeth|CC_Base_Teeth02|_teeth02/i
    for (const child of allChildren) {
      const parentName = child.parent?.name || ""
      const matName = child.material?.name || ""
      if (LOWER_TEETH_RE.test(child.name) || LOWER_TEETH_RE.test(parentName) || LOWER_TEETH_RE.test(matName)) {
        _lowerTeethMesh = child
        _lowerTeethMgr = child.morphTargetManager || null
        _lowerTeethDict = _lowerTeethMgr ? buildMorphDict(child) : {}
        break
      }
    }
    if (!_lowerTeethMesh) {
      console.warn("[viseme] Lower teeth mesh not found — Jaw_Open mirroring to teeth is skipped")
    }
  }

  const cfg = _characterConfig
  const suffix = cfg?.visemeSetSuffix || ""
  cachedVisemeMorphNames = buildVisemeMorphSet(cfg?.visemeMap, suffix)

  _jawBone = null
  _jawBaseQuat = null
  if (_rootMesh) {
    const scene = _rootMesh.getScene()
    let bone: Bone | undefined
    for (const sk of scene?.skeletons || []) {
      bone = sk.bones?.find((b) => b.name === "CC_Base_JawRoot")
      if (!bone) bone = sk.bones?.find((b) => /jawroot/i.test(b.name || ""))
      if (!bone) bone = sk.bones?.find((b) => /jaw|mandible/i.test(b.name || ""))
      if (bone) break
    }
    if (bone) {
      const node = typeof bone.getTransformNode === "function" ? bone.getTransformNode() : null
      const driver = (node || bone) as TransformNode | Bone
      _jawBone = driver
      _jawBaseQuat = driver.rotationQuaternion
        ? driver.rotationQuaternion.clone()
        : Quaternion.FromEulerAngles(0, 0, 0)

      if (_lowerTeethMesh && !_lowerTeethMesh.skeleton) {
        _lowerTeethMesh.setParent(_jawBone as any)
      } else if (_lowerTeethMesh) {
        _lowerTeethSkeleton = _lowerTeethMesh.skeleton
      }
    } else {
      console.warn("[viseme] CC_Base_JawRoot not found in any scene skeleton — lower teeth will not follow jaw")
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export function initVisemeController(opts: { rootMesh: AbstractMesh; characterConfig: CharacterVisemeConfig }): void {
  _rootMesh = opts.rootMesh
  _characterConfig = opts.characterConfig
  rebuildCache()
}

export function clampVisemeMorphs(max = 0.85): void {
  for (const { mgr } of cachedMeshes) {
    for (let i = 0; i < mgr.numTargets; i++) {
      if (getMorphInfluence(mgr, i) > max) setMorphInfluence(mgr, i, max)
    }
  }
  if (_lowerTeethMgr) {
    for (let i = 0; i < _lowerTeethMgr.numTargets; i++) {
      if (getMorphInfluence(_lowerTeethMgr, i) > max) setMorphInfluence(_lowerTeethMgr, i, max)
    }
  }
}

export function resetVisemes(): void {
  if (!_rootMesh || cachedMeshes.length === 0) return

  for (const { dict, mgr } of cachedMeshes) {
    for (const morphName of cachedVisemeMorphNames) {
      if (SKIP_DECAY.has(morphName)) continue
      const index = dict[morphName]
      if (index !== undefined) setMorphInfluence(mgr, index, 0)
    }
  }

  if (_lowerTeethMgr) {
    for (let i = 0; i < _lowerTeethMgr.numTargets; i++) {
      setMorphInfluence(_lowerTeethMgr, i, 0)
    }
  }
}

export interface VisemeEventLike {
  start: number
  end: number
  value: string
}

/** Per-frame viseme render tick — call from the render loop. */
export function visemeRenderController(audioStartTime: number, visemeData: VisemeEventLike[], audioNow?: number): void {
  const nowTime = performance.now() / 1000
  if (nowTime - lastVisemeUpdate < VISEME_TICK) return
  lastVisemeUpdate = nowTime

  if (!_rootMesh || cachedMeshes.length === 0) return

  const cfg = _characterConfig
  const visemeTiming = cfg?.visemeTiming ?? DEFAULT_VISEME_TIMING
  const visemeOffset = cfg?.visemeOffset ?? 0
  const visemeStrength = visemeTiming.strength ?? 1.0
  const decay = visemeTiming.decay ?? 0.9

  const now = (audioNow !== undefined ? audioNow : performance.now() / 1000 - audioStartTime) + visemeOffset

  const characterVisemeMap = cfg?.visemeMap
  const visemeSetSuffix = cfg?.visemeSetSuffix || ""
  const teethSuffix = cfg?.teethSuffix || ""

  for (const { dict, mgr } of cachedMeshes) {
    for (const morphName of cachedVisemeMorphNames) {
      if (SKIP_DECAY.has(morphName)) continue
      const index = dict[morphName]
      if (index !== undefined) {
        const cur = getMorphInfluence(mgr, index)
        setMorphInfluence(mgr, index, cur * decay)
      }
    }
  }

  if (!visemeData || !characterVisemeMap) return

  for (const v of visemeData) {
    const visemeSet = characterVisemeMap[v.value] || characterVisemeMap["default"]
    if (!visemeSet) continue

    const fadeIn = visemeTiming.fadeIn ?? 0.1
    const fadeOut = visemeTiming.fadeOut ?? 0.1

    let t = 0
    if (now >= v.start && now <= v.end) {
      if (now < v.start + fadeIn) {
        t = (now - v.start) / fadeIn
      } else if (now > v.end - fadeOut) {
        t = (v.end - now) / fadeOut
      } else {
        t = 1
      }

      const jawScale = visemeTiming.jawScale ?? 1.0
      const lipScale = visemeTiming.lipScale ?? 1.0

      for (const [visemeName, weight] of Object.entries(visemeSet)) {
        const fullName = visemeName + visemeSetSuffix

        let morphScale = 1.0
        if (visemeName.startsWith("Jaw_")) morphScale = jawScale
        else if (visemeName.startsWith("V_") || visemeName.startsWith("Mouth_") || visemeName.startsWith("Cheek_")) morphScale = lipScale

        const delta = Math.max(0, Math.min(1, t)) * weight * visemeStrength * morphScale
        const additiveMax = visemeTiming.additiveMax ?? 0.85

        for (const { dict, mgr } of cachedMeshes) {
          const index = dict[fullName]
          if (index === undefined) continue

          if (visemeName.startsWith("Jaw_")) {
            const cur = getMorphInfluence(mgr, index)
            setMorphInfluence(mgr, index, Math.min(1, Math.max(cur, delta)))
          } else {
            const cur = getMorphInfluence(mgr, index)
            setMorphInfluence(mgr, index, Math.min(additiveMax, cur + delta))
          }

          if (visemeName === "Jaw_Open" && _lowerTeethMgr && _lowerTeethDict) {
            const teethMorphName = visemeName + teethSuffix
            const teethIndex = _lowerTeethDict[teethMorphName]
            if (teethIndex !== undefined) {
              const jawValue = getMorphInfluence(mgr, index)
              setMorphInfluence(_lowerTeethMgr, teethIndex, Math.min(1, jawValue))
            }
          }
        }
      }
    }
  }

  if (_jawBone && _jawBaseQuat) {
    let jawTarget = 0
    for (const { dict, mgr } of cachedMeshes) {
      const idx = dict["Jaw_Open" + visemeSetSuffix]
      if (idx !== undefined) {
        jawTarget = Math.max(jawTarget, getMorphInfluence(mgr, idx))
        break
      }
    }

    const dt = 1 / 60
    const alpha = jawTarget > _currentJawInfluence ? Math.min(1, dt / JAW_SMOOTH_UP) : Math.min(1, dt / JAW_SMOOTH_DOWN)
    _currentJawInfluence += (jawTarget - _currentJawInfluence) * alpha

    const angle = JAW_AMOUNT_RAD * _currentJawInfluence * JAW_DRIVE * JAW_GLOBAL
    const deltaQ = Quaternion.FromEulerAngles(0, 0, angle)
    _jawBone.rotationQuaternion = deltaQ.multiply(_jawBaseQuat)
  }
}
