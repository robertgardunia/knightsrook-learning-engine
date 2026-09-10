import { Animation, AnimationGroup, SceneLoader, type Scene, type TargetedAnimation, type TransformNode } from "@babylonjs/core"

/**
 * Loads an animation GLB once per filepath (cached, shared across characters)
 * and retargets its bones onto any skeleton by bone name — for animation
 * clips that live in a separate file from the character (e.g. an ActorCore
 * library clip applied to the mentor's own rig), as opposed to a clip baked
 * into the character's own GLB (see AnimationSlots — those are played by
 * index directly from the character's own animationGroups).
 *
 * Supports layered animation via boneGroup masking (upper/lower/full body)
 * so multiple clips can run simultaneously on different bone sets, and
 * mirrorX to flip L↔R at retarget time without pre-baking a mirrored GLB.
 */

interface LoadResult {
  meshes: { isVisible: boolean }[]
  transformNodes?: TransformNode[]
  skeletons?: ({ bones?: { getTransformNode?: () => TransformNode | null }[] } | null)[]
}

export type BoneGroup = "full" | "upper" | "lower" | "spine" | "head" | "arms" | "legs"

// CC5 bone sets for named groups. Each set is matched as a substring of the
// bone name (case-insensitive). "full" is the absence of a filter.
const BONE_GROUP_PATTERNS: Record<Exclude<BoneGroup, "full">, string[]> = {
  upper: ["spine01", "spine02", "ribstwist", "clavicle", "scapula", "upperarm", "forearm", "hand", "index", "mid", "ring", "pinky", "thumb", "necktw", "head", "jaw", "eye", "teeth", "tongue", "eyelash", "breast", "elbow", "forearmtwist"],
  lower: ["hip", "pelvis", "waist", "thigh", "calf", "foot", "toe", "knee"],
  spine: ["spine", "hip", "pelvis", "waist", "ribstwist"],
  head: ["necktw", "head", "jaw", "eye", "teeth", "tongue", "upperjaw", "facial"],
  arms: ["clavicle", "scapula", "upperarm", "forearm", "hand", "index", "mid", "ring", "pinky", "thumb", "elbow", "upperarmtwist", "forearmtwist"],
  legs: ["thigh", "calf", "foot", "toe", "knee", "thightwist", "calftwist"],
}

export interface ApplyAnimationOptions {
  loop?: boolean
  stopFirst?: AnimationGroup | null
  noHide?: boolean
  /** Exclude bones whose names contain any of these substrings (legacy filter). */
  filterBones?: string[] | null
  randomStart?: boolean
  filterRootMotion?: boolean
  speedRatio?: number
  /** Restrict retargeting to a named bone group for layered animation. */
  boneGroup?: BoneGroup
  /** Mirror L↔R at retarget time — no pre-baked GLB needed. */
  mirrorX?: boolean
}

const sourceCache = new Map<string, Promise<TargetedAnimation[]>>()

const BIND_POSE_RE = /\b(t[-_]?pose|a[-_]?pose|default|bind|reference|ref)\b/i

async function loadSourceAnimations(filepath: string, scene: Scene): Promise<TargetedAnimation[]> {
  const result = await SceneLoader.ImportMeshAsync("", "", filepath, scene)

  const newGroups = result.animationGroups || []

  const usable = newGroups.filter((g) => !BIND_POSE_RE.test(g.name))
  const source =
    usable.find((g) => /idle/i.test(g.name)) ||
    usable.reduce<AnimationGroup | null>((best, g) => {
      if (!best) return g
      const gLen = g.to - g.from
      const bLen = best.to - best.from
      if (gLen > bLen) return g
      if (gLen === bLen && g.targetedAnimations.length > best.targetedAnimations.length) return g
      return best
    }, null) ||
    newGroups[0]

  const targetedAnims = source ? [...source.targetedAnimations] : []

  newGroups.forEach((g) => {
    try { g.stop(); g.dispose() } catch { /* ok */ }
  })

  const animSkels = result.skeletons || []
  const boneNodeIds = new Set<number>()
  for (const sk of animSkels) {
    for (const bone of sk.bones || []) {
      const tn = bone.getTransformNode?.()
      if (tn) boneNodeIds.add(tn.uniqueId)
    }
  }
  animSkels.forEach((sk) => { try { sk.dispose() } catch { /* ok */ } })
  scene.transformNodes
    .filter((tn) => boneNodeIds.has(tn.uniqueId))
    .forEach((tn) => { try { tn.dispose() } catch { /* ok */ } })
  result.meshes?.forEach((m) => { try { m.dispose() } catch { /* ok */ } })

  return targetedAnims
}

function getSourceAnimations(filepath: string, scene: Scene): Promise<TargetedAnimation[]> {
  if (!sourceCache.has(filepath)) {
    sourceCache.set(filepath, loadSourceAnimations(filepath, scene))
  }
  return sourceCache.get(filepath)!
}

/** Build a bone-name → TransformNode map from a SceneLoader result. */
export function buildCharNodes(result: LoadResult): Record<string, TransformNode> {
  const nodes: Record<string, TransformNode> = {}
  result.transformNodes?.forEach((tn) => { nodes[tn.name] = tn })
  result.skeletons?.forEach((sk) => {
    sk?.bones?.forEach((bone) => {
      const tn = bone.getTransformNode?.()
      if (tn) nodes[tn.name] = tn
    })
  })
  return nodes
}

function resolveCharBone(charNodes: Record<string, TransformNode>, boneName: string): TransformNode | null {
  let node = charNodes[boneName]
  if (node) return node

  const stripped = boneName.replace(/^[^|]*\|/, "")
  node = charNodes[stripped]
  if (node) return node

  const ccMatch = boneName.match(/(CC_Base_\S+)/)
  if (ccMatch) {
    node = charNodes[ccMatch[1]]
    if (node) return node
  }

  const normalized = stripped.replace(/\./g, "_")
  return charNodes[normalized] || charNodes[normalized.replace(/^[^|]*\|/, "")] || null
}

/** Swap _L_ ↔ _R_ in a CC5 bone name. Returns null if not a paired bone. */
function mirrorBoneName(name: string): string | null {
  const mirrored = name.replace(/_(L|R)_/g, (_, s) => `_${s === "L" ? "R" : "L"}_`)
  return mirrored !== name ? mirrored : null
}

/**
 * Mirror one Animation's keyframe values for X-axis reflection.
 * For quaternion: negate Y (index 2) and Z (index 3) components.
 * For euler: negate Y (index 1) and Z (index 2) components.
 * Returns a new Animation with mirrored keys; original is untouched.
 */
function mirrorAnimation(source: Animation): Animation {
  const clone = source.clone()
  const prop = source.targetProperty.toLowerCase()
  const isQuat = prop.includes("quaternion")
  const isEuler = prop.includes("euler") || prop.includes("rotation")

  const keys = clone.getKeys()
  for (const key of keys) {
    const v = key.value
    if (isQuat && v && typeof v === "object" && "w" in v) {
      // XYZW quaternion — negate Y and Z
      key.value = { w: v.w, x: v.x, y: -v.y, z: -v.z }
    } else if (isEuler && v && typeof v === "object" && "x" in v) {
      // Euler XYZ — negate Y and Z
      key.value = { x: v.x, y: -v.y, z: -v.z }
    }
  }
  clone.setKeys(keys)
  return clone
}

/**
 * Load (or reuse cached) animation from `filepath`, retarget its bones onto
 * `result`'s skeleton, and start playing. Supports:
 *   boneGroup — restrict to a named bone set for layered animation
 *   mirrorX   — flip L↔R at retarget time
 */
export async function applyAnimation(
  filepath: string,
  result: LoadResult,
  label: string,
  scene: Scene,
  opts: ApplyAnimationOptions = {},
): Promise<AnimationGroup | null> {
  const {
    loop = true,
    stopFirst = null,
    noHide = false,
    filterBones = null,
    randomStart = false,
    filterRootMotion = false,
    speedRatio = 1.0,
    boneGroup = "full",
    mirrorX = false,
  } = opts
  const meshes = result.meshes || []

  if (!noHide) meshes.forEach((m) => (m.isVisible = false))

  let sourceAnims: TargetedAnimation[]
  try {
    sourceAnims = await getSourceAnimations(filepath, scene)
  } catch (e) {
    console.warn(`[animMixer] Failed to load ${filepath}:`, (e as Error).message)
    meshes.forEach((m) => (m.isVisible = true))
    return null
  }

  const groupPatterns = boneGroup !== "full" ? BONE_GROUP_PATTERNS[boneGroup] : null
  const charNodes = buildCharNodes(result)
  const retargeted = new AnimationGroup(label, scene)
  let mapped = 0

  for (const ta of sourceAnims) {
    const sourceBoneName = ta.target?.name || ""

    // Legacy filterBones exclusion list
    if (filterBones) {
      const lower = sourceBoneName.toLowerCase()
      if (filterBones.some((f) => lower.includes(f))) continue
    }

    // filterRootMotion: drop position/scale tracks
    if (filterRootMotion) {
      const prop = (ta.animation?.targetProperty || "").toLowerCase()
      if (prop === "scaling" || prop.startsWith("scaling")) continue
      if (prop === "position" || prop.startsWith("position")) continue
    }

    // For mirrorX: resolve the mirrored source bone name to get the right anim data,
    // but target it onto the swapped character bone.
    const targetBoneName = mirrorX ? (mirrorBoneName(sourceBoneName) ?? sourceBoneName) : sourceBoneName

    // boneGroup filter — applied to the TARGET bone name (after mirror swap)
    if (groupPatterns) {
      const lower = targetBoneName.toLowerCase()
      if (!groupPatterns.some((p) => lower.includes(p))) continue
    }

    const charBone = resolveCharBone(charNodes, targetBoneName)
    if (charBone && ta.animation) {
      const anim = mirrorX ? mirrorAnimation(ta.animation) : ta.animation
      retargeted.addTargetedAnimation(anim, charBone)
      mapped++
    }
  }

  if (mapped === 0) {
    retargeted.dispose()
    meshes.forEach((m) => (m.isVisible = true))
    console.warn(`[animMixer] No bones mapped: ${filepath} → ${label}`)
    return null
  }

  if (stopFirst) {
    try { stopFirst.stop() } catch { /* ok */ }
  }

  retargeted.start(loop, speedRatio)
  const frameRange = retargeted.to - retargeted.from
  const startOffset = randomStart && frameRange > 1 ? 1 + Math.floor(Math.random() * frameRange) : 1
  retargeted.goToFrame(retargeted.from + startOffset)

  if (!noHide) {
    scene.onAfterRenderObservable.addOnce(() => {
      meshes.forEach((m) => (m.isVisible = true))
    })
  }

  return retargeted
}

/** Clear the source animation cache (e.g. on scene dispose). */
export function clearAnimationCache(): void {
  sourceCache.clear()
}
