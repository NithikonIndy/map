import * as cesium from "cesium";

const OPEN_METEO_FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_ARCHIVE_ENDPOINT = "https://archive-api.open-meteo.com/v1/archive";

export const BANGKOK_RAIN_BOUNDS = {
  west: 99.826,
  south: 13.423,
  east: 100.967,
  north: 14.293,
} as const;

const GRID_COLUMNS = 10;
const GRID_ROWS = 8;
const GRID_FETCH_BATCH_SIZE = 30;
const RAIN_INTENSITY_NORMALIZATION_MAX = 30;
const CURRENT_WINDOW_MS = 60 * 60 * 1000;

type OpenMeteoHourly = {
  time: string[];
  precipitation?: number[];
};

type OpenMeteoPointResponse = {
  latitude: number;
  longitude: number;
  hourly?: OpenMeteoHourly;
};

type OpenMeteoBatchResponse = OpenMeteoPointResponse | OpenMeteoPointResponse[];

type GridPoint = {
  latitude: number;
  longitude: number;
  row: number;
  col: number;
};

export type RainHeatmapFrame = {
  timestampIso: string;
  timestampMs: number;
  source: "historical" | "current" | "forecast";
  intensityGrid: number[][];
  maxPrecipitationMmPerHour: number;
};

export type OpenMeteoRainDataset = {
  rangeStartIso: string;
  rangeEndIso: string;
  generatedAt: number;
  frames: RainHeatmapFrame[];
};

export type RainDateRange = {
  startDateIso: string;
  endDateIso: string;
};

type RainSegment = {
  source: "historical" | "forecast";
  startDateIso: string;
  endDateIso: string;
};

const datasetCache = new Map<string, Promise<OpenMeteoRainDataset>>();

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function createGridPoints(bounds = BANGKOK_RAIN_BOUNDS): GridPoint[] {
  const points: GridPoint[] = [];
  const lonStep = (bounds.east - bounds.west) / (GRID_COLUMNS - 1);
  const latStep = (bounds.north - bounds.south) / (GRID_ROWS - 1);

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLUMNS; col += 1) {
      points.push({
        latitude: bounds.north - (row * latStep),
        longitude: bounds.west + (col * lonStep),
        row,
        col,
      });
    }
  }

  return points;
}

function chunkArray<T>(source: readonly T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < source.length; index += chunkSize) {
    chunks.push(source.slice(index, index + chunkSize));
  }
  return chunks;
}

type RainRangeOptions = {
  pastDays: number;
  forecastDays: number;
};

function normalizePositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function buildRealtimeRangeOptions(options?: Partial<RainRangeOptions>): RainRangeOptions {
  return {
    pastDays: normalizePositiveInteger(options?.pastDays ?? 7, 7),
    forecastDays: normalizePositiveInteger(options?.forecastDays ?? 7, 7),
  };
}

function formatDateBangkok(date: Date): string {
  const bangkokMs = date.getTime() + (7 * 60 * 60 * 1000);
  const bangkok = new Date(bangkokMs);
  const year = bangkok.getUTCFullYear();
  const month = String(bangkok.getUTCMonth() + 1).padStart(2, "0");
  const day = String(bangkok.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createDefaultRangeFromNow(options?: Partial<RainRangeOptions>): RainDateRange {
  const rangeOptions = buildRealtimeRangeOptions(options);
  const now = new Date();
  const start = new Date(now.getTime() - (rangeOptions.pastDays * 24 * 60 * 60 * 1000));
  const end = new Date(now.getTime() + (rangeOptions.forecastDays * 24 * 60 * 60 * 1000));
  return {
    startDateIso: formatDateBangkok(start),
    endDateIso: formatDateBangkok(end),
  };
}

function normalizeDateRange(input?: Partial<RainDateRange>): RainDateRange {
  const fallback = createDefaultRangeFromNow();
  const startDateIso = input?.startDateIso?.trim() || fallback.startDateIso;
  const endDateIso = input?.endDateIso?.trim() || fallback.endDateIso;

  if (startDateIso <= endDateIso) {
    return { startDateIso, endDateIso };
  }

  return { startDateIso: endDateIso, endDateIso: startDateIso };
}

function splitRangeByToday(range: RainDateRange): RainSegment[] {
  const todayIso = formatDateBangkok(new Date());
  if (range.endDateIso < todayIso) {
    return [{ source: "historical", startDateIso: range.startDateIso, endDateIso: range.endDateIso }];
  }

  if (range.startDateIso > todayIso) {
    return [{ source: "forecast", startDateIso: range.startDateIso, endDateIso: range.endDateIso }];
  }

  return [
    { source: "historical", startDateIso: range.startDateIso, endDateIso: todayIso },
    { source: "forecast", startDateIso: todayIso, endDateIso: range.endDateIso },
  ];
}

function resolveSingleDateSegment(dateIso: string): RainSegment {
  const todayIso = formatDateBangkok(new Date());
  return {
    source: dateIso < todayIso ? "historical" : "forecast",
    startDateIso: dateIso,
    endDateIso: dateIso,
  };
}

function resolveRainSource(timestampMs: number, referenceNowMs: number): RainHeatmapFrame["source"] {
  const deltaMs = timestampMs - referenceNowMs;
  if (Math.abs(deltaMs) <= CURRENT_WINDOW_MS) {
    return "current";
  }

  return deltaMs < 0 ? "historical" : "forecast";
}

async function fetchBatch(
  points: readonly GridPoint[],
  segment: RainSegment,
): Promise<OpenMeteoPointResponse[]> {
  if (points.length === 0) {
    return [];
  }

  const latitude = points.map((point) => point.latitude.toFixed(4)).join(",");
  const longitude = points.map((point) => point.longitude.toFixed(4)).join(",");
  const endpoint = segment.source === "historical"
    ? OPEN_METEO_ARCHIVE_ENDPOINT
    : OPEN_METEO_FORECAST_ENDPOINT;
  const query = new URLSearchParams({
    latitude,
    longitude,
    hourly: "precipitation",
    timezone: "Asia/Bangkok",
    start_date: segment.startDateIso,
    end_date: segment.endDateIso,
  });
  const url = `${endpoint}?${query.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as OpenMeteoBatchResponse;
  return Array.isArray(payload) ? payload : [payload];
}

function getPrecipitationAtIndex(point: OpenMeteoPointResponse, index: number): number {
  const hourly = point.hourly;
  if (!hourly?.precipitation?.length) {
    return 0;
  }

  if (index < 0 || index >= hourly.precipitation.length) {
    return 0;
  }

  const value = hourly.precipitation[index];
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function createEmptyGrid(): number[][] {
  return Array.from({ length: GRID_ROWS }, () => Array.from({ length: GRID_COLUMNS }, () => 0));
}

function normalizeRainIntensity(mmPerHour: number): number {
  return clamp01(mmPerHour / RAIN_INTENSITY_NORMALIZATION_MAX);
}

function buildFrames(
  gridPoints: readonly GridPoint[],
  responses: readonly OpenMeteoPointResponse[],
  nowMs: number,
): RainHeatmapFrame[] {
  const firstHourly = responses[0]?.hourly;
  const timestamps = firstHourly?.time ?? [];
  const frames: RainHeatmapFrame[] = [];

  for (let index = 0; index < timestamps.length; index += 1) {
    const timestampIso = timestamps[index];
    const timestampMs = Date.parse(timestampIso);
    if (!Number.isFinite(timestampMs)) {
      continue;
    }

    const grid = createEmptyGrid();
    let maxPrecipitation = 0;

    for (let pointIndex = 0; pointIndex < gridPoints.length; pointIndex += 1) {
      const point = gridPoints[pointIndex];
      const response = responses[pointIndex];

      const mmPerHour = response ? getPrecipitationAtIndex(response, index) : 0;
      grid[point.row][point.col] = normalizeRainIntensity(mmPerHour);
      maxPrecipitation = Math.max(maxPrecipitation, mmPerHour);
    }

    frames.push({
      timestampIso,
      timestampMs,
      source: resolveRainSource(timestampMs, nowMs),
      intensityGrid: grid,
      maxPrecipitationMmPerHour: maxPrecipitation,
    });
  }

  return frames;
}

export async function fetchBangkokRealtimeRainDataset(
  options?: Partial<RainDateRange & RainRangeOptions>,
): Promise<OpenMeteoRainDataset> {
  const fallbackRange = createDefaultRangeFromNow(options);
  const normalizedRange = normalizeDateRange({
    startDateIso: options?.startDateIso ?? fallbackRange.startDateIso,
    endDateIso: options?.endDateIso ?? fallbackRange.endDateIso,
  });
  const cacheKey = `openmeteo-rain:start-${normalizedRange.startDateIso}:end-${normalizedRange.endDateIso}`;
  const cached = datasetCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const promise = (async () => {
    const now = new Date();
    const segments = splitRangeByToday(normalizedRange);
    const gridPoints = createGridPoints();
    const allFrames: RainHeatmapFrame[] = [];

    for (const segment of segments) {
      const responseBatches = await Promise.all(
        chunkArray(gridPoints, GRID_FETCH_BATCH_SIZE)
          .map((batch) => fetchBatch(batch, segment)),
      );
      const responses = responseBatches.flat();
      allFrames.push(...buildFrames(gridPoints, responses, now.getTime()));
    }

    const dedupedFrames = new Map<string, RainHeatmapFrame>();
    for (const frame of allFrames) {
      dedupedFrames.set(frame.timestampIso, frame);
    }

    const frames = Array.from(dedupedFrames.values())
      .sort((left, right) => left.timestampMs - right.timestampMs);

    return {
      rangeStartIso: normalizedRange.startDateIso,
      rangeEndIso: normalizedRange.endDateIso,
      generatedAt: Date.now(),
      frames,
    };
  })();

  datasetCache.set(cacheKey, promise);

  try {
    return await promise;
  } catch (error) {
    datasetCache.delete(cacheKey);
    throw error;
  }
}

export async function fetchBangkokRainDatasetForDate(dateIso: string): Promise<OpenMeteoRainDataset> {
  const normalizedDate = dateIso.trim();
  const cacheKey = `openmeteo-rain:date-${normalizedDate}`;
  const cached = datasetCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const promise = (async () => {
    const now = new Date();
    const gridPoints = createGridPoints();
    const segment = resolveSingleDateSegment(normalizedDate);
    const responseBatches = await Promise.all(
      chunkArray(gridPoints, GRID_FETCH_BATCH_SIZE)
        .map((batch) => fetchBatch(batch, segment)),
    );
    const responses = responseBatches.flat();
    const frames = buildFrames(gridPoints, responses, now.getTime())
      .sort((left, right) => left.timestampMs - right.timestampMs);

    return {
      rangeStartIso: normalizedDate,
      rangeEndIso: normalizedDate,
      generatedAt: Date.now(),
      frames,
    };
  })();

  datasetCache.set(cacheKey, promise);

  try {
    return await promise;
  } catch (error) {
    datasetCache.delete(cacheKey);
    throw error;
  }
}

export function getRainFrameNearestTime(
  dataset: OpenMeteoRainDataset,
  targetTime: Date,
): RainHeatmapFrame | null {
  if (dataset.frames.length === 0) {
    return null;
  }

  const targetMs = targetTime.getTime();
  let nearest: RainHeatmapFrame | null = null;
  let nearestDelta = Number.POSITIVE_INFINITY;

  for (const frame of dataset.frames) {
    const delta = Math.abs(frame.timestampMs - targetMs);
    if (delta < nearestDelta) {
      nearest = frame;
      nearestDelta = delta;
    }
  }

  return nearest;
}

export function getRainFrameByDateHour(
  dataset: OpenMeteoRainDataset,
  dateIso: string,
  hour: number,
): RainHeatmapFrame | null {
  const normalizedHour = String(Math.max(0, Math.min(23, Math.floor(hour)))).padStart(2, "0");
  const targetPrefix = `${dateIso}T${normalizedHour}:`;
  return dataset.frames.find((frame) => frame.timestampIso.startsWith(targetPrefix)) ?? null;
}

export function getBangkokRainBoundsRectangle(): cesium.Rectangle {
  return cesium.Rectangle.fromDegrees(
    BANGKOK_RAIN_BOUNDS.west,
    BANGKOK_RAIN_BOUNDS.south,
    BANGKOK_RAIN_BOUNDS.east,
    BANGKOK_RAIN_BOUNDS.north,
  );
}
