import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repositoryRoot, "tests/fixtures/public-resumes/manifest.json");
const outputDirectory = path.join(repositoryRoot, "tests/fixtures/public-resumes/downloads");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

await mkdir(outputDirectory, { recursive: true });

for (const fixture of manifest) {
  const response = await fetch(fixture.url, { redirect: "follow" });
  if (!response.ok)
    throw new Error(`Could not download ${fixture.filename}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== fixture.sha256) {
    throw new Error(
      `${fixture.filename} changed upstream (expected ${fixture.sha256}, received ${digest})`,
    );
  }
  await writeFile(path.join(outputDirectory, fixture.filename), bytes);
  console.log(`verified ${fixture.filename} (${bytes.length} bytes)`);
}
