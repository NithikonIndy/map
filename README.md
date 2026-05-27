# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Bangkok custom tiles

This repository includes a starter workflow for creating a Bangkok custom 3D Tiles source that can be plugged into `NUXT_PUBLIC_BANGKOK_PHOTOREALISTIC_TILESET_URL`.

The env var name still says `PHOTOREALISTIC` for compatibility, but the viewer labels this layer **Bangkok Custom 3D**. It loads **extruded building footprints** from your tileset URL, not Google Photorealistic 3D Tiles or photogrammetry mesh.

### Quick local checklist

1. Generate tiles: `npm run bangkok:tiles:all` (or run fetch → prepare → generate separately).
2. Serve tiles: `BANGKOK_TILES_PORT=8006 npm run bangkok:tiles:serve`
3. Set in `.env`: `NUXT_PUBLIC_BANGKOK_PHOTOREALISTIC_TILESET_URL=http://localhost:8006/tilesets/bangkok/tileset.json`
4. Restart the Nuxt dev server (`bun run dev`).
5. In the Bangkok viewer sidebar, enable **Bangkok Custom 3D**. With **เปรียบเทียบกับ OSM** on (default), OSM Buildings hide automatically so extruded blocks are easy to see. Use **ดู Custom 3D** in Camera Spots to zoom in.

Useful commands:

```bash
npm run bangkok:tiles:all
npm run bangkok:tiles:manifest
npm run bangkok:tiles:fetch-buildings
npm run bangkok:tiles:prepare
npm run bangkok:tiles:generate
npm run bangkok:tiles:serve
npm run bangkok:tiles:verify-http
```

`npm run bangkok:tiles:all` will run the full pipeline in one command, including starting a temporary local server and verifying the generated tileset over HTTP.

Example env value after you host the root tileset:

```bash
NUXT_PUBLIC_BANGKOK_PHOTOREALISTIC_TILESET_URL=https://cdn.example.com/tilesets/bangkok/tileset.json
```

See `docs/bangkok-custom-tiles.md` for the full source-data, pipeline, hosting, and frontend integration notes.
