import * as cesium from "cesium";
import { WATER_SIMULATION_DATE } from "./bangkokWaterTimeSeries";

/** ใจกลางกรุงเทพ */
export const BANGKOK_LATITUDE = 13.7563;
export const BANGKOK_LONGITUDE = 100.5018;

const BANGKOK_UTC_OFFSET_HOURS = 7;
const DEFAULT_SUNRISE = "06:00";
const DEFAULT_SUNSET = "18:30";

export type DayNightPhase = "night" | "dawn" | "day" | "dusk";

export type BangkokSunTimes = {
  sunrise: cesium.JulianDate;
  sunset: cesium.JulianDate;
  sunriseLabel: string;
  sunsetLabel: string;
};

function padTime(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function localTimeToJulianDate(dateIso: string, timeHours: number): cesium.JulianDate {
  const wholeHours = Math.floor(timeHours);
  const wholeMinutes = Math.round((timeHours - wholeHours) * 60);
  const iso = `${dateIso}T${padTime(wholeHours, wholeMinutes)}:00+07:00`;
  return cesium.JulianDate.fromIso8601(iso);
}

function parseSimulationDate(dateIso: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateIso.split("-").map(Number);
  return { year, month, day };
}

/**
 * NOAA-style solar calculation (approximate sunrise/sunset in local civil time).
 */
function calculateSunriseSunsetLocalHours(
  latitudeDeg: number,
  longitudeDeg: number,
  dateIso: string,
): { sunriseHours: number; sunsetHours: number } {
  const { year, month, day } = parseSimulationDate(dateIso);
  const julianDay = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day - 1524.5;
  const century = (julianDay - 2451545.0) / 36525.0;
  const geomMeanLongSun = (280.46646 + century * (36000.76983 + 0.0003032 * century)) % 360;
  const geomMeanAnomalySun = 357.52911 + century * (35999.05029 - 0.0001537 * century);
  const eccentricityEarthOrbit = 0.016708634 - century * (0.000042037 + 0.0000001267 * century);
  const sunEqOfCenter = Math.sin(geomMeanAnomalySun * cesium.Math.RADIANS_PER_DEGREE)
    * (1.914602 - century * (0.004817 + 0.000014 * century))
    + Math.sin(2 * geomMeanAnomalySun * cesium.Math.RADIANS_PER_DEGREE) * (0.019993 - 0.000101 * century)
    + Math.sin(3 * geomMeanAnomalySun * cesium.Math.RADIANS_PER_DEGREE) * 0.000289;
  const sunTrueLong = geomMeanLongSun + sunEqOfCenter;
  const sunAppLong = sunTrueLong - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * century) * cesium.Math.RADIANS_PER_DEGREE);
  const meanObliquity = 23 + (26 + (21.448 - century * (46.815 + century * (0.00059 - century * 0.001813))) / 60) / 60;
  const obliquityCorrection = meanObliquity + 0.00256 * Math.cos((125.04 - 1934.136 * century) * cesium.Math.RADIANS_PER_DEGREE);
  const sunDeclination = Math.asin(
    Math.sin(obliquityCorrection * cesium.Math.RADIANS_PER_DEGREE)
    * Math.sin(sunAppLong * cesium.Math.RADIANS_PER_DEGREE),
  ) * cesium.Math.DEGREES_PER_RADIAN;
  const varY = Math.tan((obliquityCorrection / 2) * cesium.Math.RADIANS_PER_DEGREE)
    * Math.tan((obliquityCorrection / 2) * cesium.Math.RADIANS_PER_DEGREE);
  const eqOfTime = 4 * (
    varY * Math.sin(2 * geomMeanLongSun * cesium.Math.RADIANS_PER_DEGREE)
    - 2 * eccentricityEarthOrbit * Math.sin(geomMeanAnomalySun * cesium.Math.RADIANS_PER_DEGREE)
    + 4 * eccentricityEarthOrbit * varY * Math.sin(geomMeanAnomalySun * cesium.Math.RADIANS_PER_DEGREE)
      * Math.cos(2 * geomMeanLongSun * cesium.Math.RADIANS_PER_DEGREE)
    - 0.5 * varY * varY * Math.sin(4 * geomMeanLongSun * cesium.Math.RADIANS_PER_DEGREE)
    - 1.25 * eccentricityEarthOrbit * eccentricityEarthOrbit
      * Math.sin(2 * geomMeanAnomalySun * cesium.Math.RADIANS_PER_DEGREE)
  );
  const hourAngle = Math.acos(
    Math.cos(cesium.Math.toRadians(90.833))
    / (Math.cos(cesium.Math.toRadians(latitudeDeg)) * Math.cos(cesium.Math.toRadians(sunDeclination)))
    - Math.tan(cesium.Math.toRadians(latitudeDeg)) * Math.tan(cesium.Math.toRadians(sunDeclination)),
  ) * cesium.Math.DEGREES_PER_RADIAN;
  const solarNoon = (720 - 4 * longitudeDeg - eqOfTime + BANGKOK_UTC_OFFSET_HOURS * 60) / 60;
  const sunriseHours = solarNoon - hourAngle / 15;
  const sunsetHours = solarNoon + hourAngle / 15;

  if (!Number.isFinite(sunriseHours) || !Number.isFinite(sunsetHours)) {
    return { sunriseHours: 6, sunsetHours: 18.5 };
  }

  return { sunriseHours, sunsetHours };
}

export function getBangkokSunTimes(dateIso = WATER_SIMULATION_DATE): BangkokSunTimes {
  try {
    const { sunriseHours, sunsetHours } = calculateSunriseSunsetLocalHours(
      BANGKOK_LATITUDE,
      BANGKOK_LONGITUDE,
      dateIso,
    );
    const sunriseWhole = Math.floor(sunriseHours);
    const sunriseMinutes = Math.round((sunriseHours - sunriseWhole) * 60);
    const sunsetWhole = Math.floor(sunsetHours);
    const sunsetMinutes = Math.round((sunsetHours - sunsetWhole) * 60);
    const sunriseLabel = padTime(sunriseWhole, sunriseMinutes);
    const sunsetLabel = padTime(sunsetWhole, sunsetMinutes);

    return {
      sunrise: localTimeToJulianDate(dateIso, sunriseHours),
      sunset: localTimeToJulianDate(dateIso, sunsetHours),
      sunriseLabel,
      sunsetLabel,
    };
  } catch {
    return {
      sunrise: localTimeToJulianDate(dateIso, 6),
      sunset: localTimeToJulianDate(dateIso, 18.5),
      sunriseLabel: DEFAULT_SUNRISE,
      sunsetLabel: DEFAULT_SUNSET,
    };
  }
}

function getMinutesOfDayBangkok(time: cesium.JulianDate): number {
  const date = cesium.JulianDate.toDate(time);
  const bangkokMs = date.getTime() + BANGKOK_UTC_OFFSET_HOURS * 3_600_000;
  const bangkok = new Date(bangkokMs);
  return bangkok.getUTCHours() * 60 + bangkok.getUTCMinutes();
}

function julianToMinutesBangkok(time: cesium.JulianDate): number {
  return getMinutesOfDayBangkok(time);
}

export function getDayNightPhase(time: cesium.JulianDate, sunTimes: BangkokSunTimes): DayNightPhase {
  const minutes = getMinutesOfDayBangkok(time);
  const sunriseMinutes = julianToMinutesBangkok(sunTimes.sunrise);
  const sunsetMinutes = julianToMinutesBangkok(sunTimes.sunset);
  const dawnStart = sunriseMinutes - 45;
  const dawnEnd = sunriseMinutes + 20;
  const duskStart = sunsetMinutes - 20;
  const duskEnd = sunsetMinutes + 45;

  if (minutes >= dawnStart && minutes < dawnEnd) {
    return "dawn";
  }

  if (minutes >= duskStart && minutes < duskEnd) {
    return "dusk";
  }

  if (minutes >= dawnEnd && minutes < duskStart) {
    return "day";
  }

  return "night";
}

export function getDayNightPhaseLabel(phase: DayNightPhase): string {
  switch (phase) {
    case "dawn":
      return "รุ่งเช้า";
    case "day":
      return "กลางวัน";
    case "dusk":
      return "พลบค่ำ";
    default:
      return "กลางคืน";
  }
}

type LightingProfile = {
  sunIntensity: number;
  fogMinimumBrightness: number;
  fogDensity: number;
  atmosphereBrightnessShift: number;
  atmosphereSaturationShift: number;
};

function getLightingProfile(phase: DayNightPhase): LightingProfile {
  switch (phase) {
    case "dawn":
      return {
        sunIntensity: 1.35,
        fogMinimumBrightness: 0.06,
        fogDensity: 8.5e-5,
        atmosphereBrightnessShift: -0.08,
        atmosphereSaturationShift: -0.05,
      };
    case "day":
      return {
        sunIntensity: 2,
        fogMinimumBrightness: 0.05,
        fogDensity: 7e-5,
        atmosphereBrightnessShift: 0,
        atmosphereSaturationShift: 0,
      };
    case "dusk":
      return {
        sunIntensity: 1.1,
        fogMinimumBrightness: 0.07,
        fogDensity: 9e-5,
        atmosphereBrightnessShift: -0.12,
        atmosphereSaturationShift: -0.08,
      };
    default:
      return {
        sunIntensity: 0.45,
        fogMinimumBrightness: 0.14,
        fogDensity: 1.1e-4,
        atmosphereBrightnessShift: -0.22,
        atmosphereSaturationShift: -0.18,
      };
  }
}

export function syncBangkokDayNightLighting(
  viewer: cesium.Viewer,
  time: cesium.JulianDate,
  sunTimes: BangkokSunTimes,
  options?: { cloudsLayerEnabled?: boolean },
): DayNightPhase {
  const phase = getDayNightPhase(time, sunTimes);
  const profile = getLightingProfile(phase);
  const { scene } = viewer;
  const cloudsLayerEnabled = options?.cloudsLayerEnabled ?? false;

  scene.globe.enableLighting = true;

  const light = scene.light;
  if (light instanceof cesium.SunLight) {
    light.intensity = profile.sunIntensity;
  }

  if (!cloudsLayerEnabled) {
    scene.fog.enabled = true;
    scene.fog.minimumBrightness = profile.fogMinimumBrightness;
    scene.fog.density = profile.fogDensity;
  }

  const atmosphere = scene.skyAtmosphere;
  if (atmosphere) {
    atmosphere.brightnessShift = profile.atmosphereBrightnessShift;
    atmosphere.saturationShift = profile.atmosphereSaturationShift;
  }

  return phase;
}
