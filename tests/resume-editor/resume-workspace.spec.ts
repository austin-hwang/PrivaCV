import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import { resumeDocx } from "@/lib/docx-export";
import { sampleState } from "@/lib/resume";
import {
  MAX_PDF_BYTES,
  advanceReviewTo,
  chooseSelectOption,
  closeVersions,
  expandAllEntries,
  expandAllTagGroups,
  expectGuidedHighlightToFrame,
  exportPdf,
  loadSample,
  makeDocxWithFieldLink,
  makeDocxWithFooterContact,
  makeDocxWithHeaderContact,
  makeDocxWithLabelOnlyLink,
  makeTextPdf,
  openDesign,
  openExport,
  openMenu,
  openResumeLibrary,
  openResumeReview,
  openTools,
  openVersions,
  removeSection,
  saveVersion,
  setRichText,
  setRichTextBlocks,
  summaryEditor,
} from "../resume-editor-support";

test("keeps the editor interactive while development security headers are active", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await loadSample(page);

  await expect(page.getByLabel("Full Name")).toHaveValue("John Doe");
});

test("uses focused edit, preview, and section navigation modes on phones", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const mobileNavigation = page.getByRole("navigation", { name: "Resume workspace" });
  await expect(mobileNavigation).toBeVisible();
  await expect(mobileNavigation.getByRole("radio", { name: "Edit" })).toBeChecked();
  await expect(page.getByLabel("Resume editor")).toBeVisible();

  await mobileNavigation.getByRole("radio", { name: "Preview" }).click();
  await expect(page.getByLabel("Resume preview")).toBeVisible();
  await expect(page.getByLabel("Resume editor")).toBeHidden();

  // The Next.js development toolbar occupies the bottom-left corner only in
  // the test server; force the app control so the production interaction is
  // exercised instead of the dev-only overlay.
  await mobileNavigation
    .getByRole("button", { name: "Open resume sections" })
    .dispatchEvent("click");
  const navigator = page.getByRole("dialog", { name: "Navigate resume" });
  await expect(navigator.getByLabel("Search resume fields")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(navigator).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await context.close();
});

test("does not reserve disclosure padding when name parts are collapsed", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const trigger = page.getByRole("button", { name: /Name parts/ });
  const collapsible = trigger.locator("..");
  const content = collapsible.locator('[data-slot="collapsible-content"]');

  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(content).toHaveCSS("padding", "0px");
  await expect
    .poll(async () => {
      const [rootBox, triggerBox] = await Promise.all([
        collapsible.boundingBox(),
        trigger.boundingBox(),
      ]);
      return rootBox && triggerBox ? rootBox.height - triggerBox.height : Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(2);

  await trigger.click();
  await expect(page.getByLabel("First")).toBeVisible();
});

test("starts a fresh resume from the onboarding without hiding the editor", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /start a blank resume/i }).click();
  await expect(page.getByText(/change the layout and theme later from Design/i)).toBeVisible();
  const preview = page.locator(".resume-sheet");
  await page.getByRole("menuitem", { name: /modern/i }).hover();
  await expect(preview).toHaveClass(/resume-template-modern/);
  await expect(preview).toHaveAttribute("data-divider", "on");
  await expect(preview).toHaveAttribute("data-header-align", "center");
  await page.getByRole("menuitem", { name: /compact/i }).hover();
  await expect(preview).toHaveClass(/resume-template-compact/);
  await expect(preview).toHaveAttribute("data-density", "compact");
  await expect(preview).toHaveCSS("font-family", /Carlito/);
  await page.getByRole("menuitem", { name: /executive/i }).hover();
  await expect(preview).toHaveClass(/resume-template-executive/);
  await expect(preview.locator(".resume-name")).toHaveCSS("color", "rgb(127, 29, 58)");
  await page.getByRole("menuitem", { name: /technical/i }).hover();
  await expect(preview).toHaveClass(/resume-template-technical/);
  await expect(preview).toHaveCSS("font-family", /Arimo/);
  await page.getByRole("menuitem", { name: /classic/i }).click();
  await expect(page.locator("#field-name")).toBeFocused();
  await expect(page.getByText("Start fresh")).toBeHidden();
  await expect(page.getByLabel("Resume editor")).toBeVisible();
  // The Classic preset seeds ruled section headings.
  await expect(page.locator(".resume-sheet")).toHaveAttribute("data-heading", "ruled");

  await page.reload();
  await page.getByRole("button", { name: /start a blank resume/i }).click();
  await page.getByRole("menuitem", { name: /modern/i }).click();
  await expect(page.locator("#field-name")).toBeFocused();
  // The Modern preset seeds an accent bar heading style.
  await expect(page.locator(".resume-sheet")).toHaveAttribute("data-heading", "bar");
});

test("customizes and persists a professional resume theme", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const sheet = page.locator(".resume-sheet");

  // Appearance controls live in the inline Design panel above the preview.
  await openDesign(page);

  // Preset swatches and the custom color input share one row when the panel
  // has room; the group may wrap only at genuinely narrow widths.
  const accentPresets = page.getByRole("radiogroup", { name: "Accent color" });
  const customAccent = page.getByLabel("Custom accent color");
  await expect
    .poll(async () => {
      const presetsBox = await accentPresets.boundingBox();
      const customBox = await customAccent.boundingBox();
      if (!presetsBox || !customBox) return false;
      const presetsCenter = presetsBox.y + presetsBox.height / 2;
      const customCenter = customBox.y + customBox.height / 2;
      return Math.abs(presetsCenter - customCenter) < 2;
    })
    .toBe(true);

  // A preset is a professional starting point that sets every theme axis.
  await chooseSelectOption(page, "Resume preset", "Modern");
  await expect(sheet).toHaveAttribute("data-heading", "bar");
  await expect(sheet).toHaveAttribute("data-divider", "on");
  await expect(sheet).toHaveAttribute("data-header-align", "center");
  await expect(sheet).toHaveAttribute("data-bullet", "circle");
  await expect(sheet).toHaveCSS("font-family", /Inter/);
  await expect(page.locator(".resume-name")).toHaveCSS("color", "rgb(31, 58, 95)");

  // Individual controls layer on top of the preset.
  await page.getByRole("radio", { name: "Burgundy" }).click();
  await expect(page.locator(".resume-name")).toHaveCSS("color", "rgb(127, 29, 58)");
  await chooseSelectOption(page, "Resume font", /^Gelasio/);
  await expect(sheet).toHaveCSS("font-family", /Gelasio/);

  // Header, headings, and density sit under the panel's Advanced disclosure.
  await page.getByRole("button", { name: /^Advanced/ }).click();

  const themeGroups = ["Header", "Density", "Section headings", "Bullet style"].map((name) =>
    page.getByRole("radiogroup", { name }),
  );
  const themeToggleSizes = await Promise.all(
    themeGroups.map(async (group) => {
      const box = await group.getByRole("radio").first().boundingBox();
      return box ? { width: box.width, height: box.height } : null;
    }),
  );
  expect(themeToggleSizes.every(Boolean)).toBe(true);
  const widths = themeToggleSizes.map((size) => size?.width ?? 0);
  const heights = themeToggleSizes.map((size) => size?.height ?? 0);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);

  await page.getByRole("radio", { name: "Plain", exact: true }).click();
  await expect(sheet).toHaveAttribute("data-heading", "plain");
  await page.getByRole("radio", { name: "Compact", exact: true }).click();
  await expect(sheet).toHaveAttribute("data-density", "compact");

  // Reload only after IndexedDB confirms the save. A fixed delay can
  // expire before storage finishes on a slower CI runner.
  const autosave = page.locator("[data-autosave-status]");
  await expect(autosave).toHaveAttribute("data-autosave-status", "saved");
  await page.reload();
  await expect(sheet).toHaveAttribute("data-heading", "plain");
  await expect(sheet).toHaveAttribute("data-density", "compact");
  await expect(page.locator(".resume-name")).toHaveCSS("color", "rgb(127, 29, 58)");
  await expect(sheet).toHaveCSS("font-family", /Gelasio/);

  // Choosing a sample replaces the draft content but should not quietly reset
  // the visual design the person is currently evaluating.
  await openMenu(page);
  await page.getByRole("menuitem", { name: /^sample$/i }).click();
  await expect(sheet).toHaveAttribute("data-heading", "plain");
  await expect(sheet).toHaveAttribute("data-density", "compact");
  await expect(page.locator(".resume-name")).toHaveCSS("color", "rgb(127, 29, 58)");
  await expect(sheet).toHaveCSS("font-family", /Gelasio/);
});

test("self-hosts every selectable resume font without device fallbacks", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await openDesign(page);

  const sheet = page.locator(".resume-sheet");
  const expectedFonts = [
    ["merriweather", "Merriweather"],
    ["georgia", "Gelasio"],
    ["times", "Tinos"],
    ["inter", "Inter"],
    ["arial", "Arimo"],
    ["calibri", "Carlito"],
  ] as const;
  const resolvedFamilies: string[] = [];

  for (const [, familyName] of expectedFonts) {
    // Each font's visible option label is its self-hosted family name.
    await chooseSelectOption(page, "Resume font", new RegExp(`^${familyName}`));
    await expect(sheet).toHaveCSS("font-family", new RegExp(familyName));
    const font = await sheet.evaluate(async (element) => {
      const family = getComputedStyle(element).fontFamily.split(",")[0];
      await document.fonts.load(`16px ${family}`, "Resume font consistency");
      return { family, loaded: document.fonts.check(`16px ${family}`) };
    });
    expect(font.loaded).toBe(true);
    resolvedFamilies.push(font.family);
  }

  expect(new Set(resolvedFamilies).size).toBe(expectedFonts.length);
});

test("keeps desktop section navigation flush with the app header", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const [header, navigation] = await Promise.all([
    page.locator("header.app-chrome").boundingBox(),
    page.getByRole("navigation", { name: "Jump to a resume section" }).boundingBox(),
  ]);
  expect(header).not.toBeNull();
  expect(navigation).not.toBeNull();
  expect(Math.abs(navigation!.y - (header!.y + header!.height))).toBeLessThanOrEqual(1);
});

test("keeps the mobile section navigation below the persistent workspace header", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const navigation = page.getByRole("navigation", { name: "Jump to a resume section" });
  await expect(navigation).toHaveCSS("position", "sticky");
  const header = page.locator("header.app-chrome");

  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect
      .poll(async () => {
        const [headerBox, navigationBox] = await Promise.all([
          header.boundingBox(),
          navigation.boundingBox(),
        ]);
        if (!headerBox || !navigationBox) return Infinity;
        return Math.abs(navigationBox.y - (headerBox.y + headerBox.height));
      })
      .toBeLessThanOrEqual(1);
  }
});

test("warns clearly and offers a JSON backup when browser autosave fails", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(IDBFactory.prototype, "open", {
      configurable: true,
      value: () => {
        throw new DOMException("IndexedDB is unavailable", "InvalidStateError");
      },
    });
  });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());

  await loadSample(page);

  const storageWarning = page
    .getByText("Browser autosave is unavailable", { exact: true })
    .locator("..");
  await expect(storageWarning).toContainText("Browser autosave is unavailable");
  await expect(storageWarning).toContainText("may not survive a refresh");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /save json copy/i }).click();
  await expect((await download).suggestedFilename()).toBe("John_Doe.json");
});

test("records export format with a pseudonymous visitor ID", async ({ page }) => {
  const exportEvents: unknown[] = [];
  await page.route("**/api/metrics/export", async (route) => {
    exportEvents.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  expect(exportEvents).toEqual([]);
  const download = page.waitForEvent("download");
  await openExport(page);
  await page.getByRole("menuitem", { name: /export json/i }).click();
  await expect((await download).suggestedFilename()).toBe("John_Doe.json");
  await expect
    .poll(() => exportEvents)
    .toEqual([{ format: "json", visitorId: expect.stringMatching(/^[0-9a-f-]{36}$/) }]);
});

test("backs up a checkpoint instead of claiming it persisted when browser storage fails", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(IDBFactory.prototype, "open", {
      configurable: true,
      value: () => {
        throw new DOMException("IndexedDB is unavailable", "InvalidStateError");
      },
    });
  });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await loadSample(page);

  const versions = await openVersions(page);
  await expect(
    versions.getByText(/checkpoints shown here may not survive a refresh/i),
  ).toBeVisible();
  await versions.getByRole("button", { name: /save current version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Tailored product role");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /save checkpoint/i }).click();
  await expect((await download).suggestedFilename()).toBe("John_Doe-checkpoints.json");
  await expect(
    page.getByText("Browser storage unavailable — checkpoint backup downloaded", { exact: true }),
  ).toBeVisible();
  await expect(
    versions.getByRole("list").getByText("Tailored product role", { exact: true }),
  ).toBeVisible();
});

test("keeps import, export, and secondary toolbar actions usable from the keyboard", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const moreTrigger = page.getByRole("button", { name: /^more actions$/i });
  await moreTrigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: /use light mode/i })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: /resume library/i })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: /upload pdf or word/i })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: /paste resume text/i })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: /open saved json/i })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(moreTrigger).toBeFocused();

  const exportTrigger = page.getByRole("button", { name: /^export$/i });
  await exportTrigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: /export pdf/i })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(exportTrigger).toBeFocused();

  const trigger = page.getByRole("button", { name: /^more actions$/i });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");

  await expect(page.getByRole("menuitem", { name: /use light mode/i })).toBeFocused();
  await expect(page.getByRole("menuitem", { name: /copy for applications/i })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: /continue on another device/i })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: /open saved json/i })).toHaveCount(1);
  await page.keyboard.press("End");
  await expect(page.getByRole("menuitem", { name: /delete all data/i })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("menuitem", { name: /clear resume/i })).toBeFocused();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("menu")).toBeHidden();
  await expect(trigger).toBeFocused();
});
