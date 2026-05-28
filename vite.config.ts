import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
/// <reference types="vitest" />

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  optimizeDeps: {
    exclude: [
      "cordova-plugin-health",
      "@awesome-cordova-plugins/core",
      "@awesome-cordova-plugins/health",
    ],
  },
  build: {
    // Raise the chunk-size warning threshold (default 500 kB is too low for this app)
    chunkSizeWarningLimit: 1000,
    // Minify with esbuild (default, fast)
    minify: "esbuild",
    // Enable CSS code splitting for smaller initial CSS
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Fine-grained code splitting so the device only downloads what it needs
        manualChunks: (id) => {
          // Core React runtime — always cached after first load
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) return "react-core";
          if (id.includes("node_modules/react-router-dom/") || id.includes("node_modules/react-router/")) return "react-router";
          // Supabase + React Query — large but rarely changes
          if (id.includes("node_modules/@supabase/")) return "supabase";
          if (id.includes("node_modules/@tanstack/")) return "react-query";
          // UI / icon libraries
          if (id.includes("node_modules/lucide-react/")) return "lucide";
          if (id.includes("node_modules/framer-motion/")) return "framer-motion";
          if (id.includes("node_modules/recharts/") || id.includes("node_modules/d3-")) return "recharts";
          // PDF / QR code generation only used in teacher management
          if (id.includes("node_modules/jspdf/") || id.includes("node_modules/qrcode/")) return "pdf-qr";
          // date-fns — split from app code
          if (id.includes("node_modules/date-fns/")) return "date-fns";
        },
        // Deterministic file names for long-term caching
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
}));
