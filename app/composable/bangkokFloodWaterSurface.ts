import * as cesium from "cesium";
import { getFloodFillAlpha, getWaterLevelColor } from "./waterLevelColor";

/** ใจกลางกรุงเทพ — พื้นที่แผ่นน้ำท่วม */
export const BANGKOK_URBAN_FLOOD_BOUNDS = {
  west: 100.35,
  south: 13.55,
  east: 100.75,
  north: 13.95,
} as const;

export type BangkokFloodWaterSurface = {
  entity: cesium.Entity;
  setVisible: (visible: boolean) => void;
  syncAtTime: (time: cesium.JulianDate) => void;
  destroy: () => void;
};

export function createBangkokFloodWaterSurface(
  viewer: cesium.Viewer,
  heightProperty: cesium.SampledProperty,
  options?: {
    hideThreshold?: number;
    maxVisualDepth?: number;
  },
): BangkokFloodWaterSurface {
  const hideThreshold = options?.hideThreshold ?? 0.02;
  const maxVisualDepth = options?.maxVisualDepth ?? 2.5;
  let manuallyVisible = true;

  const getDepthAtTime = (time: cesium.JulianDate): number => {
    const value = heightProperty.getValue(time);
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, value);
  };

  const rectangle = cesium.Rectangle.fromDegrees(
    BANGKOK_URBAN_FLOOD_BOUNDS.west,
    BANGKOK_URBAN_FLOOD_BOUNDS.south,
    BANGKOK_URBAN_FLOOD_BOUNDS.east,
    BANGKOK_URBAN_FLOOD_BOUNDS.north,
  );

  const materialColor = new cesium.ConstantProperty(
    getWaterLevelColor(0, { maxLevel: maxVisualDepth, alpha: 0 }),
  );

  const entity = viewer.entities.add({
    id: "bangkok-flood-water-surface",
    rectangle: {
      coordinates: rectangle,
      height: 0,
      heightReference: cesium.HeightReference.CLAMP_TO_GROUND,
      extrudedHeight: heightProperty,
      extrudedHeightReference: cesium.HeightReference.RELATIVE_TO_GROUND,
      material: new cesium.ColorMaterialProperty(materialColor),
      outline: false,
    },
    show: false,
  });

  return {
    entity,
    setVisible(visible: boolean) {
      manuallyVisible = visible;
    },
    syncAtTime(time: cesium.JulianDate) {
      const depth = getDepthAtTime(time);
      entity.show = manuallyVisible && depth > hideThreshold;
      const fillAlpha = getFloodFillAlpha(depth, hideThreshold, maxVisualDepth);
      materialColor.setValue(
        getWaterLevelColor(depth, { maxLevel: maxVisualDepth, alpha: fillAlpha }),
      );
    },
    destroy() {
      viewer.entities.remove(entity);
    },
  };
}

export function syncFloodWaterSurfaceVisibility(
  surface: BangkokFloodWaterSurface | null,
  visible: boolean,
): void {
  surface?.setVisible(visible);
}
