<template>
  <div class="viewer-shell">
    <div ref="container" class="cesium-container" />

    <button
      v-if="!showHeaderPanel"
      type="button"
      class="scene-header-tab"
      aria-label="เปิดแผงข้อมูล"
      @click="showHeaderPanel = true"
    >
      แผงข้อมูล
    </button>

    <header v-if="showHeaderPanel" class="scene-card scene-header">
      <div class="scene-header-toolbar">
        <p class="eyebrow scene-header-eyebrow">
          Bangkok OSM Demo
        </p>
        <button
          type="button"
          class="panel-close-button"
          aria-label="ปิดแผงข้อมูล"
          @click="showHeaderPanel = false"
        >
          ปิด
        </button>
      </div>
      <h1 class="title">กรุงเทพมหานคร</h1>
      <p class="description">
        เดโมกรุงเทพบน satellite imagery สำหรับดู OSM Buildings แบบเมืองหนาแน่น
        พร้อมจำลองระดับน้ำตามเวลา 24 ชม. (ฝน 12:00–16:00 น.) แสงกลางวัน–กลางคืนตามพระอาทิตย์ขึ้น/ตกจริง และชั้น Bangkok Custom 3D
      </p>

      <div class="status-row">
        <span class="status-dot" />
        <span>{{ statusMessage }}</span>
      </div>

      <div class="chip-row">
        <span class="chip">เขต {{ districtCount }} เขต</span>
        <span class="chip">สถานีน้ำ {{ waterStationCount }} จุด</span>
        <span class="chip">เตือน {{ alertStationCount }} จุด</span>
        <span class="chip">{{ highestWaterChip }}</span>
        <span class="chip">{{ terrainStatusLabel }}</span>
        <span class="chip">{{ context3dLabel }}</span>
        <span class="chip">{{ custom3dStatusLabel }}</span>
        <span class="chip">{{ rainHeatmapStatusLabel }}</span>
        <span class="chip">Layer เปิด {{ visibleLayerCount }} ชั้น</span>
        <span class="chip" :class="{ 'chip-rain': isRainPeriodNow }">
          {{ simulationTimeLabel }} น.
        </span>
      </div>
    </header>

    <aside v-if="props.showSidebar" class="scene-card control-panel">
      <section class="panel-section">
        <h2>Layers</h2>

        <label class="toggle-row">
          <input
            v-model="layerVisibility.province"
            type="checkbox"
            @change="handleLayerToggle('province')"
          >
          <span>ขอบเขตกรุงเทพ</span>
        </label>

        <label class="toggle-row">
          <input
            v-model="layerVisibility.districts"
            type="checkbox"
            @change="handleLayerToggle('districts')"
          >
          <span>ขอบเขตเขต</span>
        </label>

        <label class="toggle-row" :class="{ 'is-disabled': !hasIonToken }">
          <input
            v-model="layerVisibility.buildings"
            type="checkbox"
            :disabled="!hasIonToken || buildingsLoading"
            @change="handleLayerToggle('buildings')"
          >
          <span>3D context layer (OSM Buildings)</span>
        </label>

        <label class="toggle-row" :class="{ 'is-disabled': photorealisticLoading || !hasPhotorealisticSource }">
          <input
            v-model="layerVisibility.photorealistic"
            type="checkbox"
            :disabled="photorealisticLoading || !hasPhotorealisticSource"
            @change="handleLayerToggle('photorealistic')"
          >
          <span>Bangkok Custom 3D</span>
        </label>

        <label
          v-if="hasPhotorealisticSource"
          class="toggle-row toggle-row-nested"
          :class="{ 'is-disabled': !layerVisibility.photorealistic }"
        >
          <input
            v-model="compareWithOsm"
            type="checkbox"
            :disabled="!layerVisibility.photorealistic"
            @change="handleCompareModeChange"
          >
          <span>เปรียบเทียบกับ OSM (เปิด Custom แล้วซ่อน OSM)</span>
        </label>

        <label class="toggle-row">
          <input
            v-model="layerVisibility.water"
            type="checkbox"
            @change="handleLayerToggle('water')"
          >
          <span>Water markers</span>
        </label>

        <label class="toggle-row">
          <input
            v-model="layerVisibility.flood"
            type="checkbox"
            @change="handleLayerToggle('flood')"
          >
          <span>แผ่นน้ำท่วม (จำลอง)</span>
        </label>

        <label class="toggle-row">
          <input
            v-model="layerVisibility.rain"
            type="checkbox"
            @change="handleLayerToggle('rain')"
          >
          <span>ฝนตก (จำลอง)</span>
        </label>

        <label class="toggle-row">
          <input
            v-model="layerVisibility.rainHeatmap"
            type="checkbox"
            :disabled="rainHeatmapLoading"
            @change="handleLayerToggle('rainHeatmap')"
          >
          <span>Rainfall Heatmap (Open-Meteo)</span>
        </label>

        <label
          class="toggle-row toggle-row-nested"
          :class="{ 'is-disabled': !layerVisibility.rainHeatmap || rainHeatmapLoading }"
        >
          <span>ความเข้ม Heatmap</span>
          <input
            v-model.number="rainHeatmapOpacity"
            type="range"
            min="0.15"
            max="0.95"
            step="0.01"
            :disabled="!layerVisibility.rainHeatmap || rainHeatmapLoading"
            @input="syncLayerVisibility"
          >
        </label>

        <p class="panel-note">
          ข้อมูล Real-time (Open-Meteo) แบบรายชั่วโมง
        </p>

        <div class="date-range-grid">
          <div class="date-field">
            <span>เลือกวันที่</span>
            <UInput
              id="heatmap-date"
              v-model="selectedHeatmapDate"
              type="date"
              @change="handleHeatmapDateChange"
            />
          </div>
          <div class="date-field">
            <span>เลือกชั่วโมง</span>
            <select v-model.number="selectedHeatmapHour" @change="handleHeatmapHourChange">
              <option v-for="hour in 24" :key="hour - 1" :value="hour - 1">
                {{ String(hour - 1).padStart(2, "0") }}:00
              </option>
            </select>
          </div>
        </div>

        <label class="toggle-row">
          <input
            v-model="layerVisibility.clouds"
            type="checkbox"
            @change="handleLayerToggle('clouds')"
          >
          <span>เมฆ (Cumulus)</span>
        </label>

        <p class="panel-note">
          {{ layerHelpText }}
        </p>
        <p class="panel-note">
          {{ rainHeatmapStatusLabel }} · {{ selectedHeatmapDate }} {{ selectedHeatmapHourLabel }} · แหล่งข้อมูล {{ rainHeatmapSourceLabel }} · ค่าสูงสุด {{ rainHeatmapMaxLabel }}
        </p>
      </section>

      <section class="panel-section">
        <h2>Camera Spots</h2>
        <div class="bookmark-grid">
          <button class="bookmark-button" @click="focusBangkokOverview()">
            <strong>ภาพรวมกรุงเทพ</strong>
            <span>ดูขอบเขตกรุงเทพและโครงเมืองโดยรวม</span>
          </button>
          <button class="bookmark-button" @click="focusCityCore()">
            <strong>ใจกลางเมือง</strong>
            <span>มุมเฉียง close-up ให้เห็น OSM Buildings ชัดที่สุด</span>
          </button>
          <button
            v-if="hasPhotorealisticSource"
            class="bookmark-button"
            @click="focusCustomTiles()"
          >
            <strong>ดู Custom 3D</strong>
            <span>ซูมเข้า extruded buildings จาก tileset ที่ตั้งค่าไว้</span>
          </button>
          <button class="bookmark-button" @click="focusRiverside()">
            <strong>โซนริมเจ้าพระยา</strong>
            <span>มุมเมืองติดแม่น้ำเพื่อดูมิติ skyline อีกแบบ</span>
          </button>
        </div>
      </section>

      <section class="panel-section">
        <h2>จำลองระดับน้ำตามเวลา</h2>
        <p class="panel-note">
          ช่วงฝน {{ RAIN_START_TIME }}–{{ RAIN_END_TIME }} น. — ฝนตกและน้ำท่วมใจกลางเมืองขึ้นอัตโนมัติ (เปิด layer ฝน/น้ำท่วม)
        </p>
        <div class="time-display-row">
          <strong class="time-label">{{ simulationTimeLabel }} น.</strong>
          <span class="day-phase-badge">{{ dayNightPhaseLabel }}</span>
          <span v-if="isRainPeriodNow" class="rain-badge">ฝนตก</span>
          <span v-else class="dry-badge">ไม่มีฝน</span>
        </div>
        <p class="panel-note sun-times-note">
          พระอาทิตย์ขึ้น {{ bangkokSunTimes.sunriseLabel }} น. · ตก {{ bangkokSunTimes.sunsetLabel }} น.
        </p>
        <input
          class="time-slider"
          type="range"
          min="0"
          max="1000"
          step="1"
          :value="Math.round(simulationProgress * 1000)"
          @input="onSimulationSliderInput"
        >
        <div class="time-range-labels">
          <span>{{ CLOCK_START_TIME }}</span>
          <span>{{ CLOCK_STOP_TIME }}</span>
        </div>
        <div class="time-control-row">
          <button class="mini-button" type="button" @click="toggleClockPlayback">
            {{ clockPlaying ? "หยุด" : "เล่น" }}
          </button>
          <label class="speed-select">
            <span>ความเร็ว</span>
            <select v-model.number="clockMultiplier" @change="applyClockMultiplier">
              <option :value="50">
                50×
              </option>
              <option :value="100">
                100×
              </option>
              <option :value="200">
                200×
              </option>
              <option :value="500">
                500×
              </option>
            </select>
          </label>
        </div>
      </section>

      <section class="panel-section">
        <h2>Water Summary</h2>
        <div class="summary-grid">
          <div class="summary-card">
            <strong>{{ waterStationCount }}</strong>
            <span>จุดวัด mock</span>
          </div>
          <div class="summary-card">
            <strong>{{ alertStationCount }}</strong>
            <span>จุดระดับเตือน+</span>
          </div>
          <div class="summary-card">
            <strong>{{ highestWaterStation?.levelMeters.toFixed(2) ?? "-" }} ม.</strong>
            <span>{{ highestWaterStation?.label ?? "รอข้อมูล" }}</span>
          </div>
        </div>
      </section>

      <section class="panel-section">
        <h2>Water Stations</h2>
        <ul class="station-list">
          <li
            v-for="station in waterStationsAtCurrentTime"
            :key="station.id"
            class="station-item"
            :class="{ 'is-active': activeWaterStation?.id === station.id }"
          >
            <button class="station-button" @click="focusWaterStationById(station.id)">
              <div class="station-row">
                <strong>{{ station.label }}</strong>
                <span class="water-badge" :class="`status-${station.status}`">
                  {{ waterStatusLabel(station.status) }}
                </span>
              </div>
              <span class="station-meta">
                {{ station.districtName }} • {{ station.levelMeters.toFixed(2) }} ม.
              </span>
              <span class="station-meta">{{ station.updatedAt }}</span>
            </button>
          </li>
        </ul>
      </section>

      <section v-if="activeWaterStation" class="panel-section district-card water-card">
        <p class="district-eyebrow">กำลังโฟกัสจุดวัดน้ำ</p>
        <h2>{{ activeWaterStation.label }}</h2>
        <p class="district-subtitle">{{ activeWaterStation.summary }}</p>

        <dl class="detail-list">
          <div>
            <dt>ระดับน้ำ</dt>
            <dd>{{ activeWaterStation.levelMeters.toFixed(2) }} เมตร</dd>
          </div>
          <div>
            <dt>สถานะ</dt>
            <dd>{{ waterStatusLabel(activeWaterStation.status) }}</dd>
          </div>
          <div>
            <dt>อัปเดตล่าสุด</dt>
            <dd>{{ activeWaterStation.updatedAt }}</dd>
          </div>
        </dl>

        <div class="action-row">
          <button class="mini-button" @click="focusWaterStationById(activeWaterStation.id)">
            โฟกัสจุดนี้อีกครั้ง
          </button>
          <button class="mini-button mini-button-muted" @click="clearSelection">
            กลับภาพรวม
          </button>
        </div>
      </section>

      <section v-else-if="selectedDistrict" class="panel-section district-card">
        <p class="district-eyebrow">กำลังโฟกัสเขต</p>
        <h2>{{ selectedDistrict.amp_th }}</h2>
        <p class="district-subtitle">{{ selectedDistrict.amp_en }}</p>

        <dl class="detail-list">
          <div>
            <dt>รหัสเขต</dt>
            <dd>{{ selectedDistrict.amp_code }}</dd>
          </div>
          <div>
            <dt>พื้นที่</dt>
            <dd>{{ selectedDistrict.area_sqkm.toFixed(2) }} ตร.กม.</dd>
          </div>
        </dl>

        <div class="action-row">
          <button class="mini-button" @click="focusSelectedDistrict">
            โฟกัสอีกครั้ง
          </button>
          <button class="mini-button mini-button-muted" @click="clearSelection">
            กลับภาพรวม
          </button>
        </div>
      </section>

      <section v-else-if="hoveredDistrict" class="panel-section district-card preview-card">
        <p class="district-eyebrow">กำลังชี้อยู่ที่</p>
        <h2>{{ hoveredDistrict.amp_th }}</h2>
        <p class="district-subtitle">{{ hoveredDistrict.amp_en }}</p>
        <p class="panel-note">
          คลิกเพื่อโฟกัสเขตนี้และดูชั้น OSM, Custom 3D และจุดน้ำใกล้เคียง
        </p>
      </section>

      <p class="source-note">
        ข้อมูลขอบเขต: OpenGISData-Thailand, ภาพพื้นหลัง: ArcGIS World Imagery,
        อาคาร 3D: Cesium OSM Buildings, Custom 3D: extruded tileset ตาม URL ที่ตั้งค่าไว้ (ไม่ใช่ Google Photorealistic),
        ข้อมูลน้ำ: mock design
      </p>
    </aside>
  </div>
</template>

<script setup lang="ts">
import * as cesium from "cesium";
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import {
  bangkokWaterStations,
  type BangkokWaterStation,
  type WaterLevelStatus,
} from "../composable/bangkokWaterMock";
import { createBangkokCloudCollection } from "../composable/bangkokCloudLayer";
import {
  createBangkokFloodWaterSurface,
  syncFloodWaterSurfaceVisibility,
  type BangkokFloodWaterSurface,
} from "../composable/bangkokFloodWaterSurface";
import {
  createBangkokRainSystem,
  destroyBangkokRainSystem,
  type BangkokRainSystem,
} from "../composable/bangkokRainLayer";
import { createBangkokRainHeatmapLayer, type BangkokRainHeatmapLayer } from "../composable/bangkokRainHeatmapLayer";
import {
  getBangkokSunTimes,
  getDayNightPhaseLabel,
  syncBangkokDayNightLighting,
  type BangkokSunTimes,
  type DayNightPhase,
} from "../composable/bangkokSunCycle";
import {
  buildStationLevelProperties,
  CLOCK_START_TIME,
  CLOCK_STOP_TIME,
  createFloodLevelProperty,
  formatSimulationClockTime,
  getLevelAtTime,
  getSimulationProgress,
  isRainPeriod,
  levelToStatus,
  progressToSimulationTime,
  RAIN_END_TIME,
  RAIN_START_TIME,
  WATER_SIMULATION_DATE,
  waterSimulationClock,
} from "../composable/bangkokWaterTimeSeries";
import {
  fetchBangkokRainDatasetForDate,
  getRainFrameByDateHour,
  type OpenMeteoRainDataset,
} from "../composable/openMeteoRainClient";

type DistrictState = {
  amp_code: string;
  amp_th: string;
  amp_en: string;
  area_sqkm: number;
};

type LayerKey =
  | "province"
  | "districts"
  | "buildings"
  | "photorealistic"
  | "water"
  | "flood"
  | "rain"
  | "rainHeatmap"
  | "clouds";

const props = withDefaults(defineProps<{
  showSidebar?: boolean;
}>(), {
  showSidebar: true,
});

const showHeaderPanel = defineModel<boolean>("showHeaderPanel", { default: true });

function formatDateBangkok(date: Date): string {
  const bangkokMs = date.getTime() + (7 * 60 * 60 * 1000);
  const bangkok = new Date(bangkokMs);
  const year = bangkok.getUTCFullYear();
  const month = String(bangkok.getUTCMonth() + 1).padStart(2, "0");
  const day = String(bangkok.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultRealtimeDateRange(): { startDateIso: string; endDateIso: string } {
  const now = new Date();
  const start = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  const end = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
  return {
    startDateIso: formatDateBangkok(start),
    endDateIso: formatDateBangkok(end),
  };
}

function getCurrentBangkokHour(): number {
  const now = new Date();
  const bangkokMs = now.getTime() + (7 * 60 * 60 * 1000);
  const bangkok = new Date(bangkokMs);
  return bangkok.getUTCHours();
}

const runtimeConfig = useRuntimeConfig();
const container = ref<HTMLDivElement | null>(null);
const districtCount = ref(0);
const terrainEnabled = ref(false);
const baseStatusMessage = ref("กำลังโหลดเดโมกรุงเทพ...");
const selectedDistrictCode = ref<string | null>(null);
const hoveredDistrictCode = ref<string | null>(null);
const activeWaterStationId = ref<string | null>(null);
const buildingsLoading = ref(false);
const photorealisticLoading = ref(false);
const context3dReady = ref(false);
const photorealisticReady = ref(false);
const compareWithOsm = ref(true);
const clockPlaying = ref(false);
const clockMultiplier = ref(50);
const simulationProgress = ref(0);
const isRainPeriodNow = ref(false);
const simulationTime = ref(cesium.JulianDate.clone(waterSimulationClock.start));
const rainHeatmapOpacity = ref(0.82);
const rainHeatmapLoading = ref(false);
const rainHeatmapError = ref("");
const rainHeatmapMaxLabel = ref("-");
const rainHeatmapSourceLabel = ref("-");
const defaultRealtimeDateRange = getDefaultRealtimeDateRange();
const selectedHeatmapDate = ref(defaultRealtimeDateRange.endDateIso);
const selectedHeatmapHour = ref(getCurrentBangkokHour());
const bangkokSunTimes: BangkokSunTimes = getBangkokSunTimes(WATER_SIMULATION_DATE);
const dayNightPhase = ref<DayNightPhase>("day");

const ionToken = runtimeConfig.public.cesiumIonToken?.trim() ?? "";
const photorealisticTilesetUrl = runtimeConfig.public.bangkokPhotorealisticTilesetUrl?.trim() ?? "";
const hasIonToken = ionToken.length > 0;
const hasPhotorealisticSource = photorealisticTilesetUrl.length > 0;

const layerVisibility = reactive({
  province: true,
  districts: true,
  buildings: hasIonToken,
  photorealistic: hasPhotorealisticSource,
  water: true,
  flood: true,
  rain: true,
  rainHeatmap: false,
  clouds: false,
});

const districtStates = reactive<Record<string, DistrictState>>({});
const floodHideThreshold = 0.02;
const floodMaxVisualDepth = 2.5;
const TIMELAPSE_SLOW_SYNC_INTERVAL_MS = 180;
const TIMELAPSE_FAST_MULTIPLIER_THRESHOLD = 300;
const WATER_MARKER_SYNC_INTERVAL_MS = 220;

let stationLevelProperties = new Map<string, cesium.SampledProperty>();
let floodLevelProperty: cesium.SampledProperty | null = null;
let floodDataSource: cesium.GeoJsonDataSource | null = null;
let clockTickRemover: (() => void) | null = null;

let viewer: cesium.Viewer | null = null;
let clickHandler: cesium.ScreenSpaceEventHandler | null = null;
let hoverHandler: cesium.ScreenSpaceEventHandler | null = null;
let provinceDataSource: cesium.GeoJsonDataSource | null = null;
let districtDataSource: cesium.GeoJsonDataSource | null = null;
let osmBuildingsTileset: cesium.Cesium3DTileset | null = null;
let photorealisticTileset: cesium.Cesium3DTileset | null = null;
let buildingsBeforeCustomCompare: boolean | null = null;
let cloudCollection: ReturnType<typeof createBangkokCloudCollection> | null = null;
let rainSystem: BangkokRainSystem | null = null;
let rainHeatmapLayer: BangkokRainHeatmapLayer | null = null;
let rainDataset: OpenMeteoRainDataset | null = null;
let lastRainHeatmapTimestampIso: string | null = null;
let floodWaterSurface: BangkokFloodWaterSurface | null = null;
let lastSlowSyncAtMs = 0;
let lastFloodDepthBucket = -1;
let lastFloodZoneVisible: boolean | null = null;
let lastWaterStationVisualSyncAtMs = 0;
let fogStateBeforeClouds: {
  enabled: boolean;
  density: number;
  minimumBrightness: number;
} | null = null;

const districtEntities = new Map<string, cesium.Entity>();
const waterStationEntities = new Map<string, cesium.Entity>();

const waterStationCount = bangkokWaterStations.length;

const selectedDistrict = computed(() => (
  selectedDistrictCode.value ? districtStates[selectedDistrictCode.value] ?? null : null
));

const hoveredDistrict = computed(() => {
  if (!hoveredDistrictCode.value || hoveredDistrictCode.value === selectedDistrictCode.value) {
    return null;
  }

  return districtStates[hoveredDistrictCode.value] ?? null;
});

const simulationTimeLabel = computed(() => formatSimulationClockTime(simulationTime.value));
const dayNightPhaseLabel = computed(() => getDayNightPhaseLabel(dayNightPhase.value));
const selectedHeatmapHourLabel = computed(() => `${String(selectedHeatmapHour.value).padStart(2, "0")}:00`);

const waterStationsAtCurrentTime = computed(() => bangkokWaterStations.map((station) => {
  const levelProperty = stationLevelProperties.get(station.id);
  const levelMeters = levelProperty
    ? getLevelAtTime(levelProperty, simulationTime.value, station.levelMeters)
    : station.levelMeters;

  return {
    ...station,
    levelMeters,
    status: levelToStatus(levelMeters),
    districtName: districtStates[station.districtCode]?.amp_th ?? station.districtCode,
    updatedAt: `${WATER_SIMULATION_DATE} ${simulationTimeLabel.value}`,
  };
}));

const activeWaterStation = computed(() => (
  activeWaterStationId.value
    ? waterStationsAtCurrentTime.value.find((station) => station.id === activeWaterStationId.value) ?? null
    : null
));

const alertStationCount = computed(() => (
  waterStationsAtCurrentTime.value.filter(
    (station) => station.status === "warning" || station.status === "critical",
  ).length
));

const highestWaterStation = computed(() => (
  waterStationsAtCurrentTime.value.reduce<BangkokWaterStation | null>((highest, station) => {
    if (!highest || station.levelMeters > highest.levelMeters) {
      return station;
    }

    return highest;
  }, null)
));

const highestWaterChip = computed(() => (
  highestWaterStation.value
    ? `สูงสุด ${highestWaterStation.value.levelMeters.toFixed(2)} ม.`
    : "รอข้อมูลน้ำ"
));

const visibleLayerCount = computed(() => Object.values(layerVisibility).filter(Boolean).length);

const statusMessage = computed(() => {
  if (rainHeatmapLoading.value) {
    return "กำลังโหลดชั้นฝน Open-Meteo...";
  }

  if (rainHeatmapError.value) {
    return "โหลดชั้นฝน Open-Meteo ไม่สำเร็จ";
  }

  if (buildingsLoading.value && photorealisticLoading.value) {
    return "กำลังโหลด OSM Buildings และ Bangkok Custom 3D จาก URL ที่ตั้งค่าไว้...";
  }

  if (photorealisticLoading.value) {
    return "กำลังโหลด Bangkok Custom 3D จาก URL ที่ตั้งค่าไว้...";
  }

  if (buildingsLoading.value) {
    return "กำลังโหลด OSM Buildings ของกรุงเทพ...";
  }

  if (activeWaterStation.value) {
    return `โฟกัสที่จุดน้ำ ${activeWaterStation.value.label}`;
  }

  if (selectedDistrict.value) {
    return `โฟกัสที่เขต ${selectedDistrict.value.amp_th}`;
  }

  if (hoveredDistrict.value) {
    return `กำลังชี้ที่ ${hoveredDistrict.value.amp_th}`;
  }

  return baseStatusMessage.value;
});

const terrainStatusLabel = computed(() => (
  terrainEnabled.value ? "Terrain พร้อม" : "Terrain ต้องใช้ ion token"
));

const context3dLabel = computed(() => {
  if (!hasIonToken) {
    return "OSM Buildings ต้องใช้ ion token";
  }

  if (buildingsLoading.value) {
    return "OSM Buildings กำลังโหลด";
  }

  if (context3dReady.value) {
    return layerVisibility.buildings ? "OSM Buildings เปิดอยู่" : "OSM Buildings พร้อมเปิด";
  }

  return "OSM Buildings ยังไม่โหลด";
});

const custom3dStatusLabel = computed(() => {
  if (photorealisticLoading.value) {
    return "Custom 3D กำลังโหลด";
  }

  if (photorealisticReady.value) {
    if (!layerVisibility.photorealistic) {
      return "Custom 3D พร้อมเปิด";
    }

    if (compareWithOsm.value) {
      return "Custom 3D เปิดอยู่ (ดูอย่างเดียว)";
    }

    if (layerVisibility.buildings) {
      return "Custom 3D เปิดอยู่ (ซ้อน OSM)";
    }

    return "Custom 3D เปิดอยู่";
  }

  if (!hasPhotorealisticSource) {
    return "Custom 3D รอ URL";
  }

  return "Custom 3D พร้อมตาม URL";
});

const rainHeatmapStatusLabel = computed(() => {
  if (rainHeatmapLoading.value) {
    return "Heatmap กำลังโหลด";
  }

  if (rainHeatmapError.value) {
    return "Heatmap ผิดพลาด";
  }

  if (!rainHeatmapLayer) {
    return "Heatmap รอข้อมูล";
  }

  return layerVisibility.rainHeatmap ? "Rain mode: Real-time" : "Rain mode: Real-time (ปิด layer)";
});

const layerHelpText = computed(() => {
  if (photorealisticLoading.value) {
    return "กำลังโหลด Bangkok Custom 3D (extruded footprints จาก tileset URL) — ไม่ใช่ mesh photogrammetry แบบ Google";
  }

  if (!hasIonToken) {
    return "ถ้าอยากเปิด terrain และ OSM Buildings ของกรุงเทพ ให้ตั้งค่า NUXT_PUBLIC_CESIUM_ION_TOKEN ก่อน";
  }

  if (!context3dReady.value && layerVisibility.buildings) {
    return "กำลังโหลด Cesium OSM Buildings เพื่อสร้างเดโมเมือง 3D ของกรุงเทพ";
  }

  if (layerVisibility.photorealistic && !hasPhotorealisticSource) {
    return "ยังไม่ได้ตั้งค่า NUXT_PUBLIC_BANGKOK_PHOTOREALISTIC_TILESET_URL จึงยังเปิด Bangkok Custom 3D ไม่ได้";
  }

  if (layerVisibility.photorealistic && photorealisticReady.value) {
    if (compareWithOsm.value) {
      return "โหมดเปรียบเทียบ: ปิด OSM อัตโนมัติเพื่อให้เห็น extruded buildings สีส้มชัด — สลับเปิด/ปิด Custom 3D เพื่อเทียบกับดาวเทียม";
    }

    if (layerVisibility.buildings) {
      return "ซ้อนทั้งสองชั้น: OSM ถูกทำให้โปร่งและไม่มี outline เพื่อไม่บัง Custom 3D";
    }

    return "เปิด Bangkok Custom 3D อย่างเดียวบน satellite imagery";
  }

  if (rainHeatmapError.value) {
    return "ชั้นฝน Open-Meteo โหลดไม่สำเร็จ จะใช้เอฟเฟกต์ฝนจำลองต่อไปจนกว่าจะเชื่อมข้อมูลได้";
  }

  if (rainHeatmapLoading.value) {
    return "กำลังดึงข้อมูล Open-Meteo รายชั่วโมงของวันที่เลือก";
  }

  return "เดโมนี้ใช้ satellite imagery ร่วมกับ OSM Buildings และ mock dashboard ระดับน้ำ — Custom 3D เป็น tileset extruded ที่ host เอง";
});

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getFloodDepthAtTime(time: cesium.JulianDate): number {
  if (!floodLevelProperty) {
    return 0;
  }

  const value = floodLevelProperty.getValue(time);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
}

function getFloodDepthBucket(time: cesium.JulianDate): number {
  const depth = getFloodDepthAtTime(time);
  if (depth <= floodHideThreshold) {
    return 0;
  }

  return Math.max(1, Math.round(clamp(depth / floodMaxVisualDepth, 0, 1) * 10));
}

function getFloodZoneVisibleState(time: cesium.JulianDate): boolean {
  return layerVisibility.flood && getFloodDepthAtTime(time) > floodHideThreshold;
}

function syncFloodZoneDepthVisibility(time: cesium.JulianDate, force = false): void {
  if (!floodDataSource) {
    return;
  }

  const depthBucket = getFloodDepthBucket(time);
  const nextVisible = getFloodZoneVisibleState(time);
  const shouldUpdateMaterial = force || lastFloodDepthBucket !== depthBucket;
  const shouldUpdateVisibility = force || lastFloodZoneVisible !== nextVisible;

  if (!shouldUpdateMaterial && !shouldUpdateVisibility) {
    return;
  }

  const bucketAlpha = depthBucket <= 0
    ? 0
    : 0.12 + ((depthBucket / 10) * 0.38);
  const bucketColor = cesium.Color.fromCssColorString("#0ea5e9").withAlpha(bucketAlpha);

  for (const entity of floodDataSource.entities.values) {
    if (!entity.polygon) {
      continue;
    }

    if (shouldUpdateMaterial) {
      entity.polygon.material = new cesium.ColorMaterialProperty(bucketColor);
    }

    if (shouldUpdateVisibility) {
      entity.show = nextVisible;
    }
  }

  lastFloodDepthBucket = depthBucket;
  lastFloodZoneVisible = nextVisible;
}

function getPropertyValue<T>(entity: cesium.Entity, key: string): T | undefined {
  return entity.properties?.[key]?.getValue(cesium.JulianDate.now()) as T | undefined;
}

function getDistrictCodeFromEntity(entity: cesium.Entity | null) {
  if (!entity) {
    return null;
  }

  return getPropertyValue<string>(entity, "amp_code") ?? null;
}

function getWaterStationIdFromEntity(entity: cesium.Entity | null) {
  if (!entity) {
    return null;
  }

  return getPropertyValue<string>(entity, "waterStationId") ?? null;
}

function buildDistrictState(entity: cesium.Entity): DistrictState | null {
  const amp_code = getPropertyValue<string>(entity, "amp_code");
  const amp_th = getPropertyValue<string>(entity, "amp_th");
  const amp_en = getPropertyValue<string>(entity, "amp_en");
  const area_sqkm = getPropertyValue<number>(entity, "area_sqkm");

  if (!amp_code || !amp_th || !amp_en || typeof area_sqkm !== "number") {
    return null;
  }

  return {
    amp_code,
    amp_th,
    amp_en,
    area_sqkm,
  };
}

function waterStatusLabel(status: WaterLevelStatus) {
  switch (status) {
    case "critical":
      return "วิกฤต";
    case "warning":
      return "เตือน";
    case "watch":
      return "เฝ้าระวัง";
    default:
      return "ปกติ";
  }
}

function getWaterStatusColor(status: WaterLevelStatus) {
  switch (status) {
    case "critical":
      return cesium.Color.fromCssColorString("#ef4444");
    case "warning":
      return cesium.Color.fromCssColorString("#f97316");
    case "watch":
      return cesium.Color.fromCssColorString("#f59e0b");
    default:
      return cesium.Color.fromCssColorString("#22c55e");
  }
}

function getStationLevelForTime(station: BangkokWaterStation, time: cesium.JulianDate): number {
  const levelProperty = stationLevelProperties.get(station.id);
  return levelProperty
    ? getLevelAtTime(levelProperty, time, station.levelMeters)
    : station.levelMeters;
}

function syncWaterStationVisuals(time: cesium.JulianDate, force = false): void {
  const nowMs = Date.now();
  const syncInterval = clockMultiplier.value >= TIMELAPSE_FAST_MULTIPLIER_THRESHOLD
    ? WATER_MARKER_SYNC_INTERVAL_MS * 2
    : WATER_MARKER_SYNC_INTERVAL_MS;

  if (!force && nowMs - lastWaterStationVisualSyncAtMs < syncInterval) {
    return;
  }

  lastWaterStationVisualSyncAtMs = nowMs;

  for (const station of bangkokWaterStations) {
    const entity = waterStationEntities.get(station.id);
    if (!entity?.point || !entity.polyline || !entity.label) {
      continue;
    }

    const level = getStationLevelForTime(station, time);
    const statusColor = getWaterStatusColor(levelToStatus(level));
    entity.point.color = new cesium.ConstantProperty(statusColor);
    entity.polyline.material = new cesium.ColorMaterialProperty(statusColor.withAlpha(0.75));
    entity.label.text = new cesium.ConstantProperty(`${station.label}\n${level.toFixed(2)} ม.`);
  }
}

function applyProvinceStyle() {
  if (!provinceDataSource) {
    return;
  }

  for (const entity of provinceDataSource.entities.values) {
    if (!entity.polygon) {
      continue;
    }

    entity.polygon.material = new cesium.ColorMaterialProperty(
      cesium.Color.WHITE.withAlpha(0.01),
    );
    entity.polygon.outline = new cesium.ConstantProperty(true);
    entity.polygon.outlineColor = new cesium.ConstantProperty(
      cesium.Color.fromCssColorString("#f8fafc").withAlpha(0.9),
    );
  }
}

function applyDistrictStyle(code: string) {
  const entity = districtEntities.get(code);
  const state = districtStates[code];

  if (!entity?.polygon || !state) {
    return;
  }

  const isSelected = selectedDistrictCode.value === code;
  const isHovered = hoveredDistrictCode.value === code;
  let fillColor = cesium.Color.fromCssColorString("#f8fafc").withAlpha(0.03);
  let outlineColor = cesium.Color.fromCssColorString("#e2e8f0").withAlpha(0.24);

  if (isHovered) {
    fillColor = cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.12);
    outlineColor = cesium.Color.fromCssColorString("#7dd3fc").withAlpha(0.92);
  }

  if (isSelected) {
    fillColor = cesium.Color.fromCssColorString("#f59e0b").withAlpha(0.16);
    outlineColor = cesium.Color.fromCssColorString("#fbbf24").withAlpha(0.98);
  }

  entity.polygon.material = new cesium.ColorMaterialProperty(fillColor);
  entity.polygon.outline = new cesium.ConstantProperty(true);
  entity.polygon.outlineColor = new cesium.ConstantProperty(outlineColor);
  entity.show = layerVisibility.districts;
}

function isOsmStackedWithCustom() {
  return (
    layerVisibility.photorealistic
    && layerVisibility.buildings
    && !compareWithOsm.value
    && photorealisticReady.value
  );
}

function setOsmOutlineVisible(visible: boolean) {
  if (!osmBuildingsTileset) {
    return;
  }

  const tileset = osmBuildingsTileset as cesium.Cesium3DTileset & { showOutline?: boolean };
  if (typeof tileset.showOutline === "boolean") {
    tileset.showOutline = visible;
  }
}

function applyOsmBuildingStyle(stacked = isOsmStackedWithCustom()) {
  if (!osmBuildingsTileset) {
    return;
  }

  osmBuildingsTileset.maximumScreenSpaceError = 1;
  osmBuildingsTileset.dynamicScreenSpaceError = true;
  setOsmOutlineVisible(!stacked);

  if (stacked) {
    osmBuildingsTileset.style = new cesium.Cesium3DTileStyle({
      color: {
        conditions: [
          ["true", "color('#e2e8f0', 0.32)"],
        ],
      },
    });
    return;
  }

  osmBuildingsTileset.style = new cesium.Cesium3DTileStyle({
    color: {
      conditions: [
        ["${building} === 'commercial' || ${building} === 'office'", "color('#dbeafe', 1.0)"],
        ["${building} === 'apartments' || ${building} === 'residential'", "color('#f8fafc', 0.99)"],
        ["${building} === 'industrial' || ${building} === 'warehouse'", "color('#d6c3b0', 0.97)"],
        ["${building} === 'hospital' || ${building} === 'civic'", "color('#e0f2fe', 0.99)"],
        ["true", "color('#e2e8f0', 0.98)"],
      ],
    },
  });
}

function applyCustomTilesetStyle() {
  if (!photorealisticTileset) {
    return;
  }

  photorealisticTileset.maximumScreenSpaceError = 0.5;
  photorealisticTileset.dynamicScreenSpaceError = true;
  photorealisticTileset.style = new cesium.Cesium3DTileStyle({
    color: "color('#f59e0b', 0.92)",
  });
}

function syncBuildingLayerPresentation() {
  applyOsmBuildingStyle();
  applyCustomTilesetStyle();
}

function applyCustomCompareMode() {
  const customOn = layerVisibility.photorealistic && photorealisticReady.value;
  const shouldRestoreBuildings = (
    (!layerVisibility.photorealistic || !compareWithOsm.value)
    && buildingsBeforeCustomCompare !== null
  );

  if (compareWithOsm.value && customOn) {
    if (buildingsBeforeCustomCompare === null) {
      buildingsBeforeCustomCompare = layerVisibility.buildings;
    }
    layerVisibility.buildings = false;
  } else if (shouldRestoreBuildings) {
    const previousBuildingsVisibility = buildingsBeforeCustomCompare;
    if (typeof previousBuildingsVisibility === "boolean") {
      layerVisibility.buildings = previousBuildingsVisibility;
    }
    buildingsBeforeCustomCompare = null;
  }

  syncBuildingLayerPresentation();
  syncLayerVisibility();
}

function handleCompareModeChange() {
  applyCustomCompareMode();
}

function tuneBaseImageryLayer() {
  if (!viewer || viewer.imageryLayers.length === 0) {
    return;
  }

  const imageryLayer = viewer.imageryLayers.get(0);
  imageryLayer.brightness = 1.03;
  imageryLayer.contrast = 1.18;
  imageryLayer.saturation = 1.06;
  imageryLayer.gamma = 0.94;
}

function createWaterStationMarkers() {
  if (!viewer || waterStationEntities.size > 0) {
    return;
  }

  for (const station of bangkokWaterStations) {
    const initialLevel = getStationLevelForTime(station, simulationTime.value);
    const initialStatusColor = getWaterStatusColor(levelToStatus(initialLevel));

    const entity = viewer.entities.add({
      id: `water-${station.id}`,
      position: cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, 35),
      point: {
        pixelSize: 14,
        color: initialStatusColor,
        outlineColor: cesium.Color.WHITE.withAlpha(0.96),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      polyline: {
        positions: [
          cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, 0),
          cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, 28),
        ],
        width: 3,
        material: new cesium.ColorMaterialProperty(
          initialStatusColor.withAlpha(0.75),
        ),
      },
      label: {
        text: `${station.label}\n${initialLevel.toFixed(2)} ม.`,
        font: "600 12px sans-serif",
        style: cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: cesium.Color.WHITE,
        outlineColor: cesium.Color.fromCssColorString("#0f172a"),
        outlineWidth: 3,
        showBackground: true,
        backgroundColor: cesium.Color.fromCssColorString("#0f172a").withAlpha(0.66),
        pixelOffset: new cesium.Cartesian2(0, -32),
        verticalOrigin: cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      properties: {
        waterStationId: station.id,
        districtCode: station.districtCode,
      },
    });

    entity.show = layerVisibility.water;
    waterStationEntities.set(station.id, entity);
  }

  syncWaterStationVisuals(simulationTime.value, true);
}

function setupCloudLayer() {
  if (!viewer || cloudCollection) {
    return;
  }

  cloudCollection = createBangkokCloudCollection();
  cloudCollection.show = layerVisibility.clouds;
  viewer.scene.primitives.add(cloudCollection);
  syncCloudFog();
}

function syncCloudFog() {
  if (!viewer) {
    return;
  }

  const fog = viewer.scene.fog;

  if (layerVisibility.clouds) {
    if (!fogStateBeforeClouds) {
      fogStateBeforeClouds = {
        enabled: fog.enabled,
        density: fog.density,
        minimumBrightness: fog.minimumBrightness,
      };
    }

    fog.enabled = true;
    fog.density = 9.5e-5;
    fog.minimumBrightness = 0.05;
    return;
  }

  if (fogStateBeforeClouds) {
    fog.enabled = fogStateBeforeClouds.enabled;
    fog.density = fogStateBeforeClouds.density;
    fog.minimumBrightness = fogStateBeforeClouds.minimumBrightness;
    fogStateBeforeClouds = null;
  }
}

function setupRainAndFloodEffects() {
  if (!viewer || !floodLevelProperty) {
    return;
  }

  if (!rainSystem) {
    rainSystem = createBangkokRainSystem(viewer);
  }

  if (!floodWaterSurface) {
    floodWaterSurface = createBangkokFloodWaterSurface(viewer, floodLevelProperty, {
      hideThreshold: floodHideThreshold,
      maxVisualDepth: floodMaxVisualDepth,
    });
  }

  syncRainAndFloodEffects();
}

async function setupRainHeatmapLayer() {
  if (!viewer || rainHeatmapLayer || rainHeatmapLoading.value) {
    return;
  }

  rainHeatmapLoading.value = true;
  rainHeatmapError.value = "";

  try {
    rainDataset = await fetchBangkokRainDatasetForDate(selectedHeatmapDate.value);
    const initialFrame = getRainFrameByDateHour(
      rainDataset,
      selectedHeatmapDate.value,
      selectedHeatmapHour.value,
    ) ?? rainDataset.frames[0];

    if (!initialFrame) {
      throw new Error("Open-Meteo did not return any rainfall frame");
    }

    rainHeatmapLayer = await createBangkokRainHeatmapLayer(
      viewer,
      initialFrame.intensityGrid,
      rainHeatmapOpacity.value,
    );
    rainHeatmapLayer.setVisible(layerVisibility.rainHeatmap);
    rainHeatmapMaxLabel.value = `${initialFrame.maxPrecipitationMmPerHour.toFixed(1)} mm/h`;
    rainHeatmapSourceLabel.value = mapRainSourceLabel(initialFrame.source);
    lastRainHeatmapTimestampIso = initialFrame.timestampIso;
  } catch (error) {
    rainHeatmapError.value = "ไม่สามารถดึงข้อมูล Open-Meteo";
    layerVisibility.rainHeatmap = false;
    console.error("Failed to initialize Open-Meteo rain heatmap", error);
  } finally {
    rainHeatmapLoading.value = false;
  }
}

function mapRainSourceLabel(source: "historical" | "current" | "forecast"): string {
  if (source === "historical") {
    return "ย้อนหลัง";
  }

  if (source === "current") {
    return "ปัจจุบัน";
  }

  return "ล่วงหน้า";
}

function syncRainHeatmapToSimulation(force = false) {
  if (!rainHeatmapLayer || !rainDataset) {
    return;
  }

  const frame = getRainFrameByDateHour(
    rainDataset,
    selectedHeatmapDate.value,
    selectedHeatmapHour.value,
  );
  if (!frame) {
    return;
  }

  if (!force && lastRainHeatmapTimestampIso === frame.timestampIso) {
    return;
  }

  rainHeatmapLayer.updateFrame(frame.intensityGrid);
  rainHeatmapMaxLabel.value = `${frame.maxPrecipitationMmPerHour.toFixed(1)} mm/h`;
  rainHeatmapSourceLabel.value = mapRainSourceLabel(frame.source);
  lastRainHeatmapTimestampIso = frame.timestampIso;
}

function syncRainAndFloodEffects() {
  const rainVisible = layerVisibility.rain && isRainPeriodNow.value;
  rainSystem?.setVisible(rainVisible);
  rainHeatmapLayer?.setVisible(layerVisibility.rainHeatmap);
  rainHeatmapLayer?.setOpacity(rainHeatmapOpacity.value);
  syncRainHeatmapToSimulation();
  syncFloodWaterSurfaceVisibility(floodWaterSurface, layerVisibility.flood);
  floodWaterSurface?.syncAtTime(simulationTime.value);
  syncFloodZoneDepthVisibility(simulationTime.value);
}

function setupWaterSimulationClock() {
  if (!viewer) {
    return;
  }

  viewer.clock.startTime = cesium.JulianDate.clone(waterSimulationClock.start);
  viewer.clock.stopTime = cesium.JulianDate.clone(waterSimulationClock.stop);
  viewer.clock.currentTime = cesium.JulianDate.clone(waterSimulationClock.start);
  viewer.clock.clockRange = cesium.ClockRange.CLAMPED;
  viewer.clock.multiplier = clockMultiplier.value;
  viewer.clock.shouldAnimate = clockPlaying.value;

  clockTickRemover = viewer.clock.onTick.addEventListener(() => {
    syncSimulationUiFromClock();
  });

  syncSimulationUiFromClock(true);
}

function syncSimulationUiFromClock(forceSlowPath = false) {
  if (!viewer) {
    return;
  }

  const time = viewer.clock.currentTime;
  simulationTime.value = cesium.JulianDate.clone(time);
  simulationProgress.value = getSimulationProgress(time);
  isRainPeriodNow.value = isRainPeriod(time);

  const nowMs = Date.now();
  const interval = viewer.clock.multiplier >= TIMELAPSE_FAST_MULTIPLIER_THRESHOLD
    ? TIMELAPSE_SLOW_SYNC_INTERVAL_MS * 2
    : TIMELAPSE_SLOW_SYNC_INTERVAL_MS;
  const shouldRunSlowPath = forceSlowPath || (nowMs - lastSlowSyncAtMs >= interval);

  if (!shouldRunSlowPath) {
    return;
  }

  lastSlowSyncAtMs = nowMs;
  syncCloudFog();
  dayNightPhase.value = syncBangkokDayNightLighting(viewer, time, bangkokSunTimes, {
    cloudsLayerEnabled: layerVisibility.clouds,
  });
  syncWaterStationVisuals(time);
  syncRainAndFloodEffects();
}

function toggleClockPlayback() {
  if (!viewer) {
    return;
  }

  clockPlaying.value = !clockPlaying.value;
  viewer.clock.shouldAnimate = clockPlaying.value;
}

function applyClockMultiplier() {
  if (!viewer) {
    return;
  }

  viewer.clock.multiplier = clockMultiplier.value;
}

function onSimulationSliderInput(event: Event) {
  if (!viewer) {
    return;
  }

  const progress = Number((event.target as HTMLInputElement).value) / 1000;
  simulationProgress.value = progress;
  clockPlaying.value = false;
  viewer.clock.shouldAnimate = false;
  viewer.clock.currentTime = progressToSimulationTime(progress);
  syncSimulationUiFromClock(true);
}

async function createFloodZones() {
  if (!viewer || !floodLevelProperty || floodDataSource) {
    return;
  }

  floodDataSource = await cesium.GeoJsonDataSource.load("/data/bangkok-flood-zones.geojson", {
    clampToGround: terrainEnabled.value,
  });

  await viewer.dataSources.add(floodDataSource);

  for (const entity of floodDataSource.entities.values) {
    if (!entity.polygon) {
      continue;
    }

    entity.polygon.height = new cesium.ConstantProperty(0);
    entity.polygon.extrudedHeight = floodLevelProperty;
    entity.polygon.material = new cesium.ColorMaterialProperty(
      cesium.Color.fromCssColorString("#0ea5e9").withAlpha(0),
    );
    entity.polygon.outline = new cesium.ConstantProperty(false);

    if (terrainEnabled.value) {
      entity.polygon.heightReference = new cesium.ConstantProperty(
        cesium.HeightReference.CLAMP_TO_GROUND,
      );
      entity.polygon.extrudedHeightReference = new cesium.ConstantProperty(
        cesium.HeightReference.RELATIVE_TO_GROUND,
      );
    }

    entity.show = false;
  }

  lastFloodDepthBucket = -1;
  lastFloodZoneVisible = null;
  syncFloodZoneDepthVisibility(simulationTime.value, true);
}

function syncAllDistrictStyles() {
  for (const code of districtEntities.keys()) {
    applyDistrictStyle(code);
  }
}

function syncLayerVisibility() {
  if (provinceDataSource) {
    provinceDataSource.show = layerVisibility.province;
  }

  if (districtDataSource) {
    districtDataSource.show = layerVisibility.districts;
  }

  if (osmBuildingsTileset) {
    osmBuildingsTileset.show = layerVisibility.buildings;
  }

  if (photorealisticTileset) {
    photorealisticTileset.show = layerVisibility.photorealistic;
  }

  for (const entity of waterStationEntities.values()) {
    entity.show = layerVisibility.water;
  }

  if (floodDataSource) {
    floodDataSource.show = layerVisibility.flood;
  }

  syncFloodWaterSurfaceVisibility(floodWaterSurface, layerVisibility.flood);

  if (cloudCollection) {
    cloudCollection.show = layerVisibility.clouds;
  }

  syncSimulationUiFromClock();

  syncBuildingLayerPresentation();
  syncAllDistrictStyles();
}

function setHoveredDistrict(code: string | null) {
  if (hoveredDistrictCode.value === code) {
    return;
  }

  hoveredDistrictCode.value = code;
  syncAllDistrictStyles();
}

function setSelectedDistrict(code: string | null) {
  selectedDistrictCode.value = code;
  syncAllDistrictStyles();
}

function setActiveWaterStation(id: string | null) {
  activeWaterStationId.value = id;
}

async function focusBangkokOverview(duration = 2) {
  if (!viewer || !provinceDataSource) {
    return;
  }

  setSelectedDistrict(null);
  setActiveWaterStation(null);
  await viewer.flyTo(provinceDataSource, {
    duration,
    offset: new cesium.HeadingPitchRange(
      cesium.Math.toRadians(22),
      cesium.Math.toRadians(-42),
      85_000,
    ),
  });
}

async function focusCityCore(duration = 2.4) {
  if (!viewer) {
    return;
  }

  setSelectedDistrict(null);
  setActiveWaterStation(null);
  await viewer.camera.flyTo({
    destination: cesium.Cartesian3.fromDegrees(100.5402, 13.7379, 3_400),
    orientation: {
      heading: cesium.Math.toRadians(30),
      pitch: cesium.Math.toRadians(-34),
      roll: 0,
    },
    duration,
  });
}

async function focusRiverside(duration = 2.4) {
  if (!viewer) {
    return;
  }

  setSelectedDistrict(null);
  setActiveWaterStation(null);
  await viewer.camera.flyTo({
    destination: cesium.Cartesian3.fromDegrees(100.5026, 13.7262, 3_900),
    orientation: {
      heading: cesium.Math.toRadians(44),
      pitch: cesium.Math.toRadians(-32),
      roll: 0,
    },
    duration,
  });
}

async function focusCustomTiles(duration = 2.4) {
  if (!viewer || !hasPhotorealisticSource) {
    return;
  }

  setSelectedDistrict(null);
  setActiveWaterStation(null);

  if (!layerVisibility.photorealistic) {
    layerVisibility.photorealistic = true;
  }

  await ensurePhotorealisticLayer();
  applyCustomCompareMode();

  const cameraOffset = new cesium.HeadingPitchRange(
    cesium.Math.toRadians(28),
    cesium.Math.toRadians(-38),
    1_000,
  );

  if (photorealisticTileset) {
    await viewer.flyTo(photorealisticTileset, {
      duration,
      offset: cameraOffset,
    });
    baseStatusMessage.value = "กำลังดู Bangkok Custom 3D (extruded buildings)";
    return;
  }

  await viewer.camera.flyTo({
    destination: cesium.Cartesian3.fromDegrees(100.5402, 13.7379, 1_000),
    orientation: {
      heading: cesium.Math.toRadians(28),
      pitch: cesium.Math.toRadians(-38),
      roll: 0,
    },
    duration,
  });
}

async function focusDistrict(code: string, duration = 1.8) {
  if (!viewer) {
    return;
  }

  const entity = districtEntities.get(code);
  const state = districtStates[code];

  if (!entity || !state) {
    return;
  }

  const range = clamp(state.area_sqkm * 115, 2_500, 18_000);
  await viewer.flyTo(entity, {
    duration,
    offset: new cesium.HeadingPitchRange(
      cesium.Math.toRadians(26),
      cesium.Math.toRadians(-30),
      range,
    ),
  });
}

async function focusWaterStationById(id: string, duration = 1.8) {
  if (!viewer) {
    return;
  }

  const station = bangkokWaterStations.find((item) => item.id === id);
  const entity = waterStationEntities.get(id);

  if (!station || !entity) {
    return;
  }

  setSelectedDistrict(station.districtCode);
  setActiveWaterStation(id);
  setHoveredDistrict(null);

  await viewer.flyTo(entity, {
    duration,
    offset: new cesium.HeadingPitchRange(
      cesium.Math.toRadians(18),
      cesium.Math.toRadians(-34),
      1_800,
    ),
  });
}

async function focusSelectedDistrict() {
  if (!selectedDistrictCode.value) {
    return;
  }

  setActiveWaterStation(null);
  await focusDistrict(selectedDistrictCode.value, 1.2);
}

async function selectAndFocusDistrict(code: string) {
  setActiveWaterStation(null);
  setSelectedDistrict(code);
  await focusDistrict(code);
}

function clearSelection() {
  setSelectedDistrict(null);
  setActiveWaterStation(null);
  baseStatusMessage.value = "พร้อมสำรวจเดโมกรุงเทพบน satellite imagery";
  void focusBangkokOverview(1.5);
}

async function ensureContext3dLayer() {
  if (!hasIonToken || !viewer || osmBuildingsTileset || buildingsLoading.value) {
    return;
  }

  buildingsLoading.value = true;

  try {
    osmBuildingsTileset = await cesium.createOsmBuildingsAsync({
      defaultColor: cesium.Color.fromCssColorString("#f8fafc").withAlpha(0.98),
      enableShowOutline: true,
      showOutline: true,
    });
    applyOsmBuildingStyle(isOsmStackedWithCustom());
    osmBuildingsTileset.show = layerVisibility.buildings;
    viewer.scene.primitives.add(osmBuildingsTileset);
    context3dReady.value = true;
    syncBuildingLayerPresentation();
  } catch (error) {
    layerVisibility.buildings = false;
    context3dReady.value = false;
    console.error("Failed to load Bangkok OSM Buildings", error);
  } finally {
    buildingsLoading.value = false;
  }
}

async function ensurePhotorealisticLayer() {
  if (!viewer || photorealisticTileset || photorealisticLoading.value) {
    return;
  }

  if (!hasPhotorealisticSource) {
    layerVisibility.photorealistic = false;
    baseStatusMessage.value = "ยังไม่ได้ตั้งค่า Bangkok Custom 3D tileset URL";
    return;
  }

  photorealisticLoading.value = true;

  try {
    photorealisticTileset = await cesium.Cesium3DTileset.fromUrl(photorealisticTilesetUrl);
    applyCustomTilesetStyle();
    photorealisticTileset.show = layerVisibility.photorealistic;
    viewer.scene.primitives.add(photorealisticTileset);
    photorealisticReady.value = true;
    applyCustomCompareMode();

    if (layerVisibility.photorealistic) {
      await viewer.zoomTo(
        photorealisticTileset,
        new cesium.HeadingPitchRange(
          cesium.Math.toRadians(28),
          cesium.Math.toRadians(-38),
          1_200,
        ),
      );
    }

    baseStatusMessage.value = "เชื่อม Bangkok Custom 3D จาก tileset URL แล้ว";
  } catch (error) {
    layerVisibility.photorealistic = false;
    photorealisticReady.value = false;
    baseStatusMessage.value = "โหลด Bangkok Custom 3D ไม่สำเร็จ — ตรวจว่า tile server รันและ URL ถูกต้อง";
    console.error("Failed to load Bangkok Custom 3D tileset", error);
  } finally {
    photorealisticLoading.value = false;
  }
}

async function handleLayerToggle(layer: LayerKey) {
  if (layer === "buildings" && layerVisibility.buildings) {
    await ensureContext3dLayer();
  }

  if (layer === "photorealistic") {
    if (layerVisibility.photorealistic) {
      await ensurePhotorealisticLayer();
    } else if (buildingsBeforeCustomCompare !== null) {
      layerVisibility.buildings = buildingsBeforeCustomCompare;
      buildingsBeforeCustomCompare = null;
    }
    applyCustomCompareMode();
    syncLayerVisibility();
    return;
  }

  if (layer === "buildings") {
    syncBuildingLayerPresentation();
  }

  if (layer === "rainHeatmap" && layerVisibility.rainHeatmap) {
    await setupRainHeatmapLayer();
    syncRainHeatmapToSimulation(true);
  }

  syncLayerVisibility();
}

async function handleHeatmapDateChange() {
  rainHeatmapLayer?.destroy();
  rainHeatmapLayer = null;
  rainDataset = null;
  lastRainHeatmapTimestampIso = null;
  rainHeatmapSourceLabel.value = "-";

  if (layerVisibility.rainHeatmap) {
    await setupRainHeatmapLayer();
    syncRainHeatmapToSimulation(true);
  }
}

function handleHeatmapHourChange() {
  syncRainHeatmapToSimulation(true);
}

function getEntityFromPickedObject(pickedObject: unknown) {
  if (!pickedObject || typeof pickedObject !== "object" || !("id" in pickedObject)) {
    return null;
  }

  const candidate = (pickedObject as { id?: unknown }).id;

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  return candidate as cesium.Entity;
}

function pickEntityAt(windowPosition: cesium.Cartesian2) {
  if (!viewer) {
    return null;
  }

  const directHit = getEntityFromPickedObject(viewer.scene.pick(windowPosition));

  if (directHit) {
    return directHit;
  }

  for (const pickedObject of viewer.scene.drillPick(windowPosition, 8)) {
    const entity = getEntityFromPickedObject(pickedObject);

    if (entity) {
      return entity;
    }
  }

  return null;
}

onMounted(async () => {
  if (!container.value) {
    return;
  }

  try {
    const viewerOptions: cesium.Viewer.ConstructorOptions = {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      baseLayer: cesium.ImageryLayer.fromProviderAsync(
        cesium.ArcGisMapServerImageryProvider.fromUrl(
          "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
        ),
      ),
    };

    if (hasIonToken) {
      cesium.Ion.defaultAccessToken = ionToken;
      viewerOptions.terrain = cesium.Terrain.fromWorldTerrain({
        requestVertexNormals: true,
        requestWaterMask: true,
      });
      terrainEnabled.value = true;
    }

    viewer = new cesium.Viewer(container.value, viewerOptions);
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.depthTestAgainstTerrain = terrainEnabled.value;
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.fog.enabled = false;
    viewer.scene.highDynamicRange = true;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 1;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 2_500_000;
    viewer.scene.postProcessStages.fxaa.enabled = true;
    tuneBaseImageryLayer();

    [provinceDataSource, districtDataSource] = await Promise.all([
      cesium.GeoJsonDataSource.load("/data/bangkok-province.geojson", {
        clampToGround: true,
      }),
      cesium.GeoJsonDataSource.load("/data/bangkok-districts.geojson", {
        clampToGround: true,
      }),
    ]);

    await viewer.dataSources.add(provinceDataSource);
    await viewer.dataSources.add(districtDataSource);

    applyProvinceStyle();

    const districtEntitiesList = districtDataSource.entities.values
      .filter((entity) => entity.polygon)
      .sort((left, right) => {
        const leftCode = getDistrictCodeFromEntity(left) ?? "";
        const rightCode = getDistrictCodeFromEntity(right) ?? "";
        return leftCode.localeCompare(rightCode);
      });

    for (const entity of districtEntitiesList) {
      const state = buildDistrictState(entity);
      if (!state) {
        continue;
      }

      districtStates[state.amp_code] = state;
      districtEntities.set(state.amp_code, entity);
    }

    stationLevelProperties = buildStationLevelProperties();
    floodLevelProperty = createFloodLevelProperty(stationLevelProperties);
    setupWaterSimulationClock();
    setupCloudLayer();
    setupRainAndFloodEffects();
    await setupRainHeatmapLayer();
    createWaterStationMarkers();
    await createFloodZones();

    districtCount.value = districtEntities.size;

    if (layerVisibility.buildings) {
      await ensureContext3dLayer();
    }

    if (layerVisibility.photorealistic) {
      await ensurePhotorealisticLayer();
    } else {
      syncLayerVisibility();
    }

    if (layerVisibility.photorealistic && photorealisticReady.value) {
      baseStatusMessage.value = "พร้อมดู Bangkok Custom 3D บน satellite imagery";
    } else {
      await focusCityCore();
      baseStatusMessage.value = "พร้อมสำรวจเดโมกรุงเทพ 3D บน satellite imagery";
    }

    clickHandler = new cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    clickHandler.setInputAction((movement: { position: cesium.Cartesian2 }) => {
      if (!viewer) {
        return;
      }

      const entity = pickEntityAt(movement.position);
      const waterStationId = getWaterStationIdFromEntity(entity);

      if (waterStationId) {
        void focusWaterStationById(waterStationId);
        return;
      }

      const code = getDistrictCodeFromEntity(entity);

      if (!code || !districtStates[code]) {
        setSelectedDistrict(null);
        setActiveWaterStation(null);
        return;
      }

      void selectAndFocusDistrict(code);
    }, cesium.ScreenSpaceEventType.LEFT_CLICK);

    hoverHandler = new cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    hoverHandler.setInputAction((movement: { endPosition: cesium.Cartesian2 }) => {
      if (!viewer) {
        return;
      }

      const entity = pickEntityAt(movement.endPosition);
      const waterStationId = getWaterStationIdFromEntity(entity);

      if (waterStationId) {
        setHoveredDistrict(null);
        return;
      }

      const code = getDistrictCodeFromEntity(entity);

      if (!code || !districtStates[code]) {
        setHoveredDistrict(null);
        return;
      }

      setHoveredDistrict(code);
    }, cesium.ScreenSpaceEventType.MOUSE_MOVE);
  } catch (error) {
    baseStatusMessage.value = "โหลดเดโมกรุงเทพไม่สำเร็จ";
    console.error("Failed to initialize Bangkok OSM demo", error);
  }
});

onBeforeUnmount(() => {
  clockTickRemover?.();
  destroyBangkokRainSystem(rainSystem);
  rainSystem = null;
  rainHeatmapLayer?.destroy();
  rainHeatmapLayer = null;
  rainDataset = null;
  floodWaterSurface?.destroy();
  floodWaterSurface = null;
  hoverHandler?.destroy();
  clickHandler?.destroy();
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

.scene-card {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  background: rgba(10, 20, 32, 0.82);
  color: #eff6ff;
  backdrop-filter: blur(10px);
}

.scene-header-tab {
  position: absolute;
  top: 16px;
  left: 0;
  z-index: 3;
  padding: 14px 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-left: none;
  border-radius: 0 12px 12px 0;
  background: rgba(15, 23, 42, 0.92);
  color: #f8fafc;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  cursor: pointer;
}

.scene-header-tab:hover {
  background: rgba(3, 105, 161, 0.88);
}

.scene-header {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 2;
  width: min(620px, calc(100% - 32px));
  padding: 18px;
}

.scene-header-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.scene-header-eyebrow {
  margin: 0;
}

.panel-close-button {
  flex-shrink: 0;
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.75);
  color: #dbeafe;
  cursor: pointer;
}

.panel-close-button:hover {
  background: rgba(51, 65, 85, 0.9);
}

.control-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  width: min(390px, calc(100% - 32px));
  max-height: calc(100vh - 32px);
  overflow: auto;
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
  font-size: 30px;
  line-height: 1.1;
}

.description,
.panel-note,
.district-subtitle,
.source-note {
  margin: 10px 0 0;
  line-height: 1.55;
  color: #dbeafe;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.75);
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #38bdf8;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.78);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.chip {
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.78);
  color: #dbeafe;
  font-size: 13px;
}

.chip-rain {
  background: rgba(14, 116, 144, 0.55);
  color: #e0f2fe;
}

.time-display-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.time-label {
  font-size: 22px;
}

.day-phase-badge {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(120, 113, 108, 0.65);
  color: #fafaf9;
  font-size: 12px;
  font-weight: 600;
}

.sun-times-note {
  margin-top: 6px;
  margin-bottom: 0;
}

.rain-badge {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(3, 105, 161, 0.92);
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
}

.dry-badge {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(51, 65, 85, 0.75);
  color: #e2e8f0;
  font-size: 12px;
}

.time-slider {
  width: 100%;
  margin-top: 12px;
  accent-color: #38bdf8;
}

.time-range-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  color: #94a3b8;
  font-size: 12px;
}

.time-control-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.speed-select {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #cbd5e1;
  font-size: 13px;
}

.speed-select select {
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.82);
  color: #f8fafc;
}

.panel-section + .panel-section {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.panel-section h2 {
  margin: 0;
  font-size: 18px;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.toggle-row select {
  margin-left: auto;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.82);
  color: #f8fafc;
}

.date-range-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.date-field {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: #cbd5e1;
}

.toggle-row.is-disabled {
  opacity: 0.65;
}

.toggle-row-nested {
  margin-top: 8px;
  margin-left: 18px;
  font-size: 13px;
}

.bookmark-grid {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.bookmark-button {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.72);
  color: #f8fafc;
  text-align: left;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease;
}

.bookmark-button:hover {
  border-color: rgba(56, 189, 248, 0.45);
  background: rgba(30, 41, 59, 0.95);
}

.bookmark-button span {
  color: #cbd5e1;
  line-height: 1.45;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.summary-card {
  display: grid;
  gap: 4px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.72);
}

.summary-card strong {
  font-size: 20px;
}

.summary-card span {
  color: #cbd5e1;
  line-height: 1.4;
  font-size: 13px;
}

.station-list {
  display: grid;
  gap: 10px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.station-item {
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.68);
  border: 1px solid transparent;
}

.station-item.is-active {
  border-color: rgba(125, 211, 252, 0.35);
  background: rgba(14, 116, 144, 0.18);
}

.station-button {
  width: 100%;
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.station-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.station-meta {
  color: #cbd5e1;
  font-size: 13px;
  line-height: 1.4;
}

.water-badge {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.water-badge.status-normal {
  background: rgba(21, 128, 61, 0.72);
  color: #ffffff;
}

.water-badge.status-watch {
  background: rgba(180, 83, 9, 0.74);
  color: #ffffff;
}

.water-badge.status-warning {
  background: rgba(194, 65, 12, 0.76);
  color: #ffffff;
}

.water-badge.status-critical {
  background: rgba(185, 28, 28, 0.78);
  color: #ffffff;
}

.district-card {
  padding: 14px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.72);
}

.water-card {
  background: rgba(30, 41, 59, 0.86);
}

.preview-card {
  background: rgba(14, 116, 144, 0.16);
}

.district-eyebrow {
  margin: 0;
  font-size: 13px;
  color: #fdba74;
}

.district-card h2 {
  margin: 6px 0 0;
  font-size: 24px;
}

.detail-list {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.detail-list dt {
  margin: 0 0 2px;
  font-size: 13px;
  color: #93c5fd;
}

.detail-list dd {
  margin: 0;
}

.action-row {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.mini-button {
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(3, 105, 161, 0.78);
  color: #ffffff;
  cursor: pointer;
}

.mini-button-muted {
  background: rgba(15, 23, 42, 0.82);
}

.source-note {
  margin-top: 18px;
  font-size: 13px;
  color: #bfdbfe;
}

@media (max-width: 1080px) {
  .control-panel {
    top: auto;
    bottom: 16px;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .scene-header,
  .control-panel {
    position: absolute;
    left: 16px;
    right: 16px;
    width: auto;
  }

  .control-panel {
    top: auto;
    bottom: 16px;
    max-height: 44vh;
  }

  .title {
    font-size: 24px;
  }

  .action-row,
  .station-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .date-range-grid {
    grid-template-columns: 1fr;
  }
}
</style>
