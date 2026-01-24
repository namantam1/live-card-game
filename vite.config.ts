import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".mts", ".js"],
  },
  server: {
    port: 3000,
    open: true,
  },
  plugins: [
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/*", "cards/**/*", "audio/**/*"],

      manifest: {
        name: "Call Break",
        short_name: "Call Break",
        description: "Call Break card game - Best played in landscape mode",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "fullscreen",
        orientation: "landscape",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "icons/web-app-manifest-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "icons/web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },

      workbox: {
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,jpg,jpeg,gif,webp,mp3,ogg,wav,map}",
        ],

        // Increase file size limit for large audio files (bgm.mp3 is ~9MB)
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024, // 20 MB

        // Runtime caching strategies
        runtimeCaching: [
          {
            // Cache game code with network first
            urlPattern: /^https?:\/\/.*\.(js|css|html|map)$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "game-code-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache static assets with cache first (includes fingerprinted assets)
            urlPattern: /^https?:\/\/.*\.(png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "game-images-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache audio with cache first
            urlPattern: /^https?:\/\/.*\.(mp3|ogg|wav)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "game-audio-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],

        // Clean up old caches
        cleanupOutdatedCaches: true,

        // Skip waiting and claim clients immediately
        skipWaiting: false, // We use 'prompt' mode to notify users
        clientsClaim: true,
      },

      devOptions: {
        enabled: true, // Enable PWA in dev mode for testing
        type: "module",
      },
    }),
  ],
});
