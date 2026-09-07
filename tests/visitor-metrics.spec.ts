import { expect, test } from "@playwright/test";

test("opening workspaces does not report visits or create an analytics ID", async ({
  page,
  request,
}) => {
  const visits: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/metrics/visitors")) visits.push(request.url());
  });
  for (const path of ["/", "/applications", "/about"]) {
    await page.goto(path);
    if (path === "/about") {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    } else {
      await expect(page.getByRole("navigation", { name: "Workspace", exact: true })).toBeVisible();
    }
    if (path === "/applications") {
      await expect(
        page.getByRole("button", { name: "Add application", exact: true }),
      ).toBeVisible();
    }
    expect(await page.evaluate(() => localStorage.getItem("privacv-visitor-v2"))).toBeNull();
  }
  expect(visits).toEqual([]);
  const response = await request.post("/api/metrics/visitors", { data: { workspace: "resume" } });
  expect(response.status()).toBe(204);
  expect(await response.text()).toBe("");
});
