import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { resumeDocx } from "@/lib/docx-export";
import { sampleState } from "@/lib/resume";

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
  await expect.poll(async () => {
    const highlightBox = await highlight.boundingBox();
    const targetBox = await target.boundingBox();
    if (!highlightBox || !targetBox) return false;
    return highlightBox.x <= targetBox.x
      && highlightBox.y <= targetBox.y
      && highlightBox.x + highlightBox.width >= targetBox.x + targetBox.width
      && highlightBox.y + highlightBox.height >= targetBox.y + targetBox.height;
  }).toBe(true);
}

// Entries render as collapsed one-line summaries by default. Open every
// collapsed entry so its fields are present for interaction/assertions.
async function expandAllEntries(page: Page) {
  // Wait for entries to render (e.g. just after an import) before expanding.
  await page.locator("[data-editor-entry]").first().waitFor({ state: "attached", timeout: 3000 }).catch(() => {});
  for (let i = 0; i < 40; i += 1) {
    const collapsed = page.locator('[data-editor-entry] [data-entry-toggle][aria-expanded="false"]');
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
    if (await match().isVisible().catch(() => false)) return;
    const next = tour.getByRole("button", { name: /^next/i });
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
  }
  await expect(match()).toBeVisible();
}

async function removeSection(page: Page, title: string) {
  const section = page.locator("[data-editor-section]").filter({ has: page.getByLabel(`${title} section title`) });
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
  const dialog = page.getByRole("dialog", { name: /version history/i });
  if (!(await dialog.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /version history/i }).click();
    await expect(dialog).toBeVisible();
  }
  return dialog;
}

async function closeVersions(page: Page) {
  await page.getByRole("dialog", { name: /version history/i }).getByRole("button", { name: "Close" }).click();
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
    '<w:p><w:r><w:t>Ada Lovelace</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Platform Engineer</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>ada@example.com | </w:t></w:r><w:hyperlink r:id="rIdLinkedIn"><w:r><w:t>LinkedIn</w:t></w:r></w:hyperlink></w:p>',
    '<w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Engineer | Analytical Engines | 2022–Present</w:t></w:r></w:p>',
    '</w:body></w:document>',
  ].join("");
  const relationships = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLinkedIn" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://www.linkedin.com/in/ada" TargetMode="External"/></Relationships>';
  return Buffer.from(zipSync({
    "word/document.xml": strToU8(document),
    "word/_rels/document.xml.rels": strToU8(relationships),
  }));
}

function makeDocxWithFieldLink() {
  const document = [
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
    '<w:p><w:r><w:t>Ada Lovelace</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Platform Engineer</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>ada@example.com | </w:t></w:r><w:fldSimple w:instr=" HYPERLINK &quot;https://ada.example.com&quot; "><w:r><w:t>Portfolio</w:t></w:r></w:fldSimple></w:p>',
    '<w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Engineer | Analytical Engines | 2022–Present</w:t></w:r></w:p>',
    '</w:body></w:document>',
  ].join("");
  return Buffer.from(zipSync({ "word/document.xml": strToU8(document) }));
}

function makeDocxWithHeaderContact() {
  const header = [
    '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '<w:p><w:r><w:t>Ada Lovelace</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Platform Engineer</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>ada@example.com | </w:t></w:r><w:hyperlink r:id="rIdPortfolio"><w:r><w:t>Portfolio</w:t></w:r></w:hyperlink></w:p>',
    '</w:hdr>',
  ].join("");
  const document = [
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
    '<w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Engineer | Analytical Engines | 2022–Present</w:t></w:r></w:p>',
    '</w:body></w:document>',
  ].join("");
  const documentRelationships = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>';
  const headerRelationships = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdPortfolio" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://ada.example.com" TargetMode="External"/></Relationships>';
  return Buffer.from(zipSync({
    "word/document.xml": strToU8(document),
    "word/_rels/document.xml.rels": strToU8(documentRelationships),
    "word/header1.xml": strToU8(header),
    "word/_rels/header1.xml.rels": strToU8(headerRelationships),
  }));
}

function makeDocxWithFooterContact() {
  const footer = [
    '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '<w:p><w:r><w:t>ada@example.com | </w:t></w:r><w:hyperlink r:id="rIdPortfolio"><w:r><w:t>Portfolio</w:t></w:r></w:hyperlink></w:p>',
    '<w:p><w:r><w:t>Page 1</w:t></w:r></w:p>',
    '</w:ftr>',
  ].join("");
  const document = [
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
    '<w:p><w:r><w:t>Ada Lovelace</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Platform Engineer</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Engineer | Analytical Engines | 2022–Present</w:t></w:r></w:p>',
    '</w:body></w:document>',
  ].join("");
  const documentRelationships = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>';
  const footerRelationships = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdPortfolio" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://ada.example.com" TargetMode="External"/></Relationships>';
  return Buffer.from(zipSync({
    "word/document.xml": strToU8(document),
    "word/_rels/document.xml.rels": strToU8(documentRelationships),
    "word/footer1.xml": strToU8(footer),
    "word/_rels/footer1.xml.rels": strToU8(footerRelationships),
  }));
}

test("presents credible browser metadata and public launch assets", async ({ page, request }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("PrivaCV — Private, ATS-Friendly Resume Editor");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /Build, tailor, and export a clean resume locally/i,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "PrivaCV — Private, ATS-Friendly Resume Editor",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://privacv.app");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://privacv.app");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest\.webmanifest$/);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", /icon\.svg(?:\?.*)?$/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("type", "image/png");

  const appleIconHref = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect(appleIconHref).toBeTruthy();

  const [manifest, robots, sitemap, icon, appleIcon] = await Promise.all([
    request.get("/manifest.webmanifest"),
    request.get("/robots.txt"),
    request.get("/sitemap.xml"),
    request.get("/icon.svg"),
    request.get(appleIconHref!),
  ]);
  expect(manifest.ok()).toBeTruthy();
  expect(await manifest.json()).toMatchObject({ short_name: "PrivaCV", display: "standalone" });
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain("Sitemap: https://privacv.app/sitemap.xml");
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain("<loc>https://privacv.app/</loc>");
  expect(icon.ok()).toBeTruthy();
  expect(icon.headers()["content-type"]).toContain("image/svg+xml");
  expect(appleIcon.ok()).toBeTruthy();
  expect(appleIcon.headers()["content-type"]).toContain("image/png");
});

test("protects the local workspace with production response security headers", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();

  expect(response.ok()).toBeTruthy();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("'wasm-unsafe-eval'");
  expect(headers["content-security-policy"]).toContain("https://huggingface.co");
  expect(headers["content-security-policy"]).toContain("https://raw.githubusercontent.com");
  expect(headers["content-security-policy"]).toContain("worker-src 'self' blob:");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["strict-transport-security"]).toBe("max-age=31536000");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
});

test("keeps the editor interactive while development security headers are active", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await loadSample(page);

  await expect(page.getByLabel("Full Name")).toHaveValue("John Doe");
});

test("keeps the editor page concise and puts product guidance on About", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /frequently asked questions/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /about privacv/i })).toBeVisible();

  await page.goto("/about");
  await expect(page.getByRole("heading", { name: /how privacv works/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /frequently asked questions/i })).toBeVisible();
  await expect(page.getByText("Does PrivaCV upload my resume?", { exact: true })).toBeVisible();
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
  const essentials = page.getByLabel("Blank resume essentials");
  await expect(essentials).toContainText("Start with the parts a recruiter needs first.");
  await expect(essentials.locator('ol[aria-label="0 of 3 essentials complete"]')).toBeVisible();
  await expect(essentials.getByRole("button", { name: /add details/i })).toHaveCSS("align-self", "flex-end");
  await essentials.getByRole("button", { name: /add a role/i }).click();
  await expect(page.locator("#field-experience-0-title")).toBeFocused();
  await essentials.getByRole("button", { name: /add skills/i }).click();
  await expect(page.locator("#add-skills-group")).toBeFocused();
  await expect(page.locator("#review-region-skills")).toHaveClass(/ring-brand/);
  await essentials.getByRole("button", { name: /hide guide/i }).click();
  await expect(essentials).toBeHidden();
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

  // A preset is a professional starting point that sets every theme axis.
  await page.getByLabel("Resume preset").selectOption("modern");
  await expect(sheet).toHaveAttribute("data-heading", "bar");
  await expect(sheet).toHaveAttribute("data-divider", "on");
  await expect(sheet).toHaveAttribute("data-header-align", "center");
  await expect(sheet).toHaveAttribute("data-bullet", "circle");
  await expect(sheet).toHaveCSS("font-family", /Inter/);
  await expect(page.locator(".resume-name")).toHaveCSS("color", "rgb(31, 58, 95)");

  // Individual controls layer on top of the preset.
  await page.getByRole("button", { name: "Burgundy" }).click();
  await expect(page.locator(".resume-name")).toHaveCSS("color", "rgb(127, 29, 58)");
  await page.getByLabel("Resume font").selectOption("georgia");
  await expect(sheet).toHaveCSS("font-family", /Gelasio/);

  // Header, headings, and density sit under the panel's Advanced disclosure.
  await page.getByRole("button", { name: /^Advanced/ }).click();
  await page.getByRole("button", { name: "Plain", exact: true }).click();
  await expect(sheet).toHaveAttribute("data-heading", "plain");
  await page.getByRole("button", { name: "Compact", exact: true }).click();
  await expect(sheet).toHaveAttribute("data-density", "compact");

  // The theme is saved locally and restored on reload.
  await page.waitForTimeout(450);
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

  for (const [fontId, familyName] of expectedFonts) {
    await page.getByLabel("Resume font").selectOption(fontId);
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

test("keeps the mobile section navigation below the persistent workspace header", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const navigation = page.getByRole("navigation", { name: "Jump to a resume section" });
  await expect(navigation).toHaveCSS("position", "sticky");
  await expect(navigation).toHaveCSS("top", "118px");
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(async () => (await navigation.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(117);
  await expect.poll(async () => (await navigation.boundingBox())?.y ?? -1).toBeLessThanOrEqual(119);
});

test("warns clearly and offers a JSON backup when browser autosave fails", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "setItem", {
      configurable: true,
      value: () => {
        throw new DOMException("Storage quota exceeded", "QuotaExceededError");
      },
    });
  });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());

  await loadSample(page);

  const storageWarning = page.getByText("Browser autosave is unavailable", { exact: true }).locator("..");
  await expect(storageWarning).toContainText("Browser autosave is unavailable");
  await expect(storageWarning).toContainText("may not survive a refresh");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /save json copy/i }).click();
  await expect((await download).suggestedFilename()).toBe("John_Doe.json");
});

test("records only an anonymous format event when a resume is exported", async ({ page }) => {
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
  await expect.poll(() => exportEvents).toEqual([{ format: "json" }]);
});

test("backs up a checkpoint instead of claiming it persisted when browser storage fails", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "setItem", {
      configurable: true,
      value: () => {
        throw new DOMException("Storage quota exceeded", "QuotaExceededError");
      },
    });
  });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await loadSample(page);

  const versions = await openVersions(page);
  await expect(versions.getByText(/versions shown here may not survive a refresh/i)).toBeVisible();
  await versions.getByRole("button", { name: /save current version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Tailored product role");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /save checkpoint/i }).click();
  await expect((await download).suggestedFilename()).toBe("John_Doe-checkpoints.json");
  await expect(page.getByText("Browser storage unavailable — checkpoint backup downloaded", { exact: true })).toBeVisible();
  await expect(page.getByText("Tailored product role", { exact: true })).toBeVisible();
});

test("keeps import, export, and secondary toolbar actions usable from the keyboard", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const importTrigger = page.getByRole("button", { name: /^import$/i });
  await importTrigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: /upload pdf or word/i })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: /paste resume text/i })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: /open saved json/i })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(importTrigger).toBeFocused();

  const exportTrigger = page.getByRole("button", { name: /^export$/i });
  await exportTrigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: /export pdf/i })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(exportTrigger).toBeFocused();

  const trigger = page.getByRole("button", { name: /^more actions$/i });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");

  await expect(page.getByRole("menuitem", { name: /^sample$/i })).toBeFocused();
  await expect(page.getByRole("menuitem", { name: /copy for applications/i })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: /open saved json/i })).toHaveCount(0);
  await page.keyboard.press("End");
  await expect(page.getByRole("menuitem", { name: /delete all data/i })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("menuitem", { name: /^sample$/i })).toBeFocused();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("menu")).toBeHidden();
  await expect(trigger).toBeFocused();
});

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

  await expect(page.getByLabel("Website")).toHaveValue("https://www.linkedin.com/in/ada");
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

  await expect(page.getByLabel("Website / LinkedIn")).toHaveValue("https://ada.example.com");
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
  await expect(page.getByLabel("Website / LinkedIn")).toHaveValue("https://ada.example.com");
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
  await expect(page.getByLabel("Website / LinkedIn")).toHaveValue("https://ada.example.com");
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

  // Autosave state is surfaced on the Versions button: a spinning loader while
  // saving that settles to a check, mirrored on data-autosave-status + aria.
  const autosave = page.locator("[data-autosave-status]");
  await expect(autosave).toHaveAttribute("data-autosave-status", "saved");
  await expect(autosave).toHaveAccessibleName(/saved locally/i);

  const summary = page.getByLabel("Professional Summary");
  const savedSummary = await summary.inputValue();
  await page.waitForTimeout(450);
  await summary.fill("A local-first product engineer who ships dependable tools.");
  await expect(autosave).toHaveAttribute("data-autosave-status", "saving");
  await expect(autosave).toHaveAccessibleName(/saving locally/i);

  const versions = await openVersions(page);
  await expect(versions.getByText("Autosave copy", { exact: true })).toBeVisible();
  await expect(versions.getByText("Autosaved", { exact: true })).toBeVisible();
  const autosaveCard = versions.locator("li", { hasText: "Autosave copy" });
  await autosaveCard.getByRole("button", { name: "Restore autosave" }).click();
  await expect(summary).toHaveValue(savedSummary);
  await expect(page.getByText("Restored Autosave copy")).toBeVisible();
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
  await expandAllEntries(page);
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
  await expect(page).toHaveTitle("PrivaCV — Private, ATS-Friendly Resume Editor");
});

test("flags a single resume entry that would continue onto another printed page", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const longEntry = Array.from(
    { length: 55 },
    (_, index) => `Delivered measurable platform improvement ${index + 1} for customers, reducing deployment risk and making critical workflows easier for distributed teams.`,
  ).join("\n");
  await page.locator("#field-experience-0-details").fill(longEntry);

  const review = await openResumeReview(page);
  await advanceReviewTo(review, /Experience entry 1 exceeds one printable page/);
  await review.getByRole("button", { name: /shorten entry/i }).click();
  await expect(page.locator("#field-experience-0-details")).toBeFocused();
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
  await expect(skillsFormatPicker.getByRole("button", { name: "Grouped tags format" })).toHaveAttribute("aria-pressed", "true");
  await expect(skillsFormatPicker.getByRole("button", { name: "Structured entries format" })).toBeVisible();
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
  await skillsFormatPicker.getByRole("button", { name: "Structured entries format" }).click();
  await skillsSection.locator("#add-skills-entry").click();
  await page.locator("#field-skills-0-title").fill("Cloud platforms");
  await page.locator("#field-skills-0-subtitle").fill("AWS and Azure");
  await expect(page.locator(".resume-sheet").getByText("Cloud platforms", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /add custom section/i }).click();
  await page.getByLabel("New Section section title").fill("Certifications");
  const customSection = page.locator('[data-editor-section^="custom-"]').last();
  const formatPicker = customSection.getByRole("group", { name: "Content format" });
  await formatPicker.getByRole("button", { name: "Bulleted list format" }).click();
  await page.getByLabel("Certifications (one bullet per line)").fill("AWS Certified Developer\nCertified Kubernetes Administrator");
  await expect(customSection.getByRole("button", { name: "Open local AI text editor" })).toBeVisible();

  for (const format of ["Paragraphs format", "Labeled rows format"]) {
    await formatPicker.getByRole("button", { name: format }).click();
    await expect(customSection.getByRole("button", { name: "Open local AI text editor" })).toBeVisible();
  }
  await formatPicker.getByRole("button", { name: "Bulleted list format" }).click();

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
  await expect(page.locator(".resume-entry .resume-bullets").first()).toHaveJSProperty("spellcheck", true);
  // Structured contact values should not be treated as ordinary prose.
  await expect(page.locator(".resume-contact > *").first()).toHaveJSProperty("spellcheck", false);
  await name.selectText();
  await page.keyboard.type("Ada Lovelace");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Full Name")).toHaveValue("Ada Lovelace");

  // A bullet edits in place and syncs back to the entry details field.
  const firstBullet = page.locator(".resume-entry .resume-bullets li").first();
  await firstBullet.click();
  await firstBullet.selectText();
  await page.keyboard.type("Rewrote the deploy pipeline, cutting release time in half.");
  await page.locator(".resume-name").click();
  await expect(page.locator("#field-experience-0-details")).toHaveValue(/Rewrote the deploy pipeline/);

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
  await expect(page.getByLabel("Professional Summary")).toBeHidden();
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

  await toolsToggle.click();
  await toolsPanel.getByRole("button", { name: /switch to night mode/i }).click();
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

  await page.getByRole("button", { name: /certifications/i }).click();

  await expect(page.getByLabel("Certifications section title")).toHaveValue("Certifications");
  await expect(page.locator(".resume-sheet").getByText("Certifications", { exact: true })).toBeHidden();
  await page.locator('[id^="field-custom-"][id$="-0-title"]').fill("AWS Certified Developer – Associate");
  await expect(page.locator(".resume-sheet").getByText("Certifications", { exact: true })).toBeVisible();
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

  await page.getByLabel("Professional Summary").fill("");

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

  await expect(page.getByLabel("Summary")).toHaveValue("Platform engineer building dependable developer tools.");
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

  await expect(page.getByLabel("Summary")).toHaveValue("Platform engineer building dependable developer tools.");
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

  await expect(page.getByLabel("Professional Summary")).toHaveValue("Platform engineer building dependable developer tools.");
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
    .toHaveValue("Led dependable platform work.");
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

  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Certified Kubernetes Administrator");

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

  await expect(page.getByLabel("Summary")).toHaveValue("Platform engineer building dependable developer tools.");
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

test("focuses the field behind a failed resume check", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await page.getByLabel("Phone").fill("");
  const review = await openResumeReview(page);
  await advanceReviewTo(review, /Missing contact details can make a strong resume impossible to follow up on/);
  await review.getByRole("button", { name: /fix contact/i }).click();

  await expect(page.locator("#field-phone")).toBeFocused();
});

test("guides users to add measurable evidence without requiring every bullet to have a number", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await page.locator("#field-experience-0-details").fill(
    "Led a migration to improve deployment reliability.\nMentored engineers and established review standards.\nDesigned a billing service for enterprise customers.",
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

test("keeps mobile editing focused while keeping utilities in the tools drawer", async ({ browser }) => {
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
  await expect(tools.getByRole("heading", { name: "Tools" }).locator("..").locator("..")).toHaveCSS("position", "static");
  await expect(tools.getByRole("button", { name: /resume review/i })).toContainText("Ready to export");
  await expect(tools.getByRole("button", { name: /copy for applications/i })).toBeVisible();
  await expect(tools.getByRole("button", { name: /local ai/i })).toHaveCount(0);
  await expect(tools.getByText("Resume checks run in this browser.")).toHaveCount(0);
  await expect(tools.getByRole("button", { name: /switch to (?:light|night) mode/i })).toBeVisible();
  await expect(tools.getByRole("button", { name: /navigate resume/i })).toBeVisible();
  await expect(tools.getByRole("link", { name: /feedback/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Role focus" })).toBeHidden();

  await page.getByRole("button", { name: /close tools/i }).click();
  await expect(tools).toBeHidden();
  await expect(page.getByLabel("Full Name")).toBeVisible();

  await openMenu(page);
  await expect(page.getByRole("menuitem", { name: /local ai/i })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: /feedback/i })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: /switch to (?:light|night) mode/i })).toHaveCount(0);

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

test("keeps the resume sheet to true Letter dimensions on screen and in print", async ({ page }) => {
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
    (_, index) => `• Delivered a concrete, measurable outcome for initiative ${index + 1} across a complex program.`,
  ).join("\n");
  await page.getByLabel("Details").first().fill(details);

  await expect(page.getByText("Page 2 begins")).toBeVisible();
  await expect(page.locator(".resume-page-guide span").filter({ hasText: "Page 2 begins" }).first()).toContainText("Next:");

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
  await page.locator("#field-experience-0-details").fill(details);

  // Chromium moves this complete role to a fresh Letter page. The live sheet
  // should reserve that whitespace too, rather than understating the export.
  await expect(page.getByText("3 pages in preview", { exact: true })).toBeVisible();
  await expect(page.locator('[data-resume-print-section="experience"]')).toHaveClass(/resume-print-break-before/);

  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({ format: "Letter", preferCSSPageSize: true, printBackground: true });
  expect((pdf.toString("latin1").match(/\/Type \/Page(?!s)/g) ?? []).length).toBe(3);
});

test("keeps the Skills section whole on the exported page the preview shows it on", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  // Enough role detail to push Skills onto the first-page boundary. A list
  // section has no per-entry break points, so it used to straddle the boundary
  // in the preview while the print engine split it at the page margin.
  const details = Array.from(
    { length: 14 },
    (_, index) => `Led initiative ${index + 1} that improved a cross-functional customer workflow through careful design and delivery.`,
  ).join("\n");
  await page.locator("#field-experience-0-details").fill(details);

  // The preview reserves a full break for the block and shows it on page 2.
  await expect(page.getByText("2 pages in preview", { exact: true })).toBeVisible();
  await expect(page.locator('[data-resume-print-section="skills"]')).toHaveClass(/resume-print-break-before/);

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
      return content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    }),
  );
  expect(doc.numPages).toBe(2);
  expect(markers.every((marker) => !pageText[0].includes(marker))).toBe(true);
  expect(markers.every((marker) => pageText[1].includes(marker))).toBe(true);
});

test("recomputes the preview page count when the resume shrinks", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const roleDetails = page.locator("#field-experience-0-details");
  await roleDetails.fill(
    Array.from({ length: 22 }, (_, index) => `Led initiative ${index + 1} that improved a cross-functional customer workflow through careful design, validation, and delivery across stakeholders.`).join("\n"),
  );
  // The compact-spacing helper only appears once the preview is multi-page.
  await expect(page.getByRole("button", { name: "Try compact spacing" })).toBeVisible();

  // Shrinking the resume must drop the extra page — the sheet min-height (set
  // from the page count so full pages render) must not lock the count high.
  await roleDetails.fill("Delivered one concise, measurable outcome.");
  await expect(page.getByText("1 page in preview", { exact: true })).toBeVisible();
});

test("offers reversible page-fit adjustments without changing resume content", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const details = Array.from(
    { length: 22 },
    (_, index) => `Led initiative ${index + 1} that improved a cross-functional customer workflow through careful design, validation, and delivery across stakeholders.`,
  ).join("\n");
  const roleDetails = page.locator("#field-experience-0-details");
  await roleDetails.fill(details);

  await expect(page.getByRole("button", { name: "Try compact spacing" })).toBeVisible();
  await page.getByRole("button", { name: "Try compact spacing" }).click();
  await expect(page.locator(".resume-sheet")).toHaveAttribute("data-density", "compact");
  await expect(page.locator('div[role="status"]')).toContainText("Applied compact spacing");
  await expect(roleDetails).toHaveValue(details);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".resume-sheet")).toHaveAttribute("data-density", "comfortable");
  await expect(roleDetails).toHaveValue(details);

  await page.getByRole("button", { name: "Try compact spacing" }).click();
  await page.getByRole("button", { name: "Reduce text 2%" }).click();
  await expect(page.getByText("98%", { exact: true })).toBeVisible();
  await expect(page.locator('div[role="status"]')).toContainText("Reduced text size to 98%");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await expect(roleDetails).toHaveValue(details);
});

test("shows an export review before printing an unresolved resume", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    window.print = () => {
      window.localStorage.setItem("print-called", "true");
    };
  });
  await page.reload();
  await page.evaluate(() => {
    window.print = () => {
      window.localStorage.setItem("print-called", "true");
    };
  });
  await loadSample(page);
  await page.getByLabel("Phone").fill("");

  await exportPdf(page);
  const exportDialog = page.getByRole("dialog", { name: /review before exporting/i });
  await expect(exportDialog).toBeVisible();
  await expect(exportDialog.getByText("Missing contact details can make a strong resume impossible to follow up on.")).toBeVisible();

  await exportDialog.getByRole("button", { name: /fix contact/i }).click();
  await expect(page.locator("#field-phone")).toBeFocused();
  await expect(page.getByRole("dialog", { name: /review before exporting/i })).toBeHidden();

  await exportPdf(page);
  await page.getByRole("button", { name: /export anyway/i }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("print-called"))).toBe("true");
});

test("catches unusable contact details before export and uses contact-friendly inputs", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
  await expect(page.getByLabel("Phone")).toHaveAttribute("type", "tel");
  await expect(page.getByLabel("Website / LinkedIn")).toHaveAttribute("type", "url");

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
  await importDialog.getByLabel("Resume text").fill([
    "Ada Lovelace",
    "ada@example.com | San Francisco, CA",
    "",
    "Experience",
    "Platform Engineer | Analytical Engines | 2022–Present",
    "• Built reliable systems.",
  ].join("\n"));
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
  await importDialog.getByLabel("Resume text").fill([
    "Ada Lovelace",
    "Platform Engineer",
    "ada@example.com | San Francisco, CA",
    "",
    "Experience",
    "Platform Engineer | Analytical Engines | 2022–Present",
    "• Built reliable systems.",
  ].join("\n"));
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

test("restores a version without showing a post-restore difference audit", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await saveVersion(page, "Clean baseline");

  await page.getByLabel("Full Name").fill("Ada Lovelace");

  await openVersions(page);
  await page.locator("li", { hasText: "Clean baseline" }).getByRole("button", { name: "Restore" }).click();
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
  await versions.locator("li", { hasText: "Clean baseline" }).getByRole("button", { name: "Restore" }).click();
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
  await previousAutosave.getByRole("button", { name: "Restore autosave" }).click();
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
    review: localStorage.getItem("resume-editor-import-review-v1"),
    export: localStorage.getItem("resume-editor-last-export-v1"),
    localAIModel: localStorage.getItem("resume-editor-local-ai-model-v1"),
    localAIMigration: localStorage.getItem("resume-editor-local-ai-cache-v2-migrated"),
  }))).toEqual({
    draft: null,
    history: null,
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
  await expect(page.getByText("Version saved locally")).toBeVisible();
  await expect(versions.getByText("Original software resume")).toBeVisible();
  await expect(versions.getByText("Current", { exact: true })).toBeVisible();
  await expect(versions.getByText("John Doe").first()).toBeVisible();
  const savedVersionCard = versions.locator("li", { hasText: "Original software resume" });
  await expect(savedVersionCard.locator("[data-version-thumbnail]")).toHaveCount(1);
  await expect(savedVersionCard.locator("[data-version-heading]")).toHaveCSS("display", "grid");
  await expect(savedVersionCard.locator("[data-version-icon]")).toHaveCSS("align-items", "center");
  await closeVersions(page);

  await page.getByLabel("Full Name").fill("Grace Hopper");
  await page.getByLabel("Job Title").first().fill("Principal Software Engineer");
  await expect(page.getByLabel("Full Name")).toHaveValue("Grace Hopper");

  await openVersions(page);
  await page.locator("li", { hasText: "Original software resume" }).getByRole("button", { name: "Restore" }).click();
  await expect(page.getByLabel("Full Name")).toHaveValue("John Doe");
  await expect(page.getByText(/Restored from the version saved/i)).toBeHidden();
  await expect(page.getByText("Previous resume available")).toBeVisible();

  await openVersions(page);
  await page.getByRole("button", { name: /delete original software resume/i }).click();
  await expect(page.getByText(/Deleted “Original software resume”/)).toBeVisible();

  await page.getByRole("button", { name: /undo/i }).click();
  await expect(page.getByText("Restored deleted checkpoint")).toBeVisible();
  await expect(page.getByRole("button", { name: /delete original software resume/i })).toBeVisible();
});

test("keeps every checkpoint without a save limit", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  for (let index = 1; index <= 7; index += 1) {
    await page
      .getByLabel("Professional Summary")
      .fill(`Tailored summary ${index} with enough specific context for this saved checkpoint.`);
    await saveVersion(page, `Checkpoint ${index}`);
  }

  const versions = await openVersions(page);
  // No cap: all seven checkpoints and the live autosave copy remain available.
  await expect(versions.getByText("7 checkpoints saved")).toBeVisible();
  await expect(versions.locator("[data-version-thumbnail]")).toHaveCount(8);
  await expect(versions.getByText("Checkpoint 1", { exact: true })).toBeVisible();
  await expect(versions.getByText("Checkpoint 7", { exact: true })).toBeVisible();
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

  await page.getByLabel("Professional Summary").fill("Cloud-platform leadership with a focus on reliable backend systems and developer experience.");
  const versions = await openVersions(page);
  await versions.getByRole("button", { name: /save current version/i }).click();
  const saveDialog = page.getByRole("dialog", { name: /name this checkpoint/i });
  await saveDialog.getByLabel("Checkpoint name").fill("Cloud leadership focus");
  await saveDialog.getByLabel(/^Note/).fill("Tailored for the Stripe platform engineering role.");
  await saveDialog.getByRole("button", { name: /save checkpoint/i }).click();

  const search = versions.getByLabel("Find a saved version");
  await search.fill("stripe");
  await expect(versions.getByText("Showing 1 of 2")).toBeVisible();
  await expect(versions.getByText("Cloud leadership focus", { exact: true })).toBeVisible();
  await expect(versions.getByText("Platform baseline", { exact: true })).toBeHidden();

  await closeVersions(page);
  const reopenedVersions = await openVersions(page);
  await expect(reopenedVersions.getByText("Showing all saved versions")).toBeVisible();
  await expect(reopenedVersions.getByText("Platform baseline", { exact: true })).toBeVisible();

  await reopenedVersions.getByLabel("Find a saved version").fill("no matching checkpoint");
  await expect(reopenedVersions.getByText(/No saved versions match “no matching checkpoint”/)).toBeVisible();
  await reopenedVersions.getByRole("button", { name: "Clear search" }).click();
  await expect(reopenedVersions.getByText("Showing all saved versions")).toBeVisible();
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

  // Let the debounced autosave flush before clearing, otherwise a pending
  // write can re-persist the sample in the gap between clear and navigation.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("resume-editor-data-v2")))
    .not.toBeNull();
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
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
