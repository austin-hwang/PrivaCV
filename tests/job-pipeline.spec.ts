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

test("captures an immutable checkpoint when an application is submitted", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Sample", exact: true }).click();
  await expect(page.locator("[data-autosave-status]")).toHaveAttribute("data-autosave-status", "saved");

  await page.getByRole("button", { name: "Edit history", exact: true }).click();
  const history = page.getByRole("region", { name: /edit history/i });
  await history.getByRole("button", { name: /save current version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Product baseline");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  await page.goto("/applications");
  await page.getByRole("button", { name: "Add application" }).click();
  const createDialog = page.getByRole("dialog", { name: "Add an application" });
  await createDialog.getByLabel("Company").fill("Northstar Labs");
  await createDialog.getByLabel("Role").fill("Product Lead");
  await createDialog.getByLabel("Status").selectOption("applied");
  await createDialog.getByLabel("Resume for this application").selectOption({ label: "John Doe — Product baseline" });
  await createDialog.getByRole("button", { name: "Add application" }).click();

  await page.getByRole("button", { name: /Product Lead/ }).click();
  const detail = page.getByRole("dialog", { name: "Product Lead" });
  await expect(detail.getByText(/Submitted snapshot captured/)).toContainText("John Doe — Product baseline");
  await expect(detail.getByText("Captured submitted resume")).toBeVisible();

  const snapshot = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("privacv-job-pipeline");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise<{ label: string; checkpointId?: string; data: { name?: string } }>((resolve, reject) => {
      const request = database.transaction("resumeSnapshots", "readonly").objectStore("resumeSnapshots").getAll();
      request.onsuccess = () => resolve(request.result[0]);
      request.onerror = () => reject(request.error);
    });
  });
  expect(snapshot).toMatchObject({ label: "John Doe — Product baseline", data: { name: "John Doe" } });
  expect(snapshot.checkpointId).toBeTruthy();
});
