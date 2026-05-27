import { normalizePath } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const cesiumBuildDir = normalizePath(
  decodeURIComponent(
    new URL("./node_modules/cesium/Build/Cesium", import.meta.url).pathname,
  ).replace(/^\/([A-Za-z]:\/)/, "$1"),
);

export default defineNuxtConfig({
  compatibilityDate: "2026-05-25",

  css: [
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
      CESIUM_BASE_URL: JSON.stringify("/cesium"),
    },

    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: `${cesiumBuildDir}/**/*`,
            dest: "cesium",
            rename: {
              stripBase: 4,
            },
          },
        ],
      }),
    ],
  },
});