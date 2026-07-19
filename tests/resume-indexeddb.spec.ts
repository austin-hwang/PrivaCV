import { expect, test } from "@playwright/test";
import { sampleState } from "@/lib/resume";

test("migrates legacy resume data to IndexedDB and reloads from the database", async ({ page }) => {
  const migratedState = { ...sampleState, name: "IndexedDB Resume" };
  await page.addInitScript((state) => {
    if (sessionStorage.getItem("resume-migration-seeded")) return;
    sessionStorage.setItem("resume-migration-seeded", "1");
    localStorage.setItem("resume-editor-data-v2", JSON.stringify(state));
    localStorage.setItem("resume-editor-autosave-time-v1", "2026-07-19T12:00:00.000Z");
  }, migratedState);

  await page.goto("/");
  await expect(page.getByLabel("Full Name")).toHaveValue("IndexedDB Resume");
  await expect.poll(() => page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("privacv-resume-workspace");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise<string | undefined>((resolve, reject) => {
      const request = database.transaction("resumes", "readonly").objectStore("resumes").getAll();
      request.onsuccess = () => resolve(request.result[0]?.state?.name);
      request.onerror = () => reject(request.error);
    });
  })).toBe("IndexedDB Resume");

  await page.evaluate(() => {
    localStorage.removeItem("resume-editor-data-v2");
    localStorage.removeItem("resume-editor-library-v1");
    localStorage.removeItem("resume-editor-active-resume-v1");
    localStorage.removeItem("resume-editor-autosave-time-v1");
  });
  await page.reload();
  await expect(page.getByLabel("Full Name")).toHaveValue("IndexedDB Resume");
});
