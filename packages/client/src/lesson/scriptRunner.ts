/**
 * Generic step-sequence engine — ported near-verbatim from
 * knightsrook-garage/src/narrative/scriptRunner.js (see docs/reuse-log.md #2).
 *
 * This turned out to already BE most of the spec's "lesson interpreter" (marked
 * NEW in project:learning-demo:spec) — garage's narrative system is a fully
 * generic, handler-registration-based sequencer with no game-specific
 * dependencies. lessonInterpreter.ts is a thin adapter on top of this that maps
 * LessonFile beats onto ScriptRunner steps.
 */

export type StepHandler = (params: Record<string, unknown>, context: Record<string, unknown>) => Promise<void>

interface Step {
  type: string
  [key: string]: unknown
}

export class ScriptRunner {
  private handlers = new Map<string, StepHandler>()
  private context: Record<string, unknown> = {}
  private aborted = false

  constructor() {
    this.register("wait", (params) => {
      const duration = typeof params.duration === "number" ? params.duration : 0
      return new Promise((resolve) => setTimeout(resolve, duration))
    })

    this.register("parallel", async (params) => {
      const steps = (params.steps as Step[]) ?? []
      await Promise.all(steps.map((step) => this.executeStep(step)))
    })

    this.register("branch", async (params) => {
      const condition = params.condition
      const result =
        typeof condition === "function"
          ? await (condition as (ctx: unknown) => unknown)(this.context)
          : Boolean(condition)
      const subScript = (result ? params.ifTrue : params.ifFalse) as Step[] | undefined
      for (const step of subScript ?? []) {
        if (this.aborted) break
        await this.executeStep(step)
      }
    })

    this.register("call", async (params) => {
      const fn = params.fn
      if (typeof fn === "function") await (fn as (ctx: unknown) => unknown)(this.context)
    })

    this.register("log", (params) => {
      console.debug(`[Script] ${params.message ?? ""}`)
      return Promise.resolve()
    })
  }

  register(type: string, handler: StepHandler): void {
    this.handlers.set(type, handler)
  }

  async run(script: Step[]): Promise<void> {
    this.aborted = false
    for (const step of script) {
      if (this.aborted) break
      await this.executeStep(step)
    }
  }

  abort(): void {
    this.aborted = true
  }

  private async executeStep(step: Step): Promise<void> {
    const handler = this.handlers.get(step.type)
    if (!handler) {
      console.warn(`[ScriptRunner] no handler registered for step type "${step.type}"`)
      return
    }
    await handler(step, this.context)
  }
}
