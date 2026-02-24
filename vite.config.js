// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// For GitHub Pages use: VITE_BASE_PATH=/street-net-manager/
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
