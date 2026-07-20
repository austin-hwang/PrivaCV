import { expect, test } from "@playwright/test";

test("presents credible browser metadata and public launch assets", async ({ page, request }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("PrivaCV: Free Private Resume Editor — No Sign-Up");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /Build, tailor, and export a clean resume locally/i,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "PrivaCV: Free Private Resume Editor — No Sign-Up",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://privacv.app");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://privacv.app");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest\.webmanifest$/);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/icon");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("type", "image/png");

  const appleIconHref = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect(appleIconHref).toBeTruthy();

  const [manifest, robots, sitemap, icon, appleIcon, socialImage] = await Promise.all([
    request.get("/manifest.webmanifest"),
    request.get("/robots.txt"),
    request.get("/sitemap.xml"),
    request.get("/icon"),
    request.get(appleIconHref!),
    request.get("/social/home"),
  ]);
  expect(manifest.ok()).toBeTruthy();
  expect(await manifest.json()).toMatchObject({ short_name: "PrivaCV", display: "standalone" });
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain("Sitemap: https://privacv.app/sitemap.xml");
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain("<loc>https://privacv.app/</loc>");
  expect(icon.ok()).toBeTruthy();
  expect(icon.headers()["content-type"]).toContain("image/png");
  expect(appleIcon.ok()).toBeTruthy();
  expect(appleIcon.headers()["content-type"]).toContain("image/png");
  expect(socialImage.ok()).toBeTruthy();
  expect(socialImage.headers()["content-type"]).toContain("image/png");

  await page.goto("/free-resume-builder");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://privacv.app/social/free-resume-builder",
  );
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "PrivaCV");
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
    "content",
    "Free Resume Builder — No Sign-Up or Watermark | PrivaCV",
  );
});

test("protects the local workspace with production response security headers", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();

  expect(response.ok()).toBeTruthy();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("'wasm-unsafe-eval'");
  expect(headers["content-security-policy"]).toContain("https://huggingface.co");
  expect(headers["content-security-policy"]).toContain("https://raw.githubusercontent.com");
  expect(headers["content-security-policy"]).toContain("worker-src 'self' blob:");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["strict-transport-security"]).toBe("max-age=31536000");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
});

test("keeps the editor page concise and puts product guidance on About", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /frequently asked questions/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /about privacv/i })).toBeVisible();

  await page.goto("/about");
  await expect(page.getByRole("heading", { name: /how privacv works/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /frequently asked questions/i })).toBeVisible();
  await expect(page.getByText("Does PrivaCV upload my resume?", { exact: true })).toBeVisible();
});
