import { expect, type Locator, type Page } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

async function openMenu(page: Page) {
  await page.getByRole("button", { name: /^more actions$/i }).click();
}

async function openExport(page: Page) {
  await page.getByRole("button", { name: /^export$/i }).click();
}

async function exportPdf(page: Page) {
  await openExport(page);
  await page.getByRole("menuitem", { name: /^export pdf$/i }).click();
}

async function expectGuidedHighlightToFrame(page: Page, target: Locator) {
  const highlight = page.locator("[data-guided-review-highlight]");
  await expect(highlight).toBeVisible();
  await expect
    .poll(async () => {
      const highlightBox = await highlight.boundingBox();
      const targetBox = await target.boundingBox();
      if (!highlightBox || !targetBox) return false;
      return (
        highlightBox.x <= targetBox.x &&
        highlightBox.y <= targetBox.y &&
        highlightBox.x + highlightBox.width >= targetBox.x + targetBox.width &&
        highlightBox.y + highlightBox.height >= targetBox.y + targetBox.height
      );
    })
    .toBe(true);
}

// Entries render as collapsed one-line summaries by default. Open every
// collapsed entry so its fields are present for interaction/assertions.
async function expandAllEntries(page: Page) {
  // Wait for entries to render (e.g. just after an import) before expanding.
  await page
    .locator("[data-editor-entry]")
    .first()
    .waitFor({ state: "attached", timeout: 3000 })
    .catch(() => {});
  for (let i = 0; i < 40; i += 1) {
    const collapsed = page.locator(
      '[data-editor-entry] [data-entry-toggle][aria-expanded="false"]',
    );
    if ((await collapsed.count()) === 0) break;
    await collapsed.first().click();
  }
}

async function expandAllTagGroups(page: Page) {
  for (let i = 0; i < 20; i += 1) {
    const collapsed = page.getByRole("button", { name: /^Expand .* tag group$/i });
    if ((await collapsed.count()) === 0) break;
    await collapsed.first().click();
  }
}

async function loadSample(page: Page) {
  await openMenu(page);
  await page.getByRole("menuitem", { name: /^sample$/i }).click();
  await expandAllEntries(page);
}

function summaryEditor(page: Page) {
  return page.getByRole("textbox", { name: "Professional Summary", exact: true });
}

async function setRichTextBlocks(
  editor: Locator,
  blocks: Array<{ type: "paragraph" | "bullet" | "number"; text: string }>,
) {
  await editor.focus();
  await editor.evaluate((element, nextBlocks) => {
    const root = element as HTMLElement;
    root.replaceChildren();
    for (const block of nextBlocks) {
      if (block.type === "paragraph") {
        const paragraph = document.createElement("p");
        paragraph.textContent = block.text;
        root.append(paragraph);
        continue;
      }
      const list = document.createElement(block.type === "number" ? "ol" : "ul");
      const item = document.createElement("li");
      item.textContent = block.text;
      list.append(item);
      root.append(list);
    }
    root.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  }, blocks);
  await editor.press("Tab");
}

async function setRichText(
  editor: Locator,
  text: string,
  type: "paragraph" | "bullet" | "number" = "paragraph",
) {
  await setRichTextBlocks(
    editor,
    text
      .split("\n")
      .map((line) => line.replace(/^\s*[•*-]\s*/, "").trim())
      .filter(Boolean)
      .map((line) => ({ type, text: line })),
  );
}

async function openTools(page: Page) {
  const dialog = page.getByRole("dialog", { name: /^tools$/i });
  if (!(await dialog.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /open tools/i }).click();
    await expect(dialog).toBeVisible();
  }
}

async function openResumeReview(page: Page) {
  await openTools(page);
  const tools = page.getByRole("dialog", { name: /^tools$/i });
  await tools.getByRole("button", { name: /resume review/i }).click();
  const summary = page.getByRole("dialog", { name: /^resume review$/i });
  await expect(summary).toBeVisible();
  await expect(summary.locator("[data-resume-check]")).toHaveCount(5);
  await expect(summary.getByText("Content amount", { exact: true })).toHaveCount(0);
  await expect(summary.getByText("Entry length", { exact: true })).toHaveCount(0);
  await summary.getByRole("button", { name: /start walkthrough/i }).click();
  const tour = page.getByRole("dialog", { name: /guided review/i });
  await expect(tour).toBeVisible();
  return tour;
}

async function advanceReviewTo(tour: Locator, text: string | RegExp) {
  const match = () => tour.getByText(text, { exact: typeof text === "string" }).first();
  for (let step = 0; step < 12; step += 1) {
    if (
      await match()
        .isVisible()
        .catch(() => false)
    )
      return;
    const next = tour.getByRole("button", { name: /^next/i });
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
  }
  await expect(match()).toBeVisible();
}

async function removeSection(page: Page, title: string) {
  const section = page
    .locator("[data-editor-section]")
    .filter({ has: page.getByLabel(`${title} section title`) });
  await section.getByRole("button", { name: `More actions for ${title}` }).click();
  await page.getByRole("menuitem", { name: "Remove section" }).click();
}

/** Appearance controls live in an inline panel behind the preview "Design" button. */
async function openDesign(page: Page) {
  const panel = page.locator("#design-panel");
  if (!(await panel.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Design" }).click();
    await expect(panel).toBeVisible();
  }
}

async function openVersions(page: Page) {
  const panel = page.getByRole("region", { name: /edit history/i });
  if (!(await panel.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Edit history", exact: true }).click();
    await expect(panel).toBeVisible();
  }
  return panel;
}

async function closeVersions(page: Page) {
  await page.getByRole("button", { name: "Edit history", exact: true }).click();
  await expect(page.getByRole("region", { name: /edit history/i })).toBeHidden();
}

async function openResumeLibrary(page: Page) {
  const dialog = page.getByRole("dialog", { name: /resume library/i });
  if (!(await dialog.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /resume library/i }).click();
    await expect(dialog).toBeVisible();
  }
  return dialog;
}

async function saveVersion(page: Page, label: string) {
  const versions = await openVersions(page);
  await versions.getByRole("button", { name: /save current version/i }).click();
  await page.getByLabel("Checkpoint name").fill(label);
  await page.getByRole("button", { name: /save checkpoint/i }).click();
  await closeVersions(page);
}

function makeTextPdf(text: string) {
  const stream = `BT\n/F1 14 Tf\n72 720 Td\n(${text.replace(/[\\()]/g, "\\$&")}) Tj\nET\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(pdf, "ascii");
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}

function makeDocxWithLabelOnlyLink() {
  const document = [
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>',
    "<w:p><w:r><w:t>Ada Lovelace</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>Platform Engineer</w:t></w:r></w:p>",
    '<w:p><w:r><w:t>ada@example.com | </w:t></w:r><w:hyperlink r:id="rIdLinkedIn"><w:r><w:t>LinkedIn</w:t></w:r></w:hyperlink></w:p>',
    "<w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>Engineer | Analytical Engines | 2022–Present</w:t></w:r></w:p>",
    "</w:body></w:document>",
  ].join("");
  const relationships =
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLinkedIn" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://www.linkedin.com/in/ada" TargetMode="External"/></Relationships>';
  return Buffer.from(
    zipSync({
      "word/document.xml": strToU8(document),
      "word/_rels/document.xml.rels": strToU8(relationships),
    }),
  );
}

function makeDocxWithFieldLink() {
  const document = [
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
    "<w:p><w:r><w:t>Ada Lovelace</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>Platform Engineer</w:t></w:r></w:p>",
    '<w:p><w:r><w:t>ada@example.com | </w:t></w:r><w:fldSimple w:instr=" HYPERLINK &quot;https://ada.example.com&quot; "><w:r><w:t>Portfolio</w:t></w:r></w:fldSimple></w:p>',
    "<w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>Engineer | Analytical Engines | 2022–Present</w:t></w:r></w:p>",
    "</w:body></w:document>",
  ].join("");
  return Buffer.from(zipSync({ "word/document.xml": strToU8(document) }));
}

function makeDocxWithHeaderContact() {
  const header = [
    '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    "<w:p><w:r><w:t>Ada Lovelace</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>Platform Engineer</w:t></w:r></w:p>",
    '<w:p><w:r><w:t>ada@example.com | </w:t></w:r><w:hyperlink r:id="rIdPortfolio"><w:r><w:t>Portfolio</w:t></w:r></w:hyperlink></w:p>',
    "</w:hdr>",
  ].join("");
  const document = [
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
    "<w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>Engineer | Analytical Engines | 2022–Present</w:t></w:r></w:p>",
    "</w:body></w:document>",
  ].join("");
  const documentRelationships =
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>';
  const headerRelationships =
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdPortfolio" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://ada.example.com" TargetMode="External"/></Relationships>';
  return Buffer.from(
    zipSync({
      "word/document.xml": strToU8(document),
      "word/_rels/document.xml.rels": strToU8(documentRelationships),
      "word/header1.xml": strToU8(header),
      "word/_rels/header1.xml.rels": strToU8(headerRelationships),
    }),
  );
}

function makeDocxWithFooterContact() {
  const footer = [
    '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '<w:p><w:r><w:t>ada@example.com | </w:t></w:r><w:hyperlink r:id="rIdPortfolio"><w:r><w:t>Portfolio</w:t></w:r></w:hyperlink></w:p>',
    "<w:p><w:r><w:t>Page 1</w:t></w:r></w:p>",
    "</w:ftr>",
  ].join("");
  const document = [
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
    "<w:p><w:r><w:t>Ada Lovelace</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>Platform Engineer</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>Engineer | Analytical Engines | 2022–Present</w:t></w:r></w:p>",
    "</w:body></w:document>",
  ].join("");
  const documentRelationships =
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>';
  const footerRelationships =
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdPortfolio" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://ada.example.com" TargetMode="External"/></Relationships>';
  return Buffer.from(
    zipSync({
      "word/document.xml": strToU8(document),
      "word/_rels/document.xml.rels": strToU8(documentRelationships),
      "word/footer1.xml": strToU8(footer),
      "word/_rels/footer1.xml.rels": strToU8(footerRelationships),
    }),
  );
}

export {
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
};
