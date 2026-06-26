import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Single-package frontend build. The world-server / agent-runner placeholders
// under apps/ are intentionally excluded from this build (see tsconfig.json).
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});
