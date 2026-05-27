<template>
  <ClientOnly>
    <div class="app-shell">

      <!-- Toggle Buttons -->
      <div class="floating-actions">
        <button @click="showModeSwitch = !showModeSwitch">
          {{ showModeSwitch ? "ซ่อนเมนู" : "เปิดเมนู" }}
        </button>

        <button @click="showSidebar = !showSidebar">
          {{ showSidebar ? "ซ่อน Sidebar" : "เปิด Sidebar" }}
        </button>
      </div>

      <!-- Top Mode Switch -->
      <div v-if="showModeSwitch" class="mode-switch">
        <div class="mode-switch-row">
          <button
            class="mode-button"
            :class="{ 'is-active': viewerMode === 'sisaket' }"
            @click="viewerMode = 'sisaket'"
          >
            ฉากจังหวัดศรีสะเกษ
          </button>

          <button
            class="mode-button"
            :class="{ 'is-active': viewerMode === 'photorealistic' }"
            @click="viewerMode = 'photorealistic'"
          >
            Photorealistic
          </button>

          <button
            class="mode-button"
            :class="{ 'is-active': viewerMode === 'bangkok-osm' }"
            @click="viewerMode = 'bangkok-osm'"
          >
            กรุงเทพ 3D (OSM)
          </button>
        </div>

        <p class="mode-description">
          {{ modeDescription }}
        </p>
      </div>

      <!-- Viewer -->
      <CesiumViewer
        v-if="viewerMode === 'sisaket'"
        :show-sidebar="showSidebar"
      />

      <GooglePhotorealisticViewer
        v-else-if="viewerMode === 'photorealistic'"
        :show-sidebar="showSidebar"
      />

      <BangkokOsmBuildingsViewer
        v-else
        :show-sidebar="showSidebar"
      />
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

type ViewerMode = "sisaket" | "photorealistic" | "bangkok-osm";

const viewerMode = ref<ViewerMode>("sisaket");

const showModeSwitch = ref(true);
const showSidebar = ref(true);

const modeDescription = computed(() => {
  switch (viewerMode.value) {
    case "sisaket":
      return "โหมดข้อมูลภาพรวมจังหวัด พร้อม terrain, ขอบเขตอำเภอ, OSM Buildings และ landmarks";
    case "photorealistic":
      return "โหมด photorealistic ที่จะใช้ custom tileset URL ก่อน และ fallback ไป Google เมื่อไม่ได้ตั้งค่า custom source";
    default:
      return "เดโมกรุงเทพบน satellite imagery พร้อม OSM Buildings, dashboard น้ำ และช่องรองรับ custom photorealistic tiles";
  }
});
</script>


<style scoped>
.app-shell {
  position: relative;
  min-height: 100vh;
  background: #020617;
}

.mode-switch {
  position: absolute;
  top: 16px;
  left: 50%;
  z-index: 10;
  width: min(720px, calc(100% - 32px));
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  background: rgba(10, 20, 32, 0.84);
  color: #eff6ff;
  backdrop-filter: blur(10px);
  transform: translateX(-50%);
}

.mode-switch-row {
  display: flex;
  gap: 8px;
}

.mode-button {
  padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.78);
  color: #dbeafe;
  cursor: pointer;
}

.mode-button.is-active {
  background: rgba(3, 105, 161, 0.88);
  color: #f8fafc;
  border-color: rgba(125, 211, 252, 0.42);
}

.mode-description {
  margin: 10px 0 0;
  color: #cbd5e1;
  line-height: 1.45;
}

.floating-actions {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 999;
  display: flex;
  gap: 8px;
}

.floating-actions button {
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(15,23,42,0.88);
  color: white;
  cursor: pointer;
}

@media (max-width: 640px) {
  .mode-switch-row {
    flex-direction: column;
  }
}
</style>