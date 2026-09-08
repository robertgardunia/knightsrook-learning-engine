export interface ClientConfig {
  xapiSocketUrl?: string
  retrievalApiBase: string
  elevenLabsApiKey?: string
}

export function loadConfig(): ClientConfig {
  return {
    xapiSocketUrl: import.meta.env.VITE_XAPI_SOCKET_URL as string | undefined,
    retrievalApiBase: (import.meta.env.VITE_RETRIEVAL_API_BASE as string | undefined) ?? "/api/retrieval",
    // Matches knightsrook-garage/src/systems/avatarChatOM/config.js's ELEVEN.API_KEY —
    // per-character agentId/voiceId live in course.json (VoiceConfig), but the API
    // key itself is a deployment secret, not course data, same split garage uses.
    elevenLabsApiKey: import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined,
  }
}
