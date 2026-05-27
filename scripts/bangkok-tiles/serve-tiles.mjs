import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

import { bangkokTilesConfig } from "./config.mjs";

const rootDir = bangkokTilesConfig.directories.publish;
const port = Number.parseInt(process.env.BANGKOK_TILES_PORT ?? "8006", 10);

const mimeTypes = {
  ".json": "application/json; charset=utf-8",
  ".glb": "model/gltf-binary",
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    const requestPath = normalizeRequestPath(url.pathname);
    const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(rootDir, safePath);

    await access(filePath);
    const fileStat = await stat(filePath);

    if (fileStat.isDirectory()) {
      response.writeHead(404);
      response.end("Directory listing is not supported.");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] ?? "application/octet-stream",
      "Content-Length": fileStat.size,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    });

    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving Bangkok tiles from ${rootDir} at http://127.0.0.1:${port}/tileset.json`);
});

function normalizeRequestPath(pathname) {
  if (pathname === "/" || pathname === "") {
    return "/tileset.json";
  }

  if (pathname.startsWith("/tilesets/bangkok/")) {
    return pathname.replace("/tilesets/bangkok", "");
  }

  return pathname;
}
