import { expect, test } from "@playwright/test";

test("does not track public pages and tracks workspace switching", async ({ page }) => {
  const workspaces: string[] = [];
  await page.route("**/api/metrics/visitors", async (route) => {
    workspaces.push(route.request().postDataJSON().workspace);
    await route.fulfill({ status: 204 });
  });
  for (const path of ["/about", "/privacy", "/job-application-tracker"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("privacv-visitor-v2"))).toBeNull();
  }
  expect(workspaces).toEqual([]);
  await page.goto("/");
  await expect.poll(() => workspaces.includes("resume")).toBe(true);
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("link", { name: "Applications" })
    .click();
  await expect.poll(() => workspaces.includes("job_applications")).toBe(true);
});

test("shares a daily visitor across tabs and reloads without sending page or resume data", async ({
  page,
  context,
}) => {
  const bodies: Array<{ day: string; visitorId: string; workspace: string }> = [];
  await context.route("**/api/metrics/visitors", async (route) => {
    const request = route.request();
    expect(request.headers().referer).toBeUndefined();
    const body = request.postDataJSON();
    expect(Object.keys(body).sort()).toEqual(["day", "visitorId", "workspace"]);
    bodies.push(body);
    await route.fulfill({ status: 204 });
  });
  await page.goto("/?private=test");
  await expect.poll(() => bodies.length).toBeGreaterThan(0);
  const id = bodies[0].visitorId;
  expect(bodies[0].workspace).toBe("resume");
  await page.reload();
  const other = await context.newPage();
  await other.goto("/applications");
  await expect.poll(() => bodies.length).toBeGreaterThanOrEqual(3);
  expect(new Set(bodies.map((body) => body.visitorId))).toEqual(new Set([id]));
  expect(bodies.at(-1)!.workspace).toBe("job_applications");
  // A legacy date on the stored token must not rotate the persistent ID.
  await other.evaluate(() => {
    const value = JSON.parse(localStorage.getItem("privacv-visitor-v2")!);
    localStorage.setItem("privacv-visitor-v2", JSON.stringify({ ...value, day: "2000-01-01" }));
  });
  const previousCount = bodies.length;
  await other.reload();
  await expect.poll(() => bodies.length).toBeGreaterThan(previousCount);
  expect(bodies.at(-1)!.visitorId).toBe(id);
});

test("honors Global Privacy Control without a visitor request or local identifier", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "globalPrivacyControl", { value: true }),
  );
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/metrics/visitors")) requests.push(request.url());
  });
  await page.goto("/applications");
  await expect(page.getByRole("button", { name: "Add application", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("privacv-visitor-v2"))).toBeNull();
  expect(requests).toEqual([]);
});
