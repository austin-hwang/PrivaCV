import { expect, test } from "@playwright/test";

test("loads the sample resume and reviews plain text", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^sample$/i }).click();

  await expect(page.getByText("Resume Check")).toBeVisible();
  await expect(page.getByText("Jane Doe").first()).toBeVisible();

  await page.getByRole("button", { name: /review text/i }).click();
  await expect(page.getByRole("dialog", { name: /review before copying/i })).toBeVisible();
  await expect(page.locator("textarea[readonly]")).toContainText("Jane Doe");
});

test("focuses the field behind a failed resume check", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^sample$/i }).click();

  await page.getByLabel("Phone").fill("");
  await expect(page.getByText("Missing contact details can make a strong resume impossible to follow up on.")).toBeVisible();
  await page.getByRole("button", { name: /fix contact/i }).click();

  await expect(page.locator("#field-phone")).toBeFocused();
});

test("shows an export checkpoint before printing an unresolved resume", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    window.print = () => {
      window.localStorage.setItem("print-called", "true");
    };
  });
  await page.reload();
  await page.evaluate(() => {
    window.print = () => {
      window.localStorage.setItem("print-called", "true");
    };
  });
  await page.getByRole("button", { name: /^sample$/i }).click();
  await page.getByLabel("Phone").fill("");

  await page.getByRole("button", { name: /export pdf/i }).click();
  const exportDialog = page.getByRole("dialog", { name: /review before exporting/i });
  await expect(exportDialog).toBeVisible();
  await expect(exportDialog.getByText("Missing contact details can make a strong resume impossible to follow up on.")).toBeVisible();

  await exportDialog.getByRole("button", { name: /fix contact/i }).click();
  await expect(page.locator("#field-phone")).toBeFocused();
  await expect(page.getByRole("dialog", { name: /review before exporting/i })).toBeHidden();

  await page.getByRole("button", { name: /export pdf/i }).click();
  await page.getByRole("button", { name: /export anyway/i }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("print-called"))).toBe("true");
});

test("shows when the resume changed after the last PDF export", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    window.print = () => {
      window.localStorage.setItem("print-called", "true");
    };
  });
  await page.reload();
  await page.evaluate(() => {
    window.print = () => {
      window.localStorage.setItem("print-called", "true");
    };
  });
  await page.getByRole("button", { name: /^sample$/i }).click();

  await page.getByRole("button", { name: /export pdf/i }).click();
  await page.getByRole("button", { name: /export anyway/i }).click();

  await expect.poll(() => page.evaluate(() => localStorage.getItem("print-called"))).toBe("true");
  await expect(page.getByText("Current resume matches your last PDF export.")).toBeVisible();

  await page.getByLabel("Professional Summary").fill("Edited summary for the next application.");

  await expect(page.getByText("This resume changed since your last PDF export.")).toBeVisible();
  const summaryChange = page.getByRole("button", { name: /summary changed/i });
  await expect(summaryChange).toBeVisible();
  await expect(summaryChange.getByText("Before", { exact: true })).toBeVisible();
  await expect(summaryChange.getByText("Now", { exact: true })).toBeVisible();
  await expect(summaryChange.getByText("Edited summary for the next application.")).toBeVisible();
  await expect(page.getByRole("button", { name: /export updated pdf/i })).toBeVisible();
});

test("expands dense change audits after export and restore", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    window.print = () => {
      window.localStorage.setItem("print-called", "true");
    };
  });
  await page.reload();
  await page.evaluate(() => {
    window.print = () => {
      window.localStorage.setItem("print-called", "true");
    };
  });
  await page.getByRole("button", { name: /^sample$/i }).click();

  await page.getByRole("button", { name: /save version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Clean baseline");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  await page.getByRole("button", { name: /export pdf/i }).click();
  await page.getByRole("button", { name: /export anyway/i }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("print-called"))).toBe("true");

  await page.getByLabel("Full Name").fill("Ada Lovelace");
  await page.getByLabel("Professional Summary").fill("Research engineer focused on developer tools and reliable launches.");
  await page.getByLabel("Job Title").first().fill("Staff Software Engineer");
  await page.getByLabel("Degree").fill("M.S. Computer Science");
  await page.getByLabel("Project Name").fill("Launch Review Hub");
  await page.getByLabel('Skills (one group per line, e.g. "Languages: Python, Go")').fill("Languages: TypeScript, Python\nTools: Playwright, AWS");

  await expect(page.getByText("2 more changed areas")).toBeVisible();
  await expect(page.getByText("Projects changed")).toBeHidden();
  await page.getByRole("button", { name: /show all changes/i }).click();
  await expect(page.getByText("Showing all 6 changed areas")).toBeVisible();
  await expect(page.getByText("Projects changed")).toBeVisible();
  await expect(page.getByText("Skills changed")).toBeVisible();

  await page.getByRole("button", { name: /^restore$/i }).click();
  await expect(page.getByText("Checkpoint restored")).toBeVisible();
  await expect(page.getByText("2 more changed areas")).toBeVisible();
  await page.getByRole("button", { name: /show all changes/i }).click();
  await expect(page.getByText("Showing all 6 changed areas")).toBeVisible();
  await expect(page.getByText("Projects changed")).toBeVisible();
  await expect(page.getByText("Skills changed")).toBeVisible();
});

test("restores the previous resume after clearing", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^sample$/i }).click();
  await page.getByLabel("Full Name").fill("Ada Lovelace");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /^clear$/i }).click();

  await expect(page.getByText("Restore point saved")).toBeVisible();
  await page.getByRole("button", { name: /restore previous/i }).click();

  await expect(page.getByLabel("Full Name")).toHaveValue("Ada Lovelace");
  await expect(page.getByText("Restore point saved")).toBeHidden();
});

test("saves and restores a named local version history checkpoint", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^sample$/i }).click();

  await page.getByRole("button", { name: /save version/i }).click();
  await expect(page.getByRole("dialog", { name: /name this checkpoint/i })).toBeVisible();
  await page.getByLabel("Checkpoint name").fill("Original software resume");
  await page.getByLabel("Note (optional)").fill("Before tailoring for the platform role.");
  await page.getByRole("button", { name: /save checkpoint/i }).click();
  await expect(page.getByText("Version saved locally")).toBeVisible();
  await expect(page.getByText("Original software resume")).toBeVisible();
  await expect(page.getByText("Before tailoring for the platform role.")).toBeVisible();
  await expect(page.getByText("Current", { exact: true })).toBeVisible();
  await expect(page.getByText("Jane Doe").first()).toBeVisible();
  await expect(page.getByText("2 roles")).toBeVisible();
  await expect(page.getByText("1 project")).toBeVisible();
  await expect(page.getByText("4 skill lines")).toBeVisible();

  await page.getByLabel("Full Name").fill("Grace Hopper");
  await page.getByLabel("Job Title").first().fill("Principal Software Engineer");
  await expect(page.getByLabel("Full Name")).toHaveValue("Grace Hopper");
  await expect(page.getByText("Suggested checkpoint")).toBeVisible();
  await expect(page.getByRole("button", { name: /review differences/i })).toBeVisible();
  await expect(page.getByText("2 changed areas").first()).toBeVisible();

  await page.getByRole("button", { name: /compare/i }).click();
  const compareDialog = page.getByRole("dialog", { name: /compare saved checkpoint/i });
  await expect(compareDialog).toBeVisible();
  const headerChange = compareDialog.getByRole("button", { name: /header changed/i });
  await expect(headerChange).toBeVisible();
  await expect(headerChange.getByText("Full name")).toBeVisible();
  await expect(compareDialog.getByText("Experience changed")).toBeVisible();
  await expect(compareDialog.getByText("Entry 1 Job title")).toBeVisible();
  await expect(headerChange.getByText("Saved", { exact: true })).toBeVisible();
  await expect(headerChange.getByText("Current", { exact: true })).toBeVisible();
  await expect(compareDialog.getByText("Jane Doe")).toBeVisible();
  await expect(compareDialog.getByText("Grace Hopper")).toBeVisible();

  await headerChange.click();
  await expect(page.locator("#field-name")).toBeFocused();
  await expect(compareDialog).toBeHidden();

  await page.getByRole("button", { name: /^restore$/i }).click();
  await expect(page.getByLabel("Full Name")).toHaveValue("Jane Doe");
  await expect(page.getByText("Checkpoint restored")).toBeVisible();
  const restoredChange = page.getByRole("button", { name: /header changed/i }).first();
  await expect(restoredChange.getByText("Before", { exact: true })).toBeVisible();
  await expect(restoredChange.getByText("Restored", { exact: true })).toBeVisible();
  await restoredChange.click();
  await expect(page.locator("#field-name")).toBeFocused();
  await expect(page.getByText("Restore point saved")).toBeVisible();

  await page.getByLabel("Delete saved version Original software resume").click();
  await expect(page.getByText("Deleted checkpoint")).toBeVisible();
  await expect(page.getByText("Restore it to version history before closing this page.")).toBeVisible();

  await page.getByRole("button", { name: /undo delete/i }).click();
  await expect(page.getByText("Restored deleted checkpoint")).toBeVisible();
  await expect(page.getByLabel("Delete saved version Original software resume")).toBeVisible();
});

test("compares two saved version history checkpoints", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^sample$/i }).click();

  await page.getByRole("button", { name: /save version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Original software resume");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  await page
    .getByLabel("Professional Summary")
    .fill("Platform engineer focused on infrastructure launches, reliability, and internal developer tools.");
  await page.getByRole("button", { name: /save version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Platform tailoring draft");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  await expect(page.getByText("Derived from Original software resume")).toBeVisible();
  await expect(page.getByText("Compare two saved checkpoints")).toBeVisible();
  await page.getByRole("button", { name: /compare saved versions/i }).click();

  const compareDialog = page.getByRole("dialog", { name: /compare saved versions/i });
  await expect(compareDialog).toBeVisible();
  await expect(compareDialog.getByText("Platform tailoring draft")).toBeVisible();
  await expect(compareDialog.getByText("Original software resume")).toBeVisible();
  await expect(compareDialog.getByText("Summary changed")).toBeVisible();
  await expect(compareDialog.getByText("Base", { exact: true })).toBeVisible();
  await expect(compareDialog.getByText("Compared", { exact: true })).toBeVisible();
  await expect(compareDialog.getByText("Platform engineer focused on infrastructure launches")).toBeVisible();
  await expect(compareDialog.getByText("Software engineer specializing")).toBeVisible();
  await expect(compareDialog.getByRole("button", { name: /restore compared/i })).toBeVisible();
  await expect(compareDialog.getByRole("button", { name: /restore base/i })).toBeVisible();
});

test("warns before replacing the oldest local version history checkpoint", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^sample$/i }).click();

  for (let index = 1; index <= 5; index += 1) {
    await page
      .getByLabel("Professional Summary")
      .fill(`Tailored summary ${index} with enough specific context for this saved checkpoint.`);
    await page.getByRole("button", { name: /save version/i }).click();
    await page.getByLabel("Checkpoint name").fill(`Checkpoint ${index}`);
    await page.getByRole("button", { name: /save checkpoint/i }).click();
  }

  await expect(page.getByText("5/5 saved")).toBeVisible();
  await expect(page.getByText("New checkpoints replace the oldest saved draft.")).toBeVisible();
  await expect(
    page.getByText("Checkpoint 1 is the oldest checkpoint and will be replaced first by a new unique save."),
  ).toBeVisible();

  await page
    .getByLabel("Professional Summary")
    .fill("Tailored summary 6 with a new role-specific angle that should replace the oldest checkpoint.");
  await page.getByRole("button", { name: /save with review/i }).click();

  const saveDialog = page.getByRole("dialog", { name: /name this checkpoint/i });
  await expect(saveDialog).toBeVisible();
  await expect(saveDialog.getByText("History is full")).toBeVisible();
  await expect(saveDialog.getByText("Saving a new checkpoint will replace Checkpoint 1")).toBeVisible();

  await page.getByLabel("Checkpoint name").fill("Checkpoint 6");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  await expect(page.getByText("Saved locally and replaced Checkpoint 1")).toBeVisible();
  await expect(page.getByText("Checkpoint 6", { exact: true })).toBeVisible();
  await expect(page.getByText("Checkpoint 1", { exact: true })).toBeHidden();
  await expect(page.getByText("5/5 saved")).toBeVisible();
});

test("imports a checkpoint history backup without replacing the current resume", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^sample$/i }).click();
  await page.getByRole("button", { name: /save version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Platform baseline");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  const checkpoints = await page.evaluate(() => localStorage.getItem("resume-editor-version-history-v1"));
  const backup = JSON.stringify({
    format: "resume-editor-version-history-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    checkpoints: JSON.parse(checkpoints ?? "[]"),
  });

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator("#history-backup-input").setInputFiles({
    name: "resume-checkpoints.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });

  const backupDialog = page.getByRole("dialog", { name: /add saved checkpoints from backup/i });
  await expect(backupDialog).toBeVisible();
  await expect(backupDialog.getByText("Platform baseline")).toBeVisible();
  await backupDialog.getByRole("button", { name: /add checkpoints/i }).click();

  await expect(page.getByText("Platform baseline").first()).toBeVisible();
  await expect(page.getByText("Added 1 checkpoint")).toBeVisible();
  await expect(page.getByText("Start from the resume you already have.")).toBeVisible();
});

test("makes matching checkpoint backups explicit before merging", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^sample$/i }).click();
  await page.getByRole("button", { name: /save version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Platform baseline");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  const backup = await page.evaluate(() => {
    const checkpoints = JSON.parse(localStorage.getItem("resume-editor-version-history-v1") ?? "[]");
    return JSON.stringify({
      format: "resume-editor-version-history-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      checkpoints,
    });
  });

  await page.locator("#history-backup-input").setInputFiles({
    name: "matching-resume-checkpoints.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });

  const backupDialog = page.getByRole("dialog", { name: /add saved checkpoints from backup/i });
  await expect(backupDialog.getByText("No new checkpoints to add")).toBeVisible();
  await expect(backupDialog.getByText("1 checkpoint already matches this browser")).toBeVisible();
  await expect(backupDialog.getByText("Matching drafts will not use another local history slot.")).toBeVisible();
  await backupDialog.getByRole("button", { name: /add checkpoints/i }).click();

  await expect(page.getByText("All backup checkpoints are already saved")).toBeVisible();
  await expect(page.getByText("Platform baseline", { exact: true })).toHaveCount(1);
});

test("names checkpoints that remain only in a large imported backup", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^sample$/i }).click();
  await page.getByRole("button", { name: /save version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Template checkpoint");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  const checkpoint = await page.evaluate(() => {
    const history = JSON.parse(localStorage.getItem("resume-editor-version-history-v1") ?? "[]");
    return history[0];
  });
  const checkpoints = Array.from({ length: 5 }, (_, index) => ({
    ...checkpoint,
    id: `backup-${index + 1}`,
    label: `Archived checkpoint ${index + 1}`,
    fingerprint: `backup-fingerprint-${index + 1}`,
    savedAt: new Date(Date.UTC(2026, 0, 5 - index)).toISOString(),
  }));
  const backup = JSON.stringify({
    format: "resume-editor-version-history-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    checkpoints,
  });

  await page.locator("#history-backup-input").setInputFiles({
    name: "large-resume-checkpoints.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });

  const backupDialog = page.getByRole("dialog", { name: /add saved checkpoints from backup/i });
  await expect(backupDialog).toBeVisible();
  await expect(backupDialog.getByText("5 unique checkpoints ready to add")).toBeVisible();
  await expect(backupDialog.getByText("1 older checkpoint will stay only in this backup")).toBeVisible();
  await expect(backupDialog.getByText(/Archived checkpoint 5 ·/)).toBeVisible();
  await backupDialog.getByRole("button", { name: /add checkpoints/i }).click();

  await expect(page.getByText("Archived checkpoint 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Archived checkpoint 5", { exact: true })).toBeHidden();
});

test("reviews every checkpoint in backups larger than local history", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^sample$/i }).click();
  await page.getByRole("button", { name: /save version/i }).click();
  await page.getByLabel("Checkpoint name").fill("Template checkpoint");
  await page.getByRole("button", { name: /save checkpoint/i }).click();

  const checkpoint = await page.evaluate(() => {
    const history = JSON.parse(localStorage.getItem("resume-editor-version-history-v1") ?? "[]");
    return history[0];
  });
  const checkpoints = Array.from({ length: 7 }, (_, index) => ({
    ...checkpoint,
    id: `expanded-backup-${index + 1}`,
    label: `Expanded checkpoint ${index + 1}`,
    fingerprint: `expanded-backup-fingerprint-${index + 1}`,
    savedAt: new Date(Date.UTC(2026, 0, 7 - index)).toISOString(),
  }));
  const backup = JSON.stringify({
    format: "resume-editor-version-history-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    checkpoints,
  });

  await page.locator("#history-backup-input").setInputFiles({
    name: "expanded-resume-checkpoints.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });

  const backupDialog = page.getByRole("dialog", { name: /add saved checkpoints from backup/i });
  await expect(backupDialog.getByText("7 unique checkpoints ready to add")).toBeVisible();
  await expect(backupDialog.getByText("3 older checkpoints will stay only in this backup")).toBeVisible();
  await expect(backupDialog.getByText(/Expanded checkpoint 7 ·/)).toBeVisible();

  await backupDialog.getByRole("button", { name: /add checkpoints/i }).click();
  await expect(page.getByText("Added 4 checkpoints")).toBeVisible();
  await expect(page.getByText("Expanded checkpoint 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Expanded checkpoint 7", { exact: true })).toBeHidden();
});

test("reviews role language locally without presenting an ATS score", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /^sample$/i }).click();

  const description = page.getByLabel("Job description");
  await description.fill(
    "Build TypeScript services for product teams. Partner with platform teams to improve TypeScript reliability.",
  );

  await expect(page.getByText(/selected terms already used/i)).toBeVisible();
  await expect(page.getByText("typescript", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("partner", { exact: true })).toBeVisible();
  await expect(page.getByText("This is a wording review, not an ATS score.")).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("resume-editor-role-focus-v1"))).toContain("TypeScript");

  await page.getByRole("button", { name: /clear description/i }).click();
  await expect(description).toHaveValue("");
});
