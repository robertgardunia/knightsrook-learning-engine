export interface ClientConfig {
  xapiSocketUrl?: string
  retrievalApiBase: string
}

export function loadConfig(): ClientConfig {
  return {
    xapiSocketUrl: import.meta.env.VITE_XAPI_SOCKET_URL as string | undefined,
    retrievalApiBase: (import.meta.env.VITE_RETRIEVAL_API_BASE as string | undefined) ?? "/api/retrieval",
  }
}
