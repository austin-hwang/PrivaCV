import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const includePublicResumeFixtures = process.env.PLAYWRIGHT_PUBLIC_RESUMES === "1";

export default defineConfig({
  testDir: "./tests",
  // Public resume documents are downloaded on demand and can contain real,
  // publicly posted contact details. Keep that integration suite opt-in so a
  // normal contributor run is deterministic and uses only synthetic fixtures.
  testIgnore: includePublicResumeFixtures ? [] : ["**/public-resume-import.spec.ts"],
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm dev --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
