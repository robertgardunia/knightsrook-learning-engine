/**
 * Animation Viewer — load a character GLB, inspect baked animation groups by
 * index, preview actorcore library clips retargeted onto the rig, and assign
 * animations to named course slots. The "Export JSON" button writes a ready-
 * to-paste animationSlots block for course.json.
 *
 * Ported from knightsrook-garage/src/tools/animViewer.js and adapted for the
 * learning-engine's single-model structure (no visual/speaking split) and the
 * public/assets/animations/actorcore/ library.
 *
 * Access: http://localhost:5320/tools/anim-viewer/
 */
import {
  ArcRotateCamera,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Scene,
  SceneLoader,
  Vector3,
  type AnimationGroup,
  type AbstractMesh,
  type Skeleton,
} from "@babylonjs/core"
import "@babylonjs/loaders/glTF"

import { applyAnimation } from "../avatar/animationMixer"
import { correctCCMaterials } from "../avatar/ccMaterialCorrection"

// ── Animation library (actorcore/) ──────────────────────────────────────────

const ANIM_DIR = "/assets/animations/actorcore/"

const ANIM_LIBRARY: { label: string; files: string[] }[] = [
  {
    label: "Idles",
    files: [
      "main-idle.glb",
      "idle-random-01.glb",
      "idleandmoves-standhandbackidle.glb",
      "arrogant-stand-idle-m.glb",
      "male-idle_279398.glb",
    ],
  },
  {
    label: "Talks / Chat",
    files: [
      "male-stand-talk-2.glb",
      "chat-relax-m.glb",
      "chat-relax-f.glb",
      "arrogant-chat-m.glb",
      "3stand-chat-g1-m2.glb",
      "3stand-chat-g1-f1.glb",
      "3stand-chat-g2-m1.glb",
      "standing_chat_m_270753.glb",
      "standingdiscussion_lookingdown_m_270746.glb",
      "desk_talkover_m_270698.glb",
      "36-both-hands-together-speech.glb",
    ],
  },
  {
    label: "Walks",
    files: [
      "walk-1start-378927.glb",
      "walk-2loop-379004.glb",
      "walk-3end-378983.glb",
      "walk-relaxed-start-378926.glb",
      "walk-relaxed-loop-378936.glb",
      "walk-relaxed-end-378960.glb",
      "30-texting-walk.glb",
    ],
  },
]

// Named slots — matches the AnimationSlots type in shared-types
const SLOT_NAMES = ["idle", "talk", "greet", "explain", "point"] as const
type SlotName = (typeof SLOT_NAMES)[number]

// ── Module state ─────────────────────────────────────────────────────────────

let _scene: Scene | null = null
let _charRoot: AbstractMesh | null = null
let _charMeshes: AbstractMesh[] = []
let _charSkeletons: Skeleton[] = []
let _bakedGroups: AnimationGroup[] = []
let _activeGroup: AnimationGroup | null = null
let _loadedExtGroups: AnimationGroup[] = []
let _speedRatio = 1.0

// slot name → baked animation index (null = unassigned)
const _slotAssignments: Record<SlotName, number | null> = {
  idle: null,
  talk: null,
  greet: null,
  explain: null,
  point: null,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isDescendantOf(node: { parent: unknown }, root: AbstractMesh): boolean {
  let p = node.parent as { parent: unknown } | null
  while (p) {
    if (p === root) return true
    p = (p as { parent: unknown }).parent as { parent: unknown } | null
  }
  return false
}

function fitToView(scene: Scene, root: AbstractMesh, meshes: AbstractMesh[]): void {
  meshes.forEach((m) => m.computeWorldMatrix(true))
  const bounds = root.getHierarchyBoundingVectors(true)
  const height = Math.max(0.001, bounds.max.y - bounds.min.y)
  const scale = 1.78 / height
  root.scaling.setAll(scale)
  scene.render()

  root.getChildMeshes(true).forEach((m) => m.computeWorldMatrix(true))
  const b2 = root.getHierarchyBoundingVectors(true)
  root.position = new Vector3(
    -((b2.min.x + b2.max.x) * 0.5),
    -b2.min.y,
    -((b2.min.z + b2.max.z) * 0.5),
  )
}

async function loadCharacter(scene: Scene, glbPath: string): Promise<AnimationGroup[]> {
  if (_charRoot) {
    _charRoot.dispose()
    _charRoot = null
  }
  _charMeshes = []
  _charSkeletons = []
  _bakedGroups.forEach((g) => { try { g.dispose() } catch { /* ok */ } })
  _bakedGroups = []
  _loadedExtGroups.forEach((g) => { try { g.dispose() } catch { /* ok */ } })
  _loadedExtGroups = []
  _activeGroup = null

  const url = new URL(glbPath, window.location.origin)
  const dir = url.pathname.slice(0, url.pathname.lastIndexOf("/") + 1)
  const file = url.pathname.slice(url.pathname.lastIndexOf("/") + 1)

  const result = await SceneLoader.ImportMeshAsync("", dir, file, scene)
  correctCCMaterials(result.meshes)

  _charRoot = result.meshes[0] as AbstractMesh
  _charMeshes = result.meshes.filter((m) => m.getClassName?.() === "Mesh") as AbstractMesh[]
  _charSkeletons = result.skeletons ?? []
  _charMeshes.forEach((m) => { m.isPickable = false })

  fitToView(scene, _charRoot, _charMeshes)
  _charRoot.rotation = new Vector3(0, Math.PI, 0)

  _bakedGroups = result.animationGroups ?? []
  _bakedGroups.forEach((g) => { try { g.stop() } catch { /* ok */ } })

  const cam = scene.activeCamera as ArcRotateCamera | null
  if (cam?.setTarget) cam.setTarget(new Vector3(0, 0.9, 0))

  return _bakedGroups
}

function playBaked(group: AnimationGroup, loop: boolean, statusEl: HTMLElement): void {
  stopAll()
  group.start(loop, _speedRatio)
  group.speedRatio = _speedRatio
  _activeGroup = group
  statusEl.textContent = `Baked [${_bakedGroups.indexOf(group)}] "${group.name}" — ${group.targetedAnimations.length} tracks`
}

async function playExternal(file: string, loop: boolean, statusEl: HTMLElement): Promise<void> {
  stopAll()

  if (!_charRoot) { statusEl.textContent = "Load a character first"; return }
  statusEl.textContent = `Loading ${file}…`

  const charResult = {
    meshes: _charMeshes,
    transformNodes: (_scene?.transformNodes ?? []).filter(
      (tn) => _charRoot && isDescendantOf(tn, _charRoot),
    ),
    skeletons: _charSkeletons,
  }

  const group = await applyAnimation(ANIM_DIR + file, charResult, "__viewer__", _scene!, {
    loop,
    noHide: true,
    filterRootMotion: true,
  })

  if (!group) { statusEl.textContent = `No bones matched for ${file}`; return }

  group.speedRatio = _speedRatio
  _loadedExtGroups = [group]
  _activeGroup = group

  const frames = Math.round(group.to - group.from)
  statusEl.textContent = `External: ${file} — ${group.targetedAnimations.length} bones, ${frames} frames`
}

function stopAll(): void {
  if (_activeGroup) { try { _activeGroup.stop() } catch { /* ok */ } _activeGroup = null }
  _loadedExtGroups.forEach((g) => { try { g.stop() } catch { /* ok */ } })
  _loadedExtGroups = []
}

// ── UI ───────────────────────────────────────────────────────────────────────

function buildUI(engine: Engine, scene: Scene): HTMLButtonElement {
  const panel = document.createElement("div")
  panel.style.cssText = `
    position: fixed; top: 0; left: 0; width: 420px; height: 100vh;
    background: rgba(18,18,28,0.97); color: #ccc; overflow-y: auto; overflow-x: hidden;
    font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px;
    z-index: 10000; padding: 12px; box-sizing: border-box; border-right: 1px solid #333;
  `

  // ── Title ────────────────────────────────────────────────────────────────
  const title = document.createElement("h3")
  title.textContent = "Animation Viewer"
  title.style.cssText = "color: #7af; margin: 0 0 4px 0; font-size: 15px;"
  panel.appendChild(title)

  const subtitle = document.createElement("div")
  subtitle.textContent = "learning-engine · actorcore rig"
  subtitle.style.cssText = "color: #556; font-size: 11px; margin-bottom: 10px;"
  panel.appendChild(subtitle)

  const status = document.createElement("div")
  status.style.cssText =
    "color: #aaa; font-size: 11px; margin-bottom: 12px; min-height: 32px; line-height: 1.4;"
  status.textContent = "Drop a GLB path below to load a character."
  panel.appendChild(status)

  // ── Character load ───────────────────────────────────────────────────────
  const charHeader = document.createElement("div")
  charHeader.textContent = "Character GLB path:"
  charHeader.style.cssText = "color: #8af; font-weight: bold; margin-bottom: 4px;"
  panel.appendChild(charHeader)

  const pathRow = document.createElement("div")
  pathRow.style.cssText = "display: flex; gap: 4px; margin-bottom: 4px;"

  const pathInput = document.createElement("input")
  pathInput.type = "text"
  pathInput.placeholder = "/assets/avatars/vulcan-tvek/avatar.glb"
  pathInput.value = "/assets/avatars/vulcan-tvek/avatar.glb"
  pathInput.style.cssText =
    "flex: 1; padding: 4px 6px; background: #222; color: #ccc; border: 1px solid #444; font-size: 12px;"
  pathRow.appendChild(pathInput)

  const loadBtn = makeBtn("Load", "#1a2a1a", "#7f7")
  loadBtn.style.padding = "4px 10px"
  loadBtn.style.marginBottom = "0"
  async function doLoad(): Promise<void> {
    const p = pathInput.value.trim()
    if (!p) return
    status.textContent = "Loading…"
    try {
      const baked = await loadCharacter(scene, p)
      rebuildBakedSection(baked)
      status.textContent = `Loaded — playing default idle…`
      await playExternal("standingdiscussion_lookingdown_m_270746.glb", true, status)
    } catch (e) {
      status.textContent = `Error: ${String(e)}`
    }
  }

  loadBtn.onclick = () => void doLoad()
  pathRow.appendChild(loadBtn)
  panel.appendChild(pathRow)

  // Preset paths
  const presets = ["/assets/avatars/vulcan-tvek/avatar.glb"]
  const presetEl = document.createElement("select")
  presetEl.style.cssText =
    "width: 100%; padding: 3px; background: #222; color: #888; border: 1px solid #333; font-size: 11px; margin-bottom: 12px;"
  const defaultOpt = document.createElement("option")
  defaultOpt.value = ""
  defaultOpt.textContent = "— quick-load preset —"
  presetEl.appendChild(defaultOpt)
  presets.forEach((p) => {
    const o = document.createElement("option")
    o.value = p
    o.textContent = p.split("/").pop()!
    presetEl.appendChild(o)
  })
  presetEl.onchange = () => {
    if (presetEl.value) { pathInput.value = presetEl.value; presetEl.value = "" }
  }
  panel.appendChild(presetEl)

  // ── Playback controls ────────────────────────────────────────────────────
  const loopLabel = document.createElement("label")
  loopLabel.style.cssText =
    "display: flex; align-items: center; gap: 6px; margin-bottom: 8px; cursor: pointer;"
  const loopCheck = document.createElement("input")
  loopCheck.type = "checkbox"
  loopCheck.checked = true
  loopLabel.appendChild(loopCheck)
  loopLabel.appendChild(document.createTextNode("Loop"))
  panel.appendChild(loopLabel)

  const speedHeader = document.createElement("div")
  speedHeader.textContent = "Speed: 1.0×"
  speedHeader.style.cssText = "color: #8af; font-size: 11px; margin-bottom: 2px;"
  panel.appendChild(speedHeader)

  const speedSlider = document.createElement("input")
  speedSlider.type = "range"
  speedSlider.min = "0.1"
  speedSlider.max = "2.0"
  speedSlider.step = "0.1"
  speedSlider.value = "1.0"
  speedSlider.style.cssText = "width: 100%; margin-bottom: 12px;"
  speedSlider.oninput = () => {
    _speedRatio = parseFloat(speedSlider.value)
    speedHeader.textContent = `Speed: ${_speedRatio.toFixed(1)}×`
    if (_activeGroup) _activeGroup.speedRatio = _speedRatio
  }
  panel.appendChild(speedSlider)

  // ── Stop button ──────────────────────────────────────────────────────────
  const stopBtn = makeBtn("⏹ Stop All", "#2a1a1a", "#f88")
  stopBtn.style.fontWeight = "bold"
  stopBtn.onclick = () => { stopAll(); status.textContent = "Stopped." }
  panel.appendChild(stopBtn)

  sep(panel)

  // ── Slot assignment panel ────────────────────────────────────────────────
  sectionHeader(panel, "Slot Assignments", "#fa7")

  const slotNote = document.createElement("div")
  slotNote.textContent = "Assign a baked index to each slot, then export."
  slotNote.style.cssText = "color: #666; font-size: 11px; margin-bottom: 8px;"
  panel.appendChild(slotNote)

  const slotSelects: Partial<Record<SlotName, HTMLSelectElement>> = {}

  for (const slotName of SLOT_NAMES) {
    const row = document.createElement("div")
    row.style.cssText = "display: flex; align-items: center; gap: 6px; margin-bottom: 6px;"

    const lbl = document.createElement("label")
    lbl.textContent = slotName
    lbl.style.cssText = "color: #aac; min-width: 60px; font-size: 12px;"
    row.appendChild(lbl)

    const sel = document.createElement("select")
    sel.style.cssText =
      "flex: 1; min-width: 0; padding: 3px; background: #222; color: #ccc; border: 1px solid #444; font-size: 11px;"
    const none = document.createElement("option")
    none.value = ""
    none.textContent = "— unassigned —"
    sel.appendChild(none)
    sel.onchange = () => {
      const v = sel.value
      _slotAssignments[slotName] = v === "" ? null : parseInt(v)
    }
    row.appendChild(sel)

    const previewBtn = document.createElement("button")
    previewBtn.textContent = "▶"
    previewBtn.title = `Preview ${slotName}`
    previewBtn.style.cssText =
      "padding: 3px 7px; background: #223; border: 1px solid #445; color: #aaf; cursor: pointer; border-radius: 3px;"
    previewBtn.onclick = () => {
      const idx = _slotAssignments[slotName]
      if (idx === null || idx === undefined) {
        status.textContent = `${slotName}: no index assigned`
        return
      }
      const g = _bakedGroups[idx]
      if (!g) { status.textContent = `No baked group at index ${idx}`; return }
      playBaked(g, loopCheck.checked, status)
    }
    row.appendChild(previewBtn)

    panel.appendChild(row)
    slotSelects[slotName] = sel
  }

  const exportBtn = makeBtn("📋 Copy animationSlots JSON", "#1a1a2a", "#aaf")
  exportBtn.onclick = () => {
    const out: Record<string, number> = {}
    for (const slotName of SLOT_NAMES) {
      const v = _slotAssignments[slotName]
      if (v !== null && v !== undefined) out[slotName] = v
    }
    const json = JSON.stringify(out, null, 2)
    navigator.clipboard.writeText(json).then(() => {
      exportBtn.textContent = "✓ Copied!"
      setTimeout(() => { exportBtn.textContent = "📋 Copy animationSlots JSON" }, 2000)
    })
    status.textContent = `Copied: ${json}`
  }
  panel.appendChild(exportBtn)

  sep(panel)

  // ── Baked animations (rebuilt on load) ───────────────────────────────────
  const bakedContainer = document.createElement("div")
  panel.appendChild(bakedContainer)

  sep(panel)

  // ── Actorcore library ────────────────────────────────────────────────────
  sectionHeader(panel, "Actorcore Library", "#8af")

  for (const cat of ANIM_LIBRARY) {
    sectionHeader(panel, `${cat.label} (${cat.files.length})`, "#68a", "12px")
    for (const file of cat.files) {
      const btn = makeBtn(file.replace(".glb", ""), "#1a1a2a", "#aac")
      btn.style.fontSize = "11px"
      btn.onclick = () => { void playExternal(file, loopCheck.checked, status) }
      panel.appendChild(btn)
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function rebuildBakedSection(baked: AnimationGroup[]): void {
    bakedContainer.innerHTML = ""

    if (baked.length === 0) {
      const note = document.createElement("div")
      note.textContent = "No baked animation groups in this GLB."
      note.style.cssText = "color: #666; font-size: 11px;"
      bakedContainer.appendChild(note)
      return
    }

    sectionHeader(bakedContainer, `Baked Animations (${baked.length})`, "#fa7")

    // Repopulate slot selects
    for (const slotName of SLOT_NAMES) {
      const sel = slotSelects[slotName]
      if (!sel) continue
      // Clear old options after the placeholder
      while (sel.options.length > 1) sel.remove(1)
      baked.forEach((g, idx) => {
        const o = document.createElement("option")
        o.value = String(idx)
        o.textContent = `[${idx}] ${g.name}`
        sel.appendChild(o)
      })
      sel.value = ""
      _slotAssignments[slotName] = null
    }

    baked.forEach((g, idx) => {
      const row = document.createElement("div")
      row.style.cssText = "display: flex; gap: 4px; margin-bottom: 3px;"

      const btn = makeBtn(`[${idx}] ${g.name}`, "#2a2218", "#da7")
      btn.style.flex = "1"
      btn.style.marginBottom = "0"
      btn.style.fontSize = "11px"
      btn.onclick = () => playBaked(g, loopCheck.checked, status)
      row.appendChild(btn)

      const copyBtn = document.createElement("button")
      copyBtn.textContent = "📋"
      copyBtn.title = `Copy index ${idx}`
      copyBtn.style.cssText =
        "padding: 4px 7px; background: #333; border: 1px solid #444; color: #aaa; cursor: pointer; border-radius: 3px; font-size: 11px;"
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(String(idx))
        copyBtn.textContent = "✓"
        setTimeout(() => { copyBtn.textContent = "📋" }, 1500)
      }
      row.appendChild(copyBtn)

      bakedContainer.appendChild(row)
    })
  }

  document.body.appendChild(panel)
  const canvas = engine.getRenderingCanvas()
  if (canvas) canvas.style.marginLeft = "420px"
  engine.resize()

  return loadBtn
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function makeBtn(label: string, bg: string, color: string): HTMLButtonElement {
  const btn = document.createElement("button")
  btn.textContent = label
  btn.style.cssText = `
    display: block; width: 100%; text-align: left; padding: 5px 8px;
    margin-bottom: 3px; background: ${bg}; color: ${color}; border: 1px solid #333;
    cursor: pointer; font-size: 12px; border-radius: 3px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; box-sizing: border-box;
  `
  btn.onmouseenter = () => { btn.style.filter = "brightness(1.3)" }
  btn.onmouseleave = () => { btn.style.filter = "" }
  return btn
}

function sectionHeader(
  parent: HTMLElement,
  text: string,
  color = "#8af",
  fontSize = "13px",
): void {
  const h = document.createElement("div")
  h.textContent = text
  h.style.cssText = `color: ${color}; font-weight: bold; margin: 10px 0 6px 0; font-size: ${fontSize};`
  parent.appendChild(h)
}

function sep(parent: HTMLElement): void {
  const hr = document.createElement("hr")
  hr.style.cssText = "border: none; border-top: 1px solid #2a2a3a; margin: 10px 0;"
  parent.appendChild(hr)
}

// ── Entry point ───────────────────────────────────────────────────────────────

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement
const engine = new Engine(canvas, true)
const scene = new Scene(engine)
_scene = scene
scene.clearColor = new Color4(0.1, 0.1, 0.14, 1)

const camera = new ArcRotateCamera("viewerCam", Math.PI / 2, Math.PI / 3, 2.8, new Vector3(0, 0.9, 0), scene)
camera.lowerRadiusLimit = 0.5
camera.upperRadiusLimit = 10
camera.lowerBetaLimit = 0.1
camera.upperBetaLimit = Math.PI / 2 + 0.3
camera.minZ = 0.05
camera.wheelPrecision = 50
camera.attachControl(canvas, true)

const hemi = new HemisphericLight("viewerHemi", new Vector3(0, 1, 0), scene)
hemi.intensity = 1.1
const dir = new DirectionalLight("viewerDir", new Vector3(-0.3, -1, 0.2), scene)
dir.position = new Vector3(3, 8, -4)
dir.intensity = 0.6

const loadBtn = buildUI(engine, scene)

engine.runRenderLoop(() => scene.render())

loadBtn.click()
window.addEventListener("resize", () => engine.resize())
