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
  // The detail dialog is a tall, vertically-centered RAC modal (no internal
  // scroll). Give it a viewport tall enough that its top fields (Status) stay
  // on-screen so the Select trigger is clickable. Width is unchanged so the
  // responsive layout is identical to the default Desktop Chrome device.
  await page.setViewportSize({ width: 1280, height: 1400 });
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
  // The status control is now a React Aria Select (listbox), not a native
  // <select>. Verify it defaults to "Saved" and that opening it surfaces the
  // status options as a behavioral replacement for the old caret/appearance
  // style assertions.
  const createStatusTrigger = createDialog.getByRole("button", { name: "Status" });
  await expect(createStatusTrigger).toContainText("Saved");
  await createStatusTrigger.click();
  await expect(page.getByRole("option", { name: "Applied" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(createStatusTrigger).toContainText("Saved");
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
  await detailDialog.getByRole("button", { name: "Status" }).click();
  await page.getByRole("option", { name: "Applied" }).click();
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
  await createDialog.getByRole("button", { name: "Status" }).click();
  await page.getByRole("option", { name: "Applied" }).click();
  await createDialog.getByRole("button", { name: "Resume for this application" }).click();
  await page.getByRole("option", { name: "John Doe — Product baseline" }).click();
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

test("logs a timeline activity that persists across reloads", async ({ page }) => {
  // Tall detail modal (no internal scroll): keep the Activity type Select on
  // screen. Width is unchanged from the default Desktop Chrome viewport.
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto("/applications");
  await page.getByRole("button", { name: "Add application" }).click();
  const createDialog = page.getByRole("dialog", { name: "Add an application" });
  await createDialog.getByLabel("Company").fill("Northstar Labs");
  await createDialog.getByLabel("Role").fill("Senior Product Designer");
  await createDialog.getByRole("button", { name: "Add application" }).click();

  await page.getByRole("button", { name: /Senior Product Designer/ }).click();
  const detail = page.getByRole("dialog", { name: "Senior Product Designer" });
  await detail.getByRole("button", { name: "Activity type" }).click();
  await page.getByRole("option", { name: "Interview" }).click();
  await detail.getByLabel("Activity title").fill("Phone screen with recruiter");
  await detail.getByRole("button", { name: "Log", exact: true }).click();
  await expect(detail.getByText("Phone screen with recruiter")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /Senior Product Designer/ }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Senior Product Designer" })
      .getByText("Phone screen with recruiter"),
  ).toBeVisible();
});

// Seed the IndexedDB pipeline directly so reminder buckets and insight metrics are
// deterministic. The page load creates the database (and its object stores) first;
// waiting for the "saved" status guarantees the stores exist before we write.
async function seedPipeline(
  page: import("@playwright/test").Page,
  seed: { applications: unknown[]; events?: unknown[] },
) {
  await page.goto("/applications");
  await expect(page.locator("[data-local-save-status]")).toHaveAttribute(
    "data-local-save-status",
    "saved",
  );
  await page.evaluate(async (data) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("privacv-job-pipeline");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(["applications", "events"], "readwrite");
    data.applications.forEach((item) => transaction.objectStore("applications").put(item));
    (data.events ?? []).forEach((item) => transaction.objectStore("events").put(item));
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }, seed);
  await page.reload();
}

test("groups reminders by due date and exports an ics file", async ({ page }) => {
  const localDate = (offset: number) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  const now = new Date().toISOString();
  const base = (overrides: Record<string, unknown>) => ({
    sourceUrl: "",
    source: "",
    location: "",
    compensation: "",
    contactName: "",
    contactEmail: "",
    notes: "",
    nextAction: "",
    nextActionAt: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });

  await seedPipeline(page, {
    applications: [
      base({
        id: "r-overdue",
        company: "Acme",
        role: "Designer",
        status: "applied",
        appliedAt: now,
        nextAction: "Ping the recruiter",
        nextActionAt: localDate(-2),
      }),
      base({
        id: "r-today",
        company: "Globex",
        role: "Product Manager",
        status: "interviewing",
        nextAction: "Send a thank-you note",
        nextActionAt: localDate(0),
      }),
      base({
        id: "r-upcoming",
        company: "Initech",
        role: "Design Lead",
        status: "offer",
        nextAction: "Decide on the offer",
        nextActionAt: localDate(3),
      }),
    ],
  });

  await page.getByRole("button", { name: "Reminders view" }).click();
  await expect(page.getByRole("heading", { name: "Overdue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Due today" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming" })).toBeVisible();
  await expect(page.getByText("Ping the recruiter")).toBeVisible();
  await expect(page.getByText("Send a thank-you note")).toBeVisible();
  await expect(page.getByText("Decide on the offer")).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export .ics" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^privacv-reminders-\d{4}-\d{2}-\d{2}\.ics$/);
  const contents = (await readFile((await file.path())!)).toString();
  expect(contents).toContain("BEGIN:VCALENDAR");
  expect(contents).toContain("Ping the recruiter");
  expect(contents).toContain("END:VCALENDAR");
});

test("summarizes conversion metrics in the insights view", async ({ page }) => {
  const statusEvent = (
    applicationId: string,
    toStatus: string,
    occurredAt: string,
    type = "status_changed",
  ) => ({
    id: `${applicationId}-${toStatus}`,
    applicationId,
    type,
    title: toStatus,
    occurredAt,
    toStatus,
  });
  const base = (overrides: Record<string, unknown>) => ({
    sourceUrl: "",
    source: "",
    location: "",
    compensation: "",
    contactName: "",
    contactEmail: "",
    notes: "",
    nextAction: "",
    nextActionAt: "",
    updatedAt: "2026-07-12T09:00:00.000Z",
    ...overrides,
  });

  await seedPipeline(page, {
    applications: [
      base({
        id: "i-1",
        company: "Acme",
        role: "Designer",
        status: "interviewing",
        appliedAt: "2026-07-01T09:00:00.000Z",
        createdAt: "2026-06-30T09:00:00.000Z",
      }),
      base({
        id: "i-2",
        company: "Globex",
        role: "PM",
        status: "applied",
        appliedAt: "2026-07-08T09:00:00.000Z",
        createdAt: "2026-07-08T09:00:00.000Z",
      }),
      base({
        id: "i-3",
        company: "Initech",
        role: "Lead",
        status: "offer",
        appliedAt: "2026-06-15T09:00:00.000Z",
        createdAt: "2026-06-15T09:00:00.000Z",
      }),
      base({
        id: "i-4",
        company: "Hooli",
        role: "UX",
        status: "rejected",
        appliedAt: "2026-06-20T09:00:00.000Z",
        createdAt: "2026-06-20T09:00:00.000Z",
        closedAt: "2026-07-05T09:00:00.000Z",
      }),
    ],
    events: [
      statusEvent("i-1", "applied", "2026-07-01T09:00:00.000Z", "created"),
      statusEvent("i-1", "interviewing", "2026-07-08T09:00:00.000Z"),
      statusEvent("i-3", "applied", "2026-06-15T09:00:00.000Z", "created"),
      statusEvent("i-3", "interviewing", "2026-06-25T09:00:00.000Z"),
      statusEvent("i-3", "offer", "2026-07-05T09:00:00.000Z"),
      statusEvent("i-4", "applied", "2026-06-20T09:00:00.000Z", "created"),
      statusEvent("i-4", "interviewing", "2026-06-28T09:00:00.000Z"),
      statusEvent("i-4", "rejected", "2026-07-05T09:00:00.000Z"),
    ],
  });

  await page.getByRole("button", { name: "Insights view" }).click();
  // 4 submitted; 3 of 4 responded; 3 reached interviewing; 1 of those 3 got an offer.
  await expect(page.getByText("Reached Applied or beyond")).toBeVisible();
  await expect(page.getByText("3 of 4 heard back")).toBeVisible();
  await expect(page.getByText("3 reached interviewing")).toBeVisible();
  await expect(page.getByText("1 of 3 interviewed")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Applications per week" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Time in each stage" })).toBeVisible();
});

test("renders the job search as a Sankey diagram and downloads a PNG", async ({ page }) => {
  await page.goto("/applications");
  await page.getByRole("button", { name: "Add application" }).click();
  const createDialog = page.getByRole("dialog", { name: "Add an application" });
  await createDialog.getByLabel("Company").fill("Orbit Systems");
  await createDialog.getByLabel("Role").fill("Staff Engineer");
  await createDialog.getByRole("button", { name: "Status" }).click();
  await page.getByRole("option", { name: "Applied" }).click();
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
