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
  plugins: [
    {
      name: "anim-list",
      configureServer(server) {
        // Serve a dynamic JSON listing of all GLBs under public/assets/animations/actorcore/
        // so the anim-viewer can build its UI without a hardcoded file list.
        server.middlewares.use("/api/anim-list", (_req, res) => {
          const animDir = path.resolve(__dirname, "../../public/assets/animations/actorcore")
          const files = listGlbs(animDir)
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify(files))
        })
      },
    },
  ],
})
