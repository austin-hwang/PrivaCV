import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("switches between the resume and application workspaces", async ({ page }) => {
  await page.goto("/applications");
  const applicationsNav = page.getByRole("navigation", { name: "Workspace" });
  await expect(page.locator("[data-local-save-status]")).toHaveAttribute(
    "data-local-save-status",
    "saved",
  );
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: /use light mode/i })).toBeVisible();
  await page.keyboard.press("Escape");
  await applicationsNav.getByRole("link", { name: "Resume" }).click();
  await expect(page).toHaveURL(/\/$/);

  const resumeNav = page.getByRole("navigation", { name: "Workspace" });
  await expect(resumeNav.getByRole("link", { name: "Resume" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await resumeNav.getByRole("link", { name: "Applications" }).click();
  await expect(page).toHaveURL(/\/applications$/);
});

test("tracks a job application lifecycle in IndexedDB", async ({ page }) => {
  const applicationMetrics: unknown[] = [];
  await page.route("**/api/metrics/job-applications", async (route) => {
    applicationMetrics.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  await page.goto("/applications");

  await expect(page).toHaveTitle("Private Job Application Tracker | PrivaCV");
  await expect(page.getByRole("heading", { name: "Applications", exact: true })).toBeVisible();
  await expect(page.locator("[data-local-save-status]")).toHaveAccessibleName("Saved locally");
  const workspaceNav = page.getByRole("navigation", { name: "Workspace" });
  await expect(workspaceNav.getByRole("link", { name: "Resume" })).toHaveAttribute("href", "/");
  await expect(workspaceNav.getByRole("link", { name: "Applications" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.getByRole("button", { name: "Add application" }).click();
  const createDialog = page.getByRole("dialog", { name: "Add an application" });
  await expect(createDialog.getByLabel("Status")).toHaveCSS("appearance", "none");
  await expect(createDialog.locator("[data-select-caret]")).toHaveCount(2);
  await expect(createDialog.locator("[data-select-caret]").first()).toHaveCSS("right", "12px");
  await createDialog.getByLabel("Company").fill("Northstar Labs");
  await createDialog.getByLabel("Role").fill("Senior Product Designer");
  await createDialog.getByLabel("Location").fill("Remote");
  await createDialog
    .getByLabel("Job posting URL")
    .fill("https://example.com/jobs/product-designer");
  await createDialog
    .getByLabel("Job description snapshot")
    .fill("Lead product design for a privacy-focused platform.");
  await createDialog.getByRole("button", { name: "Add application" }).click();

  await expect(page.getByRole("button", { name: /Senior Product Designer/ })).toBeVisible();
  await expect(page.getByText("1 application in this view")).toBeVisible();
  await expect.poll(() => applicationMetrics).toEqual([{ event: "job_application_created" }]);

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
  expect(applicationMetrics).toHaveLength(1);
  await page.getByRole("button", { name: /Senior Product Designer/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Senior Product Designer" }).getByText("Moved to Applied"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog", { name: "Senior Product Designer" })
      .getByLabel("Job description snapshot"),
  ).toHaveValue("Lead product design for a privacy-focused platform.");
});

test("captures an immutable checkpoint when an application is submitted", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Sample", exact: true }).click();
  await expect(page.locator("[data-autosave-status]")).toHaveAttribute(
    "data-autosave-status",
    "saved",
  );

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
  await createDialog
    .getByLabel("Resume for this application")
    .selectOption({ label: "John Doe — Product baseline" });
  await createDialog.getByRole("button", { name: "Add application" }).click();

  await page.getByRole("button", { name: /Product Lead/ }).click();
  const detail = page.getByRole("dialog", { name: "Product Lead" });
  await expect(detail.getByText(/Submitted snapshot captured/)).toContainText(
    "John Doe — Product baseline",
  );
  await expect(detail.getByText("Captured submitted resume")).toBeVisible();

  const snapshot = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("privacv-job-pipeline");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise<{ label: string; checkpointId?: string; data: { name?: string } }>(
      (resolve, reject) => {
        const request = database
          .transaction("resumeSnapshots", "readonly")
          .objectStore("resumeSnapshots")
          .getAll();
        request.onsuccess = () => resolve(request.result[0]);
        request.onerror = () => reject(request.error);
      },
    );
  });
  expect(snapshot).toMatchObject({
    label: "John Doe — Product baseline",
    data: { name: "John Doe" },
  });
  expect(snapshot.checkpointId).toBeTruthy();
});

test("renders the job search as a Sankey diagram and downloads a PNG", async ({ page }) => {
  await page.goto("/applications");
  await page.getByRole("button", { name: "Add application" }).click();
  const createDialog = page.getByRole("dialog", { name: "Add an application" });
  await createDialog.getByLabel("Company").fill("Orbit Systems");
  await createDialog.getByLabel("Role").fill("Staff Engineer");
  await createDialog.getByLabel("Status").selectOption("applied");
  await createDialog.getByRole("button", { name: "Add application" }).click();

  await page.getByRole("button", { name: "Sankey view" }).click();
  await expect(page.getByRole("button", { name: "Sankey view" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Job search Sankey" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Job search Sankey diagram" })).toContainText(
    "Awaiting response",
  );

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save as PNG" }).click();
  const image = await download;
  expect(image.suggestedFilename()).toMatch(/^privacv-job-search-sankey-\d{4}-\d{2}-\d{2}\.png$/);
  const imagePath = await image.path();
  expect(imagePath).toBeTruthy();
  expect((await readFile(imagePath!)).subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  await expect(page.getByText("Sankey image downloaded", { exact: true })).toBeVisible();
});
