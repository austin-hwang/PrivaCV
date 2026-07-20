import { expect, test } from "@playwright/test";

test("publishes crawlable tracker and Sankey pages while keeping the workspace private", async ({
  page,
  request,
}) => {
  await page.goto("/job-application-tracker");
  await expect(page).toHaveTitle("Free Private Job Application Tracker — No Sign-Up | PrivaCV");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A free, private job application tracker",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://privacv.app/job-application-tracker",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://privacv.app/social/job-application-tracker",
  );
  await expect(page.getByRole("link", { name: "Track your applications" })).toHaveAttribute(
    "href",
    "/applications",
  );
  expect(
    (await page.locator('script[type="application/ld+json"]').allTextContents()).some((value) =>
      value.includes('"@type":"WebApplication"'),
    ),
  ).toBe(true);

  await page.goto("/job-search-sankey");
  await expect(page).toHaveTitle("Free Job Search Sankey Generator — Export PNG | PrivaCV");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Make a Sankey diagram from your job search",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://privacv.app/job-search-sankey",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://privacv.app/social/job-search-sankey",
  );
  const sankeyHero = page.getByRole("img", {
    name: "Job search Sankey showing applications flowing into interviews, offers, and outcomes",
  });
  await expect(sankeyHero).toHaveAttribute("src", "/social/job-search-sankey");
  await expect
    .poll(() => sankeyHero.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(1200);
  await expect(page.getByRole("heading", { name: "Job search", exact: true })).toBeVisible();

  await page.goto("/applications");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Private Job Application Tracker | PrivaCV",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://privacv.app/social/job-application-tracker",
  );

  const [sitemap, llms, trackerCard, sankeyCard] = await Promise.all([
    request.get("/sitemap.xml"),
    request.get("/llms.txt"),
    request.get("/social/job-application-tracker"),
    request.get("/social/job-search-sankey"),
  ]);
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain("<loc>https://privacv.app/job-application-tracker</loc>");
  expect(sitemapText).toContain("<loc>https://privacv.app/job-search-sankey</loc>");
  expect(sitemapText).not.toContain("<loc>https://privacv.app/applications</loc>");
  const llmsText = await llms.text();
  expect(llmsText).toContain("Private job application tracker");
  expect(llmsText).toContain("Job search Sankey generator");
  for (const response of [trackerCard, sankeyCard]) {
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
    expect((await response.body()).byteLength).toBeGreaterThan(20_000);
  }
});
