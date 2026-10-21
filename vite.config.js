import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Se publica en GitHub Pages: https://gaston1505.github.io/don-horacio/
const BASE = "/don-horacio/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      workbox: {
        navigateFallbackDenylist: [/\.[^/]+$/],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Las imágenes satelitales se guardan en el teléfono a medida que se ven (o con
        // "Guardar mapa offline"), así el mapa sigue funcionando a caballo sin señal.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(server|services)\.arcgisonline\.com\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "dh-mapa-satelital",
              expiration: { maxEntries: 20000, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "Don Horacio",
        short_name: "Don Horacio",
        description: "Manejo del campo Don Horacio: potreros, rotación, hacienda y lluvias",
        start_url: BASE,
        scope: BASE,
        display: "standalone",
        background_color: "#F4F1EA",
        theme_color: "#3F5B2E",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
    }),
  ],
});
