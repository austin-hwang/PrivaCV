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

test("focuses the field behind a failed resume check", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await page.getByLabel("Phone").fill("");
  const review = await openResumeReview(page);
  await advanceReviewTo(
    review,
    /Missing contact details can make a strong resume impossible to follow up on/,
  );
  await review.getByRole("button", { name: /fix contact/i }).click();

  await expect(page.locator("#field-phone")).toBeFocused();
});

test("guides users to add measurable evidence without requiring every bullet to have a number", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await setRichText(
    page.locator("#field-experience-0-details"),
    "Led a migration to improve deployment reliability.\nMentored engineers and established review standards.\nDesigned a billing service for enterprise customers.",
    "bullet",
  );
  await expect(page.getByText(/bullets? show measurable scope or results\./i)).toHaveCount(0);

  const review = await openResumeReview(page);
  await advanceReviewTo(review, /Not every bullet needs a number, but measurable scope or results/);
  await review.getByRole("button", { name: /strengthen a bullet/i }).click();
  await expect(review).toBeHidden();
  await expect(page.locator("#field-experience-0-details")).toBeFocused();
});

test("exits resume review and focuses the entry that needs a shorter bullet", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const details = page.locator("#field-experience-0-details");
  await details.fill(Array.from({ length: 31 }, (_, index) => `word${index}`).join(" "));

  const review = await openResumeReview(page);
  await advanceReviewTo(review, /Short bullets are easier to skim/);
  await review.getByRole("button", { name: /tighten bullets/i }).click();

  await expect(review).toBeHidden();
  await expect(details).toBeFocused();
});

test("keeps mobile editing focused while keeping utilities in the tools drawer", async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  // Editing stays front-and-center; review and utility tools live one tap away.
  await expect(page.getByLabel("Full Name")).toBeVisible();
  await expect(page.getByRole("button", { name: "Role focus" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Open local AI text editor" })).toHaveCount(0);

  await openTools(page);
  const tools = page.getByRole("dialog", { name: /^tools$/i });
  await expect(tools).toBeVisible();
  await expect(tools).toHaveCSS("overflow-y", "auto");
  await expect(tools.getByRole("heading", { name: "Tools" }).locator("..").locator("..")).toHaveCSS(
    "position",
    "static",
  );
  await expect(tools.getByRole("button", { name: /resume review/i })).toContainText(
    "Ready to export",
  );
  await expect(tools.getByRole("button", { name: /copy for applications/i })).toBeVisible();
  await expect(tools.getByRole("button", { name: /local ai/i })).toHaveCount(0);
  await expect(tools.getByText("Resume checks run in this browser.")).toHaveCount(0);
  await expect(tools.getByRole("button", { name: /navigate resume/i })).toBeVisible();
  await expect(tools.getByRole("link", { name: /feedback/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Role focus" })).toBeHidden();

  await page.getByRole("button", { name: /close tools/i }).click();
  await expect(tools).toBeHidden();
  await expect(page.getByLabel("Full Name")).toBeVisible();

  await openMenu(page);
  await expect(page.getByRole("menuitem", { name: /local ai/i })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: /feedback/i })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: /switch to (?:light|night) mode/i })).toHaveCount(
    0,
  );

  await context.close();
});

test("keeps the phone preview faithful to the printed Letter layout", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await page.getByRole("button", { name: /^preview$/i }).click();

  await expect(page.getByText("1 page in preview", { exact: true })).toBeVisible();
  const dimensions = await page.locator(".resume-sheet").evaluate((sheet) => ({
    layoutWidth: sheet.scrollWidth,
    renderedWidth: sheet.getBoundingClientRect().width,
    renderedHeight: sheet.getBoundingClientRect().height,
  }));

  expect(dimensions.layoutWidth).toBeGreaterThan(800);
  expect(dimensions.renderedWidth).toBeLessThan(390);
  expect(dimensions.renderedHeight / dimensions.renderedWidth).toBeCloseTo(11 / 8.5, 1);

  await context.close();
});

test("keeps the resume sheet to true Letter dimensions on screen and in print", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const screenDimensions = await page.locator(".resume-sheet").evaluate((element) => {
    const sheet = element as HTMLElement;
    return {
      width: sheet.offsetWidth,
      height: sheet.offsetHeight,
      boxSizing: getComputedStyle(sheet).boxSizing,
    };
  });
  expect(screenDimensions.boxSizing).toBe("border-box");
  expect(screenDimensions.width).toBeCloseTo(8.5 * 96, 0);
  expect(screenDimensions.height).toBeGreaterThanOrEqual(11 * 96);

  await page.emulateMedia({ media: "print" });
  const printDimensions = await page.locator(".resume-sheet").evaluate((element) => {
    const sheet = element as HTMLElement;
    const cs = getComputedStyle(sheet);
    return { width: sheet.offsetWidth, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom };
  });
  expect(printDimensions.width).toBeCloseTo(8.5 * 96, 0);
  // The @page margin now owns the top/bottom inset so every printed page keeps
  // the same margin. The sheet therefore drops its own vertical padding (and
  // its fixed 11in height) in print — otherwise page one would be
  // double-margined and short resumes would spill onto a second page.
  expect(printDimensions.paddingTop).toBe("0px");
  expect(printDimensions.paddingBottom).toBe("0px");

  // A wide screen viewport must not survive into the print tree. Browsers that
  // preserve it shrink the whole page to fit, yielding ~66% scale and large
  // side margins even though the sheet itself is correctly Letter-sized.
  const printTreeWidths = await page.locator(".resume-sheet").evaluate((element) => ({
    html: document.documentElement.getBoundingClientRect().width,
    body: document.body.getBoundingClientRect().width,
    shell: document.querySelector<HTMLElement>(".app-shell")?.getBoundingClientRect().width,
    preview: document.querySelector<HTMLElement>("#resume-preview-pane")?.getBoundingClientRect()
      .width,
    sheet: element.getBoundingClientRect().width,
  }));
  for (const width of Object.values(printTreeWidths)) {
    expect(width).toBeCloseTo(8.5 * 96, 0);
  }
});

test("downloads a full-scale vector Letter PDF independent of print settings", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const downloadPromise = page.waitForEvent("download");
  await exportPdf(page);
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("John_Doe_Resume.pdf");

  const path = await download.path();
  expect(path).toBeTruthy();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await readFile(path!)) }).promise;
  expect(doc.numPages).toBe(1);

  const pdfPage = await doc.getPage(1);
  const viewport = pdfPage.getViewport({ scale: 1 });
  expect(viewport.width).toBe(612);
  expect(viewport.height).toBe(792);

  const content = await pdfPage.getTextContent();
  const textItems = content.items.filter((item) => "str" in item && item.str.trim());
  const name = textItems.find((item) => "str" in item && item.str === "John Doe");
  const summary = textItems.find(
    (item) => "str" in item && item.str.startsWith("Product operations leader"),
  );
  expect(name && "transform" in name ? name.transform[0] : 0).toBeCloseTo(19, 1);
  expect(name && "transform" in name ? name.transform[4] : 0).toBeCloseTo(36, 1);
  expect(summary && "transform" in summary ? summary.transform[0] : 0).toBeCloseTo(9.5, 1);
  expect(summary && "transform" in summary ? summary.transform[4] : 0).toBeCloseTo(36, 1);

  const annotations = await pdfPage.getAnnotations();
  expect(annotations.some((annotation) => annotation.url === "mailto:john.doe@example.com")).toBe(
    true,
  );
  expect(
    annotations.some((annotation) => annotation.url === "https://linkedin.com/in/johndoe"),
  ).toBe(true);
});

test("never includes an open Design panel in the exported PDF", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await openDesign(page);

  const designPanel = page.locator("#design-panel");
  await expect(designPanel).toBeVisible();

  await page.emulateMedia({ media: "print" });
  await expect(designPanel).toBeHidden();
  const pdf = await page.pdf({ format: "Letter", preferCSSPageSize: true, printBackground: true });
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf) }).promise;
  const pageText = await Promise.all(
    Array.from({ length: doc.numPages }, async (_, index) => {
      const content = await (await doc.getPage(index + 1)).getTextContent();
      return content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    }),
  );
  const exportedText = pageText.join(" ");

  expect(exportedText).toContain("John Doe");
  expect(exportedText).not.toMatch(/\bACCENT COLOR\b/i);
  expect(exportedText).not.toMatch(/\bPRESET\b/);
  expect(exportedText).not.toMatch(/header,\s*density,\s*headings,\s*bullets,\s*divider/i);
});

test("shows page boundaries in the preview without printing those guides", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const details = Array.from(
    { length: 70 },
    (_, index) =>
      `• Delivered a concrete, measurable outcome for initiative ${index + 1} across a complex program.`,
  ).join("\n");
  await setRichText(
    page.locator("[data-editor-entry] [data-rich-text-editor]").first(),
    details,
    "bullet",
  );

  await expect(page.getByText("Page 2 begins")).toBeVisible();
  await expect(
    page.locator(".resume-page-guide span").filter({ hasText: "Page 2 begins" }).first(),
  ).toContainText("Next:");

  await page.emulateMedia({ media: "print" });
  await expect(page.getByText("Page 2 begins")).toBeHidden();
});

test("matches preview page count when print keeps a long role intact", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const details = Array.from(
    { length: 22 },
    (_, index) =>
      `Led initiative ${index + 1} that improved a cross-functional customer workflow through careful design, validation, and delivery across stakeholders.`,
  ).join("\n");
  await setRichText(page.locator("#field-experience-0-details"), details, "bullet");

  // Chromium moves this complete role to a fresh Letter page. The live sheet
  // should reserve that whitespace too, rather than understating the export.
  await expect(page.getByText("3 pages in preview", { exact: true })).toBeVisible();
  await expect(page.locator('[data-resume-print-section="experience"]')).toHaveClass(
    /resume-print-break-before/,
  );

  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({ format: "Letter", preferCSSPageSize: true, printBackground: true });
  expect((pdf.toString("latin1").match(/\/Type \/Page(?!s)/g) ?? []).length).toBe(3);

  // The app-owned PDF renderer must paginate to the same count as the live
  // preview even though it no longer relies on the browser print pipeline.
  await page.emulateMedia({ media: "screen" });
  const downloadPromise = page.waitForEvent("download");
  await exportPdf(page);
  const exportDialog = page.getByRole("dialog", { name: /review before exporting/i });
  if (await exportDialog.isVisible()) {
    await exportDialog.getByRole("button", { name: /export anyway/i }).click();
  }
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const generated = await pdfjs.getDocument({ data: new Uint8Array(await readFile(path!)) })
    .promise;
  expect(generated.numPages).toBe(3);
});

test("repaginates inline preview edits before the editor loses focus", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const details = Array.from(
    { length: 22 },
    (_, index) =>
      `Led initiative ${index + 1} that improved a cross-functional customer workflow through careful design, validation, and delivery across stakeholders.`,
  ).join("\n");
  await setRichText(page.locator("#field-experience-0-details"), details, "bullet");
  await expect(page.getByText("3 pages in preview", { exact: true })).toBeVisible();

  const inlineDetails = page.locator(
    '.resume-sheet [data-resume-entry-section="experience"][data-resume-entry-index="0"] .resume-entry-body[contenteditable="true"]',
  );
  await inlineDetails.focus();
  await expect(inlineDetails).toBeFocused();

  // Inline fields intentionally commit to app state on blur. Pagination still
  // needs to follow the live DOM while the user is typing so stale spacer and
  // guide elements cannot cut through the newly shortened content.
  await inlineDetails.evaluate((element) => {
    element.innerHTML = "<ul><li>Delivered one concise, measurable customer outcome.</li></ul>";
    element.dispatchEvent(
      new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }),
    );
  });

  await expect(page.getByText("1 page in preview", { exact: true })).toBeVisible();
  await expect(inlineDetails).toBeFocused();
  await expect(page.locator(".resume-page-guide")).toHaveCount(0);
  await expect(page.locator(".resume-print-break-before")).toHaveCount(0);
});

test("keeps the Skills section whole on the exported page the preview shows it on", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  // Enough role detail to push Skills onto the first-page boundary. A list
  // section has no per-entry break points, so it used to straddle the boundary
  // in the preview while the print engine split it at the page margin.
  const details = Array.from(
    { length: 14 },
    (_, index) =>
      `Led initiative ${index + 1} that improved a cross-functional customer workflow through careful design and delivery.`,
  ).join("\n");
  await setRichText(page.locator("#field-experience-0-details"), details, "bullet");

  // The preview shows the complete block on page 2. Depending on font metrics,
  // Skills may land there naturally or need a synthetic break spacer; both are
  // correct as long as the visible and exported page placement agree.
  await expect(page.getByText("2 pages in preview", { exact: true })).toBeVisible();
  const skillsSection = page.locator('[data-resume-print-section="skills"]');
  await expect
    .poll(() =>
      skillsSection.evaluate((element) => {
        const section = element as HTMLElement;
        const contentTop =
          section.offsetTop + Number.parseFloat(getComputedStyle(section).paddingTop);
        return Math.floor(contentTop / (11 * 96)) + 1;
      }),
    )
    .toBe(2);

  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({ format: "Letter", preferCSSPageSize: true, printBackground: true });

  // The exported PDF must agree: every Skills line lands together on page 2,
  // never split across the Letter boundary the preview drew.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf) }).promise;
  const markers = ["SKILLS", "SQL", "Tableau", "Airtable", "Jira", "Notion"];
  const pageText = await Promise.all(
    Array.from({ length: doc.numPages }, async (_, index) => {
      const content = await (await doc.getPage(index + 1)).getTextContent();
      // PDF text extraction can split a visually contiguous word into separate
      // glyph runs (for example, "S K ILLS"). Page placement is what matters.
      return content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join("")
        .replace(/\s+/g, "")
        .toLocaleUpperCase();
    }),
  );
  expect(doc.numPages).toBe(2);
  for (const marker of markers) {
    const normalizedMarker = marker.replace(/\s+/g, "").toLocaleUpperCase();
    expect(pageText[0]).not.toContain(normalizedMarker);
    expect(pageText[1]).toContain(normalizedMarker);
  }

  await page.emulateMedia({ media: "screen" });
  const downloadPromise = page.waitForEvent("download");
  await exportPdf(page);
  const exportDialog = page.getByRole("dialog", { name: /review before exporting/i });
  if (await exportDialog.isVisible()) {
    await exportDialog.getByRole("button", { name: /export anyway/i }).click();
  }
  const download = await downloadPromise;
  const generatedPath = await download.path();
  expect(generatedPath).toBeTruthy();
  const generated = await pdfjs.getDocument({
    data: new Uint8Array(await readFile(generatedPath!)),
  }).promise;
  expect(generated.numPages).toBe(2);
  const generatedPageText = await Promise.all(
    Array.from({ length: generated.numPages }, async (_, index) => {
      const content = await (await generated.getPage(index + 1)).getTextContent();
      return content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join("")
        .replace(/\s+/g, "")
        .toLocaleUpperCase();
    }),
  );
  for (const marker of markers) {
    const normalizedMarker = marker.replace(/\s+/g, "").toLocaleUpperCase();
    expect(generatedPageText[0]).not.toContain(normalizedMarker);
    expect(generatedPageText[1]).toContain(normalizedMarker);
  }
});

test("recomputes the preview page count when the resume shrinks", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const roleDetails = page.locator("#field-experience-0-details");
  await setRichText(
    roleDetails,
    Array.from(
      { length: 22 },
      (_, index) =>
        `Led initiative ${index + 1} that improved a cross-functional customer workflow through careful design, validation, and delivery across stakeholders.`,
    ).join("\n"),
    "bullet",
  );
  // The compact-spacing helper only appears once the preview is multi-page.
  await expect(page.getByRole("button", { name: "Try compact spacing" })).toBeVisible();

  // Crossing the responsive breakpoint replaces the preview DOM. Its size
  // observer must follow the replacement instead of retaining the detached
  // desktop sheet (which left the restored viewer blank or permanently tall).
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(page.locator("#resume-preview-pane")).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator(".resume-sheet")).toBeVisible();
  await expect
    .poll(() =>
      page.locator(".resume-sheet").evaluate((sheet) => sheet.getBoundingClientRect().width),
    )
    .toBeGreaterThan(0);

  // Shrinking the resume must drop the extra page — the sheet min-height (set
  // from the page count so full pages render) must not lock the count high.
  await setRichText(roleDetails, "Delivered one concise, measurable outcome.", "bullet");
  await expect(page.getByText("1 page in preview", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.locator(".resume-preview-sheet-frame").evaluate((frame) => {
        const sheet = frame.querySelector<HTMLElement>(".resume-sheet");
        return sheet
          ? Math.abs(frame.getBoundingClientRect().height - sheet.getBoundingClientRect().height)
          : Number.POSITIVE_INFINITY;
      }),
    )
    .toBeLessThan(1);
});

test("offers reversible page-fit adjustments without changing resume content", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const details = Array.from(
    { length: 22 },
    (_, index) =>
      `Led initiative ${index + 1} that improved a cross-functional customer workflow through careful design, validation, and delivery across stakeholders.`,
  ).join("\n");
  const roleDetails = page.locator("#field-experience-0-details");
  await setRichText(roleDetails, details, "bullet");

  await expect(page.getByRole("button", { name: "Try compact spacing" })).toBeVisible();
  await page.getByRole("button", { name: "Try compact spacing" }).click();
  await expect(page.locator(".resume-sheet")).toHaveAttribute("data-density", "compact");
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: "Applied compact spacing" }),
  ).toBeVisible();
  await expect(roleDetails).toContainText("Led initiative 1");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".resume-sheet")).toHaveAttribute("data-density", "comfortable");
  await expect(roleDetails).toContainText("Led initiative 1");

  await page.getByRole("button", { name: "Try compact spacing" }).click();
  await page.getByRole("button", { name: "Reduce text 2%" }).click();
  await expect(page.getByText("98%", { exact: true })).toBeVisible();
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: "Reduced text size to 98%" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await expect(roleDetails).toContainText("Led initiative 1");
});

test("shows an export review before downloading an unresolved resume", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await page.getByLabel("Phone").fill("");

  await exportPdf(page);
  const exportDialog = page.getByRole("dialog", { name: /review before exporting/i });
  await expect(exportDialog).toBeVisible();
  await expect(
    exportDialog.getByText(
      "Missing contact details can make a strong resume impossible to follow up on.",
    ),
  ).toBeVisible();

  await exportDialog.getByRole("button", { name: /fix contact/i }).click();
  await expect(page.locator("#field-phone")).toBeFocused();
  await expect(page.getByRole("dialog", { name: /review before exporting/i })).toBeHidden();

  await exportPdf(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /export anyway/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("John_Doe_Resume.pdf");
});

test("adds, customizes, reorders, and persists header links with contact icons", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await page.getByRole("button", { name: /editing mode/i }).click();

  const preview = page.locator(".resume-sheet");
  await expect(
    preview.getByRole("link", { name: "john.doe@example.com" }).locator(".lucide-mail"),
  ).toBeVisible();
  await expect(
    preview.getByText("Chicago, IL", { exact: true }).locator(".lucide-map-pin"),
  ).toBeVisible();
  await expect(
    preview.getByRole("link", { name: "linkedin.com/in/johndoe" }).locator(".lucide-linkedin"),
  ).toBeVisible();
  const contactGeometry = await preview.locator(".resume-contact-item").evaluateAll((items) =>
    items.map((item) => {
      const icon = item.querySelector("svg");
      const itemBox = item.getBoundingClientRect();
      const iconBox = icon?.getBoundingClientRect();
      return {
        iconCenterOffset: iconBox
          ? iconBox.top + iconBox.height / 2 - (itemBox.top + itemBox.height / 2)
          : 999,
        separatorSpace: Number.parseFloat(getComputedStyle(item).marginRight),
      };
    }),
  );
  expect(contactGeometry.every(({ iconCenterOffset }) => Math.abs(iconCenterOffset) < 2)).toBe(
    true,
  );
  expect(contactGeometry.slice(0, -1).every(({ separatorSpace }) => separatorSpace > 8)).toBe(true);

  await page.getByRole("button", { name: /add link/i }).click();
  const newLink = page.locator("[data-header-link]").last();
  await expect(newLink.locator('input[id$="-label"]')).toHaveCount(0);
  await newLink.locator('input[type="url"]').fill("github.com/johndoe");

  const github = preview.getByRole("link", { name: "github.com/johndoe" });
  await expect(github).toHaveAttribute("href", "https://github.com/johndoe");
  await expect(github.locator(".lucide-github")).toBeVisible();
  const iconButton = newLink.getByLabel(/GitHub icon/i);
  await expect(iconButton.locator(".lucide-github")).toBeVisible();
  await iconButton.click();
  const iconMenu = page.locator('[data-slot="popover-content"]');
  const iconOptions = iconMenu.getByRole("button").filter({ has: page.locator("svg") });
  await expect(iconOptions).toHaveCount(14);
  await expect(iconMenu.getByRole("button", { name: "Automatic" })).toHaveCount(0);
  await iconMenu.getByRole("button", { name: "Portfolio / work" }).click();
  await expect(github.locator(".lucide-briefcase-business")).toBeVisible();
  await newLink.getByRole("button", { name: /move github up/i }).click();
  await expect(page.locator("[data-header-link]").first().locator('input[type="url"]')).toHaveValue(
    "github.com/johndoe",
  );

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("resume-editor-data-v2")))
    .toContain('"icon":"portfolio"');
  await page.reload();
  await expect(page.getByLabel("GitHub URL")).toHaveValue("github.com/johndoe");
  await expect(page.getByLabel(/GitHub icon/i).locator(".lucide-briefcase-business")).toBeVisible();
  await expect(
    page
      .locator(".resume-sheet .resume-contact-item")
      .filter({ hasText: "github.com/johndoe" })
      .locator(".lucide-briefcase-business"),
  ).toBeVisible();
});

test("catches unusable contact details before export and uses contact-friendly inputs", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
  await expect(page.getByLabel("Phone")).toHaveAttribute("type", "tel");
  await expect(page.getByLabel("LinkedIn URL")).toHaveAttribute("type", "url");

  await page.getByLabel("Email").fill("jane-at-example");
  await exportPdf(page);

  const exportDialog = page.getByRole("dialog", { name: /review before exporting/i });
  await expect(exportDialog).toContainText("Invalid email");
  await expect(exportDialog).toContainText("Email needs an @ and domain");
  await exportDialog.getByRole("button", { name: /fix contact/i }).click();
  await expect(page.getByLabel("Email")).toBeFocused();
});

test("keeps import confirmation explicit in the export review", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog
    .getByLabel("Resume text")
    .fill(
      [
        "Ada Lovelace",
        "ada@example.com | San Francisco, CA",
        "",
        "Experience",
        "Platform Engineer | Analytical Engines | 2022–Present",
        "• Built reliable systems.",
      ].join("\n"),
    );
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(page);

  await exportPdf(page);
  const exportDialog = page.getByRole("dialog", { name: /review before exporting/i });
  await expect(exportDialog.getByText("Imported fields still need review")).toBeVisible();
  await expect(exportDialog.getByText(/0\/\d+ confirmed/)).toBeVisible();
  await expect(exportDialog.getByRole("button", { name: /review next field/i })).toBeVisible();
  await expect(exportDialog.getByRole("button", { name: /mark reviewed/i })).toHaveCount(0);

  await exportDialog.getByRole("button", { name: /review next field/i }).click();
  await expect(page.locator("#field-name")).toBeFocused();
});

test("checks an imported resume before downloading Word", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog
    .getByLabel("Resume text")
    .fill(
      [
        "Ada Lovelace",
        "Platform Engineer",
        "ada@example.com | San Francisco, CA",
        "",
        "Experience",
        "Platform Engineer | Analytical Engines | 2022–Present",
        "• Built reliable systems.",
      ].join("\n"),
    );
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expandAllEntries(page);

  await openExport(page);
  await page.getByRole("menuitem", { name: /export word/i }).click();

  const exportDialog = page.getByRole("dialog", { name: /review before downloading/i });
  await expect(exportDialog).toContainText("Review before downloading");
  await expect(exportDialog.getByText("Imported fields still need review")).toBeVisible();
  await expect(exportDialog.getByRole("button", { name: /export anyway/i })).toHaveCount(0);

  const download = page.waitForEvent("download");
  await exportDialog.getByRole("button", { name: /download anyway/i }).click();
  await expect((await download).suggestedFilename()).toBe("Ada_Lovelace.docx");
});
