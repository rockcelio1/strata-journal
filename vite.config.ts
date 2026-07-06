import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      mcpPlugin(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        includeAssets: ["icon-512.png"],
        manifest: false,
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/_serverFn/, /^\/api/, /^\/~oauth/],
          runtimeCaching: [
            {
              // Navegações HTML: rede primeiro, cai pro cache offline se falhar
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "html",
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
            {
              // Assets do build (hasheados): cache-first, longa duração
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && /\.(?:js|css|woff2|png|svg)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "assets",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // Fotos/anexos do Supabase Storage (URLs assinadas + públicas)
              urlPattern: ({ url }) =>
                /\.supabase\.co$/.test(url.hostname) &&
                url.pathname.startsWith("/storage/v1/"),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "supabase-storage",
                expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Data API REST do Supabase (GET): responde do cache e revalida
              urlPattern: ({ url, request }) =>
                request.method === "GET" &&
                /\.supabase\.co$/.test(url.hostname) &&
                url.pathname.startsWith("/rest/v1/"),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "supabase-rest",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Server functions do TanStack Start (GET): SWR curto p/ navegação instantânea
              urlPattern: ({ url, request }) =>
                request.method === "GET" && url.pathname.startsWith("/_serverFn"),
              handler: "NetworkFirst",
              options: {
                cacheName: "server-fns",
                networkTimeoutSeconds: 2,
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 2 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
  },
});
