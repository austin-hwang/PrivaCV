import { test, expect } from "@playwright/test";
import { loadSample } from "../tests/resume-editor-support";

test("skills entries persist", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  const sel = '[data-editor-section="skills"]';
  const picker = page.locator(sel).getByRole("group", { name: "Content format" });
  await picker.getByRole("button", { name: "Entries format" }).click();
  await page.waitForTimeout(1500);
  const fmt = await page.evaluate(() => {
    const raw = localStorage.getItem("resume-editor-data-v2");
    return raw ? JSON.parse(raw).sectionFormats : null;
  });
  console.log("persisted sectionFormats:", JSON.stringify(fmt));
  // also read the react-rendered body: is EntryList or TagGroupEditor present?
  const body = await page.evaluate((s) => {
    const sec = document.querySelector(s)!;
    return {
      hasTagGroupEditor:
        !!sec.querySelector('[aria-label^="Tag group"]') ||
        !!sec.querySelector('[aria-label^="Add tag"]') ||
        !!sec.querySelector('button[aria-label^="Add group"]'),
      addGroupBtn: sec.querySelector('button[aria-label^="Add group"]')?.getAttribute("aria-label"),
      entriesFormatPressed: sec
        .querySelector('button[aria-label="Entries format"]')
        ?.getAttribute("aria-pressed"),
    };
  }, sel);
  console.log("body:", JSON.stringify(body));
});
