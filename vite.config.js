// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",            // ✅ أهم سطر لإصلاح شاشة البياض مع file://
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});
