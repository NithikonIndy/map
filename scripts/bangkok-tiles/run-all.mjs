import { spawn } from "node:child_process";
import net from "node:net";

import { bangkokTilesConfig } from "./config.mjs";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

async function main() {
  if (process.env.BANGKOK_TILES_SKIP_FETCH !== "1") {
    await runNpmScript("bangkok:tiles:fetch-buildings");
  }

  if (process.env.BANGKOK_TILES_SKIP_PREPARE !== "1") {
    await runNpmScript("bangkok:tiles:prepare");
  }

  if (process.env.BANGKOK_TILES_SKIP_GENERATE !== "1") {
    await runNpmScript("bangkok:tiles:generate");
  }

  const port = await findAvailablePort();
  const server = startTilesServer(port);

  try {
    await server.ready;

    const tilesetUrl = `http://127.0.0.1:${port}/tilesets/bangkok/tileset.json`;
    await runNpmScript("bangkok:tiles:verify-http", {
      BANGKOK_TILESET_URL: tilesetUrl,
    });

    console.log(`Bangkok tiles pipeline completed successfully.`);
    console.log(`Verified tileset URL: ${tilesetUrl}`);
  } finally {
    await stopChild(server.child);
  }
}

function runNpmScript(scriptName, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand, ["run", scriptName], {
      cwd: bangkokTilesConfig.workspaceRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        ...extraEnv,
      },
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Script "${scriptName}" failed with ${signal ?? `exit code ${code}`}.`));
    });
  });
}

function startTilesServer(port) {
  const child = spawn(npmCommand, ["run", "bangkok:tiles:serve"], {
    cwd: bangkokTilesConfig.workspaceRoot,
    shell: process.platform === "win32",
    env: {
      ...process.env,
      BANGKOK_TILES_PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const ready = new Promise((resolve, reject) => {
    let settled = false;

    const settle = (handler, value) => {
      if (settled) {
        return;
      }

      settled = true;
      handler(value);
    };

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);

      if (text.includes("Serving Bangkok tiles")) {
        settle(resolve);
      }
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });

    child.on("error", (error) => {
      settle(reject, error);
    });

    child.on("exit", (code, signal) => {
      settle(reject, new Error(`Tiles server exited before readiness with ${signal ?? `exit code ${code}`}.`));
    });
  });

  return { child, ready };
}

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not determine an available local port."));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

function stopChild(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.killed || !child.pid) {
      resolve();
      return;
    }

    child.once("exit", () => resolve());

    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        shell: false,
      });

      killer.on("exit", () => {
        if (child.exitCode !== null || child.killed) {
          resolve();
          return;
        }

        child.kill();
      });

      killer.on("error", () => {
        child.kill();
      });

      return;
    }

    child.kill();
    setTimeout(() => resolve(), 2000);
  });
}

main().catch((error) => {
  console.error("Bangkok tiles all-in-one pipeline failed", error);
  process.exitCode = 1;
});
