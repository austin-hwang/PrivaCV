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

test("helps first-time users choose the right private import route", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Two clear primary paths up front: bring an existing resume in, or start blank.
  await expect(page.getByText("I have a resume")).toBeVisible();
  await expect(page.getByText("Start fresh")).toBeVisible();
  const importFile = page.getByRole("button", { name: /^import a file$/i });
  const pasteText = page.getByRole("button", { name: /paste resume text/i });
  await expect(pasteText).toBeVisible();
  // PDF and Word share one importer that routes on the file itself.
  await expect(importFile).toBeVisible();
  await expect(importFile).toHaveClass(/bg-primary/);
  await expect(pasteText).toHaveClass(/border-input/);
  await expect.poll(async () => {
    const [fileBox, pasteBox] = await Promise.all([importFile.boundingBox(), pasteText.boundingBox()]);
    return Boolean(fileBox && pasteBox && fileBox.y < pasteBox.y);
  }).toBe(true);
  await expect(page.getByRole("button", { name: /^start a blank resume$/i })).toBeVisible();

  // Secondary routes stay tucked away until asked for.
  await expect(page.getByRole("button", { name: /open saved json/i })).toBeHidden();
  await expect(page.getByRole("button", { name: /open checkpoint backup/i })).toBeHidden();
  await page.getByRole("button", { name: /more options/i }).click();
  await expect(page.getByRole("button", { name: /load a sample/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /open saved json/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /open checkpoint backup/i })).toBeVisible();
});

test("imports a PDF with parser code served from the app", async ({ page }) => {
  const thirdPartyRequests: string[] = [];
  page.on("request", (request) => {
    if (/cdn\.jsdelivr\.net|unpkg\.com/.test(request.url())) thirdPartyRequests.push(request.url());
  });

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /import a file/i }).click();
  await page.locator('input[type="file"][accept*="application/pdf"]').setInputFiles({
    name: "ada-resume.pdf",
    mimeType: "application/pdf",
    buffer: makeTextPdf("Ada Lovelace"),
  });

  await expect(page.getByLabel("Full Name")).toHaveValue("Ada Lovelace");
  await expect(page.getByText("Imported PDF - please review")).toBeVisible();
  expect(thirdPartyRequests).toEqual([]);
});

test("keeps an oversized PDF import local and gives a clear recovery path", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /import a file/i }).click();
  await page.locator('input[type="file"][accept*="application/pdf"]').setInputFiles({
    name: "large-resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(MAX_PDF_BYTES + 1),
  });

  await expect(page.getByText("This PDF is too large to import locally. Try copying the resume text instead.")).toBeVisible();
  await expect(page.getByText("I have a resume")).toBeVisible();
});

test("imports an editable Word resume locally and keeps its review deliberate", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /import a file/i }).click();
  await page.locator('input[type="file"][accept*="wordprocessingml"]').setInputFiles({
    name: "jane-resume.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from(resumeDocx(sampleState())),
  });

  await expect(page.getByLabel("Full Name")).toHaveValue("John Doe");
  await expect(page.getByText("Imported Word document - please review")).toBeVisible();
  await expect(page.getByRole("heading", { name: /review the imported fields/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /start walkthrough/i })).toBeVisible();
});

test("recovers a label-only external contact link from a Word resume", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /import a file/i }).click();
  await page.locator('input[type="file"][accept*="wordprocessingml"]').setInputFiles({
    name: "ada-resume.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: makeDocxWithLabelOnlyLink(),
  });

  await expect(page.getByLabel("LinkedIn URL")).toHaveValue("https://www.linkedin.com/in/ada");
  await expect(page.getByText("Imported Word document - please review")).toBeVisible();
});

test("recovers a label-only Word field link from a resume", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /import a file/i }).click();
  await page.locator('input[type="file"][accept*="wordprocessingml"]').setInputFiles({
    name: "ada-field-link-resume.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: makeDocxWithFieldLink(),
  });

  await expect(page.getByLabel("Website URL")).toHaveValue("https://ada.example.com");
  await expect(page.getByText("Imported Word document - please review")).toBeVisible();
});

test("imports contact details stored in a referenced Word header", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /import a file/i }).click();
  await page.locator('input[type="file"][accept*="wordprocessingml"]').setInputFiles({
    name: "header-resume.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: makeDocxWithHeaderContact(),
  });

  await expect(page.getByLabel("Full Name")).toHaveValue("Ada Lovelace");
  await expect(page.getByLabel("Title / Role")).toHaveValue("Platform Engineer");
  await expect(page.getByLabel("Email")).toHaveValue("ada@example.com");
  await expect(page.getByLabel("Website URL")).toHaveValue("https://ada.example.com");
  await expect(page.getByText("Imported Word document - please review")).toBeVisible();
});

test("imports contact details stored in a referenced Word footer", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /import a file/i }).click();
  await page.locator('input[type="file"][accept*="wordprocessingml"]').setInputFiles({
    name: "footer-resume.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: makeDocxWithFooterContact(),
  });

  await expect(page.getByLabel("Full Name")).toHaveValue("Ada Lovelace");
  await expect(page.getByLabel("Title / Role")).toHaveValue("Platform Engineer");
  await expect(page.getByLabel("Email")).toHaveValue("ada@example.com");
  await expect(page.getByLabel("Website URL")).toHaveValue("https://ada.example.com");
  await expect(page.getByText("Imported Word document - please review")).toBeVisible();
});

test("loads the sample resume and reviews plain text", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await expect(page.getByText("John Doe").first()).toBeVisible();
  await expect(page.locator('[data-editor-section="experience"] [data-editor-entry]')).toHaveCount(3);
  await expect(page.locator('[data-editor-section="education"] [data-editor-entry]')).toHaveCount(2);
  await expect(page.locator('[data-editor-section="projects"] [data-editor-entry]')).toHaveCount(2);
  await expect(page.locator('[data-editor-section="skills"] [data-editor-tag-group]')).toHaveCount(4);
  await expect(page.getByText("1 page in preview", { exact: true })).toBeVisible();
  const editingMode = page.getByRole("button", { name: /editing mode — switch to view only/i });
  await expect(editingMode).toBeVisible();
  await expect(editingMode.locator("span.rounded-full")).toHaveCount(0);

  await openTools(page);
  await expect(page.getByRole("button", { name: /resume review/i })).toBeVisible();

  await openExport(page);
  await page.getByRole("menuitem", { name: /copy resume text/i }).click();
  await expect(page.getByRole("dialog", { name: /review before copying/i })).toBeVisible();
  await expect(page.locator("textarea[readonly]")).toContainText("John Doe");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /download \.txt/i }).click();
  await expect((await download).suggestedFilename()).toBe("John_Doe.txt");

  const wordDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /download \.docx/i }).click();
  const wordFile = await wordDownload;
  await expect(wordFile.suggestedFilename()).toBe("John_Doe.docx");
  expect(wordFile.suggestedFilename()).toMatch(/\.docx$/);
  const wordPath = await wordFile.path();
  expect(wordPath).toBeTruthy();
  const wordContents = unzipSync(new Uint8Array(await readFile(wordPath!)));
  expect(strFromU8(wordContents["word/document.xml"])).toContain("John Doe");
});

test("makes local autosave visible while an edited resume is being stored", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const libraryButton = page.getByRole("button", { name: /open resume library:/i });
  await expect(libraryButton.getByText("John Doe", { exact: true })).toBeVisible();
  await expect(libraryButton.locator(".lucide-library")).toBeVisible();

  // Autosave state is surfaced beside the editing controls: a spinning loader
  // while saving that settles to a check, mirrored on data-autosave-status + aria.
  const autosave = page.locator("[data-autosave-status]");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("resume-editor-data-v2"))).toContain("John Doe");
  await expect(autosave).toHaveAttribute("data-autosave-status", "saved");
  await expect(autosave).toHaveAccessibleName(/saved locally/i);
  await expect(autosave.getByText("Saved", { exact: true })).toBeVisible();

  const summary = page.getByRole("textbox", { name: "Professional Summary" });
  await page.waitForTimeout(450);
  await summary.fill("A local-first product engineer who ships dependable tools.");
  await summary.press("Tab");
  await expect(autosave).toHaveAttribute("data-autosave-status", "saving");
  await expect(autosave).toHaveAccessibleName(/saving locally/i);
  await expect(autosave.getByText("Saving", { exact: true })).toBeVisible();
  await expect(libraryButton.locator(".animate-spin")).toHaveCount(0);

  const versions = await openVersions(page);
  await expect(versions.getByRole("listitem").getByText("Autosave copy", { exact: true })).toBeVisible();
  await expect(versions.getByText("Autosaved", { exact: true })).toBeVisible();
});

test("creates a deduplicated periodic checkpoint after sustained editing", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await expect(page.locator("[data-autosave-status]")).toHaveAttribute("data-autosave-status", "saved");

  await page.evaluate(() => {
    const tenMinutesLater = Date.now() + 10 * 60 * 1000;
    Date.now = () => tenMinutesLater;
  });
  await setRichText(summaryEditor(page), "A sustained editing session with a durable automatic history point.");
  await expect(page.locator("[data-autosave-status]")).toHaveAttribute("data-autosave-status", "saved");

  await expect.poll(() => page.evaluate(() => {
    const history = JSON.parse(localStorage.getItem("resume-editor-version-history-v1") ?? "[]");
    return history.filter((item: { id?: string }) => item.id?.startsWith("auto-checkpoint-")).length;
  })).toBe(1);

  await setRichText(summaryEditor(page), "A second edit should stay within the same automatic checkpoint window.");
  await expect(page.locator("[data-autosave-status]")).toHaveAttribute("data-autosave-status", "saved");
  await expect.poll(() => page.evaluate(() => {
    const history = JSON.parse(localStorage.getItem("resume-editor-version-history-v1") ?? "[]");
    return history.filter((item: { id?: string }) => item.id?.startsWith("auto-checkpoint-")).length;
  })).toBe(1);

  const versions = await openVersions(page);
  const automatic = versions.locator("li", { hasText: "Auto · John Doe" });
  await expect(automatic.getByText("Automatic", { exact: true })).toBeVisible();
  await expect(automatic).toContainText("Saved automatically after 10 minutes of continued editing.");
});

test("keeps a second tab from silently overwriting a newer local draft", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await expect(page.locator("[data-autosave-status]")).toHaveAttribute("data-autosave-status", "saved");

  const otherTab = await context.newPage();
  await otherTab.goto("/");
  await expect(otherTab.getByLabel("Full Name")).toHaveValue("John Doe");
  await otherTab.getByLabel("Full Name").fill("Alex Morgan");
  await expect(otherTab.locator("[data-autosave-status]")).toHaveAttribute("data-autosave-status", "saved");

  const conflict = page.getByText("A different resume was saved in another tab", { exact: true }).locator("..");
  await expect(conflict).toContainText("Autosave is paused here");
  await expect(conflict.getByText("Header changed", { exact: true })).toBeVisible();
  await expect(conflict.getByText("This tab", { exact: true })).toBeVisible();
  await expect(conflict.getByText("Saved tab", { exact: true })).toBeVisible();
  await expect(page.locator("[data-autosave-status]")).toHaveAttribute("data-autosave-status", "conflict");
  await page.getByRole("button", { name: /use saved draft/i }).click();
  await expect(page.getByLabel("Full Name")).toHaveValue("Alex Morgan");
  await expect(conflict).toBeHidden();
  await otherTab.close();
});

test("keeps required import review when using an imported draft from another tab", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const otherTab = await context.newPage();
  await otherTab.goto("/");
  await otherTab.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = otherTab.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill([
    "Ada Lovelace",
    "ada@example.com | San Francisco, CA",
    "",
    "Experience",
    "Platform Engineer | Analytical Engines | 2022-Present",
    "• Built reliable systems.",
  ].join("\n"));
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(otherTab);
  await expect(otherTab.locator("#import-review-panel")).toBeVisible();
  await expect(otherTab.locator("[data-autosave-status]")).toHaveAttribute("data-autosave-status", "saved");

  await expect(page.getByText("A different resume was saved in another tab", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /use saved draft/i }).click();

  await expect(page.getByLabel("Full Name")).toHaveValue("Ada Lovelace");
  await expect(page.locator("#import-review-panel")).toBeVisible();
  await expect(page.getByText("Loaded the draft and its import review")).toBeVisible();
  await exportPdf(page);
  await expect(page.getByRole("dialog", { name: /review before exporting/i })).toContainText("Imported fields still need review");
  await otherTab.close();
});

test("offers copy-ready application fields without making users retype resume details", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await openTools(page);
  await page.getByRole("dialog", { name: /^tools$/i }).getByRole("button", { name: /copy for applications/i }).click();

  const dialog = page.getByRole("dialog", { name: /copy for applications/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Copy exactly what each portal asks for", { exact: true })).toHaveCount(0);
  await expect(dialog).toHaveCSS("overflow-y", "hidden");
  await expect(dialog.locator("[data-application-copy-list]")).toHaveCSS("overflow-y", "auto");
  await expect(dialog.getByRole("button", { name: /copy full name/i })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /copy email/i })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /copy job title/i }).first()).toBeVisible();
  await expect(dialog.getByRole("button", { name: /copy achievements/i }).first()).toBeVisible();
  await expect(dialog.getByText("Product Operations Manager · Northstar Health - Chicago, IL")).toBeVisible();

  const firstExperience = dialog.locator('section[aria-label="Experience 1"]');
  const achievements = firstExperience.locator("#application-copy-experience-0-details");
  const expand = firstExperience.locator('button[aria-controls="application-copy-experience-0-details"]');
  await expect(achievements).toHaveClass(/max-h-12/);
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await expand.click();
  await expect(achievements).not.toHaveClass(/max-h-12/);
  await expect(firstExperience.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
});

test("copies application fields when the browser rejects async clipboard access", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new DOMException("Permission denied", "NotAllowedError")) },
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: (command: string) => {
        if (command !== "copy") return false;
        const copied = document.activeElement instanceof HTMLTextAreaElement ? document.activeElement.value : "";
        document.documentElement.dataset.fallbackCopy = copied;
        return true;
      },
    });
  });

  await openTools(page);
  await page.getByRole("dialog", { name: /^tools$/i }).getByRole("button", { name: /copy for applications/i }).click();
  const dialog = page.getByRole("dialog", { name: /copy for applications/i });
  await dialog.getByRole("button", { name: /copy job title/i }).first().click();

  await expect(page.locator("html")).toHaveAttribute("data-fallback-copy", "Product Operations Manager");
  await expect(page.getByText("Copied job title")).toBeVisible();
});

test("suggests a recognizable filename when exporting a PDF", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.printTitle = document.title;
      window.dispatchEvent(new Event("afterprint"));
    };
  });

  await exportPdf(page);
  await expect(page.locator("html")).toHaveAttribute("data-print-title", "John_Doe_Resume");
  await expect(page).toHaveTitle("PrivaCV: Free Private Resume Editor — No Sign-Up");
});

test("makes validated contact details actionable in the preview", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  // Contact details are actionable links when inline editing is off (and in the
  // exported PDF); inline editing turns them into editable spans instead.
  await page.getByRole("button", { name: /editing mode/i }).click();

  const preview = page.locator(".resume-sheet");
  await expect(preview.getByRole("link", { name: "john.doe@example.com" })).toHaveAttribute("href", "mailto:john.doe@example.com");
  await expect(preview.getByRole("link", { name: "(555) 014-7823" })).toHaveAttribute("href", "tel:(555) 014-7823");
  await expect(preview.getByRole("link", { name: "linkedin.com/in/johndoe" })).toHaveAttribute("href", "https://linkedin.com/in/johndoe");
  expect(
    await preview.locator(".resume-contact > *").first().evaluate(
      (element) => getComputedStyle(element, "::after").content.includes("•"),
    ),
  ).toBeTruthy();
});

test("routes the browser print shortcut through the export review", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /start a blank resume/i }).click();
  await page.getByRole("menuitem", { name: /classic/i }).click();
  await page.getByLabel("Full Name").fill("Ada Lovelace");
  await expect(page.getByRole("button", { name: "Export", exact: true })).not.toContainText(/Cmd|Ctrl/);

  await page.keyboard.press(process.platform === "darwin" ? "Meta+P" : "Control+P");

  const exportCheck = page.getByRole("dialog", { name: /review before exporting/i });
  await expect(exportCheck).toBeVisible();
  await expect(exportCheck).toContainText("Missing email, phone, location");
  await expect(page).not.toHaveURL(/print/);
});

test("connects editor focus with the preview and supports custom sections", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const experienceTitle = page.getByLabel("Experience section title");
  await experienceTitle.fill("Selected Experience");
  await experienceTitle.focus();
  await expect(page.locator(".resume-preview-active")).toHaveText("Selected Experience");

  const analysisToggle = page.getByRole("button", { name: "Expand Analysis tag group" });
  await expect(page.getByLabel("Add tag to Analysis")).toBeHidden();
  await analysisToggle.click();
  await page.getByLabel("Add tag to Analysis").focus();
  await expect(page.locator(".resume-sheet").getByText("Skills", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /add custom section/i }).click();
  const customTitle = page.getByLabel("New Section section title");
  await customTitle.fill("Publications");
  await page.locator('[id^="field-custom-"][id$="-0-title"]').fill("Reliable Interfaces");

  const previewEntry = page.locator(".resume-sheet").getByText("Reliable Interfaces", { exact: true });
  await expect(page.locator(".resume-sheet").getByText("Publications", { exact: true })).toBeVisible();
  // Custom-section content renders on the sheet and is inline-editable.
  await expect(previewEntry).toHaveAttribute("contenteditable", "true");

  await page.waitForTimeout(450);
  await page.reload();
  await expect(page.getByLabel("Selected Experience section title")).toHaveValue("Selected Experience");
  await expect(page.getByLabel("Publications section title")).toBeVisible();
});

test("connects grouped preview lines to their editor groups in view-only mode", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const skillsEditor = page.locator('[data-editor-section="skills"]');
  const skillsCard = skillsEditor.locator("#review-region-skills");
  const analysisRow = skillsEditor.locator('[data-editor-tag-group]').filter({ hasText: "Analysis" });
  const analysisToggle = skillsEditor.getByRole("button", { name: "Expand Analysis tag group" });
  const previewGroup = page.locator('.resume-sheet [aria-label="Edit Analysis group in Skills"]');

  // Focusing a grouped editor row highlights both that row and its containing section.
  await analysisToggle.click();
  await expect(skillsCard).toHaveClass(/ring-brand/);
  await expect(analysisRow).toHaveClass(/ring-brand/);
  await expect(previewGroup).toHaveClass(/resume-preview-active/);
  await skillsEditor.getByRole("button", { name: "Collapse Analysis tag group" }).click();
  await expect(page.getByLabel("Add tag to Analysis")).toBeHidden();

  // Every preview group remains its own target in view-only mode. Selecting one
  // expands Skills and the nested group, scrolls the editor pane to it, and
  // focuses that exact group.
  await skillsEditor.getByRole("button", { name: "Collapse Skills" }).click();
  await page.getByRole("button", { name: /editing mode — switch to view only/i }).click();
  const editorPane = page.locator("#resume-editor-pane");
  await editorPane.evaluate((element) => { element.scrollTop = 0; });
  await previewGroup.click();

  await expect(analysisRow).toBeFocused();
  await expect(skillsEditor.getByRole("button", { name: "Collapse Skills" })).toBeVisible();
  await expect(page.getByLabel("Add tag to Analysis")).toBeVisible();
  await expect.poll(async () => analysisRow.evaluate((row) => {
    const pane = document.getElementById("resume-editor-pane");
    if (!pane) return false;
    const rowBox = row.getBoundingClientRect();
    const paneBox = pane.getBoundingClientRect();
    const rowCenter = rowBox.top + rowBox.height / 2;
    return rowCenter >= paneBox.top && rowCenter <= paneBox.bottom;
  })).toBe(true);
});

test("lets each section choose an ATS-readable content format", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const skillsSection = page.locator('[data-editor-section="skills"]');
  const skillsFormatPicker = skillsSection.getByRole("group", { name: "Content format" });
  await expect(skillsFormatPicker.getByRole("button", { name: "Tags format" })).toHaveAttribute("aria-pressed", "true");
  await expect(skillsFormatPicker.getByRole("button", { name: "Entries format" })).toBeVisible();
  const addSkillsGroup = skillsSection.getByRole("button", { name: "Add group to Skills" });
  await expect(addSkillsGroup).toBeVisible();
  await expect(skillsSection.getByRole("button", { name: "Add group", exact: true })).toHaveCount(0);
  await addSkillsGroup.click();
  const newGroupLabel = skillsSection.getByLabel("Tag group label").last();
  await expect(newGroupLabel).toBeFocused();
  await newGroupLabel.pressSequentially("Platforms");
  await expect(newGroupLabel).toBeFocused();
  await expect(newGroupLabel).toHaveValue("Platforms");
  await expect(skillsSection.getByLabel("Add tag to Platforms")).toBeVisible();
  await skillsFormatPicker.getByRole("button", { name: "Entries format" }).click();
  await skillsSection.locator("#add-skills-entry").click();
  await page.locator("#field-skills-0-title").fill("Cloud platforms");
  await page.locator("#field-skills-0-subtitle").fill("AWS and Azure");
  await expect(page.locator(".resume-sheet").getByText("Cloud platforms", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /add custom section/i }).click();
  await page.getByLabel("New Section section title").fill("Certifications");
  const customSection = page.locator('[data-editor-section^="custom-"]').last();
  const formatPicker = customSection.getByRole("group", { name: "Content format" });
  await formatPicker.getByRole("button", { name: "Text format" }).click();
  const certificationBody = customSection.getByRole("textbox", { name: "Certifications content" });
  await setRichText(certificationBody, "AWS Certified Developer\nCertified Kubernetes Administrator", "bullet");
  await expect(customSection.getByRole("button", { name: "Open local AI text editor" })).toBeVisible();

  const preview = page.locator(".resume-sheet");
  await expect(preview.getByText("Certifications", { exact: true })).toBeVisible();
  await expect(preview.getByRole("list").filter({ hasText: "AWS Certified Developer" })).toContainText("Certified Kubernetes Administrator");

  await customSection.getByRole("button", { name: "Open local AI text editor" }).click();
  await expect(customSection.getByLabel(/Edit Certifications .* with local AI/i)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(customSection.getByRole("button", { name: "Open local AI text editor" })).toHaveCount(0);
  await expect(customSection.getByLabel(/Edit Certifications .* with local AI/i)).toHaveCount(0);
});

test("edits resume text inline on the sheet and toggles the mode", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  // Inline editing is on by default: the name is directly editable on the sheet.
  const name = page.locator(".resume-name");
  await expect(name).toHaveAttribute("contenteditable", "true");
  await expect(name).toHaveJSProperty("spellcheck", true);
  await expect(page.locator(".resume-entry .resume-entry-body").first()).toHaveJSProperty("spellcheck", true);
  // Structured contact values should not be treated as ordinary prose.
  await expect(page.locator(".resume-contact [contenteditable]").first()).toHaveJSProperty("spellcheck", false);
  await name.selectText();
  await page.keyboard.type("Ada Lovelace");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Full Name")).toHaveValue("Ada Lovelace");

  // A bullet edits in place and syncs back to the entry details field.
  const firstEntryBody = page.locator(".resume-entry .resume-entry-body").first();
  const firstBullet = firstEntryBody.locator("li").first();
  await firstEntryBody.focus();
  await firstBullet.selectText();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString() ?? "")).toContain("Rebuilt intake and prioritization");
  await page.keyboard.insertText("Rewrote the deploy pipeline, cutting release time in half.");
  await page.locator(".resume-name").click();
  await expect(page.locator("#field-experience-0-details")).toContainText("Rewrote the deploy pipeline");

  // Grouped skills are editable directly on the sheet as a category and a
  // separator-delimited tag list, with changes synced to the structured editor.
  await page.getByRole("button", { name: "Expand Analysis tag group" }).click();
  const previewSkillGroup = page.locator('[data-preview-tag-group="skills-group-1"]');
  const previewSkillLabel = previewSkillGroup.locator("[data-preview-tag-group-label]");
  await expect(previewSkillLabel).toHaveAttribute("contenteditable", "true");
  await previewSkillLabel.selectText();
  await page.keyboard.type("Insights");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Tag group label").first()).toHaveValue("Insights");

  const previewSkillTags = previewSkillGroup.locator("[data-preview-tag-group-tags]");
  await expect(previewSkillTags).toHaveAttribute("contenteditable", "true");
  await previewSkillTags.selectText();
  await page.keyboard.type("SQL · Excel · Power BI");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Remove Power BI" })).toBeVisible();

  // Collapsing the editor gives a focused full-width canvas.
  await page.getByRole("button", { name: /hide editor/i }).click();
  await expect(page.getByLabel("Full Name")).toBeHidden();
  await page.getByRole("button", { name: /show editor/i }).click();
  await expect(page.getByLabel("Full Name")).toBeVisible();

  // Turning inline editing off restores plain (non-editable) preview text.
  await page.getByRole("button", { name: /editing mode/i }).click();
  await expect(page.getByRole("button", { name: /view only mode/i })).toBeVisible();
  await expect(page.locator(".resume-name")).not.toHaveAttribute("contenteditable", "true");
});

test("collapses editor sections to shorten a long resume", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  // A single group collapses and expands from its chevron.
  const header = page.locator('[data-field-group="header"]');
  await expect(page.getByLabel("Full Name")).toBeVisible();
  await header.getByRole("button", { name: /collapse section/i }).click();
  await expect(page.getByLabel("Full Name")).toBeHidden();
  await header.getByRole("button", { name: /expand section/i }).click();
  await expect(page.getByLabel("Full Name")).toBeVisible();

  // Reorder controls and editing now share one section card: its title remains
  // available while the full-width editor body is collapsed.
  const experience = page.locator('[data-editor-section="experience"]');
  await experience.getByRole("button", { name: "Collapse Experience" }).click();
  await expect(experience.getByLabel("Experience section title")).toBeVisible();
  await expect(experience.getByLabel("Job Title").first()).toBeHidden();
  await page.getByRole("navigation", { name: /jump to a resume section/i }).getByRole("button", { name: "Experience", exact: true }).click();
  await expect(experience.getByLabel("Job Title").first()).toBeVisible();
  await expect(page.getByText("Manage sections", { exact: true })).toBeHidden();

  // Collapse all / expand all toggles every group at once.
  await page.getByRole("button", { name: /collapse all/i }).click();
  await expect(page.getByLabel("Full Name")).toBeHidden();
  await expect(summaryEditor(page)).toBeHidden();
  await page.getByRole("button", { name: /expand all/i }).click();
  await expect(page.getByLabel("Full Name")).toBeVisible();
});

test("collapses an expanded resume entry even when one of its fields was active", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const entry = page.locator('[data-editor-section="experience"] [data-editor-entry]').first();
  const toggle = entry.locator("[data-entry-toggle]");
  await entry.getByLabel("Job Title").focus();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(entry.getByLabel("Job Title")).toBeHidden();
});

test("keeps light scroll surfaces and the tools panel visually connected", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("privacv-theme", "light");
  });
  await page.reload();
  await page.getByRole("button", { name: /start a blank resume/i }).click();
  await page.getByRole("menuitem", { name: /classic/i }).click();

  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe("light");
  const inputColors = await page.getByLabel("Full Name").evaluate((element) => ({
    text: getComputedStyle(element).color,
    placeholder: getComputedStyle(element, "::placeholder").color,
  }));
  expect(inputColors.placeholder).not.toBe(inputColors.text);
  expect(await page.locator("[data-brand-surface]").evaluate((element) => getComputedStyle(element).fill)).toBe("rgb(241, 245, 249)");
  expect(await page.locator("[data-brand-document]").evaluate((element) => getComputedStyle(element).fill)).toBe("rgb(15, 23, 42)");

  const toolsToggle = page.locator('button[aria-controls="tools-panel"]');
  const toolsPanel = page.getByRole("dialog", { name: /^tools$/i });
  await toolsToggle.click();
  await expect(toolsToggle).toHaveAttribute("aria-expanded", "true");
  await expect(toolsPanel).toBeVisible();
  await expect.poll(async () => page.evaluate(() => {
    const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
    const panelTop = document.getElementById("tools-panel")?.getBoundingClientRect().top ?? 0;
    return Math.abs(panelTop - headerBottom);
  })).toBeLessThanOrEqual(1);

  await toolsToggle.click();
  await expect(toolsToggle).toHaveAttribute("aria-expanded", "false");
  await expect(toolsPanel).toBeHidden();

  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: /use dark mode/i }).click();
  expect(await page.getByRole("button", { name: "Export", exact: true }).evaluate((element) => getComputedStyle(element).color)).toBe("rgb(255, 255, 255)");
  expect(await page.locator("[data-brand-surface]").evaluate((element) => getComputedStyle(element).fill)).toBe("rgb(21, 27, 39)");
  expect(await page.locator("[data-brand-document]").evaluate((element) => getComputedStyle(element).fill)).toBe("rgb(248, 250, 252)");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe("dark");
});

test("resizes the editor and preview with the middle divider", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const editorPane = page.locator("#resume-editor-pane");
  const divider = page.getByRole("separator", { name: /resize editor and preview/i });
  await expect(divider).toBeVisible();
  const before = await editorPane.boundingBox();
  await divider.focus();
  await page.keyboard.press("ArrowRight");
  const after = await editorPane.boundingBox();
  expect(after!.width).toBeGreaterThan(before!.width);
});

test("adapts editor cards when the divider narrows the pane", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await openMenu(page);
  await page.getByRole("menuitem", { name: "Clear resume" }).click();
  const clearDialog = page.getByRole("dialog", { name: /clear this resume/i });
  await clearDialog.getByRole("button", { name: /clear resume/i }).click();

  const editorPane = page.locator("#resume-editor-pane");
  const startPaths = page.locator("[data-start-primary-paths]");
  const recoveryHeader = page.locator("[data-recovery-header]");
  const columnCount = () => startPaths.evaluate((element) => (
    getComputedStyle(element).gridTemplateColumns.split(" ").length
  ));

  await expect.poll(columnCount).toBe(2);

  const divider = page.getByRole("separator", { name: /resize editor and preview/i });
  await divider.focus();
  for (let step = 0; step < 10; step += 1) await page.keyboard.press("ArrowLeft");

  await expect.poll(columnCount).toBe(1);
  await expect(recoveryHeader).toHaveCSS("flex-direction", "column");
  await expect.poll(() => editorPane.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test("keeps preview scaling stable at the vertical scrollbar threshold", async ({ page }) => {
  await page.setViewportSize({ width: 1240, height: 885 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const widths = await page.locator(".resume-sheet").evaluate(async (sheet) => {
    const samples: number[] = [];
    for (let frame = 0; frame < 30; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      samples.push(sheet.getBoundingClientRect().width);
    }
    return samples;
  });

  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
});

test("expands a collapsed section when a jump targets a field inside it", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await page.getByLabel("Email").fill("not-an-email");

  // Collapse everything, then jump from the guided Resume Review.
  await page.getByRole("button", { name: /collapse all/i }).click();
  const review = await openResumeReview(page);
  await advanceReviewTo(review, "Contact");
  await review.getByRole("button", { name: /fix contact/i }).click();

  // The containing group re-expands and its field is focused.
  await expect
    .poll(() => page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return Boolean(el?.id === "field-email" && el.offsetParent !== null);
    }))
    .toBe(true);
});

test("keeps accidental entry and custom-section removal reversible", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const experience = page.locator('[data-editor-section="experience"]');
  await experience.getByRole("button", { name: /remove entry/i }).first().click();
  await expect(page.locator('[role="status"]').filter({ hasText: "Removed Experience entry" })).toBeVisible();
  await expect(experience.getByLabel("Job Title").first()).toHaveValue("Business Operations Analyst");
  await expect.poll(() => page.evaluate(() => {
    const history = JSON.parse(localStorage.getItem("resume-editor-version-history-v1") ?? "[]");
    const checkpoint = history.find((item: { id?: string }) => item.id?.startsWith("auto-checkpoint-"));
    return {
      title: checkpoint?.state?.experience?.[0]?.title,
      note: checkpoint?.note,
    };
  })).toEqual({
    title: "Product Operations Manager",
    note: "Saved automatically before removing an entry from Experience.",
  });
  await page.getByRole("button", { name: /^undo$/i }).click();
  await expect(experience.getByLabel("Job Title").first()).toHaveValue("Product Operations Manager");

  await page.getByRole("button", { name: /add custom section/i }).click();
  const sectionTitle = page.getByLabel("New Section section title");
  await sectionTitle.fill("Publications");
  await removeSection(page, "Publications");
  await expect(sectionTitle).toBeHidden();
  await expect(page.locator('[role="status"]').filter({ hasText: "Removed Publications section" })).toBeVisible();
  await page.getByRole("button", { name: /^undo$/i }).click();
  await expect(page.getByLabel("Publications section title")).toBeVisible();
});

test("adds a common section with its useful heading already in place", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await page.getByRole("button", { name: /licenses & certifications/i }).click();

  await expect(page.getByLabel("Licenses & Certifications section title")).toHaveValue("Licenses & Certifications");
  await expect(page.getByLabel("License / certification", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Issuing organization", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Earned / expiration dates", { exact: true })).toBeVisible();
  await expect(page.locator(".resume-sheet").getByText("Licenses & Certifications", { exact: true })).toBeHidden();
  await page.getByLabel("License / certification", { exact: true }).fill("AWS Certified Developer – Associate");
  await expect(page.locator(".resume-sheet").getByText("Licenses & Certifications", { exact: true })).toBeVisible();
});

test("starts relevant coursework as grouped tags and languages with proficiency fields", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await page.getByRole("button", { name: /relevant coursework/i }).click();
  await expect(page.getByLabel("Tags format").last()).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Tag group label").last()).toBeVisible();
  await expect(page.getByLabel("Add tag to group")).toBeVisible();

  await page.getByRole("button", { name: /^languages$/i }).click();
  await expect(page.getByLabel("Language", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Proficiency", { exact: true })).toBeVisible();
});

test("lets each structured entry mix paragraphs and bullets", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await expandAllEntries(page);

  const educationEntry = page.locator('[data-editor-section="education"] [data-editor-entry]').first();
  const detailsEditor = educationEntry.getByRole("textbox", { name: "Honors / relevant coursework / details (one per line, optional)" });
  await setRichTextBlocks(detailsEditor, [
    { type: "paragraph", text: "Relevant coursework included:" },
    { type: "bullet", text: "Econometrics and forecasting" },
    { type: "bullet", text: "Experimental design" },
  ]);

  const previewEntry = page.locator('[data-resume-entry-section="education"][data-resume-entry-index="0"]');
  await expect(previewEntry.locator(".resume-entry-body p")).toHaveText("Relevant coursework included:");
  await expect(previewEntry.locator(".resume-entry-body li")).toHaveCount(2);

  await expect.poll(() => page.evaluate(() => localStorage.getItem("resume-editor-data-v2"))).toContain("<p>Relevant coursework included:</p><ul>");
  await page.reload();
  await expandAllEntries(page);
  const restoredEntry = page.locator('[data-resume-entry-section="education"][data-resume-entry-index="0"]');
  await expect(restoredEntry.locator(".resume-entry-body p")).toHaveText("Relevant coursework included:");
  await expect(restoredEntry.locator(".resume-entry-body li")).toHaveCount(2);
});

test("reorders resume sections by dragging their handles", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  // Compact the unified cards so both source and destination stay in view
  // during the pointer gesture.
  await page.getByRole("button", { name: /collapse all/i }).click();
  await page.locator('[data-arrange-section="skills"] [draggable="true"]').dragTo(page.locator('[data-arrange-section="education"]'));

  const headings = page.locator(".resume-sheet .resume-section-title");
  await expect(headings.nth(0)).toHaveText("Skills");
  await expect(headings.nth(1)).toHaveText("Education");

  const rowPositions = await page.locator("[data-arrange-section]").evaluateAll((rows) =>
    rows.map((row) => Math.round(row.getBoundingClientRect().top)),
  );
  expect(rowPositions).toEqual([...rowPositions].sort((first, second) => first - second));
});

test("navigates to any resume field with Cmd or Ctrl K", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const experience = page.locator('[data-editor-section="experience"]');
  await experience.locator('#field-experience-0-title').focus();
  await page.keyboard.press("Alt+Shift+N");
  await expect(experience.locator("[data-editor-entry]")).toHaveCount(3);

  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  const dialog = page.getByRole("dialog", { name: /navigate resume/i });
  await expect(dialog).toBeVisible();
  const search = dialog.getByLabel("Search resume fields");
  await expect(search).toBeFocused();
  await expect(dialog).toHaveCSS("z-index", "80");
  await expect(page.locator("[data-dialog-overlay]")).toHaveCSS("z-index", "70");
  await search.fill("Business Operations Analyst company");
  await dialog.getByRole("option", { name: /Company Experience · Business Operations Analyst/i }).click();
  await expect(experience.locator('#field-experience-1-subtitle')).toBeFocused();

  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  await expect(dialog).toBeVisible();
  await expect(search).toBeFocused();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  await expect(dialog).toBeHidden();

  const navigate = page.getByRole("button", { name: /^navigate$/i });
  const editorUtilities = navigate.locator("..");
  await expect(editorUtilities.getByRole("button", { name: /collapse all/i })).toBeVisible();
  await expect(editorUtilities.getByRole("button", { name: /^clear$/i })).toBeVisible();
  await navigate.click();
  await expect(dialog).toContainText("Cmd / Ctrl + K");
  await expect(dialog).toContainText("Cmd / Ctrl + P");
  await expect(dialog).not.toContainText("Alt + Shift");
});

test("makes the active section drag and destination visible", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const source = page.locator('[data-arrange-section="skills"] [draggable="true"]');
  const sourceRow = page.locator('[data-arrange-section="skills"]');
  const targetRow = page.locator('[data-arrange-section="education"]');
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());

  await source.dispatchEvent("dragstart", { dataTransfer });
  await expect(sourceRow).toHaveAttribute("data-dragging", "true");
  await targetRow.dispatchEvent("dragenter", { dataTransfer });
  await expect(targetRow).toHaveAttribute("data-drop-target", "true");
  await source.dispatchEvent("dragend", { dataTransfer });
  await expect(sourceRow).not.toHaveAttribute("data-dragging", "true");
});

test("makes the active subsection drag and destination visible", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const entries = page.locator('[data-editor-section="experience"] [data-editor-entry]');
  const sourceRow = entries.nth(0);
  const targetRow = entries.nth(1);
  const sourceHandle = sourceRow.locator('[draggable="true"]');
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());

  await sourceHandle.dispatchEvent("dragstart", { dataTransfer });
  await expect(sourceRow).toHaveAttribute("data-dragging", "true");
  await targetRow.dispatchEvent("dragenter", { dataTransfer });
  await expect(targetRow).toHaveAttribute("data-drop-target", "true");
  await sourceHandle.dispatchEvent("dragend", { dataTransfer });
  await expect(sourceRow).not.toHaveAttribute("data-dragging", "true");
  await expect(targetRow).not.toHaveAttribute("data-drop-target", "true");
});

test("keeps blank titles blank and lets users remove and restore default sections", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const experienceTitle = page.getByLabel("Experience section title");
  await experienceTitle.fill("");
  await expect(page.locator("#section-title-experience")).toHaveValue("");
  await page.waitForTimeout(450);
  await page.reload();
  await expect(page.getByLabel("Untitled section title")).toHaveValue("");
  await expect(page.locator(".resume-sheet .resume-section-title").filter({ hasText: "Experience" })).toBeHidden();

  await removeSection(page, "Education");
  await expect(page.locator('[data-editor-section="education"]')).toBeHidden();
  await expect(page.getByRole("button", { name: "Education", exact: true })).toBeVisible();
  await expect(page.locator('[role="status"]').filter({ hasText: "Removed Education section" })).toBeVisible();
  await page.getByRole("button", { name: /^undo$/i }).click();
  await expandAllEntries(page);
  await expect(page.locator('[data-editor-section="education"]').getByLabel("Degree").first()).toHaveValue("B.A. in Economics");

  await removeSection(page, "Education");
  await page.getByRole("button", { name: "Education", exact: true }).click();
  await expect(page.locator('[data-editor-section="education"]').getByLabel("Degree").first()).toHaveValue("");
});

test("keeps a summary optional when the resume already has experience detail", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await setRichText(summaryEditor(page), "");

  const review = await openResumeReview(page);
  await advanceReviewTo(review, /Optional — experience leads/);
  await expect(review.getByRole("button", { name: /add optional summary/i })).toBeVisible();
  await expect(page.getByText("Missing summary")).toBeHidden();
});

test("walks resume checks with a guided highlight tour from the tools drawer", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await page.getByLabel("Phone").fill("");

  const tour = await openResumeReview(page);

  // The drawer gives way to the guided tour, highlighting one check at a time.
  await expect(page.getByRole("dialog", { name: /^tools$/i })).toBeHidden();
  await expect(tour).toBeVisible();
  await expect(tour.getByText(/Step 1 of/)).toBeVisible();

  // Step to the failing contact check and jump to the field it flags.
  for (let step = 0; step < 8; step += 1) {
    if (await tour.getByText("Contact", { exact: true }).isVisible().catch(() => false)) break;
    await tour.getByRole("button", { name: /^next/i }).click();
  }
  await expect(tour.getByText("Contact", { exact: true })).toBeVisible();
  await tour.getByRole("button", { name: /fix contact/i }).click();
  await expect(page.locator("#field-phone")).toBeFocused();
});

test("locks the editor behind a modal import review so the highlight can't scroll away", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  const experienceBullets = Array.from({ length: 12 }, (_, index) => `• Delivered measurable outcome number ${index + 1}.`).join("\n");
  await importDialog.getByLabel("Resume text").fill(
    `Ada Lovelace\nPlatform Engineer\nada@example.com | San Francisco, CA\n\nExperience\nEngineer | Analytical Engines | 2022–Present\n${experienceBullets}\n\nEducation\nB.S. Mathematics | Cambridge | 2018`,
  );
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(page);
  await page.getByRole("button", { name: /start walkthrough/i }).click();

  const tour = page.getByRole("dialog", { name: /guided review/i });
  await expect(tour).toBeVisible();
  await expect(page.locator("[data-guided-review-highlight]")).toBeVisible();
  // The modal tour dims and blocks the rest of the app.
  await expect(page.locator("[data-guided-review-backdrop]")).toBeVisible();

  // The editor pane is scroll-locked (overflow hidden) so a user can't scroll
  // the active field out of view — the ring stays put, no recovery UI needed.
  await expect(page.locator("#resume-editor-pane")).toHaveCSS("overflow-y", /hidden/);
  await expect(page.locator("[data-guided-review-highlight]")).toBeVisible();
  await expect(tour.getByText(/current field is above/i)).toBeHidden();

  // Closing the tour releases the scroll lock.
  await tour.getByRole("button", { name: "Close guided review" }).click();
  await expect(page.locator("#resume-editor-pane")).not.toHaveCSS("overflow-y", /hidden/);
});
