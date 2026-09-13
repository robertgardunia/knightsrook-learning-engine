/**
 * ConvAI client — ported from knightsrook-garage/src/systems/avatarChatOM/chatOverlayOM.js.
 * Connects to ElevenLabs ConvAI agent WebSocket and pipes audio through speechController.
 */

import { processConvAIChunk, interruptSpeech } from "./speechController"

let convWs: WebSocket | null = null
let convConnected = false
let convConnectPromise: Promise<boolean> | null = null
let _agentId = ""

export function configureConvai(opts: { agentId: string }): void {
  _agentId = opts.agentId
}

async function getSignedUrl(): Promise<string> {
  if (!_agentId) throw new Error("No ConvAI agentId configured")
  const res = await fetch(`/api/convai-signed-url?agent_id=${encodeURIComponent(_agentId)}`)
  if (!res.ok) throw new Error(`Signed URL failed: HTTP ${res.status}`)
  const data = await res.json()
  return data?.signed_url || data?.signedUrl
}

export async function connectConvai(): Promise<boolean> {
  if (convConnected && convWs) return true
  if (convConnectPromise) return convConnectPromise

  convConnectPromise = (async () => {
    const wsUrl = await getSignedUrl()
    return new Promise<boolean>((resolve, reject) => {
      let settled = false
      const fail = (err: Error) => {
        if (settled) return
        settled = true
        convConnected = false
        convConnectPromise = null
        try { convWs?.close() } catch { /* ok */ }
        convWs = null
        reject(err)
      }
      const succeed = () => {
        if (settled) return
        settled = true
        convConnected = true
        convConnectPromise = null
        resolve(true)
      }

      try { convWs = new WebSocket(wsUrl) } catch (e) { fail(e as Error); return }
      const timeout = setTimeout(() => fail(new Error("ConvAI timeout")), 8000)

      convWs.onopen = () => {
        clearTimeout(timeout)
        convWs?.send(JSON.stringify({ type: "conversation_initiation_client_data" }))
        succeed()
      }

      convWs.onclose = (ev) => {
        clearTimeout(timeout)
        console.debug(`[ConvAI] closed — code=${ev.code} reason="${ev.reason}"`)
        convConnected = false
        convConnectPromise = null
        convWs = null
        if (!settled) { reject(new Error("Closed before connected")); settled = true }
      }

      convWs.onerror = () => {
        clearTimeout(timeout)
        fail(new Error("ConvAI WebSocket error"))
      }

      convWs.onmessage = (ev) => {
        let data: any
        try { data = JSON.parse(ev.data) } catch { return }

        if (data?.type === "ping") {
          const eventId = data.ping_event?.event_id
          if (convWs?.readyState === WebSocket.OPEN) {
            convWs.send(JSON.stringify({ type: "pong", event_id: eventId }))
          }
          return
        }

        if (data?.type === "audio") {
          const ae = data.audio_event || {}
          processConvAIChunk(ae.audio_base_64, ae.alignment || null)
          return
        }

        if (data?.type === "interruption") {
          interruptSpeech()
          return
        }
      }
    })
  })()

  return convConnectPromise
}

export function sendUserMessage(text: string): void {
  if (convWs?.readyState === WebSocket.OPEN) {
    convWs.send(JSON.stringify({ type: "user_message", text }))
  }
}

export function disconnectConvai(): void {
  interruptSpeech()
  try { convWs?.close() } catch { /* ok */ }
  convWs = null
  convConnected = false
  convConnectPromise = null
}
