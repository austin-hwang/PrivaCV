import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const electronPath = require("electron");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const developmentUrl = "http://127.0.0.1:3000";
let shuttingDown = false;

const next = spawn(pnpmCommand, ["dev"], {
  env: { ...process.env, PRIVACV_DESKTOP_APP: "1" },
  stdio: "inherit",
});
let electron = null;

function terminate(child) {
  if (child && child.exitCode === null && !child.killed) child.kill("SIGTERM");
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  terminate(electron);
  terminate(next);
  process.exitCode = exitCode;
}

async function waitForNext(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (next.exitCode !== null) throw new Error(`Next.js exited with code ${next.exitCode}.`);
    try {
      const response = await fetch(developmentUrl, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
    } catch {
      // Next.js is still compiling the first route.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Next.js did not become ready in time.");
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}

try {
  await waitForNext();
  electron = spawn(electronPath, ["."], {
    env: { ...process.env, ELECTRON_START_URL: developmentUrl },
    stdio: "inherit",
  });
  electron.once("exit", (code) => shutdown(code ?? 0));
  electron.once("error", (error) => {
    console.error(error);
    shutdown(1);
  });
} catch (error) {
  console.error(error);
  shutdown(1);
}
