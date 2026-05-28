import * as cesium from "cesium";

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

function createWaterMaterial(): cesium.Material {
  return new cesium.Material({
    fabric: {
      type: "Water",
      uniforms: {
        baseWaterColor: new cesium.Color(0.12, 0.45, 0.82, 0.62),
        blendColor: new cesium.Color(0, 0.65, 0.85, 0.35),
        normalMap: cesium.buildModuleUrl("Assets/Textures/waterNormals.jpg"),
        frequency: 900,
        animationSpeed: 0.012,
        amplitude: 8,
        specularIntensity: 0.55,
      },
    },
  });
}

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

  const getAlphaForDepth = (depth: number): number => {
    if (depth <= hideThreshold) {
      return 0;
    }

    const normalized = Math.min(1, Math.max(0, depth / Math.max(maxVisualDepth, 0.01)));
    return 0.12 + (normalized * 0.36);
  };

  const rectangle = cesium.Rectangle.fromDegrees(
    BANGKOK_URBAN_FLOOD_BOUNDS.west,
    BANGKOK_URBAN_FLOOD_BOUNDS.south,
    BANGKOK_URBAN_FLOOD_BOUNDS.east,
    BANGKOK_URBAN_FLOOD_BOUNDS.north,
  );

  const entity = viewer.entities.add({
    id: "bangkok-flood-water-surface",
    rectangle: {
      coordinates: rectangle,
      height: 0,
      heightReference: cesium.HeightReference.CLAMP_TO_GROUND,
      extrudedHeight: heightProperty,
      extrudedHeightReference: cesium.HeightReference.RELATIVE_TO_GROUND,
      material: new cesium.ColorMaterialProperty(new cesium.CallbackProperty((time) => {
        const depth = getDepthAtTime(time ?? viewer.clock.currentTime);
        return cesium.Color.fromCssColorString("#2563eb").withAlpha(getAlphaForDepth(depth));
      }, false)),
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
