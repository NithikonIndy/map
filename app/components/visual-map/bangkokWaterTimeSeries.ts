import * as cesium from "cesium";
import { bangkokWaterStations, type WaterLevelStatus } from "./bangkokWaterMock";

export const WATER_SIMULATION_DATE = "2026-05-26";
export const CLOCK_START_TIME = "00:00";
export const CLOCK_STOP_TIME = "24:00";
export const RAIN_START_TIME = "12:00";
export const RAIN_END_TIME = "16:00";

const BANGKOK_UTC_OFFSET_HOURS = 7;
const DEFAULT_WATER_INTERPOLATION_PROFILE = {
  preRainRiseFactor: 0.12,
  postRainDecayFactor: 0.35,
} as const;

function clockTimeToJulianDate(time: string): cesium.JulianDate {
  const [hours, minutes] = time.split(":").map(Number);
  const iso = `${WATER_SIMULATION_DATE}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+07:00`;
  return cesium.JulianDate.fromIso8601(iso);
}

const simulationStart = clockTimeToJulianDate(CLOCK_START_TIME);
const simulationStop = new cesium.JulianDate();
cesium.JulianDate.addSeconds(simulationStart, 24 * 60 * 60, simulationStop);

export const waterSimulationClock = {
  start: simulationStart,
  stop: simulationStop,
};

const rainStart = clockTimeToJulianDate(RAIN_START_TIME);
const rainEnd = clockTimeToJulianDate(RAIN_END_TIME);

export function formatSimulationClockTime(time: cesium.JulianDate): string {
  const date = cesium.JulianDate.toDate(time);
  const bangkokMs = date.getTime() + BANGKOK_UTC_OFFSET_HOURS * 3_600_000;
  const bangkok = new Date(bangkokMs);
  const hours = String(bangkok.getUTCHours()).padStart(2, "0");
  const minutes = String(bangkok.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function getBangkokHourFromJulianDate(time: cesium.JulianDate): number {
  const date = cesium.JulianDate.toDate(time);
  const bangkokMs = date.getTime() + BANGKOK_UTC_OFFSET_HOURS * 3_600_000;
  const bangkok = new Date(bangkokMs);
  return bangkok.getUTCHours();
}

export function getSimulationProgress(time: cesium.JulianDate): number {
  const totalSeconds = cesium.JulianDate.secondsDifference(
    waterSimulationClock.stop,
    waterSimulationClock.start,
  );

  if (totalSeconds <= 0) {
    return 0;
  }

  const elapsedSeconds = cesium.JulianDate.secondsDifference(time, waterSimulationClock.start);
  return cesium.Math.clamp(elapsedSeconds / totalSeconds, 0, 1);
}

export function progressToSimulationTime(progress: number): cesium.JulianDate {
  const totalSeconds = cesium.JulianDate.secondsDifference(
    waterSimulationClock.stop,
    waterSimulationClock.start,
  );
  const result = new cesium.JulianDate();
  cesium.JulianDate.addSeconds(
    waterSimulationClock.start,
    totalSeconds * cesium.Math.clamp(progress, 0, 1),
    result,
  );
  return result;
}

export function isRainPeriod(time: cesium.JulianDate): boolean {
  return (
    cesium.JulianDate.greaterThanOrEquals(time, rainStart)
    && cesium.JulianDate.lessThan(time, rainEnd)
  );
}

export function levelToStatus(levelMeters: number): WaterLevelStatus {
  if (levelMeters >= 2.1) {
    return "critical";
  }

  if (levelMeters >= 1.5) {
    return "warning";
  }

  if (levelMeters >= 0.9) {
    return "watch";
  }

  return "normal";
}

export function getLevelAtTime(
  property: cesium.SampledProperty,
  time: cesium.JulianDate,
  fallback: number,
): number {
  const value = property.getValue(time);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function interpolateWaterLevel(
  baseLevel: number,
  peakLevel: number,
  time: cesium.JulianDate,
  profile: {
    preRainRiseFactor: number;
    postRainDecayFactor: number;
    useRainEaseIn?: boolean;
  } = DEFAULT_WATER_INTERPOLATION_PROFILE,
): number {
  if (cesium.JulianDate.lessThan(time, rainStart)) {
    const span = cesium.JulianDate.secondsDifference(rainStart, waterSimulationClock.start);

    if (span <= 0) {
      return baseLevel;
    }

    const progress = cesium.JulianDate.secondsDifference(time, waterSimulationClock.start) / span;
    return baseLevel + (peakLevel - baseLevel) * profile.preRainRiseFactor * cesium.Math.clamp(progress, 0, 1);
  }

  if (cesium.JulianDate.lessThan(time, rainEnd)) {
    const span = cesium.JulianDate.secondsDifference(rainEnd, rainStart);

    if (span <= 0) {
      return peakLevel;
    }

    const progress = cesium.JulianDate.secondsDifference(time, rainStart) / span;
    const clampedProgress = cesium.Math.clamp(progress, 0, 1);
    const easedProgress = profile.useRainEaseIn
      ? clampedProgress * clampedProgress * (3 - (2 * clampedProgress))
      : clampedProgress;
    return baseLevel + (peakLevel - baseLevel) * easedProgress;
  }

  const span = cesium.JulianDate.secondsDifference(waterSimulationClock.stop, rainEnd);

  if (span <= 0) {
    return peakLevel;
  }

  const progress = cesium.JulianDate.secondsDifference(time, rainEnd) / span;
  return peakLevel - (peakLevel - baseLevel) * profile.postRainDecayFactor * cesium.Math.clamp(progress, 0, 1);
}

function addSimulationSamples(
  property: cesium.SampledProperty,
  baseLevel: number,
  peakLevel: number,
  sampleCount = 49,
  profile?: {
    preRainRiseFactor: number;
    postRainDecayFactor: number;
    useRainEaseIn?: boolean;
  },
): void {
  const totalSeconds = cesium.JulianDate.secondsDifference(
    waterSimulationClock.stop,
    waterSimulationClock.start,
  );

  for (let index = 0; index <= sampleCount; index += 1) {
    const sampleTime = new cesium.JulianDate();
    cesium.JulianDate.addSeconds(
      waterSimulationClock.start,
      (totalSeconds * index) / sampleCount,
      sampleTime,
    );
    property.addSample(sampleTime, interpolateWaterLevel(baseLevel, peakLevel, sampleTime, profile));
  }
}

export function buildStationLevelProperties(): Map<string, cesium.SampledProperty> {
  const properties = new Map<string, cesium.SampledProperty>();

  for (const station of bangkokWaterStations) {
    const property = new cesium.SampledProperty(Number);
    const baseLevel = 0;
    const peakLevel = station.levelMeters;
    addSimulationSamples(property, baseLevel, peakLevel, 49, {
      preRainRiseFactor: 0,
      postRainDecayFactor: 0.68,
      useRainEaseIn: true,
    });
    properties.set(station.id, property);
  }

  return properties;
}

function getAverageStationLevelAtTime(
  stationLevelProperties: Map<string, cesium.SampledProperty>,
  time: cesium.JulianDate,
): number {
  let total = 0;
  let count = 0;

  for (const property of stationLevelProperties.values()) {
    const value = property.getValue(time);
    if (typeof value === "number" && Number.isFinite(value)) {
      total += value;
      count += 1;
    }
  }

  if (count === 0) {
    return 0;
  }

  return total / count;
}

export function createFloodLevelProperty(
  stationLevelProperties: Map<string, cesium.SampledProperty>,
  sampleCount = 49,
): cesium.SampledProperty {
  const property = new cesium.SampledProperty(Number);
  const totalSeconds = cesium.JulianDate.secondsDifference(
    waterSimulationClock.stop,
    waterSimulationClock.start,
  );
  const startBaseline = getAverageStationLevelAtTime(stationLevelProperties, waterSimulationClock.start);

  for (let index = 0; index <= sampleCount; index += 1) {
    const sampleTime = new cesium.JulianDate();
    cesium.JulianDate.addSeconds(
      waterSimulationClock.start,
      (totalSeconds * index) / sampleCount,
      sampleTime,
    );

    const averageLevel = getAverageStationLevelAtTime(stationLevelProperties, sampleTime);
    const floodDepth = Math.max(0, averageLevel - startBaseline);
    property.addSample(sampleTime, floodDepth);
  }

  return property;
}
