import { Engine, Scene } from "@babylonjs/core"

import { PrimitiveStandIn } from "./avatar/primitiveStandIn"
import { loadConfig } from "./lib/config"
import { loadCoursePackage } from "./lib/coursePackageLoader"
import { LessonInterpreter, type LessonInterpreterHooks } from "./lesson/lessonInterpreter"
import { registerLoad } from "./scene/loadProgress"
import { ThemeProvider } from "./theme/themeProvider"

async function main() {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement
  const engine = new Engine(canvas, true)
  const scene = new Scene(engine)
  const config = loadConfig()

  const course = await loadCoursePackage("precursor-demo")

  const themeProvider = new ThemeProvider()
  themeProvider.apply(course.theme)

  // Room GLB import lands here once a real asset exists — see roomConvention.ts
  // for the spawn-node contract every room GLB must satisfy.
  registerLoad("room", 0)

  const avatar = course.avatar.glbUrl
    ? null // TODO: real GLB loader + cc4Materials.ts + arrivalTransition.ts once an asset exists
    : new PrimitiveStandIn(scene, "avatar")

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
  }

  const interpreter = new LessonInterpreter(course.lesson, hooks)
  await interpreter.run()

  engine.runRenderLoop(() => scene.render())
  window.addEventListener("resize", () => engine.resize())

  void config
}

main()
