/**
 * Ported from knightsrook-garage/src/garage/ambientAudio.js. Two things
 * that file's own comments call out as hard-won, not obvious:
 *
 * 1. Plain HTMLAudioElement, not Babylon's Sound API, played from an
 *    explicit user-gesture call — NOT Sound's `autoplay: true`. Garage's
 *    own history (see its header comment, 2026-08-14) is that relying on
 *    browser autoplay for ambient audio is unreliable across reloads;
 *    Chrome's autoplay policy needs a real gesture to play consistently.
 * 2. State lives on `window`, not module scope, and startAmbient() always
 *    tears down before building up — otherwise Vite HMR re-evaluating this
 *    module while a previous instance's audio is still playing stacks a
 *    second copy of the loop on top of the first (audible as comb-filter
 *    static on repeated dev-server reloads).
 *
 * Simplified from garage's version: one looping track, not garage's
 * layered two-track crowd-mix (that offset-mixing is garage-specific sound
 * design, not part of the general "play ambient audio correctly" pattern).
 */

interface AmbientAudioState {
  started: boolean
  track: HTMLAudioElement | null
}

declare global {
  interface Window {
    __ambientAudio?: AmbientAudioState
  }
}

const state: AmbientAudioState = (window.__ambientAudio ??= { started: false, track: null })

export function stopAmbient(): void {
  if (state.track) {
    try {
      state.track.pause()
      state.track.removeAttribute("src")
      state.track.load()
    } catch {
      // Element already torn down by a page transition — nothing to do.
    }
  }
  state.track = null
  state.started = false
}

export function startAmbient(src: string, volume: number): void {
  stopAmbient()
  state.started = true
  const track = new Audio(src)
  track.loop = true
  track.volume = volume
  track.preload = "auto"
  track.play().catch((e) => console.warn(`[ambient] failed to play ${src}`, e))
  state.track = track
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => stopAmbient())
}
window.addEventListener("pagehide", stopAmbient)
