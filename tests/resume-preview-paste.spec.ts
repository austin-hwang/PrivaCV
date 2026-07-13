import { expect, test, type Page } from "@playwright/test";

async function loadSample(page: Page) {
  await page.getByRole("button", { name: /^more actions$/i }).click();
  await page.getByRole("menuitem", { name: /^sample$/i }).click();
}

test("keeps rich clipboard markup out of one-line canvas fields", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loadSample(page);

  const name = page.locator(".resume-name");
  await name.click();
  await name.evaluate((element) => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const clipboard = new DataTransfer();
    clipboard.setData("text/plain", "Ada Lovelace\nPrincipal Engineer");
    clipboard.setData("text/html", "<strong>Ada Lovelace</strong><em>Principal Engineer</em>");
    element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: clipboard }));
  });

  await expect(name).toHaveText("Ada Lovelace Principal Engineer");
  await expect(name.locator("strong, em")).toHaveCount(0);
  await page.getByLabel("Full Name").click();
  await expect(page.getByLabel("Full Name")).toHaveValue("Ada Lovelace Principal Engineer");
});
