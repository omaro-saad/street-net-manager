// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VITE_BASE_PATH: ./ for GitHub Pages (relative paths). Omit for local/Electron.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    minify: true,
    esbuild: { drop: ["console", "debugger"] },
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
