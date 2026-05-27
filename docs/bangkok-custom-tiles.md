# Bangkok Custom 3D Tiles

This project already supports a custom Bangkok tileset URL in the frontend through `NUXT_PUBLIC_BANGKOK_PHOTOREALISTIC_TILESET_URL`. The env var name is historical; in the UI the layer is called **Bangkok Custom 3D**.

**Important:** the generated tileset is **extruded building footprints** (procedural 3D), not Google Photorealistic 3D Tiles or textured photogrammetry. To compare it clearly in the viewer, use the default **เปรียบเทียบกับ OSM** mode (hides Cesium OSM Buildings while Custom 3D is on) or the **ดู Custom 3D** camera bookmark.

The missing piece for a full city rollout is still a repeatable pipeline for creating a Bangkok tileset that points to Bangkok data instead of sample datasets from other cities.

## Recommended source data

### Primary building source

- **Overture Maps buildings**
  - Best default source for a first Bangkok tileset.
  - Open license: ODbL.
  - Can be downloaded directly for a Bangkok bounding box with the official CLI.
  - Works well for procedural 3D extrusion.

### Fallback building source

- **HOT OSM Thailand buildings**
  - Thailand-wide export that can be clipped down to Bangkok.
  - Open license: ODbL.
  - Larger download and more preprocessing than Overture.

### Terrain reference

- **Bangkok Open Data DTM**
  - URL: `https://cpudgiapp.bangkok.go.th/image/rest/services/DTM70m/ImageServer`
  - Useful for terrain clamping or height correction.
  - License is not clearly specified, so verify redistribution rules before shipping generated terrain tiles.

## Suggested pipeline

### Phase 1: fast Bangkok reality

1. Download Bangkok building footprints from Overture.
2. Clip or partition Bangkok into manageable processing cells.
3. Add or derive a `height` attribute.
4. Extrude the buildings into meshes with `geometry-extrude` in a local ENU frame (meters at each cell center).
5. Remap mesh vertices from ENU Z-up to **glTF Y-up** when writing each `GLB` (`east, up, -north`).
6. Write per-cell `tileset.json` with an ENU→ECEF `transform` so Cesium places geometry over Bangkok.
7. Skip degenerate footprints (area under 4 m² or very low compactness) and clamp building heights to 3–150 m.
6. Merge the child tilesets into one root `tileset.json`.
7. Host the final tileset and point `NUXT_PUBLIC_BANGKOK_PHOTOREALISTIC_TILESET_URL` to it.

This will not be fully photorealistic, but it gives you a real Bangkok custom tileset quickly.

### Phase 2: more realism

1. Replace or enrich some Bangkok zones with textured mesh or higher quality 3D city data.
2. Tile those zones separately.
3. Merge them into a root virtual tileset with `3d-tiles-tools mergeJson`.

## Pipeline layout

The intended pipeline in this repo is:

1. `source`:
   pull building footprints from Overture first, with HOT OSM as fallback
2. `preprocess`:
   clip to Bangkok, partition by cells, and prepare a `height` field
3. `tile generation`:
   extrude GeoJSON per cell, write `GLB`, then create per-cell `tileset.json`
4. `root merge`:
   combine child `tileset.json` files into one external root tileset
5. `publish`:
   upload the resulting directory as static files
6. `frontend`:
   set `NUXT_PUBLIC_BANGKOK_PHOTOREALISTIC_TILESET_URL` to the hosted root `tileset.json`

Recommended output layout:

```text
tilesets/
  bangkok/
    tileset.json
    cell-0001/
      tileset.json
      ...
    cell-0002/
      tileset.json
      ...
```

## Commands in this repo

Generate a local source manifest:

```bash
npm run bangkok:tiles:all
npm run bangkok:tiles:manifest
```

Download Overture building footprints for the configured Bangkok bounding box:

```bash
npm run bangkok:tiles:fetch-buildings
npm run bangkok:tiles:prepare
npm run bangkok:tiles:generate
npm run bangkok:tiles:serve
npm run bangkok:tiles:verify-http
```

For the full end-to-end workflow in one command:

```bash
npm run bangkok:tiles:all
```

This command runs `fetch-buildings`, `prepare`, `generate`, starts a temporary local server on a free port, verifies the root tileset over HTTP, and then stops the temporary server.

The scripts create working files under `.bangkok-tiles/`.

## Example tiling commands

Prepare clipped Bangkok buildings for tiling:

```bash
npm run bangkok:tiles:prepare
```

Generate `GLB` tile contents and the root `tileset.json`:

```bash
npm run bangkok:tiles:generate
```

Serve the generated tileset locally:

```bash
npm run bangkok:tiles:serve
```

Verify that the root tileset, child tilesets, and GLB payloads resolve over HTTP:

```bash
npm run bangkok:tiles:verify-http
```

## Hosting strategy

Do not commit generated production tiles into the frontend repo. Instead:

1. Build tiles locally or in a data pipeline.
2. Upload the output directory to object storage or a CDN.
3. Point the frontend env var at the hosted `tileset.json`.

Recommended production setup:

1. Store the generated tileset directory in object storage.
2. Put a CDN in front of it if the tileset is large or public.
3. Keep `tileset.json` and child tile paths stable so relative URIs keep working.
4. Version by directory name, not by rewriting the same folder during rollout.

Recommended URL shape:

```text
https://cdn.example.com/tilesets/bangkok/tileset.json
```

For local testing:

```text
http://localhost:8000/tilesets/bangkok/tileset.json
```

Other valid hosting target:

```text
https://storage.example.com/tilesets/bangkok/tileset.json
```

## Frontend integration

The Bangkok viewer consumes a standard 3D Tiles root URL:

- `app/components/BangkokOsmBuildingsViewer.vue` reads `bangkokPhotorealisticTilesetUrl`
- The viewer loads the layer with `Cesium3DTileset.fromUrl(...)` and styles it for visibility (orange extrusions in the UI)
- `nuxt.config.ts` exposes `NUXT_PUBLIC_BANGKOK_PHOTOREALISTIC_TILESET_URL`
- Sidebar toggle: **Bangkok Custom 3D**; compare mode hides OSM Buildings when Custom 3D is on

A valid Bangkok `tileset.json` can be plugged in by setting the env var and serving the publish directory over HTTP.

### Local viewer checklist

1. `npm run bangkok:tiles:generate` (or `bangkok:tiles:all`)
2. `BANGKOK_TILES_PORT=8006 npm run bangkok:tiles:serve`
3. Set `NUXT_PUBLIC_BANGKOK_PHOTOREALISTIC_TILESET_URL=http://localhost:8006/tilesets/bangkok/tileset.json`
4. Restart Nuxt dev server
5. Open Bangkok demo → enable **Bangkok Custom 3D** → use **ดู Custom 3D** bookmark
6. In DevTools Network, confirm `tileset.json` and `cell-*.glb` return HTTP 200

## Verification checklist

Before treating a Bangkok tileset as ready:

1. Open the root `tileset.json` over HTTP and confirm it loads without redirects or auth walls.
2. Verify the root bounding volume is in Bangkok, not another city.
3. Confirm child tile URIs resolve correctly relative to the root `tileset.json`.
4. Set `NUXT_PUBLIC_BANGKOK_PHOTOREALISTIC_TILESET_URL` to the hosted URL and start the app.
5. Toggle **Bangkok Custom 3D** on in the Bangkok viewer and confirm the chip shows Custom 3D enabled (not "รอ URL").
6. With compare mode on, OSM Buildings should hide while Custom 3D is on; orange extruded blocks should be visible when zoomed in.
7. Check that the visible dataset matches Bangkok geography.

## Coordinate systems

- Footprints are projected to local **ENU meters** (east, north) per cell.
- `geometry-extrude` builds meshes with vertical extrusion on **Z** in that frame.
- `writeGlb` converts vertices/normals to **glTF Y-up** before export.
- Each cell `tileset.json` root includes a **transform** from local ENU at the cell center to ECEF.

If buildings appear as needles or walls, regenerate tiles after pipeline updates (`npm run bangkok:tiles:generate`) and hard-refresh the viewer.

## Current limitations

- The repository now includes a first pure-JS generation path for Bangkok building tiles, but it is still optimized for a first workable dataset rather than a production city-scale photogrammetry pipeline.
- Building heights may need to be inferred when source data has no reliable height attributes (capped at 150 m in the pipeline).
- A true photorealistic Bangkok mesh still requires textured mesh or photogrammetry source data.
