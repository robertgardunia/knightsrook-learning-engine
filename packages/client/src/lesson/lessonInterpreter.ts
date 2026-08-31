import type { AnimationSlots, Beat, LessonFile } from "@learning-engine/shared-types"

import { ScriptRunner } from "./scriptRunner"

export interface LessonInterpreterHooks {
  playAnimationSlot: (slot: keyof AnimationSlots) => Promise<void>
  showDialogue: (text: string) => Promise<void>
  /** Resolve with the chosen Choice.id once the learner responds. */
  presentChoices: (beat: Beat) => Promise<string>
  showFeedback: (feedback: string) => Promise<void>
  emitXapi?: (verb: string, beatId: string) => void
}

/**
 * Walks a LessonFile's beats via ScriptRunner. Genuinely new (per spec), but
 * intentionally thin — all sequencing logic lives in scriptRunner.ts, ported
 * from the garage. This file only knows how to translate a Beat into steps.
 */
export class LessonInterpreter {
  private runner = new ScriptRunner()
  private beatsById: Map<string, Beat>

  constructor(
    private lesson: LessonFile,
    private hooks: LessonInterpreterHooks,
  ) {
    this.beatsById = new Map(lesson.beats.map((beat) => [beat.id, beat]))
    this.runner.register("beat", async (params) => this.runBeat(params.beatId as string))
  }

  async run(): Promise<void> {
    const first = this.lesson.beats[0]
    if (!first) return
    await this.runner.run([{ type: "beat", beatId: first.id }])
  }

  private async runBeat(beatId: string): Promise<void> {
    const beat = this.beatsById.get(beatId)
    if (!beat) {
      console.warn(`[LessonInterpreter] unknown beat id "${beatId}"`)
      return
    }

    await this.hooks.playAnimationSlot(beat.animationSlot)
    await this.hooks.showDialogue(beat.dialogue)

    let nextBeatId: string | undefined
    if (beat.choices?.length) {
      const chosenId = await this.hooks.presentChoices(beat)
      const choice = beat.choices.find((c) => c.id === chosenId)
      if (choice) {
        await this.hooks.showFeedback(choice.feedback)
        nextBeatId = choice.nextBeatId
      }
    }

    if (beat.xapiVerb) this.hooks.emitXapi?.(beat.xapiVerb, beat.id)

    if (nextBeatId) {
      await this.runner.run([{ type: "beat", beatId: nextBeatId }])
    }
  }
}
