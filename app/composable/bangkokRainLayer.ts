import * as cesium from "cesium";

/** จุดขาวเล็กๆ สำหรับอนุภาคฝน */
const RAIN_PARTICLE_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const RAIN_EMISSION_RATE_NORMAL = 9000;
const RAIN_EMISSION_RATE_LITE = 0;

export type BangkokRainSystem = {
  particleSystem: cesium.ParticleSystem;
  preUpdateRemover: () => void;
  setVisible: (visible: boolean) => void;
  setPerformanceMode: (lite: boolean) => void;
  destroy: () => void;
};

function updateRainModelMatrix(
  particleSystem: cesium.ParticleSystem,
  camera: cesium.Camera,
): void {
  const cartographic = cesium.Cartographic.fromCartesian(camera.positionWC);
  const emitterPosition = cesium.Cartesian3.fromRadians(
    cartographic.longitude,
    cartographic.latitude,
    cartographic.height + 900,
  );
  particleSystem.modelMatrix = cesium.Transforms.eastNorthUpToFixedFrame(emitterPosition);
}

export function createBangkokRainSystem(viewer: cesium.Viewer): BangkokRainSystem {
  const scene = viewer.scene;
  let performanceLite = false;

  const particleSystem = scene.primitives.add(
    new cesium.ParticleSystem({
      image: RAIN_PARTICLE_IMAGE,
      startColor: cesium.Color.WHITE.withAlpha(0.55),
      endColor: cesium.Color.WHITE.withAlpha(0.08),
      startScale: 1,
      endScale: 0.5,
      minimumParticleLife: 0.8,
      maximumParticleLife: 1.6,
      minimumSpeed: 25,
      maximumSpeed: 45,
      imageSize: new cesium.Cartesian2(12, 24),
      emissionRate: RAIN_EMISSION_RATE_NORMAL,
      lifetime: Number.POSITIVE_INFINITY,
      emitter: new cesium.BoxEmitter(new cesium.Cartesian3(2800, 2800, 500)),
      modelMatrix: cesium.Matrix4.IDENTITY,
      emitterModelMatrix: cesium.Matrix4.IDENTITY,
    }),
  );

  particleSystem.show = false;

  const preUpdateRemover = scene.preUpdate.addEventListener(() => {
    if (!particleSystem.show || performanceLite) {
      return;
    }

    updateRainModelMatrix(particleSystem, scene.camera);
  });

  return {
    particleSystem,
    preUpdateRemover,
    setVisible(visible: boolean) {
      particleSystem.show = visible;

      if (visible && !performanceLite) {
        updateRainModelMatrix(particleSystem, scene.camera);
      }
    },
    setPerformanceMode(lite: boolean) {
      performanceLite = lite;
      particleSystem.emissionRate = lite ? RAIN_EMISSION_RATE_LITE : RAIN_EMISSION_RATE_NORMAL;
    },
    destroy() {
      preUpdateRemover();
      scene.primitives.remove(particleSystem);
      if (!particleSystem.isDestroyed) {
        particleSystem.destroy();
      }
    },
  };
}

export function setRainVisible(
  system: BangkokRainSystem | null,
  visible: boolean,
): void {
  system?.setVisible(visible);
}

export function destroyBangkokRainSystem(system: BangkokRainSystem | null): void {
  system?.destroy();
}
