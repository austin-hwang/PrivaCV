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
  await expect(page.getByText("Missing contact details can make a strong resume impossible to follow up on.")).toBeVisible();
  await page.getByRole("button", { name: /fix contact/i }).click();

  await expect(page.locator("#field-phone")).toBeFocused();
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
  await page.getByRole("button", { name: /^sample$/i }).click();
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
  await page.getByRole("button", { name: /^sample$/i }).click();

  await page.getByRole("button", { name: /export pdf/i }).click();
  await page.getByRole("button", { name: /export anyway/i }).click();

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

test("restores the previous resume after clearing", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^sample$/i }).click();
  await page.getByLabel("Full Name").fill("Ada Lovelace");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /^clear$/i }).click();

  await expect(page.getByText("Restore point saved")).toBeVisible();
  await page.getByRole("button", { name: /restore previous/i }).click();

  await expect(page.getByLabel("Full Name")).toHaveValue("Ada Lovelace");
  await expect(page.getByText("Restore point saved")).toBeHidden();
});

test("saves and restores a named local version history checkpoint", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^sample$/i }).click();

  await page.getByRole("button", { name: /save version/i }).click();
  await expect(page.getByRole("dialog", { name: /name this checkpoint/i })).toBeVisible();
  await page.getByLabel("Checkpoint name").fill("Original software resume");
  await page.getByLabel("Note (optional)").fill("Before tailoring for the platform role.");
  await page.getByRole("button", { name: /save checkpoint/i }).click();
  await expect(page.getByText("Version saved locally")).toBeVisible();
  await expect(page.getByText("Original software resume")).toBeVisible();
  await expect(page.getByText("Before tailoring for the platform role.")).toBeVisible();

  await page.getByLabel("Full Name").fill("Grace Hopper");
  await page.getByLabel("Job Title").first().fill("Principal Software Engineer");
  await expect(page.getByLabel("Full Name")).toHaveValue("Grace Hopper");

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

  await page.getByRole("button", { name: /^restore$/i }).click();
  await expect(page.getByLabel("Full Name")).toHaveValue("Jane Doe");
  await expect(page.getByText("Restore point saved")).toBeVisible();
});
