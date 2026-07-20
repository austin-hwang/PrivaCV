import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import { resumeDocx } from "@/lib/docx-export";
import { sampleState } from "@/lib/resume";
import {
  MAX_PDF_BYTES,
  advanceReviewTo,
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

test("restores a version without showing a post-restore difference audit", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await saveVersion(page, "Clean baseline");

  await page.getByLabel("Full Name").fill("Ada Lovelace");

  const history = await openVersions(page);
  await history.getByRole("button", { name: "Select Clean baseline" }).click();
  await history.getByRole("button", { name: "Confirm restore" }).click();
  await expect(page.getByLabel("Full Name")).toHaveValue("John Doe");
  await expect(page.getByText(/Restored from the version saved/i)).toBeHidden();
  await expect(page.getByText("Previous resume available")).toBeVisible();
});

test("forks autosave into a separate slot before loading another saved version", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await saveVersion(page, "Clean baseline");

  await page.getByLabel("Full Name").fill("Ada Lovelace");
  await expect(page.locator("[data-autosave-status]")).toHaveAttribute("data-autosave-status", "saved");

  let versions = await openVersions(page);
  await versions.getByRole("button", { name: "Select Clean baseline" }).click();
  await versions.getByRole("button", { name: "Confirm restore" }).click();
  await expect(page.getByLabel("Full Name")).toHaveValue("John Doe");
  await expect(page.locator("[data-autosave-status]")).toHaveAttribute("data-autosave-status", "saved");

  await expect.poll(() => page.evaluate(() => {
    const history = JSON.parse(localStorage.getItem("resume-editor-version-history-v1") ?? "[]");
    const active = JSON.parse(localStorage.getItem("resume-editor-data-v2") ?? "null");
    return {
      activeName: active?.name,
      autosaveNames: history
        .filter((item: { id?: string }) => item.id?.startsWith("autosave-slot-"))
        .map((item: { state?: { name?: string } }) => item.state?.name),
    };
  })).toEqual({ activeName: "John Doe", autosaveNames: ["Ada Lovelace"] });

  versions = await openVersions(page);
  const previousAutosave = versions.locator("li", { hasText: "Autosave · Ada Lovelace" });
  await expect(previousAutosave.getByText("Autosaved", { exact: true })).toBeVisible();
  await expect(previousAutosave).toContainText("Preserved automatically before loading Clean baseline.");
  await previousAutosave.getByRole("button", { name: "Select Autosave · Ada Lovelace" }).click();
  await versions.getByRole("button", { name: "Confirm restore" }).click();
  await expect(page.getByLabel("Full Name")).toHaveValue("Ada Lovelace");
});

test("keeps the current autosave in its own slot when opening saved JSON", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await expect(page.locator("[data-autosave-status]")).toHaveAttribute("data-autosave-status", "saved");

  const savedResume = await page.evaluate(() => JSON.parse(localStorage.getItem("resume-editor-data-v2") ?? "null"));
  await page.locator("#resume-json-input").setInputFiles({
    name: "grace-hopper.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...savedResume, name: "Grace Hopper" })),
  });

  await expect(page.getByText("Loaded JSON", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Full Name")).toHaveValue("Grace Hopper");
  await expect(page.locator("[data-autosave-status]")).toHaveAttribute("data-autosave-status", "saved");
  await expect.poll(() => page.evaluate(() => {
    const history = JSON.parse(localStorage.getItem("resume-editor-version-history-v1") ?? "[]");
    return history
      .filter((item: { id?: string }) => item.id?.startsWith("autosave-slot-"))
      .map((item: { state?: { name?: string } }) => item.state?.name);
  })).toEqual(["John Doe"]);
});

test("restores the previous resume after clearing", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await page.getByLabel("Full Name").fill("Ada Lovelace");

  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Clear resume" }).click();
  const clearDialog = page.getByRole("dialog", { name: /clear this resume/i });
  await expect(clearDialog).toBeVisible();
  await clearDialog.getByRole("button", { name: /clear resume/i }).click();

  await expect(page.getByText("Previous resume available")).toBeVisible();
  await page.getByRole("button", { name: /restore previous/i }).click();

  await expect(page.getByLabel("Full Name")).toHaveValue("Ada Lovelace");
  await expect(page.getByText("Previous resume available")).toBeHidden();
});

test("deletes all data from a shared browser", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("resume-editor-data-v2"))).toContain("John Doe");
  await saveVersion(page, "Shared computer draft");

  // Seed the other privacy-sensitive browser-only records without opening the
  // print dialog or an import review during this focused destructive-flow test.
  await page.evaluate(() => {
    localStorage.setItem("resume-editor-import-review-v1", JSON.stringify({ fileName: "resume.pdf", items: [] }));
    localStorage.setItem("resume-editor-last-export-v1", JSON.stringify({ fingerprint: "current", exportedAt: new Date().toISOString(), pageCount: 1, issueCount: 0 }));
    localStorage.setItem("resume-editor-local-ai-model-v1", "test-model");
    localStorage.setItem("resume-editor-local-ai-cache-v2-migrated", "1");
  });
  await page.evaluate(async () => {
    const cache = await caches.open("webllm/model");
    await cache.put("https://resume.test/model-shard.bin", new Response(new Uint8Array([1, 2, 3])));
  });

  await openMenu(page);
  await page.getByRole("menuitem", { name: /delete all data/i }).click();
  const deleteDialog = page.getByRole("dialog", { name: /delete all browser data/i });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: /delete all data/i }).click();

  await expect(page.getByText("I have a resume")).toBeVisible();
  await expect(page.getByText("Deleted all data")).toBeVisible();
  await expect.poll(() => page.evaluate(() => ({
    draft: localStorage.getItem("resume-editor-data-v2"),
    history: localStorage.getItem("resume-editor-version-history-v1"),
    library: localStorage.getItem("resume-editor-library-v1"),
    activeResume: localStorage.getItem("resume-editor-active-resume-v1"),
    checkpoints: localStorage.getItem("resume-editor-checkpoint-history-v1"),
    review: localStorage.getItem("resume-editor-import-review-v1"),
    export: localStorage.getItem("resume-editor-last-export-v1"),
    localAIModel: localStorage.getItem("resume-editor-local-ai-model-v1"),
    localAIMigration: localStorage.getItem("resume-editor-local-ai-cache-v2-migrated"),
  }))).toEqual({
    draft: null,
    history: null,
    library: null,
    activeResume: null,
    checkpoints: null,
    review: null,
    export: null,
    localAIModel: null,
    localAIMigration: null,
  });
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).filter((name) => name.startsWith("webllm/")))).toEqual([]);

  await page.reload();
  await expect(page.getByText("I have a resume")).toBeVisible();
  await expect(page.getByText("Shared computer draft")).toBeHidden();
});

test("duplicates and switches named resumes while keeping checkpoint history separate", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await saveVersion(page, "Product baseline");

  let library = await openResumeLibrary(page);
  await expect(library.getByText("1 resume saved in this browser")).toBeVisible();
  await library.getByTitle("Duplicate resume").click();
  await expect(page.getByText(/Duplicated/i)).toBeVisible();

  const history = await openVersions(page);
  await expect(history.getByText("0 checkpoints for this resume")).toBeVisible();
  await expect(history.getByLabel("Move through edit history")).toBeVisible();
  await expect(page.getByRole("dialog", { name: /edit history/i })).toHaveCount(0);
  await expect.poll(async () => {
    const paper = await page.locator(".resume-preview-sheet-frame").boundingBox();
    const panel = await history.boundingBox();
    return paper && panel ? panel.x > paper.x : false;
  }).toBe(true);
  await closeVersions(page);

  await page.getByLabel("Full Name").fill("Jane Doe");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("resume-editor-library-v1"))).toContain("Jane Doe");
  library = await openResumeLibrary(page);
  await expect(library.getByText("2 resumes saved in this browser")).toBeVisible();
  const original = library.getByRole("listitem").filter({ hasText: "John Doe" }).filter({ hasNotText: "copy" });
  await original.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByLabel("Full Name")).toHaveValue("John Doe");

  library = await openResumeLibrary(page);
  const current = library.getByRole("listitem").filter({ hasText: "Current" });
  await current.getByTitle("Rename resume").click();
  const rename = current.locator('input[aria-label^="Rename "]');
  await rename.fill("Product roles");
  await rename.press("Enter");
  await expect(current.getByText("Product roles", { exact: true })).toBeVisible();
});

test("migrates the active draft and legacy versions into separate library resumes", async ({ page }) => {
  const active = { ...sampleState, name: "Legacy current" };
  const archived = { ...sampleState, name: "Archived product role" };
  await page.addInitScript(({ activeState, archivedState }) => {
    localStorage.clear();
    localStorage.setItem("resume-editor-data-v2", JSON.stringify(activeState));
    localStorage.setItem("resume-editor-autosave-time-v1", "2026-01-10T09:00:00.000Z");
    localStorage.setItem("resume-editor-version-history-v1", JSON.stringify([{
      id: "legacy-product-role",
      savedAt: "2026-01-09T09:00:00.000Z",
      label: "Product role",
      fingerprint: "legacy-product-role-fingerprint",
      state: archivedState,
      importReview: null,
    }]));
  }, { activeState: active, archivedState: archived });
  await page.goto("/");

  await expect(page.getByLabel("Full Name")).toHaveValue("Legacy current");
  const library = await openResumeLibrary(page);
  await expect(library.getByText("2 resumes saved in this browser")).toBeVisible();
  await expect(library.getByRole("listitem").filter({ hasText: "Legacy current" }).getByText("Current", { exact: true })).toBeVisible();
  await expect(library.getByRole("listitem").filter({ hasText: "Product role" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => ({
    library: localStorage.getItem("resume-editor-library-v1"),
    legacyHistory: localStorage.getItem("resume-editor-version-history-v1"),
  }))).toEqual({
    library: expect.stringContaining("Archived product role"),
    legacyHistory: null,
  });
});

test("saves and restores a named local version history checkpoint", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  const versions = await openVersions(page);

  await versions.getByRole("button", { name: /save current version/i }).click();
  await expect(page.getByRole("dialog", { name: /name this checkpoint/i })).toBeVisible();
  await page.getByLabel("Checkpoint name").fill("Original software resume");
  await page.getByRole("button", { name: /save checkpoint/i }).click();
  await expect(page.getByText("Checkpoint saved locally")).toBeVisible();
  await expect(versions.getByText("Original software resume")).toBeVisible();
  await expect(versions.locator("[data-history-selection]").getByText("Current", { exact: true })).toBeVisible();
  await expect(versions.getByText("John Doe").first()).toBeVisible();
  const savedCheckpoint = versions.locator("li", { hasText: "Original software resume" });
  await expect(savedCheckpoint.getByRole("button", { name: "Select Original software resume" })).toBeVisible();
  await closeVersions(page);

  await page.getByLabel("Full Name").fill("Grace Hopper");
  await page.getByLabel("Job Title").first().fill("Principal Software Engineer");
  await expect(page.getByLabel("Full Name")).toHaveValue("Grace Hopper");

  const timeline = await openVersions(page);
  await timeline.getByLabel("Move through edit history").fill("0");
  await expect(timeline.locator("[data-history-selection]")).toContainText("Original software resume");
  await expect(page.locator(".resume-sheet .resume-name")).toHaveText("John Doe");
  await expect(page.getByLabel("Full Name")).toHaveValue("Grace Hopper");
  await timeline.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".resume-sheet .resume-name")).toHaveText("Grace Hopper");
  await expect(page.getByLabel("Full Name")).toHaveValue("Grace Hopper");
  await timeline.getByLabel("Move through edit history").fill("0");
  await timeline.getByRole("button", { name: "Confirm restore" }).click();
  await expect(page.getByLabel("Full Name")).toHaveValue("John Doe");
  await expect(page.getByText(/Restored from the version saved/i)).toBeHidden();
  await expect(page.getByText("Previous resume available")).toBeVisible();

  const restoredTimeline = await openVersions(page);
  await restoredTimeline.getByRole("button", { name: "Select Original software resume" }).click();
  await restoredTimeline.getByRole("button", { name: /delete original software resume/i }).click();
  await expect(page.getByText(/Deleted “Original software resume”/)).toBeVisible();

  await page.getByRole("button", { name: /undo/i }).click();
  await expect(page.getByText("Restored deleted checkpoint")).toBeVisible();
  await expect(page.getByRole("button", { name: "Select Original software resume" })).toBeVisible();
});

test("keeps every checkpoint without a save limit", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  for (let index = 1; index <= 7; index += 1) {
    await setRichText(
      summaryEditor(page),
      `Tailored summary ${index} with enough specific context for this saved checkpoint.`,
    );
    await saveVersion(page, `Checkpoint ${index}`);
  }

  const versions = await openVersions(page);
  // No cap: all seven checkpoints and the live autosave copy remain available.
  await expect(versions.getByText("7 checkpoints for this resume")).toBeVisible();
  await expect.poll(() => versions.getByRole("list", { name: "Checkpoint timeline" }).getByRole("listitem").count()).toBeGreaterThanOrEqual(8);
  await expect(versions.getByText("Checkpoint 1", { exact: true })).toBeVisible();
  await expect(versions.getByText("Checkpoint 7", { exact: true })).toBeVisible();
});

test("clears checkpoints for the current resume without clearing its live draft", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await saveVersion(page, "Before tailoring");

  const versions = await openVersions(page);
  await versions.getByRole("button", { name: "Select Before tailoring" }).click();
  await versions.getByRole("button", { name: "Clear checkpoints", exact: true }).click();

  const confirmDialog = page.getByRole("dialog", { name: "Clear all checkpoints?" });
  await expect(confirmDialog).toContainText("Your live draft and autosave stay intact");
  await confirmDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(versions.getByRole("button", { name: "Select Before tailoring" })).toBeVisible();

  await versions.getByRole("button", { name: "Clear checkpoints", exact: true }).click();
  await confirmDialog.getByRole("button", { name: "Clear checkpoints", exact: true }).click();

  await expect(page.getByText("Cleared checkpoints")).toBeVisible();
  await expect(versions.getByText("0 checkpoints for this resume")).toBeVisible();
  await expect(versions.getByRole("button", { name: "Clear checkpoints", exact: true })).toBeDisabled();
  await expect(versions.getByRole("button", { name: "Select Before tailoring" })).toHaveCount(0);
  await expect(page.getByLabel("Full Name")).toHaveValue("John Doe");
  await expect(page.locator(".resume-sheet .resume-name")).toHaveText("John Doe");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("resume-editor-checkpoint-history-v1"))).toBeNull();
});

test("differentiates saved checkpoints with an optional note", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const versions = await openVersions(page);
  await versions.getByRole("button", { name: /save current version/i }).click();
  const saveDialog = page.getByRole("dialog", { name: /name this checkpoint/i });
  await saveDialog.getByLabel("Checkpoint name").fill("Backend focus");
  await saveDialog.getByLabel(/^Note/).fill("Tailored for the Stripe backend role; trimmed to one page.");
  await saveDialog.getByRole("button", { name: /save checkpoint/i }).click();

  await expect(versions.getByText("Backend focus")).toBeVisible();
  await expect(versions.getByText("Tailored for the Stripe backend role; trimmed to one page.")).toBeVisible();
});

test("finds a saved checkpoint by its name, note, or resume identity", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await saveVersion(page, "Platform baseline");

  await setRichText(summaryEditor(page), "Cloud-platform leadership with a focus on reliable backend systems and developer experience.");
  const versions = await openVersions(page);
  await versions.getByRole("button", { name: /save current version/i }).click();
  const saveDialog = page.getByRole("dialog", { name: /name this checkpoint/i });
  await saveDialog.getByLabel("Checkpoint name").fill("Cloud leadership focus");
  await saveDialog.getByLabel(/^Note/).fill("Tailored for the Stripe platform engineering role.");
  await saveDialog.getByRole("button", { name: /save checkpoint/i }).click();

  const search = versions.getByLabel("Find a checkpoint");
  await search.fill("stripe");
  await expect(versions.getByText(/Showing 1 of \d+/)).toBeVisible();
  await expect(versions.getByText("Cloud leadership focus", { exact: true })).toBeVisible();
  await expect(versions.getByText("Platform baseline", { exact: true })).toBeHidden();

  await closeVersions(page);
  const reopenedVersions = await openVersions(page);
  await expect(reopenedVersions.getByText("Showing all checkpoints")).toBeVisible();
  await expect(reopenedVersions.getByText("Platform baseline", { exact: true })).toBeVisible();

  await reopenedVersions.getByLabel("Find a checkpoint").fill("no matching checkpoint");
  await expect(reopenedVersions.getByText(/No checkpoints match “no matching checkpoint”/)).toBeVisible();
  await reopenedVersions.getByRole("button", { name: "Clear search" }).click();
  await expect(reopenedVersions.getByText("Showing all checkpoints")).toBeVisible();
});

test("imports a checkpoint history backup without replacing the current resume", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await saveVersion(page, "Platform baseline");

  const checkpoints = await page.evaluate(() => localStorage.getItem("resume-editor-version-history-v1"));
  const backup = JSON.stringify({
    format: "resume-editor-version-history-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    checkpoints: JSON.parse(checkpoints ?? "[]"),
  });

  // Use the product's privacy control so both legacy localStorage and the
  // IndexedDB workspace are empty before the backup is merged.
  await openMenu(page);
  await page.getByRole("menuitem", { name: /delete all data/i }).click();
  const deleteDialog = page.getByRole("dialog", { name: /delete all browser data/i });
  await deleteDialog.getByRole("button", { name: /delete all data/i }).click();
  await expect(page.getByText("I have a resume")).toBeVisible();
  await page.locator("#history-backup-input").setInputFiles({
    name: "resume-checkpoints.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });

  const backupDialog = page.getByRole("dialog", { name: /add saved checkpoints from backup/i });
  await expect(backupDialog).toBeVisible();
  await expect(backupDialog.getByText("Platform baseline")).toBeVisible();
  await backupDialog.getByRole("button", { name: /add 1 checkpoint/i }).click();

  await expect(page.getByText("Added 1 checkpoint")).toBeVisible();
  await expect(page.getByText("I have a resume")).toBeVisible();
  const versions = await openVersions(page);
  await expect(versions.getByText("Platform baseline").first()).toBeVisible();
});

test("makes matching checkpoint backups explicit before merging", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await saveVersion(page, "Platform baseline");

  const backup = await page.evaluate(() => {
    const checkpoints = JSON.parse(localStorage.getItem("resume-editor-version-history-v1") ?? "[]");
    return JSON.stringify({
      format: "resume-editor-version-history-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      checkpoints,
    });
  });

  await page.locator("#history-backup-input").setInputFiles({
    name: "matching-resume-checkpoints.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });

  const backupDialog = page.getByRole("dialog", { name: /checkpoints already added/i });
  await expect(backupDialog.getByText("All checkpoints are already in this browser")).toBeVisible();
  await expect(backupDialog.getByText("1 matching checkpoint was kept as-is. No duplicates were added.")).toBeVisible();
  await expect(backupDialog.getByText("Platform baseline", { exact: true })).toBeVisible();
  const checkpointSummary = backupDialog.locator("[data-checkpoint-summary]");
  await expect(checkpointSummary).toHaveCSS("display", "flex");
  expect(await checkpointSummary.locator("[data-checkpoint-summary-icon]").boundingBox()).toEqual(
    expect.objectContaining({ y: expect.any(Number) }),
  );
  await expect.poll(async () => {
    const icon = await checkpointSummary.locator("[data-checkpoint-summary-icon]").boundingBox();
    const heading = await checkpointSummary.getByText("All checkpoints are already in this browser").boundingBox();
    return icon && heading ? Math.abs(icon.y - heading.y) : 999;
  }).toBeLessThan(6);
  await backupDialog.getByRole("button", { name: /^done$/i }).click();
  await expect(backupDialog).toBeHidden();

  const versions = await openVersions(page);
  await expect(versions.getByText("Platform baseline", { exact: true })).toHaveCount(1);
});

test("merges every checkpoint from a large imported backup without a limit", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await saveVersion(page, "Template checkpoint");

  const checkpoint = await page.evaluate(() => {
    const history = JSON.parse(localStorage.getItem("resume-editor-version-history-v1") ?? "[]");
    return history[0];
  });
  const checkpoints = Array.from({ length: 7 }, (_, index) => ({
    ...checkpoint,
    id: `expanded-backup-${index + 1}`,
    label: `Expanded checkpoint ${index + 1}`,
    fingerprint: `expanded-backup-fingerprint-${index + 1}`,
    savedAt: new Date(Date.UTC(2026, 0, 7 - index)).toISOString(),
  }));
  const backup = JSON.stringify({
    format: "resume-editor-version-history-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    checkpoints,
  });

  await page.locator("#history-backup-input").setInputFiles({
    name: "expanded-resume-checkpoints.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });

  const backupDialog = page.getByRole("dialog", { name: /add saved checkpoints from backup/i });
  await expect(backupDialog.getByText("7 new checkpoints ready to add")).toBeVisible();
  await backupDialog.getByRole("button", { name: /add 7 checkpoints/i }).click();
  await expect(page.getByText("Added 7 checkpoints")).toBeVisible();

  // No cap: the oldest imported checkpoint is kept alongside the newest.
  const versions = await openVersions(page);
  await expect(versions.getByText("Expanded checkpoint 1", { exact: true })).toBeVisible();
  await expect(versions.getByText("Expanded checkpoint 7", { exact: true })).toBeVisible();
});
