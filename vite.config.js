import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const API_URL = env.VITE_API_URL || "http://localhost:5000";

  return {
    plugins: [
      react({
        jsxRuntime: "automatic",
        fastRefresh: true,
      }),

      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        devOptions: {
          enabled: false,
          type: "module",
        },
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
              src: "/pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          navigateFallbackDenylist: [/^\/api/, /^\/@vite/, /^\/src/],
          globPatterns: ["**/*.{js,css,html,woff2,ttf,svg,png,jpg,jpeg,webp,webmanifest}"],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.destination === "image",
              handler: "CacheFirst",
              options: {
                cacheName: "images-cache",
                expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: ({ request }) => ["font", "style"].includes(request.destination),
              handler: "StaleWhileRevalidate",
              options: { cacheName: "assets-cache" },
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith("/api"),
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        // ✅ DÉCOMMENTÉ - Force une seule instance de React
        react: path.resolve(__dirname, "node_modules/react"),
        "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
        "react/jsx-runtime": path.resolve(__dirname, "node_modules/react/jsx-runtime"),
      },
      extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
    },

    server: {
      host: true,
      port: 5173,
      strictPort: true,
      hmr: {
        clientPort: 5173,
        overlay: true,
      },
      watch: {
        usePolling: true,
      },
      proxy: {
        "/api": {
          target: API_URL,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        "/socket.io": {
          target: API_URL,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },

    build: {
      target: "es2015",
      minify: "esbuild",
      cssMinify: "esbuild",
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            ui: ["framer-motion", "lucide-react"],
            utils: ["axios", "date-fns"],
            media: ["emoji-picker-react"],
            stripe: ["@stripe/stripe-js", "@stripe/react-stripe-js"],
          },
        },
      },
    },

    define: {
      "process.env.VITE_COUNTRY": JSON.stringify("CI"),
      "process.env.VITE_CURRENCY": JSON.stringify("XOF"),
    },

    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react-router-dom",
        "@stripe/stripe-js",
        "@stripe/react-stripe-js",
        "emoji-picker-react",
        "socket.io-client",
        "chart.js",
        "react-chartjs-2",
      ],
      force: true,
      esbuildOptions: {
        mainFields: ["module", "main"],
        conditions: ["import", "module", "default"],
      },
    },
  };
});