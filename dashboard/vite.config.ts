import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split vendors so the app chunk can be re-fetched on its own, and so
        // the cost of each library is visible in the build output rather than
        // hidden inside one number.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return
          if (id.includes("@phosphor-icons")) return "icons"
          if (id.includes("motion")) return "motion"
          if (id.includes("react")) return "react"
        },
      },
    },
  },
})
