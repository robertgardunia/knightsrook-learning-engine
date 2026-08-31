import { defineConfig } from "vite"

export default defineConfig({
  server: {
    port: 5320,
    proxy: {
      "/api/retrieval": { target: "http://localhost:5110", changeOrigin: true },
    },
  },
})
