import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distName = ".next-electron";
const distDirectory = path.join(repositoryRoot, distName);
const standaloneDirectory = path.join(distDirectory, "standalone");
const nextEnvironmentPath = path.join(repositoryRoot, "next-env.d.ts");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

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
  await run(pnpmCommand, ["exec", "next", "build"], {
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

console.log(`Prepared Electron server at ${path.relative(repositoryRoot, standaloneDirectory)}`);
