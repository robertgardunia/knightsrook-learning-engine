import type { LessonFile } from "./lesson"

/**
 * A course is data, not code. These six inputs are the entire assembly surface —
 * standing up environment two should never require touching packages/client or
 * packages/retrieval source. See project:learning-demo:spec.
 */
export interface CoursePackage {
  id: string
  room: RoomConfig
  avatar: AvatarConfig
  voice: VoiceConfig
  theme: ThemeTokens
  lesson: LessonFile
  corpus: CorpusConfig
}

export interface RoomConfig {
  glbUrl: string
  /** Named spawn node in the GLB — see docs/architecture/room-convention.md */
  spawnNode: string
  /**
   * Named empty in the room GLB marking where the avatar/mentor stands —
   * same convention as `spawnNode`, just for the avatar instead of the
   * player camera. Omit to fall back to a fixed offset in front of
   * `spawnNode` (see main.ts's AVATAR_STANDOFF_METERS).
   */
  avatarSpawnNode?: string
  /** Looping ambient bed for the room, e.g. /assets/audio/music/<id>.mp3. */
  ambientAudioUrl?: string
}

export interface AvatarConfig {
  /** Omit for the primitive stand-in (capsules/spheres, procedural idle/talk/gesture). */
  glbUrl?: string
  animationSlots: AnimationSlots
  /**
   * Correction applied on top of the room's authored avatarSpawnNode yaw.
   * Every CC/Blender export pipeline can bake a different "forward" axis
   * for the character rig — this is the per-model config knob for that,
   * same idea as garage's placeholder-mods.json rotateY overrides, just
   * scoped to this project's single-avatar-per-room convention instead of
   * a rule-matching system built for many placeholder characters. Degrees,
   * clockwise when viewed from above. Omit if the model's default facing
   * already agrees with the spawn node's authored yaw.
   */
  facingOffsetDegrees?: number
  /**
   * Default playback speed for every slot on this character, 1.0 = the
   * clip's authored speed. ActorCore/CC library animations tend to run fast
   * across the board, so this is a per-character knob, not a one-off fix —
   * override individual slots via animationSpeedRatios instead of forcing
   * every character to the same value.
   */
  animationSpeedRatio?: number
  /** Per-slot override of animationSpeedRatio — takes precedence when set. */
  animationSpeedRatios?: Partial<Record<keyof AnimationSlots, number>>
}

/** Exact clip indices, never name regex — see project:learning-demo:spec "Animation slots". */
export interface AnimationSlots {
  idle: number
  talk: number
  greet: number
  explain: number
  point: number
}

export interface VoiceConfig {
  elevenLabsAgentId: string
  voiceId: string
}

export interface ThemeTokens {
  id: string
  cssVariables: Record<string, string>
  copyRegister: Record<string, string>
  inJokes?: string[]
}

export interface CorpusConfig {
  documents: CorpusDocument[]
}

export interface CorpusDocument {
  id: string
  title: string
  sourceUrl: string
  /** Omit to auto-detect from the sourceUrl extension — see packages/retrieval/app/ingest. */
  format?: CorpusDocumentFormat
}

/** Extractor formats the ingest pipeline currently supports. */
export type CorpusDocumentFormat = "text" | "markdown"
