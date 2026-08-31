export type LessonMode = "lesson" | "reference"

export interface LessonFile {
  id: string
  mode: LessonMode
  title: string
  beats: Beat[]
}

/** The lesson interpreter walks these; it must never be lesson-specific code. */
export interface Beat {
  id: string
  /** Which animation slot (see AnimationSlots) the avatar plays during this beat. */
  animationSlot: "idle" | "talk" | "greet" | "explain" | "point"
  dialogue: string
  choices?: Choice[]
  /** xAPI verb emitted when this beat completes, e.g. "answered", "experienced". */
  xapiVerb?: string
}

export interface Choice {
  id: string
  label: string
  correct: boolean
  /** In-character explanation shown on any answer — never a bare red X. */
  feedback: string
  nextBeatId?: string
}
