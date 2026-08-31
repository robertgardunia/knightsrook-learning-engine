import { defineConfig } from "vite"

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
})
