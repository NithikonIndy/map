<template>
    <div class="viewer-shell">
        <div ref="container" class="cesium-container" />

        <header class="scene-card scene-header">
            <p class="eyebrow">Sisaket Visual Scene</p>
            <h1 class="title">จังหวัดศรีสะเกษ</h1>
            <p class="description">
                มุมมองภาพรวมสมจริงของจังหวัด เน้นภาพถ่ายดาวเทียม, terrain, OSM Buildings โทนเมือง,
                camera tour แบบ cinematic และจุด landmark placeholder สำหรับต่อยอด asset 3D จริง
            </p>

            <div class="status-row">
                <span class="status-dot" />
                <span>{{ statusMessage }}</span>
            </div>

            <div class="chip-row">
                <span class="chip">อำเภอ {{ districtCount }} แห่ง</span>
                <span class="chip">Layer เปิด {{ visibleLayerCount }} ชั้น</span>
                <span class="chip">{{ terrainStatusLabel }}</span>
                <span class="chip">{{ context3dLabel }}</span>
                <span class="chip">{{ landmarkStatusLabel }}</span>
            </div>
        </header>

        <aside v-if="showSidebar" class="scene-card control-panel">
            <section class="panel-section">
                <h2>Layers</h2>

                <label class="toggle-row">
                    <input v-model="layerVisibility.province" type="checkbox" @change="handleLayerToggle('province')">
                    <span>ขอบเขตจังหวัด</span>
                </label>

                <label class="toggle-row">
                    <input v-model="layerVisibility.districts" type="checkbox" @change="handleLayerToggle('districts')">
                    <span>ขอบเขตอำเภอ</span>
                </label>

                <label class="toggle-row" :class="{ 'is-disabled': !hasIonToken }">
                    <input v-model="layerVisibility.buildings" type="checkbox"
                        :disabled="!hasIonToken || buildingsLoading" @change="handleLayerToggle('buildings')">
                    <span>3D context layer (OSM Buildings)</span>
                </label>

                <label class="toggle-row">
                    <input v-model="layerVisibility.landmarks" type="checkbox" @change="handleLayerToggle('landmarks')">
                    <span>Landmark placeholders</span>
                </label>

                <p class="panel-note">
                    {{ layerHelpText }}
                </p>
            </section>

            <section class="panel-section">
                <h2>Camera Tour</h2>
                <div class="tour-card">
                    <p class="panel-note">
                        กดเล่นเพื่อพากล้องดูภาพรวมจังหวัด แล้วไล่ลงสู่แลนด์มาร์กสำคัญแบบ cinematic
                    </p>

                    <div class="action-row">
                        <button class="mini-button" :disabled="isTourRunning" @click="playCameraTour">
                            เล่น camera tour
                        </button>
                        <button class="mini-button mini-button-muted" :disabled="!isTourRunning"
                            @click="stopCameraTour">
                            หยุด tour
                        </button>
                    </div>

                    <p class="tour-meta">
                        เส้นทาง {{ sisaketTourSequence.length }} ช่วง / {{ isTourRunning ? "กำลังเล่น" : "พร้อมใช้งาน"
                        }}
                    </p>
                </div>
            </section>

            <section class="panel-section">
                <h2>Bookmarks</h2>
                <div class="bookmark-grid">
                    <button v-for="bookmark in sisaketVisualBookmarks" :key="bookmark.id" class="bookmark-button"
                        @click="focusBookmark(bookmark)">
                        <strong>{{ bookmark.label }}</strong>
                        <span>{{ bookmark.description }}</span>
                    </button>
                </div>
            </section>

            <section class="panel-section">
                <h2>Landmarks</h2>
                <ul class="hook-list">
                    <li v-for="landmark in landmarkPlaceholdersWithNames" :key="landmark.id" class="hook-item">
                        <strong>{{ landmark.label }}</strong>
                        <span>{{ landmark.summary }}</span>
                        <span class="hook-meta">
                            เขต {{ landmark.districtName }} / {{ assetTypeLabel(landmark.assetType) }}
                        </span>
                        <button class="mini-button mini-button-muted hook-action"
                            @click="focusLandmarkById(landmark.id)">
                            โฟกัสจุดนี้
                        </button>
                    </li>
                </ul>
            </section>

            <section v-if="activeLandmark" class="panel-section district-card landmark-card">
                <p class="district-eyebrow">กำลังโฟกัส landmark</p>
                <h2>{{ activeLandmark.label }}</h2>
                <p class="district-subtitle">{{ activeLandmark.summary }}</p>

                <dl class="detail-list">
                    <div>
                        <dt>ประเภท asset</dt>
                        <dd>{{ assetTypeLabel(activeLandmark.assetType) }}</dd>
                    </div>
                    <div>
                        <dt>พื้นที่อ้างอิง</dt>
                        <dd>{{ districtStates[activeLandmark.districtCode]?.amp_th ?? activeLandmark.districtCode }}
                        </dd>
                    </div>
                </dl>

                <div class="action-row">
                    <button class="mini-button" @click="focusLandmarkById(activeLandmark.id)">
                        เล่นมุมกล้องอีกครั้ง
                    </button>
                    <button class="mini-button mini-button-muted" @click="clearSelection">
                        ล้างการเลือก
                    </button>
                </div>
            </section>

            <section v-else-if="selectedDistrict" class="panel-section district-card">
                <p class="district-eyebrow">กำลังโฟกัสพื้นที่</p>
                <h2>{{ selectedDistrict.amp_th }}</h2>
                <p class="district-subtitle">{{ selectedDistrict.amp_en }}</p>

                <dl class="detail-list">
                    <div>
                        <dt>รหัสอำเภอ</dt>
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
                        ล้างการเลือก
                    </button>
                </div>
            </section>

            <section v-else-if="hoveredDistrict" class="panel-section district-card preview-card">
                <p class="district-eyebrow">กำลังชี้อยู่ที่</p>
                <h2>{{ hoveredDistrict.amp_th }}</h2>
                <p class="district-subtitle">{{ hoveredDistrict.amp_en }}</p>
                <p class="panel-note">
                    คลิกเพื่อพากล้องเข้าไปดูอำเภอนี้ในมุมมองเฉียงแบบนำชม
                </p>
            </section>

            <section class="panel-section">
                <h2>Future Detail Hooks</h2>
                <ul class="hook-list">
                    <li v-for="hook in futureHooksWithNames" :key="hook.id" class="hook-item">
                        <strong>{{ hook.label }}</strong>
                        <span>{{ hook.summary }}</span>
                        <span class="hook-meta">
                            เขต {{ hook.districtName }} / {{ assetTypeLabel(hook.assetType) }}
                        </span>
                    </li>
                </ul>
            </section>

            <p class="source-note">
                ข้อมูลขอบเขต: OpenGISData-Thailand, ภาพพื้นหลัง: ArcGIS World Imagery, จุด landmark เป็น placeholder
                สำหรับต่อยอด glTF หรือ 3D Tiles ภายหลัง
            </p>
        </aside>
    </div>
</template>

<script setup lang="ts">
import * as cesium from "cesium";
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import {
    sisaketFutureDetailHooks,
    sisaketLandmarkPlaceholders,
    sisaketTourSequence,
    sisaketVisualBookmarks,
    type SisaketFutureDetailHook,
    type SisaketLandmarkPlaceholder,
    type SisaketVisualBookmark,
} from "./visual-map/sisaketSceneConfig";

const props = defineProps<{
  showSidebar: boolean;
}>();
type DistrictVisualState = {
    amp_code: string;
    amp_th: string;
    amp_en: string;
    area_sqkm: number;
};

type LayerKey = "province" | "districts" | "buildings" | "landmarks";

const runtimeConfig = useRuntimeConfig();
const container = ref<HTMLDivElement | null>(null);
const districtCount = ref(0);
const terrainEnabled = ref(false);
const baseStatusMessage = ref("กำลังโหลดฉากภาพรวมจังหวัด...");
const selectedDistrictCode = ref<string | null>(null);
const hoveredDistrictCode = ref<string | null>(null);
const activeLandmarkId = ref<string | null>(null);
const buildingsLoading = ref(false);
const context3dReady = ref(false);
const isTourRunning = ref(false);
const tourRunToken = ref(0);

const layerVisibility = reactive({
    province: true,
    districts: true,
    buildings: false,
    landmarks: true,
});

const districtStates = reactive<Record<string, DistrictVisualState>>({});

let viewer: cesium.Viewer | null = null;
let clickHandler: cesium.ScreenSpaceEventHandler | null = null;
let hoverHandler: cesium.ScreenSpaceEventHandler | null = null;
let provinceDataSource: cesium.GeoJsonDataSource | null = null;
let districtDataSource: cesium.GeoJsonDataSource | null = null;
let osmBuildingsTileset: cesium.Cesium3DTileset | null = null;

const districtEntities = new Map<string, cesium.Entity>();
const landmarkEntities = new Map<string, cesium.Entity>();
const ionToken = runtimeConfig.public.cesiumIonToken?.trim() ?? "";
const hasIonToken = ionToken.length > 0;

const selectedDistrict = computed(() => {
    if (!selectedDistrictCode.value) {
        return null;
    }

    return districtStates[selectedDistrictCode.value] ?? null;
});

const hoveredDistrict = computed(() => {
    if (!hoveredDistrictCode.value || hoveredDistrictCode.value === selectedDistrictCode.value) {
        return null;
    }

    return districtStates[hoveredDistrictCode.value] ?? null;
});

const activeLandmark = computed(() => {
    if (!activeLandmarkId.value) {
        return null;
    }

    return sisaketLandmarkPlaceholders.find((item) => item.id === activeLandmarkId.value) ?? null;
});

const visibleLayerCount = computed(() => Object.values(layerVisibility).filter(Boolean).length);

const statusMessage = computed(() => {
    if (buildingsLoading.value) {
        return "กำลังโหลด 3D context layer...";
    }

    if (isTourRunning.value) {
        return "กำลังเล่น cinematic camera tour";
    }

    if (activeLandmark.value) {
        return `โฟกัสที่ landmark ${activeLandmark.value.label}`;
    }

    if (selectedDistrict.value) {
        return `โฟกัสที่อำเภอ ${selectedDistrict.value.amp_th}`;
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
        return "3D context ต้องใช้ ion token";
    }

    if (buildingsLoading.value) {
        return "3D context กำลังโหลด";
    }

    if (context3dReady.value) {
        return layerVisibility.buildings ? "3D context เปิดอยู่" : "3D context พร้อมเปิด";
    }

    return "3D context ยังไม่โหลด";
});

const landmarkStatusLabel = computed(() => (
    layerVisibility.landmarks ? "Landmarks เปิดอยู่" : "Landmarks ซ่อนอยู่"
));

const layerHelpText = computed(() => {
    if (!hasIonToken) {
        return "ถ้าอยากเปิด terrain และ Cesium OSM Buildings ให้ตั้งค่า NUXT_PUBLIC_CESIUM_ION_TOKEN ก่อน";
    }

    if (!context3dReady.value && layerVisibility.buildings) {
        return "กำลังดึง Cesium OSM Buildings พร้อม style โทนเมืองแบบ muted เพื่อใช้เป็นบริบท 3D ของพื้นที่";
    }

    return "เปิดหรือปิด layer ตามมุมมองที่ต้องการ เพื่อสลับระหว่างภาพรวมข้อมูล, อาคารเมือง, และจุด landmark เฉพาะจุด";
});

const futureHooksWithNames = computed(() => sisaketFutureDetailHooks.map((hook) => ({
    ...hook,
    districtName: districtStates[hook.districtCode]?.amp_th ?? hook.districtCode,
})));

const landmarkPlaceholdersWithNames = computed(() => sisaketLandmarkPlaceholders.map((landmark) => ({
    ...landmark,
    districtName: districtStates[landmark.districtCode]?.amp_th ?? landmark.districtCode,
})));

function assetTypeLabel(assetType: SisaketFutureDetailHook["assetType"] | SisaketLandmarkPlaceholder["assetType"]) {
    switch (assetType) {
        case "3d-tiles":
            return "3D Tiles";
        case "gltf":
            return "glTF Model";
        default:
            return "Photogrammetry";
    }
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function getDistrictColorSeed(code: string) {
    const numericCode = Number.parseInt(code, 10);
    if (Number.isFinite(numericCode)) {
        return numericCode;
    }

    return Array.from(code).reduce((total, character) => total + character.charCodeAt(0), 0);
}

function getDistrictColorFamily(code: string) {
    const hue = ((getDistrictColorSeed(code) * 37) % 360) / 360;
    const baseColor = cesium.Color.fromHsl(hue, 0.62, 0.56);
    const fillColor = baseColor.brighten(0.08, new cesium.Color());
    const outlineColor = baseColor.brighten(0.22, new cesium.Color());

    return {
        fillColor,
        outlineColor,
    };
}

function sleep(ms: number) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
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

function getLandmarkIdFromEntity(entity: cesium.Entity | null) {
    if (!entity) {
        return null;
    }

    return getPropertyValue<string>(entity, "landmarkId") ?? null;
}

function getBookmarkById(id: string) {
    return sisaketVisualBookmarks.find((bookmark) => bookmark.id === id) ?? null;
}

function getLandmarkById(id: string) {
    return sisaketLandmarkPlaceholders.find((landmark) => landmark.id === id) ?? null;
}

function buildDistrictState(entity: cesium.Entity): DistrictVisualState | null {
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

function applyProvinceStyle() {
    if (!cesium || !provinceDataSource) {
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
            cesium.Color.fromCssColorString("#f8fafc").withAlpha(0.55),
        );
    }
}

function applyDistrictStyle(code: string) {
    if (!cesium) {
        return;
    }

    const entity = districtEntities.get(code);
    const state = districtStates[code];

    if (!entity?.polygon || !state) {
        return;
    }

    const isSelected = selectedDistrictCode.value === code;
    const isHovered = hoveredDistrictCode.value === code;
    const districtColorFamily = getDistrictColorFamily(code);
    let fillColor = districtColorFamily.fillColor.withAlpha(0.08);
    let outlineColor = districtColorFamily.outlineColor.withAlpha(0.72);

    if (isHovered) {
        fillColor = districtColorFamily.fillColor
            .brighten(0.12, new cesium.Color())
            .withAlpha(0.18);
        outlineColor = districtColorFamily.outlineColor
            .brighten(0.16, new cesium.Color())
            .withAlpha(0.98);
    }

    if (isSelected) {
        fillColor = districtColorFamily.fillColor
            .brighten(0.2, new cesium.Color())
            .withAlpha(0.24);
        outlineColor = districtColorFamily.outlineColor
            .brighten(0.24, new cesium.Color())
            .withAlpha(1);
    }

    entity.polygon.material = new cesium.ColorMaterialProperty(fillColor);
    entity.polygon.outline = new cesium.ConstantProperty(true);
    entity.polygon.outlineColor = new cesium.ConstantProperty(outlineColor);
    entity.show = layerVisibility.districts;
}

function applyOsmBuildingStyle() {
    if (!cesium || !osmBuildingsTileset) {
        return;
    }

    osmBuildingsTileset.style = new cesium.Cesium3DTileStyle({
        color: {
            conditions: [
                ["${building} === 'commercial'", "color('#d8e1ea', 0.90)"],
                ["${building} === 'apartments' || ${building} === 'residential'", "color('#cfd7e2', 0.84)"],
                ["${building} === 'industrial' || ${building} === 'warehouse'", "color('#94a3b8', 0.72)"],
                ["${building} === 'hospital' || ${building} === 'civic'", "color('#e5edf5', 0.94)"],
                ["true", "color('#c3cfdb', 0.80)"],
            ],
        },
    });
}

function createLandmarkPlaceholders() {
    if (!viewer || !cesium || landmarkEntities.size > 0) {
        return;
    }

    for (const landmark of sisaketLandmarkPlaceholders) {
        const markerColor = landmark.assetType === "3d-tiles"
            ? cesium.Color.fromCssColorString("#fb7185")
            : cesium.Color.fromCssColorString("#f59e0b");

        const entity = viewer.entities.add({
            id: `landmark-${landmark.id}`,
            position: cesium.Cartesian3.fromDegrees(
                landmark.longitude,
                landmark.latitude,
                landmark.height,
            ),
            point: {
                pixelSize: landmark.assetType === "3d-tiles" ? 14 : 12,
                color: markerColor,
                outlineColor: cesium.Color.WHITE.withAlpha(0.96),
                outlineWidth: 2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            polyline: {
                positions: [
                    cesium.Cartesian3.fromDegrees(landmark.longitude, landmark.latitude, 0),
                    cesium.Cartesian3.fromDegrees(
                        landmark.longitude,
                        landmark.latitude,
                        Math.max(40, landmark.height - 24),
                    ),
                ],
                width: 2,
                material: markerColor.withAlpha(0.7),
            },
            label: {
                text: `${landmark.label}\n${assetTypeLabel(landmark.assetType)} placeholder`,
                font: "600 13px sans-serif",
                style: cesium.LabelStyle.FILL_AND_OUTLINE,
                fillColor: cesium.Color.WHITE,
                outlineColor: cesium.Color.fromCssColorString("#0f172a"),
                outlineWidth: 3,
                showBackground: true,
                backgroundColor: cesium.Color.fromCssColorString("#0f172a").withAlpha(0.65),
                pixelOffset: new cesium.Cartesian2(0, -34),
                verticalOrigin: cesium.VerticalOrigin.BOTTOM,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            properties: {
                landmarkId: landmark.id,
                districtCode: landmark.districtCode,
                assetType: landmark.assetType,
            },
        });

        entity.show = layerVisibility.landmarks;
        landmarkEntities.set(landmark.id, entity);
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

    for (const entity of landmarkEntities.values()) {
        entity.show = layerVisibility.landmarks;
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

function setActiveLandmark(id: string | null) {
    activeLandmarkId.value = id;
}

function interruptTour(statusText?: string) {
    if (!viewer) {
        return;
    }

    if (isTourRunning.value) {
        tourRunToken.value += 1;
        isTourRunning.value = false;
        viewer.camera.cancelFlight();
    }

    if (statusText) {
        baseStatusMessage.value = statusText;
    }
}

function getDistrictHeadingDegrees(code: string) {
    if (code === "3304") {
        return 62;
    }

    if (code === "3317") {
        return 118;
    }

    return 18;
}

function getLandmarkHeadingDegrees(id: string) {
    if (id === "pha-mo-i-daeng") {
        return 92;
    }

    if (id === "sisaket-city-core") {
        return 36;
    }

    return 16;
}

async function focusProvinceOverview(duration = 2.4) {
    if (!viewer || !cesium || !provinceDataSource) {
        return;
    }

    await viewer.flyTo(provinceDataSource, {
        duration,
        offset: new cesium.HeadingPitchRange(
            cesium.Math.toRadians(24),
            cesium.Math.toRadians(-38),
            250000,
        ),
    });
}

async function focusDistrict(code: string, duration = 1.8) {
    if (!viewer || !cesium) {
        return;
    }

    const entity = districtEntities.get(code);
    const state = districtStates[code];

    if (!entity || !state) {
        return;
    }

    const range = clamp(state.area_sqkm * 140, 12_000, 120_000);
    await viewer.flyTo(entity, {
        duration,
        offset: new cesium.HeadingPitchRange(
            cesium.Math.toRadians(getDistrictHeadingDegrees(code)),
            cesium.Math.toRadians(-31),
            range,
        ),
    });
}

async function focusLandmarkInternal(id: string, duration = 2.2) {
    if (!viewer || !cesium) {
        return;
    }

    const landmark = getLandmarkById(id);
    const entity = landmarkEntities.get(id);

    if (!landmark || !entity) {
        return;
    }

    setHoveredDistrict(null);
    setSelectedDistrict(landmark.districtCode);
    setActiveLandmark(id);

    const range = landmark.assetType === "3d-tiles" ? 3_800 : 2_800;
    await viewer.flyTo(entity, {
        duration,
        offset: new cesium.HeadingPitchRange(
            cesium.Math.toRadians(getLandmarkHeadingDegrees(id)),
            cesium.Math.toRadians(-24),
            range,
        ),
    });
}

async function focusSelectedDistrict() {
    if (!selectedDistrictCode.value) {
        return;
    }

    setActiveLandmark(null);
    await focusDistrict(selectedDistrictCode.value, 1.2);
}

function clearSelection() {
    interruptTour();
    setActiveLandmark(null);
    setSelectedDistrict(null);
    setHoveredDistrict(null);
    baseStatusMessage.value = "พร้อมสำรวจภาพรวมศรีสะเกษ";
}

async function selectAndFocusDistrict(code: string, duration = 1.8) {
    setActiveLandmark(null);
    setSelectedDistrict(code);
    await focusDistrict(code, duration);
}

async function focusBookmarkInternal(bookmark: SisaketVisualBookmark, duration?: number) {
    setHoveredDistrict(null);
    setActiveLandmark(null);

    if (bookmark.target === "province") {
        setSelectedDistrict(null);
        await focusProvinceOverview(duration ?? 2.0);
        return;
    }

    if (bookmark.districtCode) {
        await selectAndFocusDistrict(bookmark.districtCode, duration ?? 1.8);
    }
}

async function focusBookmark(bookmark: SisaketVisualBookmark) {
    interruptTour("หยุด camera tour แล้ว");
    await focusBookmarkInternal(bookmark);
}

async function focusLandmarkById(id: string) {
    interruptTour("หยุด camera tour แล้ว");
    await focusLandmarkInternal(id);
}

async function playCameraTour() {
    if (isTourRunning.value) {
        return;
    }

    const runToken = tourRunToken.value + 1;
    tourRunToken.value = runToken;
    isTourRunning.value = true;
    setHoveredDistrict(null);
    baseStatusMessage.value = "กำลังเล่น cinematic camera tour";

    try {
        for (const step of sisaketTourSequence) {
            if (tourRunToken.value !== runToken) {
                return;
            }

            if (step.target === "bookmark") {
                const bookmark = getBookmarkById(step.id);
                if (bookmark) {
                    await focusBookmarkInternal(bookmark, 2.4);
                }
            } else {
                await focusLandmarkInternal(step.id, 2.6);
            }

            if (tourRunToken.value !== runToken) {
                return;
            }

            await sleep(950);
        }

        if (tourRunToken.value === runToken) {
            baseStatusMessage.value = "camera tour เล่นครบเส้นทางแล้ว";
        }
    } finally {
        if (tourRunToken.value === runToken) {
            isTourRunning.value = false;
        }
    }
}

function stopCameraTour() {
    interruptTour("หยุด camera tour แล้ว");
}

async function ensureContext3dLayer() {
    if (!hasIonToken || !viewer || !cesium || osmBuildingsTileset || buildingsLoading.value) {
        return;
    }

    buildingsLoading.value = true;

    try {
        osmBuildingsTileset = await cesium.createOsmBuildingsAsync({
            defaultColor: cesium.Color.fromCssColorString("#d8e1ea").withAlpha(0.9),
            enableShowOutline: false,
            showOutline: false,
        });
        applyOsmBuildingStyle();
        osmBuildingsTileset.show = layerVisibility.buildings;
        viewer.scene.primitives.add(osmBuildingsTileset);
        context3dReady.value = true;
    } catch (error) {
        layerVisibility.buildings = false;
        context3dReady.value = false;
        console.error("Failed to load Cesium OSM Buildings", error);
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
        viewer.scene.screenSpaceCameraController.minimumZoomDistance = 10;
        viewer.scene.screenSpaceCameraController.maximumZoomDistance = 1_800_000;
        viewer.scene.postProcessStages.fxaa.enabled = true;

        [provinceDataSource, districtDataSource] = await Promise.all([
            cesium.GeoJsonDataSource.load("/data/sisaket-province.geojson", {
                clampToGround: true,
            }),
            cesium.GeoJsonDataSource.load("/data/sisaket-districts.geojson", {
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

        createLandmarkPlaceholders();

        districtCount.value = districtEntities.size;
        syncLayerVisibility();

        await focusProvinceOverview();
        baseStatusMessage.value = "พร้อมสำรวจภาพรวมศรีสะเกษ";

        clickHandler = new cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        clickHandler.setInputAction((movement: { position: cesium.Cartesian2 }) => {
            if (!viewer || !cesium) {
                return;
            }

            const pickedObject = viewer.scene.pick(movement.position);
            const entity = cesium.defined(pickedObject) && pickedObject.id
                ? pickedObject.id as cesium.Entity
                : null;
            const landmarkId = getLandmarkIdFromEntity(entity);

            if (landmarkId) {
                void focusLandmarkById(landmarkId);
                return;
            }

            const code = getDistrictCodeFromEntity(entity);

            if (!code || !districtStates[code]) {
                clearSelection();
                return;
            }

            interruptTour("หยุด camera tour แล้ว");
            void selectAndFocusDistrict(code);
        }, cesium.ScreenSpaceEventType.LEFT_CLICK);

        hoverHandler = new cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        hoverHandler.setInputAction((movement: { endPosition: cesium.Cartesian2 }) => {
            if (!viewer || !cesium) {
                return;
            }

            const pickedObject = viewer.scene.pick(movement.endPosition);
            const entity = cesium.defined(pickedObject) && pickedObject.id
                ? pickedObject.id as cesium.Entity
                : null;
            const landmarkId = getLandmarkIdFromEntity(entity);

            if (landmarkId) {
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
        baseStatusMessage.value = "โหลดฉากศรีสะเกษไม่สำเร็จ";
        console.error("Failed to initialize Sisaket visual scene", error);
    }
});

onBeforeUnmount(() => {
    interruptTour();
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
    width: min(560px, calc(100% - 32px));
    padding: 18px;
}

.control-panel {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 2;
    width: min(380px, calc(100% - 32px));
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
.source-note,
.tour-meta {
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

.panel-section+.panel-section {
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

.tour-card {
    margin-top: 12px;
    padding: 14px;
    border-radius: 16px;
    background: rgba(15, 23, 42, 0.72);
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

.district-card {
    padding: 14px;
    border-radius: 16px;
    background: rgba(15, 23, 42, 0.72);
}

.landmark-card {
    background: rgba(124, 45, 18, 0.24);
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
    transition: opacity 0.18s ease, transform 0.18s ease;
}

.mini-button:hover:not(:disabled) {
    transform: translateY(-1px);
}

.mini-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.mini-button-muted {
    background: rgba(15, 23, 42, 0.82);
}

.hook-list {
    display: grid;
    gap: 10px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
}

.hook-item {
    display: grid;
    gap: 4px;
    padding: 12px;
    border-radius: 14px;
    background: rgba(15, 23, 42, 0.68);
}

.hook-item span {
    line-height: 1.45;
    color: #cbd5e1;
}

.hook-meta {
    font-size: 13px;
    color: #93c5fd;
}

.hook-action {
    margin-top: 8px;
    justify-self: start;
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

    .scene-header {
        width: min(520px, calc(100% - 32px));
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

    .scene-header {
        top: 16px;
    }

    .control-panel {
        top: auto;
        bottom: 16px;
        max-height: 46vh;
    }

    .title {
        font-size: 24px;
    }

    .action-row {
        flex-direction: column;
    }
}
</style>