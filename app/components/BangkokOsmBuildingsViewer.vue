<template>
  <div class="viewer-shell">
    <div ref="container" class="cesium-container" />

    <header class="scene-card scene-header">
      <p class="eyebrow">Bangkok OSM Demo</p>
      <h1 class="title">กรุงเทพมหานคร</h1>
      <p class="description">
        เดโมกรุงเทพสำหรับดู OSM Buildings แบบเมืองหนาแน่น พร้อม mock dashboard ระดับน้ำ
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
        <span class="chip">Layer เปิด {{ visibleLayerCount }} ชั้น</span>
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

        <label class="toggle-row">
          <input
            v-model="layerVisibility.water"
            type="checkbox"
            @change="handleLayerToggle('water')"
          >
          <span>Water markers</span>
        </label>

        <p class="panel-note">
          {{ layerHelpText }}
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
          <button class="bookmark-button" @click="focusRiverside()">
            <strong>โซนริมเจ้าพระยา</strong>
            <span>มุมเมืองติดแม่น้ำเพื่อดูมิติ skyline อีกแบบ</span>
          </button>
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
            v-for="station in waterStationsWithDistrictNames"
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
          คลิกเพื่อโฟกัสเขตนี้และดู OSM Buildings กับจุดน้ำใกล้เคียง
        </p>
      </section>

      <p class="source-note">
        ข้อมูลขอบเขต: OpenGISData-Thailand, ภาพพื้นหลัง: ArcGIS World Imagery, อาคาร 3D: Cesium OSM Buildings, ข้อมูลน้ำ: mock design
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
} from "./visual-map/bangkokWaterMock";

type DistrictState = {
  amp_code: string;
  amp_th: string;
  amp_en: string;
  area_sqkm: number;
};

type LayerKey = "province" | "districts" | "buildings" | "water";

const props = withDefaults(defineProps<{
  showSidebar?: boolean;
}>(), {
  showSidebar: true,
});

const runtimeConfig = useRuntimeConfig();
const container = ref<HTMLDivElement | null>(null);
const districtCount = ref(0);
const terrainEnabled = ref(false);
const baseStatusMessage = ref("กำลังโหลดเดโมกรุงเทพ...");
const selectedDistrictCode = ref<string | null>(null);
const hoveredDistrictCode = ref<string | null>(null);
const activeWaterStationId = ref<string | null>(null);
const buildingsLoading = ref(false);
const context3dReady = ref(false);

const ionToken = runtimeConfig.public.cesiumIonToken?.trim() ?? "";
const hasIonToken = ionToken.length > 0;

const layerVisibility = reactive({
  province: true,
  districts: true,
  buildings: hasIonToken,
  water: true,
});

const districtStates = reactive<Record<string, DistrictState>>({});

let viewer: cesium.Viewer | null = null;
let clickHandler: cesium.ScreenSpaceEventHandler | null = null;
let hoverHandler: cesium.ScreenSpaceEventHandler | null = null;
let provinceDataSource: cesium.GeoJsonDataSource | null = null;
let districtDataSource: cesium.GeoJsonDataSource | null = null;
let osmBuildingsTileset: cesium.Cesium3DTileset | null = null;

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

const activeWaterStation = computed(() => (
  activeWaterStationId.value
    ? bangkokWaterStations.find((station) => station.id === activeWaterStationId.value) ?? null
    : null
));

const waterStationsWithDistrictNames = computed(() => bangkokWaterStations.map((station) => ({
  ...station,
  districtName: districtStates[station.districtCode]?.amp_th ?? station.districtCode,
})));

const alertStationCount = computed(() => (
  bangkokWaterStations.filter((station) => station.status === "warning" || station.status === "critical").length
));

const highestWaterStation = computed(() => (
  bangkokWaterStations.reduce<BangkokWaterStation | null>((highest, station) => {
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

const layerHelpText = computed(() => {
  if (!hasIonToken) {
    return "ถ้าอยากเปิด terrain และ OSM Buildings ของกรุงเทพ ให้ตั้งค่า NUXT_PUBLIC_CESIUM_ION_TOKEN ก่อน";
  }

  if (!context3dReady.value && layerVisibility.buildings) {
    return "กำลังโหลด Cesium OSM Buildings เพื่อสร้างเดโมเมือง 3D ของกรุงเทพ";
  }

  return "เดโมนี้เพิ่ม mock dashboard ระดับน้ำแบบ combined dashboard พร้อม marker บนแผนที่และ panel สรุปด้านข้าง";
});

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
      cesium.Color.fromCssColorString("#e2e8f0").withAlpha(0.82),
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
  let fillColor = cesium.Color.fromCssColorString("#f8fafc").withAlpha(0.02);
  let outlineColor = cesium.Color.fromCssColorString("#cbd5e1").withAlpha(0.15);

  if (isHovered) {
    fillColor = cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.10);
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

function applyOsmBuildingStyle() {
  if (!osmBuildingsTileset) {
    return;
  }

  osmBuildingsTileset.style = new cesium.Cesium3DTileStyle({
    color: {
      conditions: [
        ["${building} === 'commercial' || ${building} === 'office'", "color('#d7dee8', 0.98)"],
        ["${building} === 'apartments' || ${building} === 'residential'", "color('#f8fafc', 0.98)"],
        ["${building} === 'industrial' || ${building} === 'warehouse'", "color('#d7c4b6', 0.96)"],
        ["true", "color('#e5e7eb', 0.97)"],
      ],
    },
  });
}

function createWaterStationMarkers() {
  if (!viewer || waterStationEntities.size > 0) {
    return;
  }

  for (const station of bangkokWaterStations) {
    const markerColor = getWaterStatusColor(station.status);
    const entity = viewer.entities.add({
      id: `water-${station.id}`,
      position: cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, 35),
      point: {
        pixelSize: 14,
        color: markerColor,
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
        material: markerColor.withAlpha(0.75),
      },
      label: {
        text: `${station.label}\n${station.levelMeters.toFixed(2)} ม.`,
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
        waterStatus: station.status,
      },
    });

    entity.show = layerVisibility.water;
    waterStationEntities.set(station.id, entity);
  }
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

  for (const entity of waterStationEntities.values()) {
    entity.show = layerVisibility.water;
  }

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

async function focusBangkokOverview(duration = 2.0) {
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
    destination: cesium.Cartesian3.fromDegrees(100.5402, 13.7379, 4_200),
    orientation: {
      heading: cesium.Math.toRadians(28),
      pitch: cesium.Math.toRadians(-28),
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
    destination: cesium.Cartesian3.fromDegrees(100.5026, 13.7262, 4_600),
    orientation: {
      heading: cesium.Math.toRadians(42),
      pitch: cesium.Math.toRadians(-26),
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
  baseStatusMessage.value = "พร้อมสำรวจเดโมกรุงเทพ";
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
    applyOsmBuildingStyle();
    osmBuildingsTileset.show = layerVisibility.buildings;
    viewer.scene.primitives.add(osmBuildingsTileset);
    context3dReady.value = true;
  } catch (error) {
    layerVisibility.buildings = false;
    context3dReady.value = false;
    console.error("Failed to load Bangkok OSM Buildings", error);
  } finally {
    buildingsLoading.value = false;
  }
}

async function handleLayerToggle(layer: LayerKey) {
  if (layer === "buildings" && layerVisibility.buildings) {
    await ensureContext3dLayer();
  }

  syncLayerVisibility();
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
    viewer.scene.globe.enableLighting = terrainEnabled.value;
    viewer.scene.globe.depthTestAgainstTerrain = terrainEnabled.value;
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.highDynamicRange = true;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 120;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 1_500_000;
    viewer.scene.postProcessStages.fxaa.enabled = true;

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

    createWaterStationMarkers();

    districtCount.value = districtEntities.size;

    if (layerVisibility.buildings) {
      await ensureContext3dLayer();
    }

    syncLayerVisibility();

    await focusCityCore();
    baseStatusMessage.value = "พร้อมสำรวจเดโมกรุงเทพ 3D";

    clickHandler = new cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    clickHandler.setInputAction((movement: { position: cesium.Cartesian2 }) => {
      if (!viewer) {
        return;
      }

      const pickedObject = viewer.scene.pick(movement.position);
      const entity = cesium.defined(pickedObject) && pickedObject.id
        ? pickedObject.id as cesium.Entity
        : null;
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

      const pickedObject = viewer.scene.pick(movement.endPosition);
      const entity = cesium.defined(pickedObject) && pickedObject.id
        ? pickedObject.id as cesium.Entity
        : null;
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

.scene-header {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 2;
  width: min(620px, calc(100% - 32px));
  padding: 18px;
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

.toggle-row.is-disabled {
  opacity: 0.65;
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
  background: rgba(34, 197, 94, 0.18);
  color: #86efac;
}

.water-badge.status-watch {
  background: rgba(245, 158, 11, 0.18);
  color: #fcd34d;
}

.water-badge.status-warning {
  background: rgba(249, 115, 22, 0.18);
  color: #fdba74;
}

.water-badge.status-critical {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
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
  background: rgba(2, 132, 199, 0.24);
  color: #f8fafc;
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
}
</style>
