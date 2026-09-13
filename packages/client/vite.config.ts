import { defineConfig } from "vite"
import fs from "node:fs"
import path from "node:path"

// Recursively list all .glb files under a directory, returning paths relative
// to that directory (using forward slashes).
function listGlbs(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return listGlbs(full, base)
    if (entry.name.endsWith(".glb")) return [path.relative(base, full).replace(/\\/g, "/")]
    return []
  })
}

export default defineConfig({
  // Shared asset library + course packages live at the repo root (../../public),
  // not nested inside this package — corpus documents in particular are
  // consumed by packages/retrieval, not the client, so they don't belong
  // owned by one workspace package. See public/README.md.
  publicDir: "../../public",
  server: {
    port: 5320,
    proxy: {
      "/api/retrieval": { target: "http://localhost:5110", changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      external: ["events", "crypto", "http", "https", "os", "fs", "path", "stream", "zlib", "querystring", "timers"],
    },
  },
  plugins: [
    {
      name: "dev-api",
      configureServer(server) {
        server.middlewares.use("/api/anim-list", (_req, res) => {
          const animDir = path.resolve(__dirname, "../../public/assets/animations/actorcore")
          const files = listGlbs(animDir)
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify(files))
        })

        // Proxy signed ConvAI URL requests so the ElevenLabs API key stays server-side.
        server.middlewares.use("/api/convai-signed-url", async (req, res) => {
          const apiKey = process.env.ELEVENLABS_API_KEY
          if (!apiKey) { res.statusCode = 503; res.end(JSON.stringify({ error: "ELEVENLABS_API_KEY not set" })); return }
          const url = new URL("http://localhost" + req.url!)
          const agentId = url.searchParams.get("agent_id") ?? ""
          if (!agentId) { res.statusCode = 400; res.end(JSON.stringify({ error: "agent_id required" })); return }
          try {
            const upstream = await fetch(
              `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
              { method: "GET", headers: { "xi-api-key": apiKey } }
            )
            const data = await upstream.json() as any
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify(data))
          } catch (e) {
            res.statusCode = 502; res.end(JSON.stringify({ error: String(e) }))
          }
        })
      },
    },
  ],
})
