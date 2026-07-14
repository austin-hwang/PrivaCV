import { expect, test } from "@playwright/test";

test("local AI setup stays explicit and gives a concise quality disclaimer", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: {
        requestAdapter: async () => ({ features: { has: () => false } }),
      },
    });
  });
  const modelRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (/huggingface\.co|raw\.githubusercontent\.com\/mlc-ai\/binaries|\.wasm(?:\?|$)/i.test(url)) {
      modelRequests.push(url);
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Local AI", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Nothing downloads automatically");
  await expect(dialog).toContainText("Performance may be slower on some devices");
  await expect(dialog).toContainText("suggestions may be inaccurate");
  await expect(dialog.getByText("Not downloaded", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Download and load model" })).toBeEnabled();

  await page.waitForTimeout(250);
  expect(modelRequests).toEqual([]);
});

test("offers a small local AI prompt beside resume body text", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^more actions$/i }).click();
  await page.getByRole("menuitem", { name: /^sample$/i }).click();

  const magicButton = page.locator('[data-ai-edit-for="field-summary"]');
  await expect(magicButton).toBeVisible();
  await magicButton.click();

  const inlineEdit = page.getByLabel(/edit professional summary with local ai/i);
  await expect(inlineEdit).toBeVisible();
  await expect(inlineEdit.getByLabel(/ai edit instruction/i)).toBeVisible();
  await expect(inlineEdit.getByRole("button", { name: /open setup/i })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /local ai setup/i })).toBeHidden();
});

test("places import repair by the preview and keeps it gated on local setup", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill(
    "Ada Lovelace\nPlatform Engineer\nada@example.com\n\nExperience\nEngineer | Analytical Engines | 2022-Present\nBuilt reliable systems.",
  );
  await importDialog.getByRole("button", { name: /^import text$/i }).click();

  const fixButton = page.getByRole("button", { name: /fix import with ai/i });
  await expect(fixButton).toBeEnabled();
  const editButton = page.getByRole("button", { name: /edit(?:ing)? on sheet/i });
  const hideEditorButton = page.getByRole("button", { name: /hide editor/i });
  const [fixBox, editBox, hideBox] = await Promise.all([
    fixButton.boundingBox(),
    editButton.boundingBox(),
    hideEditorButton.boundingBox(),
  ]);
  expect(Math.abs(fixBox!.y - editBox!.y)).toBeLessThan(2);
  expect(Math.abs(fixBox!.y - hideBox!.y)).toBeLessThanOrEqual(2);
  await fixButton.click();
  const repair = page.getByRole("region", { name: /fix import with local ai/i });
  await expect(repair).toContainText(/original extracted text stays in this browser/i);
  await expect(repair.getByRole("button", { name: /open setup/i })).toBeVisible();
});

test("keeps import repair available for a legacy review whose source was not persisted", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill(
    "Ada Lovelace\nPlatform Engineer\nada@example.com\n\nExperience\nEngineer | Analytical Engines | 2022-Present\nBuilt reliable systems.",
  );
  await importDialog.getByRole("button", { name: /^import text$/i }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("resume-editor-import-review-v1"))).not.toBeNull();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("resume-editor-data-v2"))).not.toBeNull();
  await page.evaluate(() => {
    const key = "resume-editor-import-review-v1";
    const review = JSON.parse(localStorage.getItem(key) ?? "{}");
    delete review.sourceText;
    localStorage.setItem(key, JSON.stringify(review));
  });
  await page.reload();

  const fixButton = page.getByRole("button", { name: /fix import with ai/i });
  await expect(fixButton).toBeEnabled();
  await fixButton.click();
  await expect(page.getByRole("region", { name: /fix import with local ai/i })).toContainText(
    /model will reorganize the current parsed draft/i,
  );
});
