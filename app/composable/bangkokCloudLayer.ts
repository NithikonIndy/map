import * as cesium from "cesium";

type CloudLayerKind = "stratus" | "cumulus";
type CloudCenter = { longitude: number; latitude: number };
type CloudPlacement = { longitude: number; latitude: number };

type CloudCollectionInstance = {
  add: (options: {
    position: cesium.Cartesian3;
    scale: cesium.Cartesian2;
    maximumSize: cesium.Cartesian3;
    slice?: number;
    brightness?: number;
    color?: cesium.Color;
  }) => unknown;
  show: boolean;
};

type CloudCollectionConstructor = new (options?: unknown) => CloudCollectionInstance;

type BangkokCloudSpec = {
  layer: CloudLayerKind;
  longitude: number;
  latitude: number;
  height: number;
  scale: readonly [number, number];
  maximumSize: readonly [number, number, number];
  slice: number;
  brightness: number;
  color: cesium.Color;
};

/** ขอบเขตกรุงเทพมหานคร (จาก bangkok-tiles config) */
const BANGKOK_BOUNDS = {
  west: 99.826,
  south: 13.423,
  east: 100.967,
  north: 14.293,
} as const;

export const BANGKOK_STRATUS_COUNT = 220;
export const BANGKOK_CUMULUS_COUNT = 560;
export const BANGKOK_CLOUD_COUNT = BANGKOK_STRATUS_COUNT + BANGKOK_CUMULUS_COUNT;

const STRATUS_MIN_SPACING_DEG = 0.028;
const CUMULUS_MIN_SPACING_DEG = 0.04;

const MAX_PLACEMENT_ATTEMPTS = 240;

const DEFAULT_CLOUD_SEED = 42;

const STRATUS_COLOR = new cesium.Color(0.8, 0.84, 0.9, 1);
const CUMULUS_COLOR = new cesium.Color(1, 0.98, 0.96, 1);

const STRATUS_CLUSTER_CENTERS: readonly CloudCenter[] = [
  { longitude: 100.5, latitude: 13.74 },
  { longitude: 100.55, latitude: 13.73 },
  { longitude: 100.47, latitude: 13.7 },
] as const;

const CUMULUS_CLUSTER_CENTERS: readonly CloudCenter[] = [
  { longitude: 100.52, latitude: 13.74 },
  { longitude: 100.49, latitude: 13.72 },
  { longitude: 100.56, latitude: 13.71 },
  { longitude: 100.53, latitude: 13.69 },
] as const;

const STRATUS_HORIZON_BANDS = [
  { latitude: 13.67, longitudeCenter: 100.5 },
  { latitude: 13.78, longitudeCenter: 100.53 },
] as const;

const FOCUS_BOUNDS = {
  west: 100.38,
  south: 13.6,
  east: 100.64,
  north: 13.85,
} as const;

const STRATUS_BOUNDS = {
  west: 100.34,
  south: 13.58,
  east: 100.68,
  north: 13.88,
} as const;

/** สร้างฟังก์ชันสุ่มจาก seed */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** สร้างค่าสุ่มจากการแจกแจงสม่ำเสมอ */
function randomBetween(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

/** สร้างค่าสุ่มจากการแจกแจงปกติ */
function gaussianBetween(random: () => number, mean: number, stdDev: number): number {
  const u1 = Math.max(1e-6, random());
  const u2 = Math.max(1e-6, random());
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stdDev;
}

/** เลือกหมอกออกมาจากรายการหมอกที่มีอยู่ */
function randomChoice<T>(random: () => number, options: readonly T[]): T {
  const idx = Math.floor(random() * options.length);
  return options[Math.max(0, Math.min(options.length - 1, idx))] as T;
}

/** ตรวจสอบว่าหมอกนั้นอยู่ใกล้กับหมอกอื่นหรือไม่ */
function isTooClose(
  longitude: number,
  latitude: number,
  placed: readonly Pick<BangkokCloudSpec, "longitude" | "latitude" | "layer">[],
  layer: CloudLayerKind,
): boolean {
  const minSpacingDeg = layer === "stratus" ? STRATUS_MIN_SPACING_DEG : CUMULUS_MIN_SPACING_DEG;
  const minSpacingSq = minSpacingDeg * minSpacingDeg;

  for (const cloud of placed) {
    if (cloud.layer !== layer) {
      continue;
    }

    const deltaLon = longitude - cloud.longitude;
    const deltaLat = latitude - cloud.latitude;

    if ((deltaLon * deltaLon) + (deltaLat * deltaLat) < minSpacingSq) {
      return true;
    }
  }

  return false;
}

/** สร้างข้อมูลกรอบของหมอกสุดขั้ว */
function createStratusSpec(random: () => number, longitude: number, latitude: number): BangkokCloudSpec {
  const scaleX = randomBetween(random, 18_000, 30_000);
  const scaleY = scaleX * randomBetween(random, 0.22, 0.36);

  return {
    layer: "stratus",
    longitude,
    latitude,
    height: randomBetween(random, 3_000, 4_900),
    scale: [scaleX, scaleY],
    maximumSize: [
      randomBetween(random, 95, 145),
      randomBetween(random, 75, 125),
      randomBetween(random, 20, 34),
    ],
    slice: randomBetween(random, 0.39, 0.44),
    brightness: randomBetween(random, 0.68, 0.88),
    color: STRATUS_COLOR,
  };
}

function createCumulusSpec(random: () => number, longitude: number, latitude: number): BangkokCloudSpec {
  const isTower = random() < 0.18;
  const height = isTower
    ? randomBetween(random, 6_500, 9_500)
    : randomBetween(random, 4_500, 7_500);

  const scaleX = randomBetween(random, 9_000, 18_500);
  const scaleY = scaleX * randomBetween(random, 0.58, 0.88);

  const shapeWidth = randomBetween(random, 70, isTower ? 200 : 150);
  const shapeDepth = randomBetween(random, 50, isTower ? 140 : 105);
  const shapeHeight = randomBetween(random, isTower ? 55 : 45, isTower ? 95 : 75);

  return {
    layer: "cumulus",
    longitude,
    latitude,
    height,
    scale: [scaleX, scaleY],
    maximumSize: [shapeWidth, shapeDepth, shapeHeight],
    slice: randomBetween(random, 0.34, 0.52),
    brightness: isTower
      ? randomBetween(random, 1.06, 1.24)
      : randomBetween(random, 0.98, 1.18),
    color: CUMULUS_COLOR,
  };
}

function getClusterCenters(layer: CloudLayerKind) {
  return layer === "stratus" ? STRATUS_CLUSTER_CENTERS : CUMULUS_CLUSTER_CENTERS;
}

function getLayerSpread(layer: CloudLayerKind): { longitudeStdDev: number; latitudeStdDev: number } {
  if (layer === "stratus") {
    return {
      longitudeStdDev: 0.05,
      latitudeStdDev: 0.04,
    };
  }

  return {
    longitudeStdDev: 0.045,
    latitudeStdDev: 0.035,
  };
}

function sampleClusterPosition(
  layer: CloudLayerKind,
  random: () => number,
): CloudPlacement {
  const center = randomChoice(random, getClusterCenters(layer));
  const spread = getLayerSpread(layer);

  return {
    longitude: gaussianBetween(random, center.longitude, spread.longitudeStdDev),
    latitude: gaussianBetween(random, center.latitude, spread.latitudeStdDev),
  };
}

function sampleHorizonBandPosition(random: () => number): CloudPlacement {
  const band = randomChoice(random, STRATUS_HORIZON_BANDS);
  return {
    longitude: gaussianBetween(random, band.longitudeCenter, 0.08),
    latitude: gaussianBetween(random, band.latitude, 0.02),
  };
}

function sampleCloudPosition(layer: CloudLayerKind, random: () => number): CloudPlacement {
  if (layer === "stratus" && random() < 0.58) {
    return sampleHorizonBandPosition(random);
  }

  return sampleClusterPosition(layer, random);
}

function isWithinBangkokBounds(longitude: number, latitude: number): boolean {
  return (
    longitude >= BANGKOK_BOUNDS.west
    && longitude <= BANGKOK_BOUNDS.east
    && latitude >= BANGKOK_BOUNDS.south
    && latitude <= BANGKOK_BOUNDS.north
  );
}

function isWithinFocusBounds(longitude: number, latitude: number): boolean {
  return (
    longitude >= FOCUS_BOUNDS.west
    && longitude <= FOCUS_BOUNDS.east
    && latitude >= FOCUS_BOUNDS.south
    && latitude <= FOCUS_BOUNDS.north
  );
}

function isWithinLayerBounds(layer: CloudLayerKind, longitude: number, latitude: number): boolean {
  if (layer === "stratus") {
    return (
      longitude >= STRATUS_BOUNDS.west
      && longitude <= STRATUS_BOUNDS.east
      && latitude >= STRATUS_BOUNDS.south
      && latitude <= STRATUS_BOUNDS.north
    );
  }

  return isWithinFocusBounds(longitude, latitude);
}

function buildCloudSpec(
  layer: CloudLayerKind,
  random: () => number,
  longitude: number,
  latitude: number,
): BangkokCloudSpec {
  if (layer === "stratus") {
    return createStratusSpec(random, longitude, latitude);
  }

  return createCumulusSpec(random, longitude, latitude);
}

function generateLayerSpecs(
  layer: CloudLayerKind,
  targetCount: number,
  random: () => number,
): BangkokCloudSpec[] {
  const specs: BangkokCloudSpec[] = [];
  while (specs.length < targetCount) {
    let placed = false;

    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
      const { longitude, latitude } = sampleCloudPosition(layer, random);

      if (!isWithinBangkokBounds(longitude, latitude) || !isWithinLayerBounds(layer, longitude, latitude)) {
        continue;
      }

      if (isTooClose(longitude, latitude, specs, layer)) {
        continue;
      }

      specs.push(buildCloudSpec(layer, random, longitude, latitude));
      placed = true;
      break;
    }

    if (!placed) {
      break;
    }
  }

  return specs;
}

function generateRandomBangkokCloudSpecs(
  stratusCount = BANGKOK_STRATUS_COUNT,
  cumulusCount = BANGKOK_CUMULUS_COUNT,
  seed = DEFAULT_CLOUD_SEED,
): BangkokCloudSpec[] {
  const stratusRandom = mulberry32(seed);
  const cumulusRandom = mulberry32(seed + 10_000);

  return [
    ...generateLayerSpecs("stratus", stratusCount, stratusRandom),
    ...generateLayerSpecs("cumulus", cumulusCount, cumulusRandom),
  ];
}

function getCloudCollectionConstructor(): CloudCollectionConstructor {
  const CloudCollection = (cesium as unknown as { CloudCollection?: CloudCollectionConstructor }).CloudCollection;

  if (!CloudCollection) {
    throw new Error("Cesium.CloudCollection is not available in this build");
  }

  return CloudCollection;
}

export function createBangkokCloudCollection(
  stratusCount = BANGKOK_STRATUS_COUNT,
  cumulusCount = BANGKOK_CUMULUS_COUNT,
  seed = DEFAULT_CLOUD_SEED,
): CloudCollectionInstance {
  const noiseSeed = seed * 17;
  const clouds = new (getCloudCollectionConstructor())({
    noiseDetail: 14,
    noiseOffset: new cesium.Cartesian3(noiseSeed, noiseSeed / 2, noiseSeed / 3),
  });
  const specs = generateRandomBangkokCloudSpecs(stratusCount, cumulusCount, seed);

  for (const spec of specs) {
    clouds.add({
      position: cesium.Cartesian3.fromDegrees(spec.longitude, spec.latitude, spec.height),
      scale: new cesium.Cartesian2(...spec.scale),
      maximumSize: new cesium.Cartesian3(...spec.maximumSize),
      slice: spec.slice,
      brightness: spec.brightness,
      color: spec.color,
    });
  }

  return clouds;
}
