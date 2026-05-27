import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { bangkokTilesConfig } from "./config.mjs";
import {
  boundsCenter,
  computeFeatureBounds,
  createCellBounds,
  createCellIndexer,
  deriveBuildingHeight,
  parseCellId,
} from "./helpers.mjs";

async function main() {
  await mkdir(bangkokTilesConfig.directories.prepared, { recursive: true });
  await mkdir(bangkokTilesConfig.directories.preparedCells, { recursive: true });

  const sourceText = await readFile(bangkokTilesConfig.files.buildingsGeoJson, "utf8");
  const sourceGeoJson = JSON.parse(sourceText);

  const indexCell = createCellIndexer(
    bangkokTilesConfig.bbox,
    bangkokTilesConfig.pipeline.cellGrid.columns,
    bangkokTilesConfig.pipeline.cellGrid.rows,
  );

  const preparedFeatures = [];
  const cellMap = new Map();
  let scannedCount = 0;

  for (const feature of sourceGeoJson.features ?? []) {
    scannedCount += 1;

    const featureBounds = computeFeatureBounds(feature);
    if (!featureBounds) {
      continue;
    }

    const center = boundsCenter(featureBounds);
    const cellId = indexCell(center.lon, center.lat);
    const existing = cellMap.get(cellId) ?? [];

    if (preparedFeatures.length >= bangkokTilesConfig.pipeline.generation.maxFeaturesTotal) {
      break;
    }

    if (existing.length >= bangkokTilesConfig.pipeline.generation.maxFeaturesPerCell) {
      continue;
    }

    const derivedHeight = deriveBuildingHeight(feature.properties);
    const preparedFeature = {
      ...feature,
      properties: {
        ...feature.properties,
        height: derivedHeight,
        _tileCellId: cellId,
      },
    };

    existing.push(preparedFeature);
    cellMap.set(cellId, existing);
    preparedFeatures.push(preparedFeature);
  }

  const cellSummaries = [];

  for (const [cellId, features] of [...cellMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const cellInfo = parseCellId(cellId);
    if (!cellInfo) {
      continue;
    }

    const cellBounds = createCellBounds(
      bangkokTilesConfig.bbox,
      bangkokTilesConfig.pipeline.cellGrid.columns,
      bangkokTilesConfig.pipeline.cellGrid.rows,
      cellInfo.row,
      cellInfo.column,
    );

    const maxHeight = features.reduce((highest, feature) => Math.max(highest, Number(feature.properties?.height ?? 0)), 0);
    const geoJson = {
      type: "FeatureCollection",
      features,
    };

    const cellPath = path.join(bangkokTilesConfig.directories.preparedCells, `${cellId}.geojson`);
    await writeFile(cellPath, `${JSON.stringify(geoJson)}\n`, "utf8");

    cellSummaries.push({
      cellId,
      featureCount: features.length,
      maxHeight,
      bounds: cellBounds,
      sourcePath: cellPath,
    });
  }

  await writeFile(
    bangkokTilesConfig.files.preparedBuildingsGeoJson,
    `${JSON.stringify({ type: "FeatureCollection", features: preparedFeatures })}\n`,
    "utf8",
  );

  await writeFile(
    bangkokTilesConfig.files.cellSummary,
    `${JSON.stringify({
      scannedCount,
      preparedCount: preparedFeatures.length,
      cellCount: cellSummaries.length,
      cellSummaries,
    }, null, 2)}\n`,
    "utf8",
  );

  console.log(`Prepared ${preparedFeatures.length} Bangkok buildings across ${cellSummaries.length} cells.`);
}

main().catch((error) => {
  console.error("Failed to prepare Bangkok buildings for tiling", error);
  process.exitCode = 1;
});
