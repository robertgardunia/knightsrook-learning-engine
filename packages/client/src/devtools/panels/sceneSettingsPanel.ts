import { Observer } from "@babylonjs/core"
import type { PointerInfo } from "@babylonjs/core"

import type { DevPanel } from "../devPanel"

/**
 * Ported near-verbatim from
 * knightsrook-garage/src/utils/devPanels/sceneSettingsPanel.js — gravity
 * toggle (kill camera gravity to freely inspect a scene) and mesh picker
 * (click a mesh, get its name/position/material logged and shown in the
 * panel). Directly useful for exactly the kind of "which mesh is my camera
 * actually colliding with" debugging this project has needed tonight.
 */
export function createSceneSettingsPanel(devPanel: DevPanel): HTMLDivElement {
  const section = devPanel.createSection("Scene Settings")

  // ── Gravity toggle ────────────────────────────────────────────────────
  const gravityContainer = document.createElement("div")
  gravityContainer.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    background: rgba(0,0,0,0.2);
    border-radius: 4px;
    margin-bottom: 8px;
  `

  const gravityLabel = document.createElement("span")
  gravityLabel.textContent = "Camera Gravity"
  gravityLabel.style.cssText = "font-size: 12px;"

  const gravityToggle = document.createElement("button")
  const camera = devPanel.camera as unknown as { applyGravity?: boolean } | null
  const isGravityEnabled = !!camera?.applyGravity
  gravityToggle.textContent = isGravityEnabled ? "ON" : "OFF"
  gravityToggle.style.cssText = `
    padding: 4px 12px;
    background: ${isGravityEnabled ? "#4ade80" : "#ef4444"};
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 11px;
    font-weight: bold;
    cursor: pointer;
    min-width: 50px;
  `

  gravityToggle.onclick = () => {
    if (camera) {
      camera.applyGravity = !camera.applyGravity
      gravityToggle.textContent = camera.applyGravity ? "ON" : "OFF"
      gravityToggle.style.background = camera.applyGravity ? "#4ade80" : "#ef4444"
      console.debug(`[devPanel] camera gravity: ${camera.applyGravity ? "enabled" : "disabled"}`)
    }
  }

  gravityContainer.appendChild(gravityLabel)
  gravityContainer.appendChild(gravityToggle)

  // ── Mesh picker ───────────────────────────────────────────────────────
  const pickerContainer = document.createElement("div")
  pickerContainer.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    background: rgba(0,0,0,0.2);
    border-radius: 4px;
    margin-bottom: 8px;
  `

  const pickerLabel = document.createElement("span")
  pickerLabel.textContent = "Mesh Picker"
  pickerLabel.style.cssText = "font-size: 12px;"

  const pickerToggle = document.createElement("button")
  pickerToggle.textContent = "OFF"
  pickerToggle.style.cssText = `
    padding: 4px 12px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 11px;
    font-weight: bold;
    cursor: pointer;
    min-width: 50px;
  `

  const pickerInfo = document.createElement("div")
  pickerInfo.style.cssText = `
    font-size: 10px;
    color: #a0a0a0;
    padding: 4px 8px;
    max-height: 60px;
    overflow-y: auto;
    word-break: break-all;
  `

  let pickerActive = false
  let pickerObserver: Observer<PointerInfo> | null = null

  pickerToggle.onclick = () => {
    pickerActive = !pickerActive
    pickerToggle.textContent = pickerActive ? "ON" : "OFF"
    pickerToggle.style.background = pickerActive ? "#4ade80" : "#ef4444"

    if (pickerActive) {
      pickerObserver = devPanel.scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === 1) {
          // POINTERDOWN
          const pick = pointerInfo.pickInfo
          if (pick?.hit && pick.pickedMesh) {
            const m = pick.pickedMesh
            const pos = m.absolutePosition
            const info = `${m.name} | pos:(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}) | mat:${m.material?.name ?? "none"} | collides:${m.checkCollisions}`
            pickerInfo.textContent = info
            console.debug(`[meshPicker] ${info}`)
          }
        }
      })
    } else {
      if (pickerObserver) {
        devPanel.scene.onPointerObservable.remove(pickerObserver)
        pickerObserver = null
      }
      pickerInfo.textContent = ""
    }
  }

  pickerContainer.appendChild(pickerLabel)
  pickerContainer.appendChild(pickerToggle)

  section.appendChild(gravityContainer)
  section.appendChild(pickerContainer)
  section.appendChild(pickerInfo)

  return section
}
