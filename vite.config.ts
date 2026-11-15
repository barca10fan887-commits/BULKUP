import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// BASE_PATH lets the same build run at a sub-path, e.g. https://you.github.io/bulkup/
const base = (process.env.BASE_PATH || "/").replace(/\/?$/, "/");
// Native (Capacitor) builds don't use a service worker.
const native = process.env.BUILD_TARGET === "native";

export default defineConfig({
  base,
  resolve: {
    alias: {
      "@": path.resolve(here, "src"),
      "@shared": path.resolve(here, "shared"),
    },
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8787" },
  },
  plugins: [
    react(),
    VitePWA({
      disable: native,
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png", "sw-notify.js"],
      manifest: {
        name: "BULKUP",
        short_name: "BULKUP",
        description: "Bulking, nutrition and training tracker with a personal coach.",
        theme_color: "#050608",
        background_color: "#050608",
        display: "standalone",
        orientation: "portrait",
        start_url: base,
        scope: base,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        importScripts: ["sw-notify.js"],
        navigateFallbackDenylist: [/\/api\//, /\/privacy\.html$/],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "fonts", expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
  },
} as never);
