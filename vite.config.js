import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      jsxRuntime: "automatic",
      fastRefresh: true,
    }),

    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      devOptions: { enabled: mode === "development" },

      manifest: {
        name: "ChantiLink",
        short_name: "ChantiLink",
        description: "Réseau social professionnel avec IA intégrée",
        theme_color: "#E67E3C",
        background_color: "#2B2D42",
        display: "standalone",
        start_url: "/",
        lang: "fr-CI",
        orientation: "portrait-primary",
        icons: [
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },

      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,ttf,svg,png,jpg,jpeg,webp,webmanifest}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,

        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ request }) => ["script", "style"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "assets-cache" },
          },
          {
            urlPattern: /^https:\/\/api\.chantilink\.ci\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 5 },
            },
          },
        ],
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    extensions: [".js", ".jsx", ".ts", ".tsx"],
    dedupe: ["react", "react-dom"],
  },

  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 5173,
    },

    // Proxy uniquement en développement
    proxy: mode === "development"
      ? {
          "/api": {
            target: "http://localhost:5000",
            changeOrigin: true,
            ws: true,
          },
        }
      : undefined,
  },

  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
    cssMinify: "esbuild",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          motion: ["framer-motion"],
          icons: ["lucide-react"],
        },
      },
    },
  },

  define: {
    "process.env.VITE_COUNTRY": JSON.stringify("CI"),
    "process.env.VITE_CURRENCY": JSON.stringify("XOF"),
  },

  optimizeDeps: {
    entries: ["./index.html"],
    include: [
      "react",
      "react-dom",
      "use-debounce",
      "react-icons",
      "react-icons/hi2",
      "react-icons/fa",
      "framer-motion",
    ],
  },
}));
