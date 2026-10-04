import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Browser-safe part of the shared package (zod schemas only), compiled from source.
export const sharedExtraction = fileURLToPath(new URL("../../packages/shared/src/extraction.ts", import.meta.url));

export default defineConfig({
  // Only VITE_* variables reach the bundle; server secrets must never use this prefix.
  envPrefix: "VITE_",
  resolve: { alias: { "@czyzyk/shared/extraction": sharedExtraction } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Czyżyk – asystent przedszkolny",
        short_name: "Czyżyk",
        description: "Wydarzenia, rzeczy do przyniesienia i płatności z grup przedszkola",
        lang: "pl",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f7fee7",
        theme_color: "#3f6212",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Never cache API or Supabase responses: family data must not linger offline.
        navigateFallbackDenylist: [/^\/auth\//],
        runtimeCaching: [],
      },
    }),
  ],
});
