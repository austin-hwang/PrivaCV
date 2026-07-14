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
  await dialog.getByRole("combobox", { name: /model/i }).selectOption("Qwen2.5-0.5B-Instruct-q4f16_1-MLC");
  await expect(dialog.getByText(/Qwen 2\.5 0\.5B:/)).toBeVisible();
  await expect(dialog).toContainText("Compact multilingual option");

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
  const instruction = inlineEdit.getByLabel(/ai edit instruction/i);
  await expect(instruction).toBeVisible();
  await expect(instruction).toHaveAttribute("maxlength", "100");
  await expect(inlineEdit.getByText("0/100", { exact: true })).toBeVisible();
  await expect(inlineEdit.getByRole("button", { name: /open setup/i })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /local ai setup/i })).toBeHidden();
});

test("temporarily hides local AI import repair while small-model quality is inconsistent", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /paste resume text/i }).click();
  const importDialog = page.getByRole("dialog", { name: /paste the resume you already have/i });
  await importDialog.getByLabel("Resume text").fill(
    "Ada Lovelace\nPlatform Engineer\nada@example.com\n\nExperience\nEngineer | Analytical Engines | 2022-Present\nBuilt reliable systems.",
  );
  await importDialog.getByRole("button", { name: /^import text$/i }).click();

  await expect(page.getByRole("button", { name: /fix import with ai/i })).toHaveCount(0);
  await expect(page.getByRole("region", { name: /fix import with local ai/i })).toHaveCount(0);
});
