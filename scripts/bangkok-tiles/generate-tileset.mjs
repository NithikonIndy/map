import path from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

import { Document, NodeIO } from "@gltf-transform/core";
import geometryExtrude from "geometry-extrude";

import { bangkokTilesConfig } from "./config.mjs";
import {
  boundsCenter,
  clamp,
  createExternalRootTilesetJson,
  createRootTilesetJson,
  createTilePaths,
  isValidExtrusionFootprint,
  toLocalPlanarPolygon,
} from "./helpers.mjs";

const { extrudeGeoJSON } = geometryExtrude;

async function main() {
  await rm(bangkokTilesConfig.directories.publish, { recursive: true, force: true });
  await mkdir(bangkokTilesConfig.directories.publish, { recursive: true });

  const summary = JSON.parse(await readFile(bangkokTilesConfig.files.cellSummary, "utf8"));
  const generatedCells = [];

  for (const cellSummary of summary.cellSummaries ?? []) {
    const cellGeoJson = JSON.parse(await readFile(cellSummary.sourcePath, "utf8"));
    if (!cellGeoJson.features?.length) {
      continue;
    }

    const origin = boundsCenter(cellSummary.bounds);
    const localGeoJson = {
      type: "FeatureCollection",
      features: cellGeoJson.features
        .map((feature) => {
          const localGeometry = toLocalPlanarPolygon(feature, origin.lon, origin.lat);
          if (!localGeometry || !isValidExtrusionFootprint(localGeometry)) {
            return null;
          }

          return {
            type: "Feature",
            properties: feature.properties,
            geometry: localGeometry,
          };
        })
        .filter(Boolean),
    };

    if (localGeoJson.features.length === 0) {
      continue;
    }

    const extrusion = extrudeGeoJSON(localGeoJson, {
      depth: (feature) => clamp(
        Number(feature.properties?.height ?? bangkokTilesConfig.pipeline.height.defaultMeters),
        3,
        150,
      ),
      excludeBottom: true,
      smoothSide: "auto",
    });

    if (!extrusion.polygon?.position?.length) {
      continue;
    }

    const tilePaths = createTilePaths(bangkokTilesConfig.directories.publish, cellSummary.cellId);
    await mkdir(tilePaths.cellDir, { recursive: true });
    await writeGlb(tilePaths.glbPath, extrusion.polygon);

    const cellTileset = createRootTilesetJson({
      bounds: cellSummary.bounds,
      uri: path.basename(tilePaths.glbPath),
      maxHeight: cellSummary.maxHeight,
      originLon: origin.lon,
      originLat: origin.lat,
    });

    await writeFile(tilePaths.tilesetPath, `${JSON.stringify(cellTileset, null, 2)}\n`, "utf8");

    generatedCells.push({
      cellId: cellSummary.cellId,
      featureCount: cellSummary.featureCount,
      maxHeight: cellSummary.maxHeight,
      bounds: cellSummary.bounds,
      tilesetPath: tilePaths.tilesetPath,
      glbPath: tilePaths.glbPath,
    });
  }

  const rootTileset = createExternalRootTilesetJson(generatedCells, bangkokTilesConfig.bbox);
  await writeFile(bangkokTilesConfig.files.rootTileset, `${JSON.stringify(rootTileset, null, 2)}\n`, "utf8");

  await writeFile(
    bangkokTilesConfig.files.tilesetManifest,
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      cellCount: generatedCells.length,
      totalFeatures: generatedCells.reduce((sum, cell) => sum + cell.featureCount, 0),
      rootTileset: bangkokTilesConfig.files.rootTileset,
      cells: generatedCells,
    }, null, 2)}\n`,
    "utf8",
  );

  console.log(`Generated ${generatedCells.length} Bangkok tile cells.`);
}

function remapEnuFloat32ToGltfYUp(values) {
  const source = values instanceof Float32Array ? values : Float32Array.from(values);
  const remapped = new Float32Array(source.length);

  for (let index = 0; index < source.length; index += 3) {
    const east = source[index];
    const north = source[index + 1];
    const up = source[index + 2];
    remapped[index] = east;
    remapped[index + 1] = up;
    remapped[index + 2] = -north;
  }

  return remapped;
}

async function writeGlb(outputPath, meshData) {
  if (!meshData?.position?.length) {
    return;
  }

  const document = new Document();
  const buffer = document.createBuffer();
  const material = document.createMaterial("BangkokBuildings").setBaseColorFactor(hexToColorFactor(
    bangkokTilesConfig.pipeline.generation.baseColor,
  ));

  const positionAccessor = document
    .createAccessor("POSITION", buffer)
    .setType("VEC3")
    .setArray(remapEnuFloat32ToGltfYUp(meshData.position));

  const normalAccessor = document
    .createAccessor("NORMAL", buffer)
    .setType("VEC3")
    .setArray(meshData.normal ? remapEnuFloat32ToGltfYUp(meshData.normal) : meshData.normal);

  const indexAccessor = document
    .createAccessor("INDICES", buffer)
    .setType("SCALAR")
    .setArray(meshData.indices);

  const primitive = document
    .createPrimitive()
    .setAttribute("POSITION", positionAccessor)
    .setAttribute("NORMAL", normalAccessor)
    .setIndices(indexAccessor)
    .setMaterial(material);

  const mesh = document.createMesh("BangkokTileMesh").addPrimitive(primitive);
  const node = document.createNode("BangkokTileNode").setMesh(mesh);
  document.createScene("Scene").addChild(node);

  const io = new NodeIO();
  await io.write(outputPath, document);
}

function hexToColorFactor(hex) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  return [red, green, blue, 1];
}

main().catch((error) => {
  console.error("Failed to generate Bangkok 3D Tiles", error);
  process.exitCode = 1;
});
