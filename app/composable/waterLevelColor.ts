import * as cesium from "cesium";
import type { WaterLevelStatus } from "./bangkokWaterMock";
import { levelToStatus } from "./bangkokWaterTimeSeries";

export const DEFAULT_WATER_LEVEL_COLOR_MAX = 2.5;

/** สี marker ตามสถานะ: เขียวปลอดภัย / ส้มเสี่ยง / แดงอันตราย */
const MARKER_STATUS_COLORS: Record<WaterLevelStatus, string> = {
  normal: "#22c55e",
  watch: "#f97316",
  warning: "#f97316",
  critical: "#ef4444",
};

/** Tailwind blue-50 → blue-800 */
const WATER_BLUE_RAMP: readonly { stop: number; rgb: readonly [number, number, number] }[] = [
  { stop: 0, rgb: [239, 246, 255] },
  { stop: 0.125, rgb: [219, 234, 254] },
  { stop: 0.25, rgb: [191, 219, 254] },
  { stop: 0.375, rgb: [147, 197, 253] },
  { stop: 0.5, rgb: [96, 165, 250] },
  { stop: 0.625, rgb: [59, 130, 246] },
  { stop: 0.75, rgb: [37, 99, 235] },
  { stop: 0.875, rgb: [29, 78, 216] },
  { stop: 1, rgb: [30, 64, 175] },
] as const;

/** blue-200 — minimum marker visibility on satellite imagery */
const MARKER_MIN_RGB: readonly [number, number, number] = [191, 219, 254];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function normalizeWaterLevel(
  levelMeters: number,
  maxLevel = DEFAULT_WATER_LEVEL_COLOR_MAX,
): number {
  if (!Number.isFinite(levelMeters) || levelMeters <= 0) {
    return 0;
  }

  return clamp01(levelMeters / Math.max(maxLevel, 0.01));
}

function interpolateRampRgb(normalized: number): { r: number; g: number; b: number } {
  const t = clamp01(normalized);
  const first = WATER_BLUE_RAMP[0];
  if (!first) {
    return { r: 239, g: 246, b: 255 };
  }

  if (t <= first.stop) {
    const [r, g, b] = first.rgb;
    return { r, g, b };
  }

  for (let index = 1; index < WATER_BLUE_RAMP.length; index += 1) {
    const prev = WATER_BLUE_RAMP[index - 1];
    const next = WATER_BLUE_RAMP[index];
    if (!prev || !next) {
      continue;
    }

    if (t <= next.stop) {
      const segmentProgress = (t - prev.stop) / (next.stop - prev.stop);
      return {
        r: Math.round(prev.rgb[0] + ((next.rgb[0] - prev.rgb[0]) * segmentProgress)),
        g: Math.round(prev.rgb[1] + ((next.rgb[1] - prev.rgb[1]) * segmentProgress)),
        b: Math.round(prev.rgb[2] + ((next.rgb[2] - prev.rgb[2]) * segmentProgress)),
      };
    }
  }

  const last = WATER_BLUE_RAMP.at(-1);
  if (!last) {
    return { r: 30, g: 64, b: 175 };
  }

  const [r, g, b] = last.rgb;
  return { r, g, b };
}

export type WaterLevelColorOptions = {
  maxLevel?: number;
  alpha?: number;
  /** Use at least blue-200 for map markers at low levels */
  enforceMarkerMinimum?: boolean;
};

export function getWaterLevelColor(
  levelMeters: number,
  options?: WaterLevelColorOptions,
): cesium.Color {
  const maxLevel = options?.maxLevel ?? DEFAULT_WATER_LEVEL_COLOR_MAX;
  const alpha = options?.alpha ?? 1;
  const normalized = normalizeWaterLevel(levelMeters, maxLevel);
  let { r, g, b } = interpolateRampRgb(normalized);

  if (options?.enforceMarkerMinimum && normalized < 0.25) {
    const minBlend = 1 - (normalized / 0.25);
    const [minR, minG, minB] = MARKER_MIN_RGB;
    r = Math.round(r + ((minR - r) * minBlend));
    g = Math.round(g + ((minG - g) * minBlend));
    b = Math.round(b + ((minB - b) * minBlend));
  }

  return new cesium.Color(r / 255, g / 255, b / 255, clamp01(alpha));
}

export function getWaterLevelCssColor(
  levelMeters: number,
  options?: WaterLevelColorOptions,
): string {
  const color = getWaterLevelColor(levelMeters, { ...options, alpha: 1 });
  const r = Math.round(color.red * 255);
  const g = Math.round(color.green * 255);
  const b = Math.round(color.blue * 255);
  const alpha = options?.alpha ?? 1;
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
}

export function getWaterMarkerColor(levelMeters: number, alpha = 1): cesium.Color {
  const status = levelToStatus(levelMeters);
  const cssColor = MARKER_STATUS_COLORS[status];
  return cesium.Color.fromCssColorString(cssColor).withAlpha(clamp01(alpha));
}

/** Alpha for flood fill layers — scales with depth while hue comes from ramp */
export function getFloodFillAlpha(
  depthMeters: number,
  hideThreshold = 0.02,
  maxVisualDepth = DEFAULT_WATER_LEVEL_COLOR_MAX,
): number {
  if (depthMeters <= hideThreshold) {
    return 0;
  }

  const normalized = clamp01(depthMeters / Math.max(maxVisualDepth, 0.01));
  return 0.12 + (normalized * 0.38);
}
