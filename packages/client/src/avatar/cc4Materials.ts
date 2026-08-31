/**
 * Placeholder for CC4/CC5 material correction — NOT ported yet, deliberately.
 *
 * The real implementation lives at knightsrook-garage/src/utils/cc4Materials.js
 * and is tightly coupled to Reallusion's export quirks (transparencyMode
 * forced OPAQUE by Blender's GLTF export, emissiveColor zeroed at runtime,
 * hair-cap alpha needing ALPHATEST not ALPHABLEND). Per the spec, model/
 * character creation is a separate pipeline off this project's critical path —
 * this module stays a no-op until the first real CC4/CC5 avatar GLB lands.
 *
 * When that happens: copy knightsrook-garage/src/utils/cc4Materials.js in
 * verbatim (port to TS), call it from wherever the avatar GLB import resolves,
 * and log the port in docs/reuse-log.md.
 */
import type { AbstractMesh } from "@babylonjs/core"

export function applyCC4Materials(meshes: AbstractMesh[], sourceFile = ""): void {
  void meshes
  void sourceFile
  console.debug("[cc4Materials] no-op stand-in — see comment header for when/how to port the real fix")
}
