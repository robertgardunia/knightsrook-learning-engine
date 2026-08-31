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
}

export interface AvatarConfig {
  /** Omit for the primitive stand-in (capsules/spheres, procedural idle/talk/gesture). */
  glbUrl?: string
  animationSlots: AnimationSlots
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
}
