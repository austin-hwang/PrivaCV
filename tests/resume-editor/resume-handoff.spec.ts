import { expect, test } from "@playwright/test";
import { loadSample, openMenu } from "../resume-editor-support";

test("transfers the active resume from a single scanned link", async ({
  browser,
  page: sender,
}) => {
  test.setTimeout(60_000);

  await sender.goto("/");
  await sender.evaluate(() => localStorage.clear());
  await sender.reload();
  await loadSample(sender);

  const receiverContext = await browser.newContext();
  const receiver = await receiverContext.newPage();
  try {
    await receiver.goto("/");
    await receiver.evaluate(() => localStorage.clear());
    await receiver.reload();

    await openMenu(sender);
    await sender.getByRole("menuitem", { name: /continue on another device/i }).click();
    const senderDialog = sender.getByRole("dialog", { name: /continue on another device/i });
    await senderDialog.getByRole("button", { name: /create transfer qr code/i }).click();
    const handoffUrl = await senderDialog
      .locator("[data-handoff-url]")
      .getAttribute("data-handoff-url");
    expect(handoffUrl).toMatch(/#handoff=PCV2\./u);

    await receiver.goto(handoffUrl!);
    const receiverDialog = receiver.getByRole("dialog", { name: /continue on another device/i });
    await expect(receiverDialog).toBeVisible();
    await expect(receiverDialog.getByText("Private link opened")).toBeVisible();

    await expect(receiverDialog.getByText("Resume received and verified.")).toBeVisible({
      timeout: 15_000,
    });
    await receiverDialog.getByRole("button", { name: /open received resume/i }).click();
    await expect(receiver.getByLabel("Full Name")).toHaveValue("John Doe");
    await expect(
      senderDialog.getByText("Resume delivered and verified by the other device."),
    ).toBeVisible();
  } finally {
    await receiverContext.close();
  }
});
