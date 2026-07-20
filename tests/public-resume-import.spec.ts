import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import manifest from "./fixtures/public-resumes/manifest.json";

const fixtureDirectory = path.resolve("tests/fixtures/public-resumes/downloads");

type ImportedEntry = { title: string; details: string };
type ImportedState = {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  skills: string;
  experience: ImportedEntry[];
  education: ImportedEntry[];
  projects: ImportedEntry[];
  customSections: Array<{ title: string }>;
};
type ContactField = "name" | "title" | "email" | "phone" | "location" | "website";
type FixtureExpected = Partial<Record<ContactField, string>> & {
  contactFieldsPresent?: ContactField[];
  experienceTitles?: string[];
  educationTitles?: string[];
  projectTitles?: string[];
  skillsInclude?: string[];
  experienceDetailsInclude?: string[];
  projectDetailsInclude?: string[];
  customSectionTitles?: string[];
};

async function readStoredResumeState(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("privacv-resume-workspace");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const records = await new Promise<Array<{ state: ImportedState }>>((resolve, reject) => {
      const request = database.transaction("resumes", "readonly").objectStore("resumes").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return records[0]?.state ?? null;
  });
}

for (const fixture of manifest) {
  test(`imports public resume fixture: ${fixture.filename}`, async ({ page }) => {
    const fixturePath = path.join(fixtureDirectory, fixture.filename);
    test.skip(!existsSync(fixturePath), "Run pnpm test:public-resumes to download public fixtures first.");

    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: /import a file/i }).click();
    await page.locator('input[type="file"][accept*="application/pdf"]').setInputFiles({
      name: fixture.filename,
      mimeType: fixture.mimeType,
      buffer: readFileSync(fixturePath),
    });
    await expect(page.getByText(/Imported (PDF|Word document) - please review/)).toBeVisible();
    await expect.poll(async () => (await readStoredResumeState(page))?.name).toBe(fixture.expected.name);

    const state = await readStoredResumeState(page) as ImportedState;
    const expected = fixture.expected as FixtureExpected;
    for (const field of ["name", "title", "email", "phone", "location", "website"] as const) {
      if (expected[field] !== undefined) expect(state[field]).toBe(expected[field]);
    }
    if (expected.contactFieldsPresent) {
      for (const field of expected.contactFieldsPresent) expect(state[field]).toBeTruthy();
    }
    if (expected.experienceTitles) expect(state.experience.map((entry) => entry.title)).toEqual(expected.experienceTitles);
    if (expected.educationTitles) expect(state.education.map((entry) => entry.title)).toEqual(expected.educationTitles);
    if (expected.projectTitles) expect(state.projects.map((entry) => entry.title)).toEqual(expected.projectTitles);
    if (expected.skillsInclude) {
      for (const value of expected.skillsInclude) expect(state.skills).toContain(value);
    }
    if (expected.experienceDetailsInclude) {
      const experienceDetails = state.experience.map((entry) => entry.details).join("\n");
      for (const value of expected.experienceDetailsInclude) expect(experienceDetails).toContain(value);
    }
    if (expected.projectDetailsInclude) {
      const projectDetails = state.projects.map((entry) => entry.details).join("\n");
      for (const value of expected.projectDetailsInclude) expect(projectDetails).toContain(value);
    }
    if (expected.customSectionTitles) {
      expect(state.customSections.map((section) => section.title)).toEqual(expect.arrayContaining(expected.customSectionTitles));
    }
  });
}
