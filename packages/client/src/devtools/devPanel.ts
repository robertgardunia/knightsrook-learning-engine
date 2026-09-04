import type { Camera, Scene } from "@babylonjs/core"

import { createCameraPanel } from "./panels/cameraPanel"
import { createSceneSettingsPanel } from "./panels/sceneSettingsPanel"

/**
 * Ported from knightsrook-garage/src/utils/devPanel.js — shell + toggle
 * behavior only. Garage's full panel (scene selector/export, memory
 * monitor, weather/day-cycle, character lighting rigs, workstation/mentor
 * toggles) is almost entirely garage-specific systems this project doesn't
 * have; porting those sections wholesale would just be dead code. Only the
 * generic shell (createSection, the `~` toggle, panel styling) and the
 * camera position readout are ported now, kept extensible the same way
 * garage's is (`setLighting()`-style late-wired sections) so a lighting
 * panel or others can be added the same way later without redesigning this.
 */
export class DevPanel {
  scene: Scene
  camera: Camera | null
  isVisible = false
  panel!: HTMLDivElement

  constructor(scene: Scene, camera: Camera | null = null) {
    this.scene = scene
    this.camera = camera
    this.createPanel()
    this.setupKeyboardShortcut()
    // Reachable from a devtools console or a scripted browser check without
    // requiring pointer lock (which headless browsers can't reliably grant).
    ;(window as unknown as { __devPanel?: DevPanel }).__devPanel = this
  }

  private createPanel(): void {
    this.panel = document.createElement("div")
    this.panel.id = "dev-panel"
    this.panel.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 320px;
      height: 100vh;
      background: rgba(20, 20, 30, 0.95);
      color: #fff;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      padding: 20px;
      box-shadow: -4px 0 20px rgba(0,0,0,0.5);
      overflow-y: auto;
      transform: translateX(100%);
      transition: transform 0.3s ease;
      z-index: 10000;
      border-left: 2px solid #4a9eff;
    `

    const header = document.createElement("div")
    header.style.cssText = `
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #4a9eff;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `
    header.innerHTML = `
      <span>Dev Tools</span>
      <span style="font-size: 11px; opacity: 0.6;">Press ~ to close</span>
    `
    this.panel.appendChild(header)
    this.panel.appendChild(createSceneSettingsPanel(this))
    this.panel.appendChild(createCameraPanel(this))

    document.body.appendChild(this.panel)
  }

  createSection(title: string): HTMLDivElement {
    const section = document.createElement("div")
    section.style.cssText = "margin-bottom: 20px;"

    const sectionTitle = document.createElement("div")
    sectionTitle.textContent = title
    sectionTitle.style.cssText = `
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 10px;
      color: #4a9eff;
    `
    section.appendChild(sectionTitle)
    return section
  }

  private setupKeyboardShortcut(): void {
    document.addEventListener("keydown", (e) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return

      // Match the physical key left of "1", not the character it emits —
      // layouts disagree what that key produces when shifted (see garage's
      // original comment: UK keyboards emit ¬, never ~, on shift).
      const isToggleKey = e.code === "Backquote" || e.key === "`" || e.key === "~" || e.key === "¬"
      if (!isToggleKey) return

      e.preventDefault()
      this.toggle()
    })
  }

  toggle(): void {
    this.isVisible = !this.isVisible
    this.panel.style.transform = this.isVisible ? "translateX(0)" : "translateX(100%)"
  }
}
