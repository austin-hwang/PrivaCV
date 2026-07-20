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

test("keeps the whole page from scrolling away during import review", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill(
    "Ada Lovelace\nPlatform Engineer\nada@example.com | San Francisco, CA\n\nExperience\nEngineer | Analytical Engines | 2022–Present\n• Built reliable systems.\n\nEducation\nB.S. Mathematics | Cambridge | 2018",
  );
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(page);
  await expect(page.getByText("Review the imported fields")).toBeVisible();

  // The editor pane scrolls internally; the document itself must stay pinned to
  // the viewport. A regression here let absolutely-positioned children escape
  // the pane's overflow and stretch the page into blank space.
  const pageOverflow = await page.evaluate(
    () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
  );
  expect(pageOverflow).toBeLessThanOrEqual(2);
});

test("imports a pasted resume locally and keeps confirmation deliberate without repetitive clicks", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await expect(importDialog.getByText("scanned PDF")).toBeVisible();
  await expect(importDialog.getByText("Nothing is uploaded or sent anywhere.")).toBeVisible();
  await importDialog.getByLabel("Resume text").fill(
    "Ada Lovelace\nPlatform Engineer\nada@example.com | San Francisco, CA\n\nExperience\nEngineer | Analytical Engines | 2022–Present\n• Built reliable systems.\n\nEducation",
  );
  await importDialog.getByRole("button", { name: /^import text$/i }).click();

  await expect(page.getByLabel("Full Name")).toHaveValue("Ada Lovelace");
  const banner = page.locator("#import-review-panel");
  await expect(banner.getByText("Review the imported fields")).toBeVisible();
  await expect(banner.getByRole("button", { name: /finish review/i })).toBeEnabled();

  // The review is a guided walkthrough: each suggested field is highlighted in
  // turn with its source context, and confirmation stays deliberate.
  await page.getByRole("button", { name: /start walkthrough/i }).click();
  const tour = page.getByRole("dialog", { name: /guided review/i });
  await expect(tour).toBeVisible();
  await expect(tour.getByText("Contact details")).toBeVisible();
  await expect(tour.getByText(/Step 1 of 3/)).toBeVisible();
  await expect(tour.getByText("Ada Lovelace | ada@example.com | San Francisco, CA")).toBeVisible();

  // The highlighted field remains genuinely editable: cursor keys must not
  // advance the tour while someone is correcting imported text.
  await page.getByLabel("Full Name").focus();
  await page.keyboard.press("ArrowRight");
  await expect(tour.getByText(/Step 1 of 3/)).toBeVisible();

  await tour.getByRole("button", { name: /confirm this field/i }).click();
  await expect(tour.getByRole("button", { name: /^confirmed$/i })).toBeVisible();
  await tour.getByRole("button", { name: /^next/i }).click();

  await expect(tour.getByText("Experience entry 1")).toBeVisible();
  await expect(page.getByLabel("Job Title").first()).toBeVisible();
  await tour.getByRole("button", { name: /confirm this field/i }).click();
  await tour.getByRole("button", { name: /^next/i }).click();

  // The Education heading was found in the source but produced no entries.
  await expect(tour.getByText("Possible skipped section")).toBeVisible();
  const finish = tour.getByRole("button", { name: /finish review/i });
  await expect(finish).toBeEnabled();
  await finish.click();

  await expect(page.getByRole("dialog", { name: /guided review/i })).toBeHidden();
  await expect(page.getByText("Review the imported fields")).toBeHidden();
});

test("automatically checkpoints the current draft before a pasted import replaces it", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await page.getByLabel("Full Name").fill("Existing Draft");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("resume-editor-data-v2"))).toContain("Existing Draft");

  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill(
    "Ada Lovelace\nPlatform Engineer\nada@example.com\n\nExperience\nEngineer | Analytical Engines | 2022–Present\n• Built reliable systems.",
  );
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expect(page.getByLabel("Full Name")).toHaveValue("Ada Lovelace");

  await expect.poll(() => page.evaluate(() => {
    const history = JSON.parse(localStorage.getItem("resume-editor-version-history-v1") ?? "[]");
    const checkpoint = history.find((item: { id?: string }) => item.id?.startsWith("autosave-slot-"));
    return {
      name: checkpoint?.state?.name,
      note: checkpoint?.note,
    };
  })).toEqual({
    name: "Existing Draft",
    note: "Preserved automatically before loading pasted resume text.",
  });
});

test("keeps an unfinished import review after a browser refresh", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill(
    "Ada Lovelace\nPlatform Engineer\nada@example.com | San Francisco, CA\n\nExperience\nEngineer | Analytical Engines | 2022–Present\n• Built reliable systems.",
  );
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(page);
  await expect(page.locator("#import-review-panel")).toBeVisible();

  await expect.poll(async () => page.evaluate(() => localStorage.getItem("resume-editor-data-v2"))).toContain("Ada Lovelace");
  const storedReview = await page.evaluate(() => localStorage.getItem("resume-editor-import-review-v1"));
  expect(storedReview).toContain('"items"');
  expect(storedReview).toContain('"sourceText"');

  await page.reload();

  const banner = page.locator("#import-review-panel");
  await expect(page.getByLabel("Full Name")).toHaveValue("Ada Lovelace");
  await expect(banner.getByText("Review the imported fields")).toBeVisible();
  await expect(banner.getByText("0/2")).toBeVisible();
  await exportPdf(page);
  await expect(page.getByRole("dialog", { name: /review before exporting/i })).toContainText("Imported fields still need review");
});

test("lets someone finish review of a clean imported draft without repetitive clicks", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill(
    "Ada Lovelace\nada@example.com\n\nExperience\nPlatform Engineer | Analytical Engines | 2022–Present\n• Built reliable systems.",
  );
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(page);

  const banner = page.locator("#import-review-panel");
  await banner.getByRole("button", { name: /finish review/i }).click();
  await expect(banner).toBeHidden();
  await expect(page.getByText("Import review complete")).toBeVisible();
});

test("imports common alternate section headings without losing resume content", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill([
    "Ada Lovelace",
    "ada@example.com",
    "",
    "Career Profile",
    "Platform engineer building dependable developer tools.",
    "",
    "Relevant Experience",
    "Staff Engineer | Analytical Engines | 2022–Present",
    "• Built reliable systems.",
    "",
    "Key Skills",
    "TypeScript, React, systems design",
  ].join("\n"));
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(page);
  await expandAllTagGroups(page);

  await expect(summaryEditor(page)).toHaveText("Platform engineer building dependable developer tools.");
  await expect(page.getByLabel("Job Title", { exact: true }).first()).toHaveValue("Staff Engineer");
  await expect(page.getByRole("button", { name: "Remove TypeScript" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove React" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove systems design" })).toBeVisible();
  await expect(page.getByText("Review the imported fields")).toBeVisible();
});

test("imports styled PDF-style section headings without losing their content", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill([
    "Ada Lovelace",
    "ada@example.com",
    "",
    "— CAREER HIGHLIGHTS —",
    "Platform engineer building dependable developer tools.",
    "",
    "• PROFESSIONAL ROLES •",
    "Staff Engineer | Analytical Engines | 2022–Present",
    "• Built reliable systems.",
    "",
    "| TECHNICAL EXPERTISE |",
    "TypeScript, React, systems design",
  ].join("\n"));
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(page);
  await expandAllTagGroups(page);

  await expect(summaryEditor(page)).toHaveText("Platform engineer building dependable developer tools.");
  await expect(page.getByLabel("Job Title", { exact: true }).first()).toHaveValue("Staff Engineer");
  await expect(page.getByRole("button", { name: "Remove TypeScript" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove React" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove systems design" })).toBeVisible();
  await expect(page.getByText("Review the imported fields")).toBeVisible();
});

test("imports concise overview and skills headings without losing their content", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill([
    "Ada Lovelace",
    "ada@example.com",
    "",
    "Professional Overview",
    "Platform engineer building dependable developer tools.",
    "",
    "Skills & Tools",
    "TypeScript, React, systems design",
  ].join("\n"));
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(page);
  await expandAllTagGroups(page);

  await expect(summaryEditor(page)).toHaveText("Platform engineer building dependable developer tools.");
  await expect(page.getByRole("button", { name: "Remove TypeScript" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove React" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove systems design" })).toBeVisible();
  await expect(page.getByText("Review the imported fields")).toBeVisible();
});

test("keeps an employer-first dated PDF header editable as the right role and employer", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill([
    "Ada Lovelace",
    "",
    "Experience",
    "Northstar Labs | Seattle, WA",
    "Senior Product Engineer | Feb 2022 – Present",
    "• Led dependable platform work.",
  ].join("\n"));
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(page);

  await expect(page.getByLabel("Job Title", { exact: true }).first()).toHaveValue("Senior Product Engineer");
  await expect(page.getByLabel("Company", { exact: true }).first()).toHaveValue("Northstar Labs");
  await expect(page.getByLabel("Dates (e.g. Jan 2020 - Present)", { exact: true }).first())
    .toHaveValue("Feb 2022 – Present");
  await expect(page.getByLabel("Responsibilities / achievements (one bullet per line)", { exact: true }).first())
    .toHaveText("Led dependable platform work.");
});

test("requires review of imported specialty-section entries", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill([
    "Ada Lovelace",
    "ada@example.com",
    "",
    "Certifications",
    "Certified Kubernetes Administrator | Cloud Native Computing Foundation | 2026",
  ].join("\n"));
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(page);

  await expect(page.getByLabel("License / certification", { exact: true })).toHaveValue("Certified Kubernetes Administrator");

  // The specialty entry is surfaced as a confirmable step in the walkthrough.
  await page.getByRole("button", { name: /start walkthrough/i }).click();
  const tour = page.getByRole("dialog", { name: /guided review/i });
  for (let step = 0; step < 8; step += 1) {
    if (await tour.getByText("Certifications entry 1").isVisible().catch(() => false)) break;
    await tour.getByRole("button", { name: /^next/i }).click();
  }
  await expect(tour.getByText("Certifications entry 1")).toBeVisible();
  await expectGuidedHighlightToFrame(
    page,
    page.locator('[data-editor-section^="custom-"] [data-review-region]').first(),
  );
  await tour.getByRole("button", { name: /confirm this field/i }).click();
  await expect(tour.getByRole("button", { name: /^confirmed$/i })).toBeVisible();
});

test("highlights grouped Skills during the import review tour", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill([
    "Ada Lovelace",
    "ada@example.com",
    "",
    "Skills",
    "TypeScript, SQL, systems design",
  ].join("\n"));
  await importDialog.getByRole("button", { name: /^import text$/i }).click();

  await page.getByRole("button", { name: /start walkthrough/i }).click();
  const tour = page.getByRole("dialog", { name: /guided review/i });
  await expect(tour.getByText("Contact details")).toBeVisible();
  await tour.getByRole("button", { name: /^next/i }).click();

  await expect(tour.getByText("Skills", { exact: true })).toBeVisible();
  await expectGuidedHighlightToFrame(page, page.locator("#review-region-skills"));
});

test("preserves text written beside an inline resume heading", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill([
    "Ada Lovelace",
    "ada@example.com",
    "",
    "Professional Summary: Platform engineer building dependable developer tools.",
    "Skills: TypeScript, React, systems design",
    "Experience: Staff Engineer | Analytical Engines | 2022–Present",
    "• Built reliable systems.",
  ].join("\n"));
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(page);
  await expandAllTagGroups(page);

  await expect(summaryEditor(page)).toHaveText("Platform engineer building dependable developer tools.");
  await expect(page.getByRole("button", { name: "Remove TypeScript" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove React" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove systems design" })).toBeVisible();
  await expect(page.getByLabel("Job Title", { exact: true }).first()).toHaveValue("Staff Engineer");
  await expect(page.getByText("Review the imported fields")).toBeVisible();
});

test("parses company-first imported experience entries and keeps the swap control available", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill([
    "Ada Lovelace",
    "ada@example.com",
    "",
    "Experience",
    "Analytical Engines | Staff Engineer | 2022–Present",
    "• Built reliable systems.",
  ].join("\n"));
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(page);

  const title = page.getByLabel("Job Title", { exact: true }).first();
  const company = page.getByLabel("Company", { exact: true }).first();
  await expect(title).toHaveValue("Staff Engineer");
  await expect(company).toHaveValue("Analytical Engines");
  await page.getByRole("button", { name: /switch role and employer/i }).click();
  await expect(title).toHaveValue("Analytical Engines");
  await expect(company).toHaveValue("Staff Engineer");
});

test("asks users to review every imported experience entry", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill([
    "Ada Lovelace",
    "Platform Engineer",
    "ada@example.com | San Francisco, CA",
    "",
    "Experience",
    "Staff Engineer | Analytical Engines | 2022–Present",
    "• Built reliable systems.",
    "",
    "Software Engineer | Example Co. | 2018–2022",
    "• Improved deployment tooling.",
  ].join("\n"));
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(page);

  // Both roles are parsed as separate entries, each surfaced for review.
  await expect(page.getByLabel("Job Title", { exact: true }).nth(0)).toHaveValue("Staff Engineer");
  await expect(page.getByLabel("Job Title", { exact: true }).nth(1)).toHaveValue("Software Engineer");
  await expect(page.locator("#field-experience-1-title")).toBeVisible();
});

test("keeps adjacent roles separate when dates are on their own lines", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill([
    "Ada Lovelace",
    "ada@example.com",
    "",
    "Experience",
    "Staff Engineer",
    "Analytical Engines",
    "Jan 2022 – Present",
    "• Built reliable systems.",
    "Software Engineer",
    "Example Company",
    "Jun 2018 – Dec 2021",
    "• Improved deployment tooling.",
  ].join("\n"));
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(page);

  await expect(page.getByLabel("Job Title", { exact: true }).nth(0)).toHaveValue("Staff Engineer");
  await expect(page.getByLabel("Job Title", { exact: true }).nth(1)).toHaveValue("Software Engineer");
});

test("keeps compact education entries separate when dates are on their own lines", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill([
    "Ada Lovelace",
    "ada@example.com",
    "",
    "Education",
    "Master of Science in Computer Science",
    "University of Example",
    "2016 – 2018",
    "Bachelor of Science in Mathematics",
    "Example College",
    "2012 – 2016",
  ].join("\n"));
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(page);

  await expect(page.getByLabel("Degree", { exact: true }).nth(0)).toHaveValue("Master of Science in Computer Science");
  await expect(page.getByLabel("Degree", { exact: true }).nth(1)).toHaveValue("Bachelor of Science in Mathematics");
});

test("keeps mobile import review focused on the next editable field", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill(
    "Ada Lovelace\nPlatform Engineer\nada@example.com | San Francisco, CA\n\nExperience\nEngineer | Analytical Engines | 2022–Present\n• Built reliable systems.",
  );
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(page);

  // On a phone the review is the same guided walkthrough, with the card pinned
  // to the bottom so it never crowds the highlighted field.
  await expect(page.getByText("Review the imported fields")).toBeVisible();
  await page.getByRole("button", { name: /start walkthrough/i }).click();
  const tour = page.getByRole("dialog", { name: /guided review/i });
  await expect(tour).toBeVisible();
  await expect(tour.getByText("Contact details")).toBeVisible();
  await tour.getByRole("button", { name: /confirm this field/i }).click();
  await tour.getByRole("button", { name: /^next/i }).click();
  await expect(tour.getByText("Experience entry 1")).toBeVisible();

  await tour.getByRole("button", { name: /close guided review/i }).click();
  await expect(page.getByRole("dialog", { name: /guided review/i })).toBeHidden();
  await expect(page.getByText("Review the imported fields")).toBeVisible();

  await context.close();
});

test("calls out a specialty heading when import cannot reconstruct its entries", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill([
    "Ada Lovelace",
    "ada@example.com",
    "",
    "Experience",
    "Engineer | Analytical Engines | 2022–Present",
    "• Built reliable systems.",
    "",
    "Certifications",
  ].join("\n"));
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(page);

  // The banner flags that a found source section was not imported.
  await expect(page.locator("#import-review-panel")).toContainText(/not imported/i);

  await page.getByRole("button", { name: /start walkthrough/i }).click();
  const tour = page.getByRole("dialog", { name: /guided review/i });
  for (let step = 0; step < 6; step += 1) {
    if (await tour.getByText("Possible skipped section").isVisible().catch(() => false)) break;
    await tour.getByRole("button", { name: /^next/i }).click();
  }
  await expect(tour.getByText("Possible skipped section")).toBeVisible();
  await expect(tour).toContainText(/Certifications/i);
  await tour.getByRole("button", { name: /go to this section/i }).click();
  await expect(page.locator("#add-custom-section")).toBeFocused();
});

test("switches between focused editor and preview views on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const editorPane = page.locator("#resume-editor-pane");
  const previewPane = page.locator("#resume-preview-pane");
  await expect(editorPane).toBeVisible();
  await expect(previewPane).toBeHidden();
  await page.getByLabel("Phone").fill("");

  await page.getByRole("button", { name: /^preview$/i }).click();
  await expect(previewPane).toBeVisible();
  await expect(editorPane).toBeHidden();
  await expect(previewPane.getByText("1 page in preview", { exact: true })).toBeVisible();

  await exportPdf(page);
  await page.getByRole("dialog", { name: /review before exporting/i }).getByRole("button", { name: /fix contact/i }).click();
  await expect(editorPane).toBeVisible();
  await expect(page.locator("#field-phone")).toBeFocused();

  await page.getByRole("button", { name: /^preview$/i }).click();
  await expect(previewPane).toBeVisible();
  await page.getByRole("button", { name: /^edit resume$/i }).last().click();
  await expect(previewPane).toBeHidden();
});
