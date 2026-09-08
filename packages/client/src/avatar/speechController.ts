/**
 * Streaming ElevenLabs TTS, ported near-verbatim from
 * knightsrook-garage/src/systems/avatarChatOM/controllers/speechController.js.
 * Outputs viseme events in the same { start, end, value } shape garage's
 * visemeRenderController consumes, so visemeController.ts can be a matching
 * port rather than a reinvention.
 */

export interface VisemeEvent {
  start: number
  end: number
  value: string
}

interface SpeechConfig {
  apiKey: string
  voiceId: string
  modelId: string
  stability: number
  similarityBoost: number
}

const config: SpeechConfig = {
  apiKey: "",
  voiceId: "",
  modelId: "eleven_flash_v2_5",
  stability: 0.35,
  similarityBoost: 0.75,
}

let audioContext: AudioContext | null = null
let nextPlayTime = 0
let speechStartTime = 0
let isSpeaking = false
let visemeData: VisemeEvent[] = []
let ws: WebSocket | null = null
const speechQueue: string[] = []
const activeSources: AudioBufferSourceNode[] = []

const CHAR_TO_PHONEME: Record<string, string> = {
  a: "AA", e: "EH", i: "IH", o: "AO", u: "UH",
  b: "B", c: "K", d: "D", f: "F", g: "G",
  h: "HH", j: "JH", k: "K", l: "L", m: "M",
  n: "N", p: "P", q: "K", r: "R", s: "S",
  t: "T", v: "V", w: "W", x: "K", y: "Y", z: "Z",
}

function hasCredentials(): boolean {
  return !!config.apiKey && !!config.voiceId
}

function ensureAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  if (audioContext.state === "suspended") {
    void audioContext.resume()
  }
  return audioContext
}

function now(): number {
  return audioContext ? audioContext.currentTime : 0
}

function enqueuePCM16Base64(b64: string): { startAt: number; durationSec: number } {
  const ctx = ensureAudioContext()
  const bytes = atob(b64)
  const int16 = new Int16Array(bytes.length / 2)
  for (let i = 0; i < int16.length; i++) {
    int16[i] = bytes.charCodeAt(i * 2) | (bytes.charCodeAt(i * 2 + 1) << 8)
  }

  const sampleRate = 16000
  const audioBuffer = ctx.createBuffer(1, int16.length, sampleRate)
  const channelData = audioBuffer.getChannelData(0)
  for (let i = 0; i < int16.length; i++) {
    channelData[i] = int16[i] / 32768
  }

  const startAt = Math.max(ctx.currentTime + 0.035, nextPlayTime)
  const source = ctx.createBufferSource()
  source.buffer = audioBuffer
  source.connect(ctx.destination)
  activeSources.push(source)
  source.onended = () => {
    const idx = activeSources.indexOf(source)
    if (idx >= 0) activeSources.splice(idx, 1)
  }
  source.start(startAt)

  nextPlayTime = startAt + audioBuffer.duration
  if (!speechStartTime) speechStartTime = startAt

  return { startAt, durationSec: audioBuffer.duration }
}

interface Alignment {
  kind: "char_sec" | "char"
  starts: number[]
  ends?: number[] | null
  durs?: number[] | null
  items: string[]
}

function extractAlignment(data: any): Alignment | null {
  if (!data) return null
  const a = data?.normalizedAlignment || data?.normalized_alignment || data?.alignment
  if (!a) return null

  const chars2 = a.characters
  const starts2 = a.character_start_times_seconds
  const ends2 = a.character_end_times_seconds
  if (chars2 && starts2 && Array.isArray(chars2) && Array.isArray(starts2)) {
    return { kind: "char_sec", starts: starts2, ends: Array.isArray(ends2) ? ends2 : null, items: chars2 }
  }

  const cStarts = a.char_start_times_ms || a.charStartTimesMs
  const cDurs = a.chars_durations_ms || a.charsDurationsMs
  const chars = a.chars
  if (cStarts && chars && Array.isArray(cStarts) && Array.isArray(chars)) {
    return { kind: "char", starts: cStarts, durs: Array.isArray(cDurs) ? cDurs : null, items: chars }
  }

  return null
}

function buildVisemeEvents(alignment: Alignment, utteranceStart: number, chunkDurationSec?: number): VisemeEvent[] {
  const { items, starts, durs, ends } = alignment
  const events: VisemeEvent[] = []

  for (let i = 0; i < starts.length && i < items.length; i++) {
    const raw = items[i]
    const v = CHAR_TO_PHONEME[String(raw).toLowerCase()]
    if (!v) continue

    let startSec: number
    let endSec: number
    if (alignment.kind === "char_sec") {
      startSec = utteranceStart + (Number(starts[i]) || 0)
      endSec = ends && i < ends.length ? utteranceStart + (Number(ends[i]) || 0) : startSec + 0.1
    } else {
      const startMs = Math.max(0, Number(starts[i]) || 0)
      let durMs = durs && i < durs.length ? Math.max(0, Number(durs[i]) || 0) : 100

      if (i + 1 < starts.length) {
        const nextStartMs = Math.max(0, Number(starts[i + 1]) || 0)
        if (nextStartMs > startMs + durMs) durMs = nextStartMs - startMs
      } else if (chunkDurationSec !== undefined) {
        const chunkEndMs = chunkDurationSec * 1000
        if (chunkEndMs > startMs + durMs) durMs = chunkEndMs - startMs
      }

      startSec = utteranceStart + startMs / 1000
      endSec = startSec + durMs / 1000
    }

    events.push({ start: startSec, end: endSec, value: v })
  }

  return events
}

function speakImmediate(text: string): Promise<void> {
  return new Promise((resolve) => {
    const t = text.trim()
    if (!t || !hasCredentials()) {
      resolve()
      return
    }

    isSpeaking = true
    speechStartTime = 0
    visemeData = []
    let utteranceStart: number | null = null

    const voiceId = config.voiceId.trim()
    const apiKey = config.apiKey.trim()

    const wsUrl =
      "wss://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(voiceId) +
      "/stream-input?model_id=" + encodeURIComponent(config.modelId) +
      "&output_format=pcm_16000&sync_alignment=true&auto_mode=true"

    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      ws?.send(JSON.stringify({
        text: " ",
        xi_api_key: apiKey,
        voice_settings: { stability: config.stability, similarity_boost: config.similarityBoost },
        generation_config: { chunk_length_schedule: [60, 80, 120, 160] },
      }))
      ws?.send(JSON.stringify({ text: t.endsWith(" ") ? t : t + " ", try_trigger_generation: true }))
      ws?.send(JSON.stringify({ text: "" }))
    }

    ws.onmessage = (ev) => {
      let data: any
      try {
        data = JSON.parse(ev.data)
      } catch {
        return
      }

      if (data?.audio) {
        const info = enqueuePCM16Base64(data.audio)
        if (utteranceStart === null) utteranceStart = info.startAt
        const align = extractAlignment(data)
        if (align) {
          visemeData.push(...buildVisemeEvents(align, utteranceStart, info.durationSec))
        }
      }

      if (data?.isFinal === true || data?.is_final === true) {
        try { ws?.close() } catch { /* already closing */ }
      }
    }

    ws.onclose = () => {
      ws = null
      isSpeaking = false
      const waitMs = Math.max(0, nextPlayTime - now()) * 1000 + 100
      setTimeout(processQueue, Math.min(waitMs, 30000))
      resolve()
    }

    ws.onerror = () => {
      isSpeaking = false
      resolve()
      processQueue()
    }
  })
}

function processQueue(): void {
  if (isSpeaking || speechQueue.length === 0) return
  const next = speechQueue.shift()!
  speakImmediate(next).catch(() => processQueue())
}

export function configureSpeech(opts: { apiKey?: string; voiceId?: string }): void {
  if (opts.apiKey) config.apiKey = opts.apiKey
  if (opts.voiceId) config.voiceId = opts.voiceId
}

export async function speak(text: string): Promise<void> {
  const t = text.trim()
  if (!t || !hasCredentials()) return

  ensureAudioContext()

  if (isSpeaking) {
    speechQueue.push(t)
    return
  }

  return speakImmediate(t)
}

export function interruptSpeech(): void {
  speechQueue.length = 0
  for (const src of activeSources) {
    try { src.stop() } catch { /* already stopped */ }
  }
  activeSources.length = 0
  try { ws?.close() } catch { /* already closed */ }
  ws = null
  isSpeaking = false
  speechStartTime = 0
  nextPlayTime = 0
  visemeData = []
}

export function getAudioState() {
  const isActive = isSpeaking || (audioContext !== null && now() < nextPlayTime)
  return {
    isActive,
    audioStartTime: speechStartTime,
    visemeData,
    now: now(),
  }
}
