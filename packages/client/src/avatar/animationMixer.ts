import { AnimationGroup, SceneLoader, type Scene, type TargetedAnimation, type TransformNode } from "@babylonjs/core"

/**
 * Loads an animation GLB once per filepath (cached, shared across characters)
 * and retargets its bones onto any skeleton by bone name — for animation
 * clips that live in a separate file from the character (e.g. an ActorCore
 * library clip applied to the mentor's own rig), as opposed to a clip baked
 * into the character's own GLB (see AnimationSlots — those are played by
 * index directly from the character's own animationGroups).
 *
 * Ported near-verbatim from knightsrook-garage/src/systems/animationMixer.js
 * — no garage-specific assumptions in the original, just CC/ActorCore rig
 * naming conventions.
 */

interface LoadResult {
  meshes: { isVisible: boolean }[]
  transformNodes?: TransformNode[]
  skeletons?: ({ bones?: { getTransformNode?: () => TransformNode | null }[] } | null)[]
}

interface ApplyAnimationOptions {
  loop?: boolean
  stopFirst?: AnimationGroup | null
  noHide?: boolean
  filterBones?: string[] | null
  randomStart?: boolean
  filterRootMotion?: boolean
  /** 1.0 = the clip's authored speed. Library motion (ActorCore etc.) tends
   * to run fast across the board — this is a per-call knob, same idea as
   * AvatarController's animationSpeedRatio for baked clips. */
  speedRatio?: number
}

const sourceCache = new Map<string, Promise<TargetedAnimation[]>>()

const BIND_POSE_RE = /\b(t[-_]?pose|a[-_]?pose|default|bind|reference|ref)\b/i

async function loadSourceAnimations(filepath: string, scene: Scene): Promise<TargetedAnimation[]> {
  const result = await SceneLoader.ImportMeshAsync("", "", filepath, scene)

  // result.animationGroups is authoritative here, not a scene-wide diff — see
  // garage's animationMixer.js for why (rapid create/dispose across loads
  // makes uniqueId diffing unreliable).
  const newGroups = result.animationGroups || []

  // Prefer named idle, then the longest non-bind-pose group. Reference/pose
  // groups are always short (1-5 frames); real animations are 30+ frames.
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
    try {
      g.stop()
      g.dispose()
    } catch {
      // already disposed
    }
  })

  // Dispose the imported bone TransformNodes too — only the keyframe data
  // (ta.animation) is retained; ta.target.name stays readable for retargeting.
  const animSkels = result.skeletons || []
  const boneNodeIds = new Set<number>()
  for (const sk of animSkels) {
    for (const bone of sk.bones || []) {
      const tn = bone.getTransformNode?.()
      if (tn) boneNodeIds.add(tn.uniqueId)
    }
  }
  animSkels.forEach((sk) => {
    try {
      sk.dispose()
    } catch {
      // already disposed
    }
  })
  scene.transformNodes
    .filter((tn) => boneNodeIds.has(tn.uniqueId))
    .forEach((tn) => {
      try {
        tn.dispose()
      } catch {
        // already disposed
      }
    })
  result.meshes?.forEach((m) => {
    try {
      m.dispose()
    } catch {
      // already disposed
    }
  })

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
  result.transformNodes?.forEach((tn) => {
    nodes[tn.name] = tn
  })
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

  // Strip NLA track prefix, e.g. "Armature|CC_Base_Hip" → "CC_Base_Hip"
  const stripped = boneName.replace(/^[^|]*\|/, "")
  node = charNodes[stripped]
  if (node) return node

  // CC full path match
  const ccMatch = boneName.match(/(CC_Base_\S+)/)
  if (ccMatch) {
    node = charNodes[ccMatch[1]]
    if (node) return node
  }

  const normalized = stripped.replace(/\./g, "_")
  return charNodes[normalized] || charNodes[normalized.replace(/^[^|]*\|/, "")] || null
}

/**
 * Load (or reuse cached) animation from `filepath`, retarget its bones onto
 * `result`'s skeleton, start it looping, and keep the character hidden until
 * the first animated frame renders — so a bind-pose flash never shows.
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

  const charNodes = buildCharNodes(result)
  const retargeted = new AnimationGroup(label, scene)
  let mapped = 0

  for (const ta of sourceAnims) {
    const boneName = ta.target?.name || ""
    if (filterBones) {
      const lower = boneName.toLowerCase()
      if (filterBones.some((f) => lower.includes(f))) continue
    }
    // Rotation-only retargeting: scale/position tracks bake in the source
    // character's own proportions and bone lengths, which would distort a
    // differently-proportioned target character (hunching, wrong shoulder
    // width, etc). Each character keeps its own rest-pose proportions.
    if (filterRootMotion) {
      const prop = (ta.animation?.targetProperty || "").toLowerCase()
      if (prop === "scaling" || prop.startsWith("scaling")) continue
      if (prop === "position" || prop.startsWith("position")) continue
    }
    const charBone = resolveCharBone(charNodes, boneName)
    if (charBone && ta.animation) {
      retargeted.addTargetedAnimation(ta.animation, charBone)
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
    try {
      stopFirst.stop()
    } catch {
      // already stopped
    }
  }

  // Skip frame 0 — CC bakes a bind-pose reference frame there. randomStart
  // scatters the initial frame across the clip so identical looping idles
  // playing on multiple characters desync visually.
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
