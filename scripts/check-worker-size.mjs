import { spawnSync } from "node:child_process";

// Cloudflare Workers Free accepts at most 3 MiB after gzip. Keep a small
// buffer so compression differences between local and deployment builds do
// not turn a passing CI run into a rejected upload.
const workerBudgetKiB = 3_000;
const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(packageManager, ["exec", "wrangler", "deploy", "--dry-run"], {
  encoding: "utf8",
});

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(output);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const match = output.match(/gzip:\s*([\d.]+)\s*(KiB|MiB)/i);
if (!match) {
  console.error("Could not determine the compressed Worker size from Wrangler output.");
  process.exit(1);
}

const measuredKiB = Number(match[1]) * (match[2].toLocaleLowerCase() === "mib" ? 1_024 : 1);
if (measuredKiB > workerBudgetKiB) {
  console.error(
    `Compressed Worker size ${measuredKiB.toFixed(2)} KiB exceeds the ${workerBudgetKiB} KiB deployment budget.`,
  );
  process.exit(1);
}

console.log(
  `Compressed Worker size ${measuredKiB.toFixed(2)} KiB is within the ${workerBudgetKiB} KiB deployment budget.`,
);
