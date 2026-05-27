<template>
  <div class="viewer-shell">
    <div ref="container" class="cesium-container" />

    <header class="viewer-card viewer-header">
      <p class="eyebrow">Photorealistic Mode</p>
      <h1 class="title">{{ viewerTitle }}</h1>
      <p class="description">
        {{ viewerDescription }}
      </p>

      <div class="status-card">
        <strong>{{ statusMessage }}</strong>
        <span v-if="warningMessage" class="warning-text">{{ warningMessage }}</span>
        <span v-if="errorMessage" class="error-text">{{ errorMessage }}</span>
      </div>
    </header>

    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-card">
        <h2>Loading...</h2>
        <p>{{ statusMessage }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

type CesiumModule = typeof import("cesium");

const runtimeConfig = useRuntimeConfig();
const container = ref<HTMLDivElement | null>(null);
const isLoading = ref(true);
const baseStatusMessage = ref("กำลังเตรียม photorealistic viewer...");
const warningMessage = ref<string | null>(null);
const errorMessage = ref<string | null>(null);

let cesiumModule: CesiumModule | null = null;
let viewer: import("cesium").Viewer | null = null;

const ionToken = runtimeConfig.public.cesiumIonToken?.trim() ?? "";
const googleMapsApiKey = runtimeConfig.public.googleMapsApiKey?.trim() ?? "";
const customTilesetUrl = runtimeConfig.public.bangkokPhotorealisticTilesetUrl?.trim() ?? "";
const hasCustomTilesetUrl = customTilesetUrl.length > 0;

const viewerTitle = computed(() => (
  hasCustomTilesetUrl ? "Custom Photorealistic" : "Sisaket Close-up"
));

const viewerDescription = computed(() => (
  hasCustomTilesetUrl
    ? "โหมดนี้โหลด custom 3D Tiles โดยตรงจาก tileset URL และบินไปยังพื้นที่ของ dataset อัตโนมัติ"
    : "โหมด close-up สำหรับดูฉาก 3D แบบ photorealistic แยกจากแผนที่จังหวัดหลัก"
));

const statusMessage = computed(() => {
  if (errorMessage.value) {
    return "โหลดโหมด photorealistic ไม่สำเร็จ";
  }

  return baseStatusMessage.value;
});

onMounted(async () => {
  if (!container.value) {
    return;
  }

  try {
    cesiumModule = await import("cesium");

    if (ionToken) {
      cesiumModule.Ion.defaultAccessToken = ionToken;
    } else if (!hasCustomTilesetUrl) {
      warningMessage.value = "ยังไม่ได้ตั้งค่า Cesium ion token; Google geocoder อาจใช้งานได้ไม่ครบ";
    }

    if (hasCustomTilesetUrl) {
      viewer = new cesiumModule.Viewer(container.value, {
        timeline: false,
        animation: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        baseLayer: cesiumModule.ImageryLayer.fromProviderAsync(
          cesiumModule.ArcGisMapServerImageryProvider.fromUrl(
            "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
          ),
        ),
      });

      const { scene } = viewer;
      scene.highDynamicRange = true;
      scene.fog.enabled = false;
      scene.postProcessStages.fxaa.enabled = true;
      scene.globe.showGroundAtmosphere = true;
      scene.screenSpaceCameraController.minimumZoomDistance = 1;
      scene.screenSpaceCameraController.maximumZoomDistance = 2_500_000;

      baseStatusMessage.value = "กำลังโหลด custom photorealistic 3D Tiles...";

      const tileset = await cesiumModule.Cesium3DTileset.fromUrl(customTilesetUrl);
      tileset.maximumScreenSpaceError = 1;
      tileset.dynamicScreenSpaceError = true;
      scene.primitives.add(tileset);

      await viewer.flyTo(tileset, {
        duration: 2.4,
        offset: new cesiumModule.HeadingPitchRange(
          cesiumModule.Math.toRadians(24),
          cesiumModule.Math.toRadians(-34),
          0,
        ),
      });

      baseStatusMessage.value = "Custom photorealistic 3D Tiles พร้อมใช้งานแล้ว";
      warningMessage.value = "กำลังแสดง dataset ตามตำแหน่งจริงของ tileset ไม่ได้ยึดกล้องไว้ที่ศรีสะเกษหรือกรุงเทพ";
    } else {
      if (!googleMapsApiKey) {
        errorMessage.value = "ยังไม่ได้ตั้งค่า NUXT_PUBLIC_GOOGLE_MAPS_API_KEY หรือ custom tileset URL";
        return;
      }

      cesiumModule.GoogleMaps.defaultApiKey = googleMapsApiKey;

      viewer = new cesiumModule.Viewer(container.value, {
        globe: false,
        baseLayer: false,
        geocoder: cesiumModule.IonGeocodeProviderType.GOOGLE,
        timeline: false,
        animation: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        homeButton: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
      });

      const { scene, camera } = viewer;
      scene.verticalExaggeration = 1.8;
      if (scene.skyAtmosphere) {
        scene.skyAtmosphere.show = true;
      }
      scene.highDynamicRange = true;

      camera.setView({
        destination: cesiumModule.Cartesian3.fromDegrees(104.32944, 15.10694, 2200),
        orientation: new cesiumModule.HeadingPitchRoll(
          cesiumModule.Math.toRadians(28),
          cesiumModule.Math.toRadians(-28),
          0,
        ),
      });

      baseStatusMessage.value = "กำลังโหลด Google Photorealistic 3D Tiles...";

      const tileset = await cesiumModule.createGooglePhotorealistic3DTileset({
        onlyUsingWithGoogleGeocoder: true,
      });

      scene.primitives.add(tileset);
      baseStatusMessage.value = "Photorealistic 3D Tiles พร้อมใช้งานแล้ว";
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
    console.error("Failed to initialize Google Photorealistic viewer", error);
  } finally {
    isLoading.value = false;
  }
});

onBeforeUnmount(() => {
  viewer?.destroy();
});
</script>

<style scoped>
.viewer-shell {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #020617;
}

.cesium-container {
  width: 100%;
  height: 100%;
}

.viewer-card {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  background: rgba(10, 20, 32, 0.82);
  color: #eff6ff;
  backdrop-filter: blur(10px);
}

.viewer-header {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 2;
  width: min(420px, calc(100% - 32px));
  padding: 18px;
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #93c5fd;
}

.title {
  margin: 0;
  font-size: 28px;
  line-height: 1.1;
}

.description {
  margin: 10px 0 0;
  line-height: 1.55;
  color: #dbeafe;
}

.status-card {
  display: grid;
  gap: 8px;
  margin-top: 14px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.78);
}

.warning-text {
  color: #fcd34d;
}

.error-text {
  color: #fca5a5;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(2, 6, 23, 0.45);
}

.loading-card {
  padding: 22px 24px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.92);
  color: #eff6ff;
  text-align: center;
}

.loading-card h2,
.loading-card p {
  margin: 0;
}

.loading-card p {
  margin-top: 8px;
  color: #cbd5e1;
}

@media (max-width: 640px) {
  .viewer-header {
    right: 16px;
    width: auto;
  }

  .title {
    font-size: 24px;
  }
}
</style>
