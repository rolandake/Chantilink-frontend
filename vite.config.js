import { defineConfig, loadEnv } from "vite"; // 1. Import loadEnv
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 2. Charger les variables d'environnement (.env)
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
          enabled: true, // 3. Activé en dev pour tester le SW
          type: 'module',
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
              src: "/pwa-192x192.png", // Assure-toi que ces noms matchent tes fichiers
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
          globPatterns: ["**/*.{js,css,html,woff2,ttf,svg,png,jpg,jpeg,webp,webmanifest}"],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // Cleanup automatique des vieux caches
          cleanupOutdatedCaches: true, 

          runtimeCaching: [
            {
              // Cache les images (avatars, posts)
              urlPattern: ({ request }) => request.destination === "image",
              handler: "CacheFirst",
              options: {
                cacheName: "images-cache",
                expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 jours
              },
            },
            {
              // Cache les polices et styles
              urlPattern: ({ request }) => ["style", "script", "font"].includes(request.destination),
              handler: "StaleWhileRevalidate",
              options: { cacheName: "assets-cache" },
            },
            {
              // Cache API intelligent (marche en Prod ET en Dev via regex souple)
              urlPattern: ({ url }) => url.pathname.startsWith('/api'),
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                networkTimeoutSeconds: 5, // Réduit à 5s pour UX plus rapide si hors ligne
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 }, // 5 min
                cacheableResponse: {
                  statuses: [0, 200],
                },
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
    },

    server: {
      host: true, // 4. Permet l'accès via IP locale (ex: 192.168.1.x) pour tester sur ton téléphone
      port: 5173,
      strictPort: true,
      watch: {
        usePolling: true, // Parfois nécessaire sur Windows/Docker pour le HMR
      },
      proxy: {
        "/api": {
          target: API_URL, // Utilise la variable d'env
          changeOrigin: true,
          secure: false,
          ws: true, // Indispensable pour Socket.io
        },
      },
    },

    build: {
      target: "es2015", // 5. Plus compatible que 'esnext' pour les vieux Android
      minify: "esbuild",
      cssMinify: "esbuild",
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            // Optimisation du chargement
            vendor: ["react", "react-dom", "react-router-dom"],
            ui: ["framer-motion", "lucide-react"],
            utils: ["axios", "date-fns"],
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
        "react-router-dom",
        "framer-motion",
        "socket.io-client", 
        "axios"
      ],
    },
  };
});