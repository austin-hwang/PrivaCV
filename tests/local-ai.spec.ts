import { expect, test } from "@playwright/test";

test("local AI setup stays explicit and warns about device limits", async ({ page }) => {
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
  await expect(dialog).toContainText("WebGPU support, speed, and available memory vary");
  await expect(dialog.getByText("Not downloaded", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Download and load model" })).toBeEnabled();

  await page.waitForTimeout(250);
  expect(modelRequests).toEqual([]);
});
