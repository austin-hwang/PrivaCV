import { spawn } from "node:child_process";
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distName = ".next-electron";
const distDirectory = path.join(repositoryRoot, distName);
const standaloneDirectory = path.join(distDirectory, "standalone");
const nextEnvironmentPath = path.join(repositoryRoot, "next-env.d.ts");
const pnpmScript = process.env.npm_execpath;
const windowsFallback = process.platform === "win32" && !pnpmScript;
const pnpmCommand = pnpmScript
  ? process.execPath
  : windowsFallback
    ? (process.env.ComSpec ?? "cmd.exe")
    : "pnpm";
const pnpmArgs = pnpmScript ? [pnpmScript] : windowsFallback ? ["/d", "/s", "/c", "pnpm"] : [];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${signal || `code ${code}`}.`));
    });
  });
}

await rm(distDirectory, { force: true, recursive: true });
const nextEnvironment = await readFile(nextEnvironmentPath);
try {
  await run(pnpmCommand, [...pnpmArgs, "exec", "next", "build"], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      ELECTRON_BUILD: "1",
      NEXT_DIST_DIR: distName,
      NEXT_TELEMETRY_DISABLED: "1",
      PRIVACV_DESKTOP_APP: "1",
    },
  });
} finally {
  // Next rewrites this generated reference to whichever distDir was built
  // most recently. Keep normal web development pointed at `.next`.
  await writeFile(nextEnvironmentPath, nextEnvironment);
}

await cp(path.join(repositoryRoot, "public"), path.join(standaloneDirectory, "public"), {
  recursive: true,
});
const packagedStaticDirectory = path.join(standaloneDirectory, distName, "static");
await mkdir(path.dirname(packagedStaticDirectory), { recursive: true });
await cp(path.join(distDirectory, "static"), packagedStaticDirectory, { recursive: true });

// Next preserves pnpm's dependency symlinks in standalone output. Forge's
// Windows ZIP maker cannot traverse the equivalent directory junctions. Build
// a conventional flat node_modules from pnpm's virtual store so the packaged
// server has ordinary directories and Node can still resolve every dependency.
const sourceNodeModules = path.join(standaloneDirectory, "node_modules");
const flattenedNodeModules = path.join(distDirectory, "node_modules-flat");
await cp(path.join(sourceNodeModules, ".pnpm", "node_modules"), flattenedNodeModules, {
  dereference: true,
  recursive: true,
});
for (const entry of await readdir(sourceNodeModules, { withFileTypes: true })) {
  if (entry.name === ".pnpm") continue;
  await cp(path.join(sourceNodeModules, entry.name), path.join(flattenedNodeModules, entry.name), {
    dereference: true,
    recursive: true,
  });
}
await rm(sourceNodeModules, { force: true, recursive: true });
await rename(flattenedNodeModules, sourceNodeModules);

console.log(`Prepared Electron server at ${path.relative(repositoryRoot, standaloneDirectory)}`);
