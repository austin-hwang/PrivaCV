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
  await page.evaluate(async () => {
    localStorage.clear();
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith("webllm/") || name === "tvmjs")
        .map((name) => caches.delete(name)),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: /open tools/i }).click();
  await page.getByRole("dialog", { name: /^tools$/i }).getByRole("button", { name: /local ai/i }).click();

  const dialog = page.getByRole("dialog");
  const modelSelect = dialog.getByRole("combobox", { name: /model/i });
  await expect(dialog).toBeVisible();
  await expect(modelSelect).toBeEnabled();
  await expect(modelSelect).toBeFocused();
  await expect(dialog).toHaveCSS("z-index", "80");
  await expect(page.locator("[data-dialog-overlay]")).toHaveCSS("z-index", "70");
  await expect(dialog).toContainText("Nothing downloads automatically");
  await expect(dialog).toContainText("Performance may be slower on some devices");
  await expect(dialog).toContainText("suggestions may be inaccurate");
  await expect(dialog.getByText("Not downloaded", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByRole("button", { name: "Download and load model" })).toBeEnabled();
  await expect(modelSelect).toHaveValue("Llama-3.2-3B-Instruct-q4f16_1-MLC");
  await expect(dialog.getByText(/Llama 3\.2 3B:/)).toBeVisible();
  await expect(dialog).toContainText("Recommended for stronger rewrites");
  await expect(dialog.getByRole("option", { name: /Phi-4 Mini.*3\.4 GB/i })).toHaveCount(1);
  await expect(dialog.getByRole("option", { name: /DeepSeek R1 Llama 8B.*5\.0 GB/i })).toHaveCount(1);
  await expect(dialog.getByRole("option", { name: /SmolLM2|Qwen 3 0\.6B/i })).toHaveCount(0);

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
  await expect(inlineEdit.getByLabel("Suggested AI edits").getByRole("button")).toHaveCount(4);
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
