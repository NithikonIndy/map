import * as cesium from "cesium";
import { getBangkokRainBoundsRectangle } from "./openMeteoRainClient";

export type BangkokRainHeatmapLayer = {
  setVisible: (visible: boolean) => void;
  setOpacity: (alpha: number) => void;
  setPerformanceMode: (lite: boolean) => void;
  updateFrame: (intensityGrid: number[][]) => void;
  destroy: () => void;
};

type HeatColorStop = {
  stop: number;
  color: [number, number, number];
};

const DEFAULT_ALPHA = 0.82;
const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 512;
const CANVAS_WIDTH_LITE = 384;
const CANVAS_HEIGHT_LITE = 384;

const COLOR_RAMP: readonly HeatColorStop[] = [
  { stop: 0.08, color: [34, 197, 94] },
  { stop: 0.28, color: [132, 204, 22] },
  { stop: 0.5, color: [250, 204, 21] },
  { stop: 0.72, color: [249, 115, 22] },
  { stop: 0.88, color: [239, 68, 68] },
  { stop: 1, color: [147, 51, 234] },
] as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getInterpolatedColor(value: number): { r: number; g: number; b: number } {
  const normalized = clamp01(value);
  const firstStop = COLOR_RAMP[0];
  if (!firstStop) {
    return { r: 255, g: 255, b: 255 };
  }

  if (normalized <= firstStop.stop) {
    const [r, g, b] = firstStop.color;
    return { r, g, b };
  }

  for (let index = 1; index < COLOR_RAMP.length; index += 1) {
    const prev = COLOR_RAMP[index - 1];
    const next = COLOR_RAMP[index];
    if (!prev || !next) {
      continue;
    }

    if (normalized <= next.stop) {
      const segmentProgress = (normalized - prev.stop) / (next.stop - prev.stop);
      return {
        r: Math.round(prev.color[0] + ((next.color[0] - prev.color[0]) * segmentProgress)),
        g: Math.round(prev.color[1] + ((next.color[1] - prev.color[1]) * segmentProgress)),
        b: Math.round(prev.color[2] + ((next.color[2] - prev.color[2]) * segmentProgress)),
      };
    }
  }

  const lastStop = COLOR_RAMP.at(-1);
  if (!lastStop) {
    return { r: 255, g: 255, b: 255 };
  }
  const [r, g, b] = lastStop.color;
  return { r, g, b };
}

function sampleGridBilinear(grid: number[][], u: number, v: number): number {
  const firstRow = grid[0];
  if (grid.length === 0 || !firstRow || firstRow.length === 0) {
    return 0;
  }

  const rows = grid.length;
  const cols = firstRow.length;
  const x = clamp01(u) * (cols - 1);
  const y = clamp01(v) * (rows - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(cols - 1, x0 + 1);
  const y1 = Math.min(rows - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;

  const q00 = grid[y0]?.[x0] ?? 0;
  const q10 = grid[y0]?.[x1] ?? 0;
  const q01 = grid[y1]?.[x0] ?? 0;
  const q11 = grid[y1]?.[x1] ?? 0;

  const top = q00 + ((q10 - q00) * tx);
  const bottom = q01 + ((q11 - q01) * tx);
  return clamp01(top + ((bottom - top) * ty));
}

function drawHeatmap(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensityGrid: number[][],
): void {
  const imageData = context.createImageData(width, height);
  const { data } = imageData;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const v = y / Math.max(1, height - 1);
      const intensity = sampleGridBilinear(intensityGrid, u, v);

      const index = (y * width + x) * 4;
      if (intensity < 0.01) {
        data[index + 3] = 0;
        continue;
      }

      const color = getInterpolatedColor(intensity);
      data[index] = color.r;
      data[index + 1] = color.g;
      data[index + 2] = color.b;
      data[index + 3] = Math.round(255 * clamp01(Math.max(0.35, intensity * 0.92)));
    }
  }

  context.putImageData(imageData, 0, 0);
}

function resizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
  if (canvas.width === width && canvas.height === height) {
    return;
  }

  canvas.width = width;
  canvas.height = height;
}

export function createBangkokRainHeatmapLayer(
  viewer: cesium.Viewer,
  initialIntensityGrid: number[][],
  initialOpacity = DEFAULT_ALPHA,
): BangkokRainHeatmapLayer {
  let canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  let context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create 2D context for rain heatmap layer");
  }

  drawHeatmap(context, canvas.width, canvas.height, initialIntensityGrid);

  const tintColor = new cesium.ConstantProperty(cesium.Color.WHITE.withAlpha(clamp01(initialOpacity)));
  const entity = viewer.entities.add({
    id: "bangkok-rain-heatmap",
    rectangle: {
      coordinates: getBangkokRainBoundsRectangle(),
      height: 2,
      heightReference: cesium.HeightReference.CLAMP_TO_GROUND,
      material: new cesium.ImageMaterialProperty({
        image: canvas,
        transparent: true,
        color: tintColor,
      }),
    },
    show: true,
  });

  let pendingGrid: number[][] | null = null;
  let frameRequestId: number | null = null;
  let performanceLite = false;
  let lastGrid: number[][] = initialIntensityGrid;

  const flushPendingFrame = () => {
    frameRequestId = null;
    if (!pendingGrid || !context) {
      return;
    }

    drawHeatmap(context, canvas.width, canvas.height, pendingGrid);
    lastGrid = pendingGrid;
    pendingGrid = null;
    viewer.scene.requestRender();
  };

  const scheduleFrameFlush = () => {
    if (frameRequestId !== null) {
      return;
    }

    frameRequestId = requestAnimationFrame(flushPendingFrame);
  };

  const applyPerformanceCanvasSize = () => {
    const nextWidth = performanceLite ? CANVAS_WIDTH_LITE : CANVAS_WIDTH;
    const nextHeight = performanceLite ? CANVAS_HEIGHT_LITE : CANVAS_HEIGHT;
    resizeCanvas(canvas, nextWidth, nextHeight);
    context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to recreate 2D context for rain heatmap layer");
    }

    drawHeatmap(context, canvas.width, canvas.height, lastGrid);
    viewer.scene.requestRender();
  };

  return {
    setVisible(visible: boolean) {
      entity.show = visible;
      viewer.scene.requestRender();
    },
    setOpacity(alpha: number) {
      tintColor.setValue(cesium.Color.WHITE.withAlpha(clamp01(alpha)));
      viewer.scene.requestRender();
    },
    setPerformanceMode(lite: boolean) {
      if (performanceLite === lite) {
        return;
      }

      performanceLite = lite;
      applyPerformanceCanvasSize();
    },
    updateFrame(intensityGrid: number[][]) {
      pendingGrid = intensityGrid;
      scheduleFrameFlush();
    },
    destroy() {
      if (frameRequestId !== null) {
        cancelAnimationFrame(frameRequestId);
      }

      viewer.entities.remove(entity);
      canvas = createCanvas(0, 0);
      context = null;
    },
  };
}
