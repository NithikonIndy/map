import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, "../..");
const workingRoot = path.join(workspaceRoot, ".bangkok-tiles");

export const bangkokTilesConfig = {
  workspaceRoot,
  workingRoot,
  bbox: {
    // Bangkok Metropolitan Region bbox, used as a practical fetch envelope.
    west: 99.826,
    south: 13.423,
    east: 100.967,
    north: 14.293,
  },
  directories: {
    source: path.join(workingRoot, "source"),
    downloads: path.join(workingRoot, "downloads"),
    prepared: path.join(workingRoot, "prepared"),
    preparedCells: path.join(workingRoot, "prepared", "cells"),
    terrain: path.join(workingRoot, "terrain"),
    tiles: path.join(workingRoot, "tiles"),
    publish: path.join(workingRoot, "publish"),
  },
  files: {
    rawHotosmZip: path.join(workingRoot, "downloads", "hotosm-thailand-buildings.geojson.zip"),
    buildingsGeoJson: path.join(workingRoot, "source", "bangkok-buildings.geojson"),
    preparedBuildingsGeoJson: path.join(workingRoot, "prepared", "bangkok-buildings-prepared.geojson"),
    cellSummary: path.join(workingRoot, "prepared", "bangkok-cells.json"),
    rootTileset: path.join(workingRoot, "publish", "tileset.json"),
    tilesetManifest: path.join(workingRoot, "publish", "tiles-manifest.json"),
    sourceManifest: path.join(workingRoot, "bangkok-source-manifest.json"),
  },
  hosting: {
    envKey: "NUXT_PUBLIC_BANGKOK_PHOTOREALISTIC_TILESET_URL",
    localExample: "http://localhost:8000/tilesets/bangkok/tileset.json",
    cdnExample: "https://cdn.example.com/tilesets/bangkok/tileset.json",
    objectStorageExample: "https://storage.example.com/tilesets/bangkok/tileset.json",
  },
  sources: {
    overtureBuildings: {
      type: "building-footprints",
      provider: "Overture Maps",
      license: "ODbL",
      notes: [
        "Recommended primary source for Bangkok building footprints.",
        "Streams only the bbox you request via the official CLI.",
      ],
      release: "2026-05-20.0",
      cliDocs: "https://docs.overturemaps.org/getting-data/overturemaps-py/",
    },
    hotosmThailandBuildings: {
      type: "building-footprints",
      provider: "HOT OSM / HDX",
      license: "ODbL",
      notes: [
        "Fallback source when Overture is unavailable.",
        "Thailand-wide download is large and should be clipped to Bangkok before tiling.",
      ],
      datasetUrl: "https://data.humdata.org/dataset/hotosm_tha_buildings",
      geojsonZipResourceId: "b59ec126-9ed5-41d4-a758-238bf6c8ad23",
      geojsonZipDownloadUrl: "https://s3.dualstack.us-east-1.amazonaws.com/production-raw-data-api/ISO3/THA/buildings/polygons/hotosm_tha_buildings_polygons_geojson.zip",
    },
    bangkokDtm: {
      type: "terrain",
      provider: "Bangkok Open Data",
      license: "License not specified",
      notes: [
        "Useful as a terrain reference for extrusion or height correction.",
        "Confirm licensing before redistribution or commercial hosting.",
      ],
      imageServerUrl: "https://cpudgiapp.bangkok.go.th/image/rest/services/DTM70m/ImageServer",
      datasetPage: "https://data.bangkok.go.th/en/dataset/digital-terrain-model-dtm",
    },
  },
  pipeline: {
    tiler: "geometry-extrude + glTF-Transform",
    merger: "custom root tileset writer",
    stages: [
      "download-building-footprints",
      "clip-or-partition-bangkok-cells",
      "derive-height-attributes",
      "generate-child-3d-tiles",
      "merge-root-tileset-json",
      "publish-static-tileset",
      "point-frontend-env-to-tileset",
    ],
    cellGrid: {
      columns: 6,
      rows: 6,
    },
    height: {
      defaultMeters: 12,
      metersPerLevel: 3.2,
    },
    generation: {
      maxFeaturesTotal: 12000,
      maxFeaturesPerCell: 500,
      baseColor: "#e8a735",
    },
  },
};

export function bboxToCsv(bbox = bangkokTilesConfig.bbox) {
  return [bbox.west, bbox.south, bbox.east, bbox.north].join(",");
}
