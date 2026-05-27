import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import chain from "stream-chain";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/pick.js";
import { streamArray } from "stream-json/streamers/stream-array.js";
import unzipper from "unzipper";

import { bangkokTilesConfig, bboxToCsv } from "./config.mjs";
import { boundsIntersect, computeFeatureBounds } from "./helpers.mjs";

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (typeof result.status === "number") {
    return result.status === 0;
  }

  if (result.error?.code === "ENOENT") {
    return false;
  }

  return false;
}

async function main() {
  await mkdir(bangkokTilesConfig.directories.source, { recursive: true });
  await mkdir(bangkokTilesConfig.directories.downloads, { recursive: true });

  const bbox = process.env.BANGKOK_TILES_BBOX ?? bboxToCsv();
  const outputPath = process.env.BANGKOK_BUILDINGS_OUTPUT ?? bangkokTilesConfig.files.buildingsGeoJson;
  const overtureArgs = [
    "overturemaps",
    "download",
    "--bbox",
    bbox,
    "-f",
    "geojson",
    "--type",
    "building",
    "-o",
    outputPath,
  ];

  const ranWithUvx = runCommand("uvx", overtureArgs);
  const ranWithCli = ranWithUvx
    || runCommand("overturemaps", overtureArgs.slice(1));

  if (!ranWithCli) {
    console.warn("Overture CLI is not available. Falling back to HOT OSM Thailand buildings.");
    const bboxObject = parseCsvBbox(bbox);
    const resolvedFromSnapshot = await tryHotSnapshotPlain({
      bbox: bboxObject,
      outputPath,
    });

    if (!resolvedFromSnapshot) {
      await downloadAndClipHotosmBuildings({
        bbox: bboxObject,
        outputPath,
      });
    }
  }

  console.log(`Saved Bangkok building footprints to ${outputPath}`);
}

async function downloadAndClipHotosmBuildings({ bbox, outputPath }) {
  const zipUrl = await resolveHdxGeojsonZipUrl();
  const zipPath = bangkokTilesConfig.files.rawHotosmZip;

  const response = await fetch(zipUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download HOT OSM buildings zip: ${response.status} ${response.statusText}`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(zipPath));

  const directory = await unzipper.Open.file(zipPath);
  const geojsonEntry = directory.files.find((entry) => entry.path.toLowerCase().endsWith(".geojson"));

  if (!geojsonEntry) {
    throw new Error("The HOT OSM archive did not contain a GeoJSON file.");
  }

  const readStream = geojsonEntry.stream();
  const writeStream = createWriteStream(outputPath, { encoding: "utf8" });

  writeStream.write("{\"type\":\"FeatureCollection\",\"features\":[");

  let keptCount = 0;
  let scannedCount = 0;

  const jsonPipeline = chain([
    readStream,
    parser(),
    pick({ filter: "features" }),
    streamArray(),
  ]);

  for await (const { value } of jsonPipeline) {
    scannedCount += 1;

    const featureBounds = computeFeatureBounds(value);
    if (!featureBounds || !boundsIntersect(featureBounds, bbox)) {
      continue;
    }

    if (keptCount > 0) {
      writeStream.write(",");
    }

    writeStream.write(JSON.stringify(value));
    keptCount += 1;
  }

  const finished = new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  writeStream.write("]}");
  writeStream.end();

  await finished;

  console.log(`Clipped ${keptCount} Bangkok features from ${scannedCount} HOT OSM features.`);
}

async function tryHotSnapshotPlain({ bbox, outputPath }) {
  const response = await fetch("https://api-prod.raw-data.hotosm.org/v1/snapshot/plain/", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "cesium-nuxt-bangkok-tiles/1.0",
    },
    body: JSON.stringify({
      geometry: {
        type: "Polygon",
        coordinates: [[
          [bbox.west, bbox.south],
          [bbox.east, bbox.south],
          [bbox.east, bbox.north],
          [bbox.west, bbox.north],
          [bbox.west, bbox.south],
        ]],
      },
      bbox: [bbox.west, bbox.south, bbox.east, bbox.north],
      select: ["*"],
      where: [
        {
          key: "building",
          value: ["*"],
        },
      ],
      joinBy: "AND",
      geometryType: ["polygon"],
      lookIn: ["ways_poly", "relations"],
    }),
  });

  if (!response.ok) {
    console.warn(`HOT snapshot/plain unavailable (${response.status}). Falling back to HDX archive.`);
    return false;
  }

  const geoJson = await response.json();
  if (!Array.isArray(geoJson?.features) || geoJson.features.length === 0) {
    console.warn("HOT snapshot/plain returned no building features. Falling back to HDX archive.");
    return false;
  }

  await writeGeoJson(outputPath, geoJson);
  console.log(`Downloaded ${geoJson.features.length} Bangkok features from HOT snapshot/plain.`);
  return true;
}

async function resolveHdxGeojsonZipUrl() {
  const apiUrl = `https://data.humdata.org/api/3/action/package_show?id=${encodeURIComponent("hotosm_tha_buildings")}`;
  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "cesium-nuxt-bangkok-tiles/1.0",
    },
  });

  if (!response.ok) {
    return bangkokTilesConfig.sources.hotosmThailandBuildings.geojsonZipDownloadUrl;
  }

  const payload = await response.json();
  const resources = payload?.result?.resources ?? [];
  const preferred = resources.find((resource) => resource.id === bangkokTilesConfig.sources.hotosmThailandBuildings.geojsonZipResourceId);
  const resource = preferred
    ?? resources.find((entry) => String(entry.format ?? "").toLowerCase() === "geojson");

  if (!resource?.url) {
    return bangkokTilesConfig.sources.hotosmThailandBuildings.geojsonZipDownloadUrl;
  }

  return resource.download_url ?? resource.url;
}

function parseCsvBbox(csv) {
  const [west, south, east, north] = csv.split(",").map((value) => Number.parseFloat(value.trim()));
  return {
    west,
    south,
    east,
    north,
  };
}

async function writeGeoJson(outputPath, geoJson) {
  const writeStream = createWriteStream(outputPath, { encoding: "utf8" });
  const finished = new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  writeStream.write(`${JSON.stringify(geoJson)}\n`);
  writeStream.end();

  await finished;
}

main().catch((error) => {
  console.error("Failed to fetch Bangkok building footprints from Overture", error);
  process.exitCode = 1;
});
