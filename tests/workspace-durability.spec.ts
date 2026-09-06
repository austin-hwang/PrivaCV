import { expect, test, type Page } from "@playwright/test";
import { sampleState } from "../lib/resume";

async function seedResume(page: Page) {
  await page.addInitScript((state) => {
    if (sessionStorage.getItem("durability-seeded")) return;
    sessionStorage.setItem("durability-seeded", "1");
    localStorage.setItem("resume-editor-data-v2", JSON.stringify(state));
  }, sampleState());
  await page.goto("/");
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue("John Doe");
}

async function storedResumes(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("privacv-resume-workspace");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const records = await new Promise<
      Array<{ id: string; label: string; state: { name: string } }>
    >((resolve, reject) => {
      const request = database.transaction("resumes").objectStore("resumes").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return records;
  });
}

test("preserves the final resume edit on immediate reload and workspace navigation", async ({
  page,
}) => {
  await seedResume(page);
  await page.getByLabel("Full Name", { exact: true }).fill("Final edit before reload");
  await page.reload();
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue(
    "Final edit before reload",
  );
  await page.getByLabel("Full Name", { exact: true }).fill("Final edit before navigation");
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("link", { name: "Applications" })
    .click();
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("link", { name: "Resume" })
    .click();
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue(
    "Final edit before navigation",
  );
});

test("keeps a resume duplicated in another tab and refreshes the library", async ({
  page,
  context,
}) => {
  await seedResume(page);
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.getByLabel("Full Name", { exact: true })).toHaveValue("John Doe");
  await other.getByRole("button", { name: /Open resume library:/ }).click();
  await other.getByRole("button", { name: /Duplicate/ }).click();
  await expect.poll(async () => (await storedResumes(page)).length).toBe(2);
  await page.getByLabel("Full Name", { exact: true }).fill("Original edited");
  await expect
    .poll(async () => (await storedResumes(page)).map((item) => item.state.name).sort())
    .toEqual(["John Doe", "Original edited"]);
  await page.getByRole("button", { name: /Open resume library:/ }).click();
  await expect(page.getByText("2 resumes saved in this browser", { exact: true })).toBeVisible();
});

test("recovers a journaled edit when the IndexedDB write was interrupted", async ({ page }) => {
  await seedResume(page);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === "resumes")
        throw new DOMException("Simulated interrupted write", "AbortError");
      return put.call(this, value, key);
    };
  });
  await page.getByLabel("Full Name", { exact: true }).fill("Recovered final edit");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).some((key) => key.startsWith("resume-editor-pending-v1:")),
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue("Recovered final edit");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).some((key) => key.startsWith("resume-editor-pending-v1:")),
      ),
    )
    .toBe(false);
});

test("rejects unrelated JSON without replacing a resume", async ({ page }) => {
  await seedResume(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Open saved JSON" }).click();
  await (
    await chooser
  ).setFiles({
    name: "settings.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"unrelated":true}'),
  });
  await expect(page.getByText("That file is not valid resume JSON", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue("John Doe");
});

async function openAster(page: Page) {
  await page
    .getByRole("button", { name: /Open Staff Product Designer at Aster Cloud/ })
    .filter({ visible: true })
    .click();
  return page.getByRole("dialog", { name: "Staff Product Designer" });
}

test("merges application notes with another tab's status update", async ({ page, context }) => {
  await page.goto("/applications");
  await page.getByRole("button", { name: "Load sample", exact: true }).click();
  const detail = await openAster(page);
  await detail.getByLabel("Notes").fill("New notes from first tab");
  const other = await context.newPage();
  await other.goto("/applications");
  const secondDetail = await openAster(other);
  await secondDetail.getByRole("button", { name: /Status$/ }).click();
  await other.getByRole("option", { name: "Offer", exact: true }).click();
  await secondDetail.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(secondDetail).toBeHidden();
  await detail.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(detail).toBeHidden();
  await page.reload();
  const reopened = await openAster(page);
  await expect(reopened.getByRole("button", { name: /Status$/ })).toContainText("Offer");
  await expect(reopened.getByLabel("Notes")).toHaveValue("New notes from first tab");
});

test("rejects competing application status edits", async ({ page, context }) => {
  await page.goto("/applications");
  await page.getByRole("button", { name: "Load sample", exact: true }).click();
  const detail = await openAster(page);
  await detail.getByRole("button", { name: /Status$/ }).click();
  await page.getByRole("option", { name: "Applied", exact: true }).click();
  const other = await context.newPage();
  await other.goto("/applications");
  const secondDetail = await openAster(other);
  await secondDetail.getByRole("button", { name: /Status$/ }).click();
  await other.getByRole("option", { name: "Offer", exact: true }).click();
  await secondDetail.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(secondDetail).toBeHidden();
  await detail.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(detail.getByText(/This application changed in another tab/)).toBeVisible();
  await page.reload();
  await expect((await openAster(page)).getByRole("button", { name: /Status$/ })).toContainText(
    "Offer",
  );
});

test("keeps mobile notifications above navigation and dialog actions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/applications");
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Load sample applications" }).click();
  const toast = page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "Loaded 13 sample applications" });
  const navigation = page.getByRole("navigation", { name: "Application workspace" });
  await expect(toast).toBeVisible();
  const above = async (bar: ReturnType<Page["locator"]>) => {
    const notification = await toast.boundingBox();
    const actions = await bar.boundingBox();
    return Boolean(notification && actions && notification.y + notification.height <= actions.y);
  };
  await expect.poll(() => above(navigation)).toBe(true);
  await page.screenshot({ path: "test-results/fixes/mobile-pipeline.png" });
  await openAster(page);
  await expect.poll(() => above(page.locator("[data-mobile-action-bar]"))).toBe(true);
  await page.screenshot({ path: "test-results/fixes/mobile-detail.png" });
});
