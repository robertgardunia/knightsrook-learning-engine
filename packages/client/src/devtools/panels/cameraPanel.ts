import type { DevPanel } from "../devPanel"

/** Ported near-verbatim from knightsrook-garage/src/utils/devPanels/cameraPanel.js. */
export function createCameraPanel(devPanel: DevPanel): HTMLDivElement {
  const section = devPanel.createSection("Camera Position")

  const posDiv = document.createElement("div")
  posDiv.id = "camera-position"
  posDiv.style.cssText = `
    font-size: 11px;
    line-height: 1.8;
    opacity: 0.8;
    font-family: 'Consolas', 'Monaco', monospace;
    background: rgba(0,0,0,0.2);
    padding: 8px;
    border-radius: 4px;
  `

  updateCameraPosition(devPanel, posDiv)
  section.appendChild(posDiv)

  devPanel.scene.onBeforeRenderObservable.add(() => {
    if (devPanel.isVisible) updateCameraPosition(devPanel, posDiv)
  })

  return section
}

function updateCameraPosition(devPanel: DevPanel, element: HTMLDivElement): void {
  const camera = devPanel.camera
  if (!camera) {
    element.innerHTML = '<span style="opacity: 0.5;">No camera available</span>'
    return
  }

  const pos = camera.position
  const rot = "rotation" in camera ? (camera as unknown as { rotation: { x: number; y: number; z: number } }).rotation : null

  element.innerHTML = `
    <strong>Position:</strong><br>
    X: <span style="color: #ff6b6b">${pos.x.toFixed(2)}</span><br>
    Y: <span style="color: #4ade80">${pos.y.toFixed(2)}</span><br>
    Z: <span style="color: #4a9eff">${pos.z.toFixed(2)}</span><br>
    <br>
    ${
      rot
        ? `<strong>Rotation:</strong><br>
    X: ${((rot.x * 180) / Math.PI).toFixed(1)}&deg;<br>
    Y: ${((rot.y * 180) / Math.PI).toFixed(1)}&deg;<br>
    Z: ${((rot.z * 180) / Math.PI).toFixed(1)}&deg;`
        : ""
    }
  `
}
