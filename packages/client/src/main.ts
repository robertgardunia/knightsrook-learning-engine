import { Color3, Color4, Engine, HemisphericLight, Mesh, Scene, SceneLoader, Vector3 } from "@babylonjs/core"
import "@babylonjs/loaders/glTF"

import { PrimitiveStandIn } from "./avatar/primitiveStandIn"
import { DevPanel } from "./devtools/devPanel"
import { loadConfig } from "./lib/config"
import { loadCoursePackage } from "./lib/coursePackageLoader"
import { LessonInterpreter, type LessonInterpreterHooks } from "./lesson/lessonInterpreter"
import { startAmbient } from "./scene/ambientAudio"
import { animateEmissiveLights } from "./scene/lightAnimation"
import { registerLoad, completeLoad, reportProgress } from "./scene/loadProgress"
import { setupPostProcessing } from "./scene/postProcessing"
import { findOrSynthesizeSpawnNode, getSpawnWorldPosition, getSpawnWorldYaw, markRoomMeshesCollidable, snapToFloor } from "./scene/roomConvention"
import { setupPlayerCamera } from "./scene/playerCamera"
import { createXapiRelay } from "./telemetry/xapiClient"
import { ThemeProvider } from "./theme/themeProvider"

/** The mentor avatar stands this far in front of (along -Z from) the
 * player's spawn point, so first-person collision (see playerCamera.ts)
 * doesn't spawn the player wedged inside the avatar's own solid body. */
const AVATAR_STANDOFF_METERS = 1.5

async function main() {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement
  const engine = new Engine(canvas, true)
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.02, 0.02, 0.03, 1)
  scene.gravity = new Vector3(0, -9.81, 0)
  const config = loadConfig()

  // Ambient tuning ported from knightsrook-garage/src/garage/lighting.js's
  // setupLighting() — its directional-sun + shop-fixture rig is tuned to
  // the garage's own outdoor-facing layout and isn't reusable as-is for an
  // arbitrary interior room, but these ambient values aren't garage-specific
  // geometry, just numbers, so there's no reason to reinvent them.
  const ambientLight = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene)
  ambientLight.intensity = 0.5
  ambientLight.diffuse = new Color3(0.9, 0.95, 1.0)
  ambientLight.groundColor = new Color3(0.2, 0.2, 0.22)

  const course = await loadCoursePackage("precursor-demo")

  const themeProvider = new ThemeProvider()
  themeProvider.apply(course.theme)

  // Activity IDs are course-specific data, not code — matches the six-input
  // course package contract. Real IDs land here once course.json grows an
  // "activities" field; using the lesson id as a stand-in until then.
  const xapi = createXapiRelay(config.xapiSocketUrl, "learning-engine", {
    [course.lesson.id]: {
      id: `https://learning-demo.knightsrook.com/activities/${course.lesson.id}`,
      objectType: "Activity",
    },
  })

  // See roomConvention.ts for the spawn-node contract every room GLB must
  // satisfy (and the bounding-box fallback for GLBs that don't author one).
  let spawnPosition = Vector3.Zero()
  let avatarSpawnPosition: Vector3 | null = null
  let camera = setupPlayerCamera(scene, canvas, spawnPosition)
  if (course.room.glbUrl) {
    const roomUrl = new URL(course.room.glbUrl, window.location.origin)
    const roomDir = roomUrl.pathname.slice(0, roomUrl.pathname.lastIndexOf("/") + 1)
    const roomFile = roomUrl.pathname.slice(roomUrl.pathname.lastIndexOf("/") + 1)

    registerLoad("room", 0)
    const result = await SceneLoader.ImportMeshAsync("", roomDir, roomFile, scene, (event) => {
      reportProgress("room", event.loaded, event.total || undefined)
    })
    completeLoad("room")

    const roomMeshes = result.meshes.filter((m): m is Mesh => m instanceof Mesh)
    const spawnNode = findOrSynthesizeSpawnNode(scene, course.room.spawnNode, roomMeshes)
    markRoomMeshesCollidable(scene, roomMeshes)
    animateEmissiveLights(scene, roomMeshes)
    spawnPosition = snapToFloor(scene, getSpawnWorldPosition(spawnNode))
    const spawnYaw = getSpawnWorldYaw(spawnNode)

    if (course.room.avatarSpawnNode) {
      const node = scene.getTransformNodeByName(course.room.avatarSpawnNode)
      if (node) {
        avatarSpawnPosition = snapToFloor(scene, getSpawnWorldPosition(node))
      } else {
        console.warn(
          `Room GLB is missing avatarSpawnNode "${course.room.avatarSpawnNode}" — ` +
            `falling back to a fixed offset from the player spawn point.`,
        )
      }
    }

    // Rebuild the camera now that the real spawn point is known — it was
    // created above with a placeholder position so gravity/collision are
    // active for the whole scene lifetime, not bolted on after load.
    camera.dispose()
    camera = setupPlayerCamera(scene, canvas, spawnPosition, spawnYaw)

    if (course.room.ambientAudioUrl) {
      // Not Sound({ autoplay: true }) — see ambientAudio.ts for why. Starts
      // on the same first-click gesture playerCamera.ts already uses for
      // pointer lock, not scene construction.
      const audioUrl = course.room.ambientAudioUrl
      canvas.addEventListener("click", () => startAmbient(audioUrl, 0.5), { once: true })
    }
  }

  setupPostProcessing(scene)
  new DevPanel(scene, camera) // press ` to toggle — see devtools/devPanel.ts

  const avatar = course.avatar.glbUrl
    ? null // TODO: real GLB loader + cc4Materials.ts + arrivalTransition.ts once an asset exists
    : new PrimitiveStandIn(scene, "avatar")
  if (avatar) avatar.root.position = avatarSpawnPosition ?? spawnPosition.add(new Vector3(0, 0, -AVATAR_STANDOFF_METERS))

  const hooks: LessonInterpreterHooks = {
    playAnimationSlot: async (slot) => {
      await avatar?.playSlot(slot)
    },
    showDialogue: async (text) => {
      console.log(`[dialogue] ${text}`)
    },
    presentChoices: async (beat) => {
      // TODO: real UI. Stand-in auto-picks the first correct choice so the
      // interpreter loop is exercisable before UI exists.
      const correct = beat.choices?.find((c) => c.correct)
      return correct?.id ?? beat.choices?.[0]?.id ?? ""
    },
    showFeedback: async (feedback) => {
      console.log(`[feedback] ${feedback}`)
    },
    emitXapi: (verb, beatId) => {
      xapi.emit(course.lesson.id, {
        id: `http://adlnet.gov/expapi/verbs/${verb}`,
        display: { "en-US": verb },
      })
      void beatId
    },
  }

  const interpreter = new LessonInterpreter(course.lesson, hooks)
  await interpreter.run()

  engine.runRenderLoop(() => scene.render())
  window.addEventListener("resize", () => engine.resize())
}

main()
