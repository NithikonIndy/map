import { mkdir, writeFile } from "node:fs/promises";

import { bangkokTilesConfig, bboxToCsv } from "./config.mjs";

async function main() {
  await mkdir(bangkokTilesConfig.workingRoot, { recursive: true });
  await mkdir(bangkokTilesConfig.directories.source, { recursive: true });
  await mkdir(bangkokTilesConfig.directories.downloads, { recursive: true });
  await mkdir(bangkokTilesConfig.directories.prepared, { recursive: true });
  await mkdir(bangkokTilesConfig.directories.preparedCells, { recursive: true });
  await mkdir(bangkokTilesConfig.directories.terrain, { recursive: true });
  await mkdir(bangkokTilesConfig.directories.tiles, { recursive: true });
  await mkdir(bangkokTilesConfig.directories.publish, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    goal: "Build a Bangkok custom 3D Tiles root tileset that can be used by NUXT_PUBLIC_BANGKOK_PHOTOREALISTIC_TILESET_URL.",
    bbox: {
      ...bangkokTilesConfig.bbox,
      csv: bboxToCsv(),
    },
    sources: bangkokTilesConfig.sources,
    localPaths: {
      sourceDir: bangkokTilesConfig.directories.source,
      downloadsDir: bangkokTilesConfig.directories.downloads,
      preparedDir: bangkokTilesConfig.directories.prepared,
      preparedCellsDir: bangkokTilesConfig.directories.preparedCells,
      terrainDir: bangkokTilesConfig.directories.terrain,
      tilesDir: bangkokTilesConfig.directories.tiles,
      publishDir: bangkokTilesConfig.directories.publish,
      buildingsGeoJson: bangkokTilesConfig.files.buildingsGeoJson,
      preparedBuildingsGeoJson: bangkokTilesConfig.files.preparedBuildingsGeoJson,
      cellSummary: bangkokTilesConfig.files.cellSummary,
      rootTileset: bangkokTilesConfig.files.rootTileset,
    },
    hosting: {
      envKey: bangkokTilesConfig.hosting.envKey,
      localExample: bangkokTilesConfig.hosting.localExample,
      cdnExample: bangkokTilesConfig.hosting.cdnExample,
      objectStorageExample: bangkokTilesConfig.hosting.objectStorageExample,
      recommendedStrategy: {
        target: "object-storage-plus-cdn",
        why: "Static 3D Tiles assets are large, cacheable, and work well behind bucket hosting or a CDN.",
      },
    },
    pipelineStages: bangkokTilesConfig.pipeline.stages,
    commands: {
      runAll: "npm run bangkok:tiles:all",
      fetchOvertureBuildings: "npm run bangkok:tiles:fetch-buildings",
      prepareBangkokBuildings: "npm run bangkok:tiles:prepare",
      generateBangkokTiles: "npm run bangkok:tiles:generate",
      serveBangkokTiles: "npm run bangkok:tiles:serve",
      verifyBangkokTilesOverHttp: "npm run bangkok:tiles:verify-http",
    },
    hostingOptions: [
      {
        name: "local-static-server",
        useCase: "Fast local verification before upload",
        tilesetUrl: bangkokTilesConfig.hosting.localExample,
      },
      {
        name: "object-storage",
        useCase: "Cheap static hosting for tileset.json plus binary tile content",
        tilesetUrl: bangkokTilesConfig.hosting.objectStorageExample,
      },
      {
        name: "cdn-fronted-bucket",
        useCase: "Recommended for production because tiles are cacheable and globally distributed",
        tilesetUrl: bangkokTilesConfig.hosting.cdnExample,
      },
    ],
    frontendIntegration: {
      viewer: "app/components/BangkokOsmBuildingsViewer.vue",
      runtimeConfigKey: "bangkokPhotorealisticTilesetUrl",
      note: "The frontend is already prepared to consume a standard tileset.json URL.",
      conclusion: "No frontend code changes are required for a standard Bangkok 3D Tiles root tileset.",
    },
    verificationChecklist: [
      "tileset.json opens directly over HTTP without auth redirects",
      "root bounding volume is located in Bangkok",
      "child tile URIs resolve relative to tileset.json",
      "NUXT_PUBLIC_BANGKOK_PHOTOREALISTIC_TILESET_URL points to the hosted root tileset",
      "BangkokOsmBuildingsViewer.vue can toggle the layer on without reverting to off",
      "dataset is Bangkok data rather than a sample from another city",
    ],
    openRisks: [
      "Building heights may need to be inferred if the selected source lacks reliable height attributes.",
      "Bangkok DTM licensing must be reviewed before redistributing derived terrain products.",
      "A true photorealistic look still depends on obtaining textured mesh or photogrammetry for key zones.",
    ],
    implementationStatus: {
      sourceDataIdentified: true,
      pipelineDesigned: true,
      hostingStrategyDefined: true,
      frontendReviewCompleted: true,
      pureJsGenerationImplemented: true,
    },
  };

  await writeFile(
    bangkokTilesConfig.files.sourceManifest,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  console.log(`Wrote Bangkok source manifest to ${bangkokTilesConfig.files.sourceManifest}`);
}

main().catch((error) => {
  console.error("Failed to write Bangkok source manifest", error);
  process.exitCode = 1;
});
