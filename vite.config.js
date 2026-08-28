import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const base = process.env.BASE_URL || "./";

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["icons/*.png", "icons/*.svg", "pets/placeholders/*.svg"],
      manifest: {
        id: "/pom-pom",
        name: "Pom-pom",
        short_name: "Pom-pom",
        description: "Student Pomodoro tracker. Focus hours grow an Inklet. Breaks do not count.",
        theme_color: "#1a1233",
        background_color: "#0d0a18",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "./",
        scope: "./",
        lang: "en",
        categories: ["education", "productivity"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-css",
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: "node",
  },
});
