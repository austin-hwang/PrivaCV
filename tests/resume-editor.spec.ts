import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";

async function openMenu(page: Page) {
  await page.getByRole("button", { name: /^more actions$/i }).click();
}

async function loadSample(page: Page) {
  await openMenu(page);
  await page.getByRole("menuitem", { name: /^sample$/i }).click();
}

async function openTools(page: Page) {
  const dialog = page.getByRole("dialog", { name: /review tools/i });
  if (!(await dialog.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /open review tools/i }).click();
    await expect(dialog).toBeVisible();
  }
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

test("presents credible browser metadata and public launch assets", async ({ page, request }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Resume Editor — private, ATS-friendly PDFs");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /Build, tailor, and export a clean resume locally/i,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Resume Editor — private, ATS-friendly PDFs",
  );
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest\.webmanifest$/);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", /icon\.svg(?:\?.*)?$/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("type", "image/png");

  const appleIconHref = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect(appleIconHref).toBeTruthy();

  const [manifest, robots, icon, appleIcon] = await Promise.all([
    request.get("/manifest.webmanifest"),
    request.get("/robots.txt"),
    request.get("/icon.svg"),
    request.get(appleIconHref!),
  ]);
  expect(manifest.ok()).toBeTruthy();
  expect(await manifest.json()).toMatchObject({ short_name: "Resume Editor", display: "standalone" });
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain("User-Agent: *");
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

  await expect(page.getByLabel("Full Name")).toHaveValue("Jane Doe");
});

test("starts a fresh resume from the onboarding without hiding the editor", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /start a blank resume/i }).click();
  await expect(page.locator("#field-name")).toBeFocused();
  await expect(page.getByText("Starting fresh?")).toBeHidden();
  await expect(page.locator('[aria-label="Resume templates"] button[aria-pressed="true"]')).toHaveText(/Classic/);

  await page.reload();
  await page.getByRole("button", { name: /start blank with modern template/i }).click();
  await expect(page.locator("#field-name")).toBeFocused();
  await expect(page.locator('[aria-label="Resume templates"] button[aria-pressed="true"]')).toHaveText(/Modern/);
});

test("customizes and persists a professional resume theme", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const sheet = page.locator(".resume-sheet");
  const templates = page.locator('[aria-label="Resume templates"]');

  // A preset is a professional starting point that sets every theme axis.
  await templates.getByRole("button", { name: /modern/i }).click();
  await expect(sheet).toHaveAttribute("data-heading", "bar");
  await expect(sheet).toHaveAttribute("data-divider", "on");
  await expect(sheet).toHaveCSS("font-family", /Inter/);
  await expect(page.locator(".resume-name")).toHaveCSS("color", "rgb(31, 58, 95)");

  // Individual controls layer on top of the preset.
  await page.getByRole("button", { name: "Burgundy" }).click();
  await expect(page.locator(".resume-name")).toHaveCSS("color", "rgb(127, 29, 58)");
  await page.getByLabel("Resume font").selectOption("georgia");
  await expect(sheet).toHaveCSS("font-family", /Georgia/);
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
  await expect(sheet).toHaveCSS("font-family", /Georgia/);

  // Choosing a sample replaces the draft content but should not quietly reset
  // the visual design the person is currently evaluating.
  await openMenu(page);
  await page.getByRole("menuitem", { name: /^sample$/i }).click();
  await expect(sheet).toHaveAttribute("data-heading", "plain");
  await expect(sheet).toHaveAttribute("data-density", "compact");
  await expect(page.locator(".resume-name")).toHaveCSS("color", "rgb(127, 29, 58)");
  await expect(sheet).toHaveCSS("font-family", /Georgia/);
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
  await expect((await download).suggestedFilename()).toBe("Jane_Doe.json");
});

test("keeps secondary toolbar actions usable from the keyboard", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const trigger = page.getByRole("button", { name: /^more actions$/i });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");

  await expect(page.getByRole("menuitem", { name: /^paste text$/i })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("menuitem", { name: /^clear$/i })).toBeFocused();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("menu")).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("helps first-time users choose the right private import route", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.getByText("Choose the route that best matches your source.")).toBeVisible();
  await expect(page.getByRole("button", { name: /paste resume text/i })).toContainText("OCR'd scanned PDFs");
  await expect(page.getByRole("button", { name: /import a pdf/i })).toContainText("Read locally");
  await expect(page.getByText("Already saved work?")).toBeVisible();
  await expect(page.getByText("You will review every imported field before you export.")).toBeVisible();
});

test("imports a PDF with parser code served from the app", async ({ page }) => {
  const thirdPartyRequests: string[] = [];
  page.on("request", (request) => {
    if (/cdn\.jsdelivr\.net|unpkg\.com/.test(request.url())) thirdPartyRequests.push(request.url());
  });

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /import a pdf/i }).click();
  await page.locator('input[type="file"][accept*="application/pdf"]').setInputFiles({
    name: "ada-resume.pdf",
    mimeType: "application/pdf",
    buffer: makeTextPdf("Ada Lovelace"),
  });

  await expect(page.getByLabel("Full Name")).toHaveValue("Ada Lovelace");
  await expect(page.getByText("Imported PDF - please review")).toBeVisible();
  expect(thirdPartyRequests).toEqual([]);
});

test("loads the sample resume and reviews plain text", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await expect(page.getByText("Jane Doe").first()).toBeVisible();
  await expect(page.getByText("1 page in preview", { exact: true })).toBeVisible();

  await openTools(page);
  await expect(page.getByText("Resume Check")).toBeVisible();

  await openMenu(page);
  await page.getByRole("menuitem", { name: /review text/i }).click();
  await expect(page.getByRole("dialog", { name: /review before copying/i })).toBeVisible();
  await expect(page.locator("textarea[readonly]")).toContainText("Jane Doe");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /download \.txt/i }).click();
  await expect((await download).suggestedFilename()).toBe("Jane_Doe.txt");

  const wordDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /download \.docx/i }).click();
  const wordFile = await wordDownload;
  await expect(wordFile.suggestedFilename()).toBe("Jane_Doe.docx");
  expect(wordFile.suggestedFilename()).toMatch(/\.docx$/);
  const wordPath = await wordFile.path();
  expect(wordPath).toBeTruthy();
  const wordContents = unzipSync(new Uint8Array(await readFile(wordPath!)));
  expect(strFromU8(wordContents["word/document.xml"])).toContain("Jane Doe");
});

test("makes local autosave visible while an edited resume is being stored", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const autosave = page.locator("[data-autosave-status]");
  await expect(autosave).toHaveAttribute("data-autosave-status", "saved");
  await expect(autosave).toHaveText("Saved locally");

  await page.getByLabel("Professional Summary").fill("A local-first product engineer who ships dependable tools.");
  await expect(autosave).toHaveAttribute("data-autosave-status", "saving");
  await expect(autosave).toHaveText("Saving locally");
  await expect(autosave).toHaveAttribute("data-autosave-status", "saved");
  await expect(autosave).toHaveText("Saved locally");
});

test("keeps a second tab from silently overwriting a newer local draft", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await expect(page.locator("[data-autosave-status]")).toHaveAttribute("data-autosave-status", "saved");

  const otherTab = await context.newPage();
  await otherTab.goto("/");
  await expect(otherTab.getByLabel("Full Name")).toHaveValue("Jane Doe");
  await otherTab.getByLabel("Full Name").fill("Alex Morgan");
  await expect(otherTab.locator("[data-autosave-status]")).toHaveAttribute("data-autosave-status", "saved");

  const conflict = page.getByText("A different resume was saved in another tab", { exact: true }).locator("..");
  await expect(conflict).toContainText("Autosave is paused here");
  await expect(page.locator("[data-autosave-status]")).toHaveAttribute("data-autosave-status", "conflict");
  await page.getByRole("button", { name: /use saved draft/i }).click();
  await expect(page.getByLabel("Full Name")).toHaveValue("Alex Morgan");
  await expect(conflict).toBeHidden();
  await otherTab.close();
});

test("offers copy-ready application fields without making users retype resume details", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await openMenu(page);
  await page.getByRole("menuitem", { name: /copy for applications/i }).click();

  const dialog = page.getByRole("dialog", { name: /copy exactly what each portal asks for/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /copy full name/i })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /copy email/i })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /copy job title/i }).first()).toBeVisible();
  await expect(dialog.getByRole("button", { name: /copy achievements/i }).first()).toBeVisible();
  await expect(dialog.getByText("Senior Software Engineer · Acme Corp - San Francisco, CA")).toBeVisible();
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

  await page.getByRole("button", { name: /^export pdf$/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-print-title", "Jane_Doe_Resume");
  await expect(page).toHaveTitle("Resume Editor — private, ATS-friendly PDFs");
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

  await openTools(page);
  await expect(page.getByText("Experience entry 1 exceeds one printable page")).toBeVisible();
  await page.getByRole("button", { name: /shorten entry/i }).click();
  await expect(page.locator("#field-experience-0-details")).toBeFocused();
});

test("makes validated contact details actionable in the preview", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const preview = page.locator(".resume-sheet");
  await expect(preview.getByRole("link", { name: "jane.doe@example.com" })).toHaveAttribute("href", "mailto:jane.doe@example.com");
  await expect(preview.getByRole("link", { name: "(555) 123-4567" })).toHaveAttribute("href", "tel:(555) 123-4567");
  await expect(preview.getByRole("link", { name: "linkedin.com/in/janedoe" })).toHaveAttribute("href", "https://linkedin.com/in/janedoe");
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
  await page.getByLabel("Full Name").fill("Ada Lovelace");

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

  await page.getByLabel(/^Skills \(one group per line/).focus();
  await expect(page.locator(".resume-section.resume-preview-active")).toContainText("Skills");

  await page.getByRole("button", { name: /add custom section/i }).click();
  const customTitle = page.getByLabel("New Section section title");
  await customTitle.fill("Publications");
  await page.locator('[id^="field-custom-"][id$="-0-title"]').fill("Reliable Interfaces");

  const previewEntry = page.locator(".resume-sheet").getByText("Reliable Interfaces", { exact: true });
  await expect(page.locator(".resume-sheet").getByText("Publications", { exact: true })).toBeVisible();
  await previewEntry.click();
  await expect(page.locator('[id^="field-custom-"][id$="-0-title"]')).toBeFocused();

  await page.waitForTimeout(450);
  await page.reload();
  await expect(page.getByLabel("Selected Experience section title")).toHaveValue("Selected Experience");
  await expect(page.getByLabel("Publications section title")).toBeVisible();
});

test("keeps accidental entry and custom-section removal reversible", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const experience = page.locator('[data-editor-section="experience"]');
  await experience.getByRole("button", { name: /^remove$/i }).first().click();
  await expect(page.locator('[role="status"]').filter({ hasText: "Removed Experience entry" })).toBeVisible();
  await expect(experience.getByLabel("Job Title").first()).toHaveValue("Software Engineer");
  await page.getByRole("button", { name: /^undo$/i }).click();
  await expect(experience.getByLabel("Job Title").first()).toHaveValue("Senior Software Engineer");

  await page.getByRole("button", { name: /add custom section/i }).click();
  const sectionTitle = page.getByLabel("New Section section title");
  await sectionTitle.fill("Publications");
  await page.getByRole("button", { name: "Remove Publications section" }).click();
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

  await page.locator('[data-arrange-section="skills"] [draggable="true"]').dragTo(page.locator('[data-arrange-section="education"]'));

  const headings = page.locator(".resume-sheet .resume-section-title");
  await expect(headings.nth(0)).toHaveText("Skills");
  await expect(headings.nth(1)).toHaveText("Education");

  const rowPositions = await page.locator("[data-arrange-section]").evaluateAll((rows) =>
    rows.map((row) => Math.round(row.getBoundingClientRect().top)),
  );
  expect(rowPositions).toEqual([...rowPositions].sort((first, second) => first - second));
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

  await page.getByRole("button", { name: "Remove Education section" }).click();
  await expect(page.locator('[data-editor-section="education"]')).toBeHidden();
  await expect(page.getByRole("button", { name: "Education", exact: true })).toBeVisible();
  await expect(page.locator('[role="status"]').filter({ hasText: "Removed Education section" })).toBeVisible();
  await page.getByRole("button", { name: /^undo$/i }).click();
  await expect(page.locator('[data-editor-section="education"]').getByLabel("Degree").first()).toHaveValue("B.S. in Computer Science");

  await page.getByRole("button", { name: "Remove Education section" }).click();
  await page.getByRole("button", { name: "Education", exact: true }).click();
  await expect(page.locator('[data-editor-section="education"]').getByLabel("Degree").first()).toHaveValue("");
});

test("keeps a summary optional when the resume already has experience detail", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await page.getByLabel("Professional Summary").fill("");

  await openTools(page);
  await expect(page.getByText("Optional — experience leads")).toBeVisible();
  await expect(page.getByRole("button", { name: /add optional summary/i })).toBeVisible();
  await expect(page.getByText("Missing summary")).toBeHidden();
});

test("imports a pasted resume locally and keeps confirmation deliberate without repetitive clicks", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await expect(importDialog.getByText("OCR'd scanned PDF")).toBeVisible();
  await expect(importDialog.getByText("Nothing is uploaded or sent anywhere.")).toBeVisible();
  await importDialog.getByLabel("Resume text").fill(
    "Ada Lovelace\nPlatform Engineer\nada@example.com | San Francisco, CA\n\nExperience\nEngineer | Analytical Engines | 2022–Present\n• Built reliable systems.\n\nEducation",
  );
  await importDialog.getByRole("button", { name: /^import text$/i }).click();

  await expect(page.getByLabel("Full Name")).toHaveValue("Ada Lovelace");
  await expect(page.getByText("Import review")).toBeVisible();
  await expect(page.getByText("Imported pasted text - please review")).toBeVisible();
  await expect(page.getByText("What the importer detected")).toBeVisible();
  await expect(page.getByText("1 entry detected")).toBeVisible();
  await expect(page.getByText("Source excerpt:").first()).toBeVisible();
  await expect(page.getByText("Engineer | Analytical Engines | 2022–Present").first()).toBeVisible();
  await expect(page.getByText("Education heading found in source, but no entries detected")).toBeVisible();
  await expect(page.getByText("Source section needs review")).toBeVisible();
  await expect(page.getByText("“Not detected” means the importer did not place content there.")).toBeVisible();
  await page.getByRole("button", { name: /education education heading found in source/i }).click();
  await expect(page.locator("#add-education-entry")).toBeFocused();
  await expect(page.getByText(/0 of \d+ confirmed/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^finish review$/i })).toBeDisabled();
  await page.getByText("View the text used for this import").click();
  await expect(page.getByLabel("Imported source text")).toHaveValue(/Ada Lovelace[\s\S]*Built reliable systems\./);

  await page.getByRole("button", { name: /review next field/i }).click();
  await expect(page.locator("#field-name")).toBeFocused();
  await expect(page.getByText("Imported Contact details.")).toBeVisible();
  await expect(page.getByText("Matching source context:").first()).toBeVisible();
  await expect(page.getByText("Ada Lovelace", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: /mark contact details reviewed/i }).click();
  await expect(page.getByText(/1 of \d+ confirmed/)).toBeVisible();

  await page.getByRole("button", { name: /confirm all imported fields/i }).click();
  await expect(page.getByText(/All suggested fields are confirmed/i)).toBeVisible();
  await page.getByRole("button", { name: /^finish review$/i }).click();
  await expect(page.getByText("Import review")).toBeHidden();
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

  await expect(page.getByLabel("Summary")).toHaveValue("Platform engineer building dependable developer tools.");
  await expect(page.getByLabel("Job Title", { exact: true }).first()).toHaveValue("Staff Engineer");
  await expect(page.locator("#field-skills")).toHaveValue("TypeScript, React, systems design");
  await expect(page.getByText("What the importer detected")).toBeVisible();
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

  await expect(page.getByLabel("Professional Summary")).toHaveValue("Platform engineer building dependable developer tools.");
  await expect(page.locator("#field-skills")).toHaveValue("TypeScript, React, systems design");
  await expect(page.getByText("Summary text detected")).toBeVisible();
  await expect(page.getByText("1 skill line detected")).toBeVisible();
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

  await expect(page.getByText("Certifications entry 1", { exact: true })).toBeVisible();
  const title = page.getByLabel("Title", { exact: true });
  await expect(title).toHaveValue("Certified Kubernetes Administrator");
  await expect(page.getByText("Imported Certifications entry 1.")).toBeVisible();
  await title.scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: /mark certifications entry 1 reviewed/i }).click();
  await expect(page.getByRole("button", { name: /^confirmed$/i }).last()).toBeVisible();
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

  await expect(page.getByLabel("Summary")).toHaveValue("Platform engineer building dependable developer tools.");
  await expect(page.locator("#field-skills")).toHaveValue("TypeScript, React, systems design");
  await expect(page.getByLabel("Job Title", { exact: true }).first()).toHaveValue("Staff Engineer");
  await expect(page.getByText("Import review")).toBeVisible();
});

test("quickly corrects company-first imported experience entries", async ({ page }) => {
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

  const title = page.getByLabel("Job Title", { exact: true }).first();
  const company = page.getByLabel("Company", { exact: true }).first();
  await expect(title).toHaveValue("Analytical Engines");
  await expect(company).toHaveValue("Staff Engineer");
  await page.getByRole("button", { name: /switch role and employer/i }).click();
  await expect(title).toHaveValue("Staff Engineer");
  await expect(company).toHaveValue("Analytical Engines");
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

  await expect(page.getByText("Experience entry 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Experience entry 2", { exact: true })).toBeVisible();
  await page.locator(".min-h-24").filter({ hasText: "Experience entry 2" })
    .getByRole("button", { name: /^review field$/i }).click();
  await expect(page.locator("#field-experience-1-title")).toBeFocused();
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

  await expect(page.getByLabel("Job Title", { exact: true }).nth(0)).toHaveValue("Staff Engineer");
  await expect(page.getByLabel("Job Title", { exact: true }).nth(1)).toHaveValue("Software Engineer");
  await expect(page.getByText("Experience entry 2", { exact: true })).toBeVisible();
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

  await expect(page.getByLabel("Degree", { exact: true }).nth(0)).toHaveValue("Master of Science in Computer Science");
  await expect(page.getByLabel("Degree", { exact: true }).nth(1)).toHaveValue("Bachelor of Science in Mathematics");
  await expect(page.getByText("Education entry 2", { exact: true })).toBeVisible();
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

  await expect(page.getByText("Keep editing; confirm each imported field.")).toBeVisible();
  await expect(page.getByRole("button", { name: /review next imported field/i })).toBeVisible();
  await expect(page.locator("#import-review-panel")).toBeHidden();

  await page.getByRole("button", { name: /review next imported field/i }).click();
  await expect(page.locator("#field-name")).toBeFocused();

  await page.getByRole("button", { name: /^open checklist$/i }).click();
  await expect(page.locator("#import-review-panel")).toBeVisible();
  await expect(page.getByText("View the text used for this import")).toBeVisible();
  await page.getByRole("button", { name: /back to editing/i }).click();
  await expect(page.locator("#import-review-panel")).toBeHidden();

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

  const certificationCard = page.locator("#import-review-panel").getByRole("button", { name: /certifications/i });
  await expect(certificationCard).toContainText("Certifications heading found in source, but no entries detected");
  await expect(certificationCard).toContainText("Source section needs review");
  await certificationCard.click();
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

  await page.getByRole("button", { name: /export pdf/i }).click();
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
  await openTools(page);
  await expect(page.getByText("Missing contact details can make a strong resume impossible to follow up on.")).toBeVisible();
  await page.getByRole("button", { name: /fix contact/i }).click();

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

  await openTools(page);
  await expect(page.getByText("Not every bullet needs a number, but measurable scope or results make your strongest work more credible at a glance.")).toBeVisible();
  await page.getByRole("button", { name: /strengthen a bullet/i }).click();
  await expect(page.locator("#field-experience-0-details")).toBeFocused();
});

test("shows an in-context evidence cue for the bullets being edited", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await page.locator("#field-experience-0-details").fill(
    "Migrated the payment flow for 2 teams.\nMentored engineers through a release.\nReduced support tickets by 30%.",
  );

  await expect(page.getByText("2 of 3 bullets show measurable scope or results.")).toBeVisible();
  await expect(page.getByText("Review bullet 2. Add a truthful scale or outcome where you know it; not every bullet needs a number.")).toBeVisible();
});

test("gently prompts for specific action openings while preserving truthful bullet writing", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await page.locator("#field-experience-0-details").fill("Responsible for release planning.\nBuilt a deployment workflow for 3 teams.\nWorked on incident response.");

  await expect(page.getByText("Consider a more specific opening for bullet 1, bullet 3. Starting with what you did can make the contribution easier to scan; keep the wording truthful.")).toBeVisible();
});

test("suggests exact role phrases for a local wording review", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await openTools(page);

  await page
    .getByLabel("Job description")
    .fill("Build backend microservices, partner with product teams, and improve backend microservices.");

  const toolsDrawer = page.getByRole("dialog", { name: /review tools/i });
  const phraseButton = toolsDrawer.getByRole("button", { name: /backend microservices/i }).first();
  await expect(phraseButton).toBeVisible();
  await phraseButton.click();
  await expect(page.getByLabel("Check an exact phrase from this role")).toHaveValue("backend microservices");
  await expect(page.getByText("Phrase already appears in your resume.")).toBeVisible();
});

test("shows where a matched role term is supported in the resume", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await openTools(page);

  await page.getByLabel("Job description").fill("Build backend microservices and partner with product teams.");
  const evidenceButton = page.getByRole("button", { name: /experience 1/i }).first();
  await expect(evidenceButton).toBeVisible();
  await evidenceButton.click();
  await expect(page.locator("#field-experience-0-details")).toBeFocused();
});

test("counts truthful custom-section evidence in role focus and links back to it", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  await page.getByRole("button", { name: /certifications/i }).click();
  await page.locator('[id^="field-custom-"][id$="-0-details"]').fill("Administered Kubernetes clusters for production releases.");
  await openTools(page);
  await page.getByLabel("Job description").fill([
    "Requirements",
    "- Kubernetes experience",
    "- Certifications",
  ].join("\n"));

  await expect(page.getByText("kubernetes present", { exact: true })).toBeVisible();
  await expect(page.getByText("certifications present", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Certifications 1" }).click();
  await expect(page.locator('[id^="field-custom-"][id$="-0-details"]')).toBeFocused();
});

test("elevates explicit role requirements without treating them as an ATS score", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await openTools(page);

  await page.getByLabel("Job description").fill([
    "Build reliable product systems and collaborate across product teams.",
    "Requirements",
    "- TypeScript and GraphQL experience",
    "Benefits",
    "- Flexible work arrangements",
  ].join("\n"));

  await expect(page.getByText("Listed requirements", { exact: true })).toBeVisible();
  await expect(page.getByText("typescript present", { exact: true })).toBeVisible();
  await expect(page.getByText("graphql review", { exact: true })).toBeVisible();
  await expect(page.getByText(/This is a wording review, not an ATS score/i)).toBeVisible();
});

test("keeps mobile editing focused while leaving review tools one tap away", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  // Editing stays front-and-center; review tools live one tap away in the drawer.
  await expect(page.getByLabel("Full Name")).toBeVisible();
  await expect(page.getByLabel("Job description")).toBeHidden();

  await openTools(page);
  await expect(page.getByRole("dialog", { name: /review tools/i })).toBeVisible();
  await expect(page.getByText("Ready to export", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Job description")).toBeVisible();

  await page.getByRole("button", { name: /close tools/i }).click();
  await expect(page.getByRole("dialog", { name: /review tools/i })).toBeHidden();
  await expect(page.getByLabel("Full Name")).toBeVisible();

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
    return { width: sheet.offsetWidth, height: sheet.offsetHeight };
  });
  expect(printDimensions.width).toBeCloseTo(8.5 * 96, 0);
  expect(printDimensions.height).toBeGreaterThanOrEqual(11 * 96);
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

test("shows an export checkpoint before printing an unresolved resume", async ({ page }) => {
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

  await page.getByRole("button", { name: /export pdf/i }).click();
  const exportDialog = page.getByRole("dialog", { name: /review before exporting/i });
  await expect(exportDialog).toBeVisible();
  await expect(exportDialog.getByText("Missing contact details can make a strong resume impossible to follow up on.")).toBeVisible();

  await exportDialog.getByRole("button", { name: /fix contact/i }).click();
  await expect(page.locator("#field-phone")).toBeFocused();
  await expect(page.getByRole("dialog", { name: /review before exporting/i })).toBeHidden();

  await page.getByRole("button", { name: /export pdf/i }).click();
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
  await page.getByRole("button", { name: /export pdf/i }).click();

  const exportDialog = page.getByRole("dialog", { name: /review before exporting/i });
  await expect(exportDialog).toContainText("Invalid email");
  await expect(exportDialog).toContainText("Email needs an @ and domain");
  await exportDialog.getByRole("button", { name: /fix contact/i }).click();
  await expect(page.getByLabel("Email")).toBeFocused();
});

test("keeps import confirmation explicit in the export checkpoint", async ({ page }) => {
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

  await page.getByRole("button", { name: /export pdf/i }).click();
  const exportDialog = page.getByRole("dialog", { name: /review before exporting/i });
  await expect(exportDialog.getByText("Imported fields still need review")).toBeVisible();
  await expect(exportDialog.getByText(/0\/\d+ confirmed/)).toBeVisible();
  await expect(exportDialog.getByRole("button", { name: /review next field/i })).toBeVisible();
  await expect(exportDialog.getByRole("button", { name: /mark reviewed/i })).toHaveCount(0);

  await exportDialog.getByRole("button", { name: /review next field/i }).click();
  await expect(page.locator("#field-name")).toBeFocused();
});

test("shows when the resume changed after the last PDF export", async ({ page }) => {
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
  await openTools(page);

  await page.getByRole("button", { name: /export pdf/i }).click();

  await expect.poll(() => page.evaluate(() => localStorage.getItem("print-called"))).toBe("true");
  await expect(page.getByText("Current resume matches your last PDF export.")).toBeVisible();

  await page.getByLabel("Professional Summary").fill("Edited summary for the next application.");

  await expect(page.getByText("This resume changed since your last PDF export.")).toBeVisible();
  const summaryChange = page.getByRole("button", { name: /summary changed/i });
  await expect(summaryChange).toBeVisible();
  await expect(summaryChange.getByText("Before", { exact: true })).toBeVisible();
  await expect(summaryChange.getByText("Now", { exact: true })).toBeVisible();
  await expect(summaryChange.getByText("Edited summary for the next application.")).toBeVisible();
  await expect(page.getByRole("button", { name: /export updated pdf/i })).toBeVisible();
});

test("expands dense change audits after export and restore", async ({ page }) => {
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
  await openTools(page);

  await page.getByRole("button", { name: /save version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Clean baseline");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  await page.getByRole("button", { name: /export pdf/i }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("print-called"))).toBe("true");

  await page.getByLabel("Full Name").fill("Ada Lovelace");
  await page.getByLabel("Professional Summary").fill("Research engineer focused on developer tools and reliable launches.");
  await page.getByLabel("Job Title").first().fill("Staff Software Engineer");
  await page.getByLabel("Degree").fill("M.S. Computer Science");
  await page.getByLabel("Project Name").fill("Launch Review Hub");
  await page.getByLabel('Skills (one group per line, e.g. "Languages: Python, Go")').fill("Languages: TypeScript, Python\nTools: Playwright, AWS");

  await expect(page.getByText("2 more changed areas")).toBeVisible();
  await expect(page.getByText("Projects changed")).toBeHidden();
  await page.getByRole("button", { name: /show all changes/i }).click();
  await expect(page.getByText("Showing all 6 changed areas")).toBeVisible();
  await expect(page.getByText("Projects changed")).toBeVisible();
  await expect(page.getByText("Skills changed")).toBeVisible();

  await page.getByRole("button", { name: /^restore$/i }).click();
  await expect(page.getByText("Checkpoint restored")).toBeVisible();
  await expect(page.getByText("2 more changed areas")).toBeVisible();
  await page.getByRole("button", { name: /show all changes/i }).click();
  await expect(page.getByText("Showing all 6 changed areas")).toBeVisible();
  await expect(page.getByText("Projects changed")).toBeVisible();
  await expect(page.getByText("Skills changed")).toBeVisible();
});

test("restores the previous resume after clearing", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await page.getByLabel("Full Name").fill("Ada Lovelace");

  await openMenu(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("menuitem", { name: /^clear$/i }).click();

  await expect(page.getByText("Restore point saved")).toBeVisible();
  await page.getByRole("button", { name: /restore previous/i }).click();

  await expect(page.getByLabel("Full Name")).toHaveValue("Ada Lovelace");
  await expect(page.getByText("Restore point saved")).toBeHidden();
});

test("saves and restores a named local version history checkpoint", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await openTools(page);

  await page.getByRole("button", { name: /save version/i }).click();
  await expect(page.getByRole("dialog", { name: /name this checkpoint/i })).toBeVisible();
  await page.getByLabel("Checkpoint name").fill("Original software resume");
  await page.getByLabel("Note (optional)").fill("Before tailoring for the platform role.");
  await expect(page.getByText("No role focus to include")).toBeVisible();
  await page.getByRole("button", { name: /save checkpoint/i }).click();
  await expect(page.getByText("Version saved locally")).toBeVisible();
  await expect(page.getByText("Original software resume")).toBeVisible();
  await expect(page.getByText("Before tailoring for the platform role.")).toBeVisible();
  await expect(page.getByText("Current", { exact: true })).toBeVisible();
  await expect(page.getByText("Jane Doe").first()).toBeVisible();
  await expect(page.getByText("2 roles")).toBeVisible();
  await expect(page.getByText("1 project")).toBeVisible();
  await expect(page.getByText("4 skill lines")).toBeVisible();

  await page.getByLabel("Full Name").fill("Grace Hopper");
  await page.getByLabel("Job Title").first().fill("Principal Software Engineer");
  await expect(page.getByLabel("Full Name")).toHaveValue("Grace Hopper");
  await expect(page.getByText("Suggested checkpoint")).toBeVisible();
  await expect(page.getByRole("button", { name: /review differences/i })).toBeVisible();
  await expect(page.getByText("2 changed areas").first()).toBeVisible();

  await page.getByRole("button", { name: /compare/i }).click();
  const compareDialog = page.getByRole("dialog", { name: /compare saved checkpoint/i });
  await expect(compareDialog).toBeVisible();
  const headerChange = compareDialog.getByRole("button", { name: /header changed/i });
  await expect(headerChange).toBeVisible();
  await expect(headerChange.getByText("Full name")).toBeVisible();
  await expect(compareDialog.getByText("Experience changed")).toBeVisible();
  await expect(compareDialog.getByText("Entry 1 Job title")).toBeVisible();
  await expect(headerChange.getByText("Saved", { exact: true })).toBeVisible();
  await expect(headerChange.getByText("Current", { exact: true })).toBeVisible();
  await expect(compareDialog.getByText("Jane Doe")).toBeVisible();
  await expect(compareDialog.getByText("Grace Hopper")).toBeVisible();

  await headerChange.click();
  await expect(page.locator("#field-name")).toBeFocused();
  await expect(compareDialog).toBeHidden();

  await openTools(page);
  await page.getByRole("button", { name: /^restore$/i }).click();
  await expect(page.getByLabel("Full Name")).toHaveValue("Jane Doe");
  await expect(page.getByText("Checkpoint restored")).toBeVisible();
  const restoredChange = page.getByRole("button", { name: /header changed/i }).first();
  await expect(restoredChange.getByText("Before", { exact: true })).toBeVisible();
  await expect(restoredChange.getByText("Restored", { exact: true })).toBeVisible();
  await restoredChange.click();
  await expect(page.locator("#field-name")).toBeFocused();
  await expect(page.getByText("Restore point saved")).toBeVisible();

  await openTools(page);
  await page.getByLabel("Delete saved version Original software resume").click();
  await expect(page.getByText("Deleted checkpoint")).toBeVisible();
  await expect(page.getByText("Restore it to version history before closing this page.")).toBeVisible();

  await page.getByRole("button", { name: /undo delete/i }).click();
  await expect(page.getByText("Restored deleted checkpoint")).toBeVisible();
  await expect(page.getByLabel("Delete saved version Original software resume")).toBeVisible();
});

test("restores the local role focus saved with a tailored checkpoint", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await openTools(page);

  const description = page.getByLabel("Job description");
  await description.fill("Build TypeScript services for product teams and improve release reliability.");
  await page.getByRole("button", { name: /save version/i }).click();
  const saveDialog = page.getByRole("dialog", { name: /name this checkpoint/i });
  await expect(saveDialog.getByText("Role focus included")).toBeVisible();
  await page.getByLabel("Checkpoint name").fill("Platform role draft");
  await page.getByRole("button", { name: /save checkpoint/i }).click();
  await expect(page.getByText("Role focus saved · Build TypeScript services for product teams and improve release reliability.")).toBeVisible();

  await description.fill("Lead design systems for a consumer product team.");
  await page.getByLabel("Professional Summary").fill("Product engineer focused on reliable platform launches.");
  await page.getByRole("button", { name: /^restore$/i }).click();

  await expect(description).toHaveValue("Build TypeScript services for product teams and improve release reliability.");
  await page.getByRole("button", { name: /restore previous/i }).click();
  await expect(description).toHaveValue("Lead design systems for a consumer product team.");
});

test("offers a base checkpoint where users start a local role review", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await openTools(page);

  await page.getByLabel("Private role label (optional)").fill("Acme — Senior Product Engineer");
  await page.getByLabel("Job description").fill("Build reliable product experiences for growing teams.");
  await expect(page.getByText("Save your base before tailoring")).toBeVisible();

  await page.getByRole("button", { name: /save base draft/i }).click();
  const saveDialog = page.getByRole("dialog", { name: /name this checkpoint/i });
  await expect(saveDialog).toBeVisible();
  await expect(saveDialog.getByText("Role focus included")).toBeVisible();
  await page.getByLabel("Checkpoint name").fill("Acme base resume");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  await expect(page.getByText("Acme base resume")).toBeVisible();
  await expect(page.getByText(/Role label · Acme — Senior Product Engineer/)).toBeVisible();
});

test("keeps same-resume checkpoints separate for different private role labels", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await openTools(page);

  await page.getByLabel("Private role label (optional)").fill("Acme — Senior Product Engineer");
  await page.getByLabel("Job description").fill("Build reliable product experiences for growing teams.");
  await page.getByRole("button", { name: /save version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Acme application");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  await page.getByLabel("Private role label (optional)").fill("Northstar — Platform Engineer");
  await page.getByLabel("Job description").fill("Build scalable platform systems for engineering teams.");
  await page.getByRole("button", { name: /save version/i }).click();
  await expect(page.getByText("Matching checkpoint found")).toBeHidden();
  await page.getByLabel("Checkpoint name").fill("Northstar application");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  await expect(page.getByText("2/5 saved")).toBeVisible();
  await expect(page.getByText(/Role label · Acme — Senior Product Engineer/)).toBeVisible();
  await expect(page.getByText(/Role label · Northstar — Platform Engineer/)).toBeVisible();
});

test("clears an unrelated role focus when restoring a checkpoint without one", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await openTools(page);

  await page.getByRole("button", { name: /save version/i }).click();
  await page.getByLabel("Checkpoint name").fill("General resume");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  const description = page.getByLabel("Job description");
  await description.fill("Lead design systems for a consumer product team.");
  await page.getByRole("button", { name: /^restore$/i }).click();

  await expect(description).toHaveValue("");
  await expect(page.getByRole("button", { name: /clear description/i })).toBeHidden();
  await page.getByRole("button", { name: /restore previous/i }).click();
  await expect(description).toHaveValue("Lead design systems for a consumer product team.");
});

test("audits changed role focus even when a saved resume still matches", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await openTools(page);

  const description = page.getByLabel("Job description");
  await description.fill("Build reliable platform services for product teams.");
  await page.getByRole("button", { name: /save version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Platform services role");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  await description.fill("Lead a consumer design system for mobile experiences.");
  await expect(page.getByText("Same resume", { exact: true })).toBeVisible();
  await expect(page.getByText("Role focus changed", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /^compare$/i }).click();
  const compareDialog = page.getByRole("dialog", { name: /compare saved checkpoint/i });
  await expect(compareDialog.getByText("Role focus changed", { exact: true })).toBeVisible();
  await expect(compareDialog.getByText("No resume differences found")).toBeVisible();
  await expect(compareDialog.getByText("Build reliable platform services for product teams.")).toBeVisible();
  await expect(compareDialog.getByText("Lead a consumer design system for mobile experiences.")).toBeVisible();
  await expect(compareDialog.getByText("Same resume · role focus changed")).toBeVisible();
});

test("compares two saved version history checkpoints", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await openTools(page);

  await page.getByRole("button", { name: /save version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Original software resume");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  await page
    .getByLabel("Professional Summary")
    .fill("Platform engineer focused on infrastructure launches, reliability, and internal developer tools.");
  await page.getByRole("button", { name: /save version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Platform tailoring draft");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  await expect(page.getByText("Derived from Original software resume")).toBeVisible();
  await expect(page.getByText("Compare two saved checkpoints")).toBeVisible();
  await page.getByRole("button", { name: /compare saved versions/i }).click();

  const compareDialog = page.getByRole("dialog", { name: /compare saved versions/i });
  await expect(compareDialog).toBeVisible();
  await expect(compareDialog.getByText("Platform tailoring draft")).toBeVisible();
  await expect(compareDialog.getByText("Original software resume")).toBeVisible();
  await expect(compareDialog.getByText("Summary changed")).toBeVisible();
  await expect(compareDialog.getByText("Base", { exact: true })).toBeVisible();
  await expect(compareDialog.getByText("Compared", { exact: true })).toBeVisible();
  await expect(compareDialog.getByText("Platform engineer focused on infrastructure launches")).toBeVisible();
  await expect(compareDialog.getByText("Software engineer specializing")).toBeVisible();
  await expect(compareDialog.getByRole("button", { name: /restore compared/i })).toBeVisible();
  await expect(compareDialog.getByRole("button", { name: /restore base/i })).toBeVisible();
});

test("warns before replacing the oldest local version history checkpoint", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await openTools(page);

  for (let index = 1; index <= 5; index += 1) {
    await page
      .getByLabel("Professional Summary")
      .fill(`Tailored summary ${index} with enough specific context for this saved checkpoint.`);
    await page.getByRole("button", { name: /save version/i }).click();
    await page.getByLabel("Checkpoint name").fill(`Checkpoint ${index}`);
    await page.getByRole("button", { name: /save checkpoint/i }).click();
  }

  await expect(page.getByText("5/5 saved")).toBeVisible();
  await expect(page.getByText("New checkpoints replace the oldest saved draft.")).toBeVisible();
  await expect(
    page.getByText("Checkpoint 1 is the oldest checkpoint and will be replaced first by a new unique save."),
  ).toBeVisible();

  await page
    .getByLabel("Professional Summary")
    .fill("Tailored summary 6 with a new role-specific angle that should replace the oldest checkpoint.");
  await page.getByRole("button", { name: /save with review/i }).click();

  const saveDialog = page.getByRole("dialog", { name: /name this checkpoint/i });
  await expect(saveDialog).toBeVisible();
  await expect(saveDialog.getByText("History is full")).toBeVisible();
  await expect(saveDialog.getByText("Saving a new checkpoint will replace Checkpoint 1")).toBeVisible();

  await page.getByLabel("Checkpoint name").fill("Checkpoint 6");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  await expect(page.getByText("Saved locally and replaced Checkpoint 1")).toBeVisible();
  await expect(page.getByText("Checkpoint 6", { exact: true })).toBeVisible();
  await expect(page.getByText("Checkpoint 1", { exact: true })).toBeHidden();
  await expect(page.getByText("5/5 saved")).toBeVisible();
});

test("imports a checkpoint history backup without replacing the current resume", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await openTools(page);
  await page.getByRole("button", { name: /save version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Platform baseline");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

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
  await expect(page.getByText("Start from a resume you have—or a clean page.")).toBeVisible();
  await page.locator("#history-backup-input").setInputFiles({
    name: "resume-checkpoints.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });

  const backupDialog = page.getByRole("dialog", { name: /add saved checkpoints from backup/i });
  await expect(backupDialog).toBeVisible();
  await expect(backupDialog.getByText("Platform baseline")).toBeVisible();
  await backupDialog.getByRole("button", { name: /add checkpoints/i }).click();

  await expect(page.getByText("Added 1 checkpoint")).toBeVisible();
  await expect(page.getByText("Start from a resume you have—or a clean page.")).toBeVisible();
  await openTools(page);
  await expect(page.getByText("Platform baseline").first()).toBeVisible();
});

test("makes matching checkpoint backups explicit before merging", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await openTools(page);
  await page.getByRole("button", { name: /save version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Platform baseline");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

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

  const backupDialog = page.getByRole("dialog", { name: /add saved checkpoints from backup/i });
  await expect(backupDialog.getByText("No new checkpoints to add")).toBeVisible();
  await expect(backupDialog.getByText("1 checkpoint already matches this browser")).toBeVisible();
  await expect(backupDialog.getByText("Matching drafts will not use another local history slot.")).toBeVisible();
  await backupDialog.getByRole("button", { name: /add checkpoints/i }).click();

  await expect(page.getByText("All backup checkpoints are already saved")).toBeVisible();
  await expect(page.getByText("Platform baseline", { exact: true })).toHaveCount(1);
});

test("names checkpoints that remain only in a large imported backup", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await openTools(page);
  await page.getByRole("button", { name: /save version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Template checkpoint");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  const checkpoint = await page.evaluate(() => {
    const history = JSON.parse(localStorage.getItem("resume-editor-version-history-v1") ?? "[]");
    return history[0];
  });
  const checkpoints = Array.from({ length: 5 }, (_, index) => ({
    ...checkpoint,
    id: `backup-${index + 1}`,
    label: `Archived checkpoint ${index + 1}`,
    fingerprint: `backup-fingerprint-${index + 1}`,
    savedAt: new Date(Date.UTC(2026, 0, 5 - index)).toISOString(),
  }));
  const backup = JSON.stringify({
    format: "resume-editor-version-history-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    checkpoints,
  });

  await page.locator("#history-backup-input").setInputFiles({
    name: "large-resume-checkpoints.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });

  const backupDialog = page.getByRole("dialog", { name: /add saved checkpoints from backup/i });
  await expect(backupDialog).toBeVisible();
  await expect(backupDialog.getByText("5 unique checkpoints ready to add")).toBeVisible();
  await expect(backupDialog.getByText("1 older checkpoint will stay only in this backup")).toBeVisible();
  await expect(backupDialog.getByText(/Archived checkpoint 5 ·/)).toBeVisible();
  await backupDialog.getByRole("button", { name: /add checkpoints/i }).click();

  await expect(page.getByText("Archived checkpoint 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Archived checkpoint 5", { exact: true })).toBeHidden();
});

test("reviews every checkpoint in backups larger than local history", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await openTools(page);
  await page.getByRole("button", { name: /save version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Template checkpoint");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

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
  await expect(backupDialog.getByText("7 unique checkpoints ready to add")).toBeVisible();
  await expect(backupDialog.getByText("3 older checkpoints will stay only in this backup")).toBeVisible();
  await expect(backupDialog.getByText(/Expanded checkpoint 7 ·/)).toBeVisible();

  await backupDialog.getByRole("button", { name: /add checkpoints/i }).click();
  await expect(page.getByText("Added 4 checkpoints")).toBeVisible();
  await expect(page.getByText("Expanded checkpoint 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Expanded checkpoint 7", { exact: true })).toBeHidden();
});

test("reviews role language locally without presenting an ATS score", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);
  await openTools(page);

  const description = page.getByLabel("Job description");
  await description.fill(
    "Build TypeScript services for product teams. Partner with platform teams to improve TypeScript reliability.",
  );

  await expect(page.getByText(/selected terms already used/i)).toBeVisible();
  await expect(page.getByText("typescript", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("partner", { exact: true })).toBeVisible();
  await expect(page.getByText("This is a wording review, not an ATS score.")).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("resume-editor-role-focus-v1"))).toContain("TypeScript");

  const phrase = page.getByLabel("Check an exact phrase from this role");
  await phrase.fill("JavaScript TypeScript");
  await expect(page.getByText("Phrase already appears in your resume.")).toBeVisible();
  await phrase.fill("platform teams");
  await expect(page.getByText("Phrase not found verbatim in your resume.")).toBeVisible();

  await page.getByRole("button", { name: /clear description/i }).click();
  await expect(description).toHaveValue("");
  await expect(phrase).toBeHidden();
});
