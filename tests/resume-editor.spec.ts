import { expect, test } from "@playwright/test";

test("loads the sample resume and reviews plain text", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^sample$/i }).click();

  await expect(page.getByText("Resume Check")).toBeVisible();
  await expect(page.getByText("Jane Doe").first()).toBeVisible();

  await page.getByRole("button", { name: /review text/i }).click();
  await expect(page.getByRole("dialog", { name: /review before copying/i })).toBeVisible();
  await expect(page.locator("textarea[readonly]")).toContainText("Jane Doe");
});

test("focuses the field behind a failed resume check", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^sample$/i }).click();

  await page.getByLabel("Phone").fill("");
  await page.getByRole("button", { name: /fix contact/i }).click();

  await expect(page.locator("#field-phone")).toBeFocused();
});
