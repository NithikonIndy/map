export default defineNuxtConfig({
  compatibilityDate: "2026-05-25",
  modules: ["@nuxt/ui"],

  css: [
    "~/assets/css/main.css",
    "cesium/Build/Cesium/Widgets/widgets.css",
  ],

  runtimeConfig: {
    public: {
      cesiumIonToken: process.env.NUXT_PUBLIC_CESIUM_ION_TOKEN,
      googleMapsApiKey: process.env.NUXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      bangkokPhotorealisticTilesetUrl: process.env.NUXT_PUBLIC_BANGKOK_PHOTOREALISTIC_TILESET_URL,
    },
  },

  vite: {
    define: {
      // Assets live in public/cesium, populated by scripts/copy-cesium-assets.mjs
      CESIUM_BASE_URL: JSON.stringify("/cesium"),
    },
  },
});