import { expect, test } from "@playwright/test";

test("tracks a job application lifecycle in IndexedDB", async ({ page }) => {
  await page.goto("/applications");

  await expect(page).toHaveTitle("Private Job Application Tracker | PrivaCV");
  await expect(page.getByRole("heading", { name: "Job pipeline" })).toBeVisible();
  await expect(page.getByText("Local only", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add application" }).click();
  const createDialog = page.getByRole("dialog", { name: "Add an application" });
  await createDialog.getByLabel("Company").fill("Northstar Labs");
  await createDialog.getByLabel("Role").fill("Senior Product Designer");
  await createDialog.getByLabel("Location").fill("Remote");
  await createDialog.getByLabel("Job posting URL").fill("https://example.com/jobs/product-designer");
  await createDialog.getByLabel("Job description snapshot").fill("Lead product design for a privacy-focused platform.");
  await createDialog.getByRole("button", { name: "Add application" }).click();

  await expect(page.getByRole("button", { name: /Senior Product Designer/ })).toBeVisible();
  await expect(page.getByText("1 application in this view")).toBeVisible();

  await page.getByRole("button", { name: /Senior Product Designer/ }).click();
  const detailDialog = page.getByRole("dialog", { name: "Senior Product Designer" });
  await detailDialog.getByLabel("Status").selectOption("applied");
  await detailDialog.getByLabel("Next action").fill("Follow up with the recruiter");
  await detailDialog.getByLabel("Due date").fill("2026-07-25");
  await detailDialog.getByRole("button", { name: "Save changes" }).click();

  const appliedColumn = page.getByRole("region", { name: "Applied applications" });
  await expect(appliedColumn.getByText("Senior Product Designer")).toBeVisible();
  await expect(appliedColumn.getByText("Follow up with the recruiter")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: /Senior Product Designer/ })).toBeVisible();
  await page.getByRole("button", { name: /Senior Product Designer/ }).click();
  await expect(page.getByRole("dialog", { name: "Senior Product Designer" }).getByText("Moved to Applied")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Senior Product Designer" }).getByLabel("Job description snapshot")).toHaveValue("Lead product design for a privacy-focused platform.");
});
