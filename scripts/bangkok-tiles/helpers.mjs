import path from "node:path";

import * as Cesium from "cesium";

export function ensureNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function computeFeatureBounds(feature) {
  const bounds = {
    west: Number.POSITIVE_INFINITY,
    south: Number.POSITIVE_INFINITY,
    east: Number.NEGATIVE_INFINITY,
    north: Number.NEGATIVE_INFINITY,
  };

  function visitCoordinates(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      return;
    }

    if (typeof coordinates[0] === "number") {
      const [lon, lat] = coordinates;
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        bounds.west = Math.min(bounds.west, lon);
        bounds.south = Math.min(bounds.south, lat);
        bounds.east = Math.max(bounds.east, lon);
        bounds.north = Math.max(bounds.north, lat);
      }
      return;
    }

    for (const entry of coordinates) {
      visitCoordinates(entry);
    }
  }

  visitCoordinates(feature?.geometry?.coordinates ?? []);

  if (!Number.isFinite(bounds.west)) {
    return null;
  }

  return bounds;
}

export function boundsIntersect(a, b) {
  return !(
    a.east < b.west
    || a.west > b.east
    || a.north < b.south
    || a.south > b.north
  );
}

export function boundsCenter(bounds) {
  return {
    lon: (bounds.west + bounds.east) / 2,
    lat: (bounds.south + bounds.north) / 2,
  };
}

const BUILDING_HEIGHT_MIN_METERS = 3;
const BUILDING_HEIGHT_MAX_METERS = 150;
const BUILDING_LEVELS_MAX = 50;

export function deriveBuildingHeight(properties = {}) {
  const explicitHeight = ensureNumber(
    properties.height
      ?? properties.Height
      ?? properties.HEIGHT
      ?? properties["building:height"],
    Number.NaN,
  );

  if (Number.isFinite(explicitHeight) && explicitHeight > 1) {
    return clamp(explicitHeight, BUILDING_HEIGHT_MIN_METERS, BUILDING_HEIGHT_MAX_METERS);
  }

  const levels = ensureNumber(
    properties.levels
      ?? properties.Levels
      ?? properties.LEVELS
      ?? properties["building:levels"],
    Number.NaN,
  );

  if (Number.isFinite(levels) && levels > 0) {
    const cappedLevels = clamp(levels, 1, BUILDING_LEVELS_MAX);
    return clamp(
      Math.max(6, cappedLevels * 3.2),
      BUILDING_HEIGHT_MIN_METERS,
      BUILDING_HEIGHT_MAX_METERS,
    );
  }

  return 12;
}

export function ringAreaSqMeters(ring) {
  if (!Array.isArray(ring) || ring.length < 3) {
    return 0;
  }

  let area = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[(index + 1) % ring.length];
    area += (x1 * y2) - (x2 * y1);
  }

  return Math.abs(area) / 2;
}

export function ringPerimeterMeters(ring) {
  if (!Array.isArray(ring) || ring.length < 2) {
    return 0;
  }

  let perimeter = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[(index + 1) % ring.length];
    perimeter += Math.hypot(x2 - x1, y2 - y1);
  }

  return perimeter;
}

/** Reject tiny or needle-like footprints before extrusion (local ENU meters). */
export function isValidExtrusionFootprint(
  geometry,
  { minAreaSqMeters = 4, minCompactness = 0.02 } = {},
) {
  if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) {
    return false;
  }

  const outerRings = geometry.type === "Polygon"
    ? [geometry.coordinates[0]]
    : geometry.coordinates.map((polygon) => polygon[0]);

  return outerRings.every((ring) => {
    if (!Array.isArray(ring) || ring.length < 4) {
      return false;
    }

    const area = ringAreaSqMeters(ring);
    if (area < minAreaSqMeters) {
      return false;
    }

    const perimeter = ringPerimeterMeters(ring);
    if (perimeter <= 0) {
      return false;
    }

    const compactness = (4 * Math.PI * area) / (perimeter * perimeter);
    return compactness >= minCompactness;
  });
}

export function createCellIndexer(bbox, columns, rows) {
  const width = bbox.east - bbox.west;
  const height = bbox.north - bbox.south;

  return (lon, lat) => {
    const rawColumn = Math.floor(((lon - bbox.west) / width) * columns);
    const rawRow = Math.floor(((lat - bbox.south) / height) * rows);
    const column = clamp(rawColumn, 0, columns - 1);
    const row = clamp(rawRow, 0, rows - 1);
    return `cell-${String(row).padStart(2, "0")}-${String(column).padStart(2, "0")}`;
  };
}

export function createCellBounds(bbox, columns, rows, row, column) {
  const cellWidth = (bbox.east - bbox.west) / columns;
  const cellHeight = (bbox.north - bbox.south) / rows;

  return {
    west: bbox.west + (cellWidth * column),
    south: bbox.south + (cellHeight * row),
    east: bbox.west + (cellWidth * (column + 1)),
    north: bbox.south + (cellHeight * (row + 1)),
  };
}

export function parseCellId(cellId) {
  const match = /^cell-(\d+)-(\d+)$/.exec(cellId);
  if (!match) {
    return null;
  }

  return {
    row: Number.parseInt(match[1], 10),
    column: Number.parseInt(match[2], 10),
  };
}

export function createTilePaths(baseDir, cellId) {
  const cellDir = path.join(baseDir, cellId);

  return {
    cellDir,
    glbPath: path.join(cellDir, `${cellId}.glb`),
    tilesetPath: path.join(cellDir, "tileset.json"),
  };
}

export function toLocalPlanarPolygon(feature, originLon, originLat) {
  const project = createLocalProjector(originLon, originLat);
  const geometry = feature.geometry;
  const coordinates = geometry.coordinates;

  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: projectPolygon(coordinates, project),
    };
  }

  if (geometry.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: coordinates.map((polygon) => projectPolygon(polygon, project)),
    };
  }

  return null;
}

function projectPolygon(polygon, project) {
  return polygon.map((ring) => ring.map(([lon, lat]) => project(lon, lat)));
}

export function projectLonLatToLocal(lon, lat, originLon, originLat) {
  return createLocalProjector(originLon, originLat)(lon, lat);
}

export function createLocalProjector(originLon, originLat) {
  const origin = Cesium.Cartographic.fromDegrees(originLon, originLat, 0);
  const originCartesian = Cesium.Cartesian3.fromRadians(origin.longitude, origin.latitude, origin.height);
  const enu = Cesium.Transforms.eastNorthUpToFixedFrame(originCartesian);
  const inverse = Cesium.Matrix4.inverseTransformation(enu, new Cesium.Matrix4());

  return (lon, lat) => {
    const point = Cesium.Cartographic.fromDegrees(lon, lat, 0);
    const pointCartesian = Cesium.Cartesian3.fromRadians(point.longitude, point.latitude, point.height);
    const local = Cesium.Matrix4.multiplyByPoint(inverse, pointCartesian, new Cesium.Cartesian3());
    return [local.x, local.y];
  };
}

export function createRegionBoundingVolume(bounds, minHeight = 0, maxHeight = 120) {
  return {
    region: [
      Cesium.Math.toRadians(bounds.west),
      Cesium.Math.toRadians(bounds.south),
      Cesium.Math.toRadians(bounds.east),
      Cesium.Math.toRadians(bounds.north),
      minHeight,
      maxHeight,
    ],
  };
}

/** 3D Tiles `transform`: column-major 4x4, local ENU (meters) → ECEF at origin. */
export function createEnuToEcefTransform(originLon, originLat, originHeight = 0) {
  const origin = Cesium.Cartographic.fromDegrees(originLon, originLat, originHeight);
  const originCartesian = Cesium.Cartesian3.fromRadians(
    origin.longitude,
    origin.latitude,
    origin.height,
  );
  const matrix = Cesium.Transforms.eastNorthUpToFixedFrame(originCartesian);
  return matrixToColumnMajorArray(matrix);
}

function matrixToColumnMajorArray(matrix) {
  return [
    matrix[0], matrix[1], matrix[2], matrix[3],
    matrix[4], matrix[5], matrix[6], matrix[7],
    matrix[8], matrix[9], matrix[10], matrix[11],
    matrix[12], matrix[13], matrix[14], matrix[15],
  ];
}

export function createRootTilesetJson({ bounds, uri, maxHeight, originLon, originLat }) {
  const root = {
    boundingVolume: createRegionBoundingVolume(bounds, 0, Math.max(20, maxHeight)),
    geometricError: 0,
    refine: "ADD",
    content: {
      uri,
    },
  };

  if (Number.isFinite(originLon) && Number.isFinite(originLat)) {
    root.transform = createEnuToEcefTransform(originLon, originLat);
  }

  return {
    asset: {
      version: "1.1",
    },
    geometricError: 0,
    root,
  };
}

export function createExternalRootTilesetJson(children, bbox) {
  return {
    asset: {
      version: "1.1",
    },
    geometricError: 500,
    root: {
      boundingVolume: createRegionBoundingVolume(bbox, 0, 300),
      geometricError: 250,
      refine: "ADD",
      children: children.map((child) => ({
        boundingVolume: createRegionBoundingVolume(child.bounds, 0, Math.max(20, child.maxHeight)),
        geometricError: 0,
        refine: "ADD",
        content: {
          uri: `${child.cellId}/tileset.json`,
        },
      })),
    },
  };
}

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
