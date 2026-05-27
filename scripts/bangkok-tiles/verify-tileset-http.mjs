import { bangkokTilesConfig } from "./config.mjs";

async function main() {
  const rootUrl = process.env.BANGKOK_TILESET_URL ?? bangkokTilesConfig.hosting.localExample;
  const rootResponse = await fetch(rootUrl);

  if (!rootResponse.ok) {
    throw new Error(`Failed to fetch root tileset: ${rootResponse.status} ${rootResponse.statusText}`);
  }

  const rootTileset = await rootResponse.json();
  const childUris = (rootTileset.root?.children ?? [])
    .map((child) => child.content?.uri)
    .filter(Boolean);

  if (childUris.length === 0) {
    throw new Error("Root tileset did not contain child tileset references.");
  }

  for (const childUri of childUris) {
    const childUrl = new URL(childUri, rootUrl).toString();
    const childResponse = await fetch(childUrl);

    if (!childResponse.ok) {
      throw new Error(`Failed to fetch child tileset ${childUrl}: ${childResponse.status}`);
    }

    const childTileset = await childResponse.json();
    const contentUri = childTileset.root?.content?.uri;

    if (!contentUri) {
      throw new Error(`Child tileset ${childUrl} did not declare content.uri.`);
    }

    const contentUrl = new URL(contentUri, childUrl).toString();
    const contentResponse = await fetch(contentUrl, { method: "HEAD" });

    if (!contentResponse.ok) {
      throw new Error(`Failed to resolve tile content ${contentUrl}: ${contentResponse.status}`);
    }
  }

  console.log(`Verified Bangkok root tileset and ${childUris.length} child tilesets over HTTP.`);
}

main().catch((error) => {
  console.error("Tileset HTTP verification failed", error);
  process.exitCode = 1;
});
