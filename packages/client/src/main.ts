import { Color3, Color4, Engine, HemisphericLight, Mesh, MeshBuilder, Quaternion, Scene, SceneLoader, Vector3 } from "@babylonjs/core"
import "@babylonjs/loaders/glTF"

import { AvatarController } from "./avatar/avatarController"
import { clampVisemeMorphs, visemeRenderController } from "./avatar/visemeController"
import { configureSpeech, getAudioState, speak } from "./avatar/speechController"
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
  let avatarSpawnYaw = 0
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
        // NOT snapToFloor — that raycasts straight down and always overrides
        // the node's authored Y with the nearest floor height below it,
        // which is right for the player spawn (never trap the camera in a
        // slightly-embedded empty) but wrong here: it silently cancels out
        // any deliberate height on avatarSpawnNode (a raised platform, etc).
        // Use the node's actual authored position as-is.
        avatarSpawnPosition = getSpawnWorldPosition(node)
        avatarSpawnYaw = getSpawnWorldYaw(node)
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

  let avatar: AvatarController | PrimitiveStandIn
  if (course.avatar.glbUrl) {
    // CC-exported GLBs are all roughly the same size — a flat estimate is
    // close enough for a proportional loading dial; real byte progress from
    // onProgress corrects it as bytes actually arrive (see loadProgress.ts).
    const AVATAR_WEIGHT_BYTES = 3_500_000
    registerLoad("avatar", AVATAR_WEIGHT_BYTES)
    avatar = await AvatarController.create(
      scene,
      course.avatar.glbUrl,
      course.avatar.animationSlots,
      (loaded, total) => reportProgress("avatar", loaded, total),
    )
    completeLoad("avatar")

    if (config.elevenLabsApiKey && course.voice?.voiceId) {
      configureSpeech({ apiKey: config.elevenLabsApiKey, voiceId: course.voice.voiceId })
    }
  } else {
    avatar = new PrimitiveStandIn(scene, "avatar")
  }
  avatar.root.position = avatarSpawnPosition ?? spawnPosition.add(new Vector3(0, 0, -AVATAR_STANDOFF_METERS))
  if (avatarSpawnPosition) {
    // The avatar's own root position isn't reliably "the feet" — CC5/Blender
    // exports don't always put the character's local origin exactly at foot
    // level, so a small gap or overlap with the floor can persist even
    // though avatarSpawnPosition itself is correctly floor-snapped (garage's
    // characterLoader.js hit the same thing; ported the fix here). Measure
    // the actual hierarchy bounding box after positioning and nudge Y so the
    // lowest point sits exactly on the target floor height.
    avatar.root.getChildMeshes(true).forEach((m) => m.computeWorldMatrix(true))
    const bounds = avatar.root.getHierarchyBoundingVectors(true)
    const feetOffset = bounds.min.y - avatarSpawnPosition.y
    if (Math.abs(feetOffset) > 0.001) {
      avatar.root.position.y -= feetOffset
    }

    // Only apply the spawn node's authored yaw when we actually found one —
    // the AVATAR_STANDOFF_METERS fallback above has no facing to read, and
    // whatever default orientation the model exported with is fine there.
    const offsetRadians = ((course.avatar.facingOffsetDegrees ?? 0) * Math.PI) / 180
    avatar.root.rotationQuaternion = Quaternion.RotationYawPitchRoll(avatarSpawnYaw + offsetRadians, 0, 0)
  }

  // Invisible collision cylinder so the player can't walk through the
  // mentor — same shape garage's characterLoader.js uses for every
  // character. Parented to avatar.root (not just position-copied once, as
  // garage's static-character version did) so it automatically tracks him
  // if he ever moves once the mobility/station system exists.
  const AVATAR_COLLIDER_DIAMETER = 1.2
  const AVATAR_COLLIDER_HEIGHT = 2.0
  const avatarCollider = MeshBuilder.CreateCylinder(
    "avatar-collider",
    { diameter: AVATAR_COLLIDER_DIAMETER, height: AVATAR_COLLIDER_HEIGHT },
    scene,
  )
  avatarCollider.parent = avatar.root
  avatarCollider.position = new Vector3(0, AVATAR_COLLIDER_HEIGHT / 2, 0)
  avatarCollider.isVisible = false
  avatarCollider.checkCollisions = true
  avatarCollider.isPickable = false

  const hooks: LessonInterpreterHooks = {
    playAnimationSlot: async (slot) => {
      await avatar?.playSlot(slot)
    },
    showDialogue: async (text) => {
      await speak(text)
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

  let audioWasPlaying = false
  let decayTailStart = 0

  engine.runRenderLoop(() => {
    const { isActive, audioStartTime, visemeData, now: audioNow } = getAudioState()

    if (isActive) {
      audioWasPlaying = true
      visemeRenderController(audioStartTime, visemeData, audioNow)
    } else if (audioWasPlaying) {
      audioWasPlaying = false
      decayTailStart = performance.now() / 1000
    }

    if (!isActive && decayTailStart > 0) {
      if (performance.now() / 1000 - decayTailStart < 0.5) {
        visemeRenderController(audioStartTime, visemeData, audioNow)
      } else {
        decayTailStart = 0
      }
    }

    clampVisemeMorphs(0.85)

    scene.render()
  })
  window.addEventListener("resize", () => engine.resize())
}

main()
