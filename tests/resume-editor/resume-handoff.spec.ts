import { expect, test } from "@playwright/test";
import { loadSample } from "../resume-editor-support";

test("transfers a resume and job applications with a short pairing code", async ({
  browser,
  page: sender,
}) => {
  test.setTimeout(60_000);

  await sender.goto("/");
  await sender.evaluate(() => localStorage.clear());
  await sender.reload();
  await loadSample(sender);
  await sender.goto("/applications");
  await sender.getByRole("button", { name: "Load sample" }).click();
  await expect(sender.getByText("13 applications in this view")).toBeVisible();
  await sender.goto("/");

  const receiverContext = await browser.newContext();
  const receiver = await receiverContext.newPage();
  try {
    await receiver.goto("/");
    await receiver.evaluate(() => localStorage.clear());
    await receiver.reload();

    await sender.getByRole("button", { name: /open tools/i }).click();
    const tools = sender.getByRole("dialog", { name: /^tools$/i });
    await tools.getByRole("button", { name: /continue on another device/i }).click();
    const senderDialog = sender.getByRole("dialog", { name: /continue on another device/i });
    await expect(
      senderDialog.getByText("13 applications are available on this device."),
    ).toBeVisible();
    await expect(senderDialog.getByRole("radio", { name: "Both" })).toBeChecked();
    await senderDialog.getByRole("button", { name: /^create transfer$/i }).click();
    const handoffUrl = await senderDialog
      .locator("[data-handoff-url]")
      .getAttribute("data-handoff-url");
    expect(handoffUrl).toMatch(/#handoff=PCV3\./u);
    const pairingCode = await senderDialog.getByLabel("Or enter this pairing code").inputValue();
    expect(pairingCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/u);

    await receiver.getByRole("button", { name: /open tools/i }).click();
    const receiverTools = receiver.getByRole("dialog", { name: /^tools$/i });
    await receiverTools.getByRole("button", { name: /continue on another device/i }).click();
    const receiverDialog = receiver.getByRole("dialog", { name: /continue on another device/i });
    await expect(receiverDialog).toBeVisible();
    await receiverDialog.getByRole("radio", { name: "Receive data" }).click();
    await receiverDialog.getByLabel("Pairing code").fill(pairingCode);
    await receiverDialog.getByRole("button", { name: "Connect devices" }).click();
    await expect(receiverDialog.getByText("Private link opened")).toBeVisible();

    await expect(receiverDialog.getByText("Data received and verified.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(receiverDialog.getByText(/John Doe and 13 applications/)).toBeVisible();
    await receiverDialog.getByRole("button", { name: /save received data/i }).click();
    await expect(receiver.getByLabel("Full Name")).toHaveValue("John Doe");
    await expect(
      senderDialog.getByText("Data delivered and verified by the other device."),
    ).toBeVisible();
    await receiver.goto("/applications");
    await expect(
      receiver
        .locator('section[aria-label="Applications summary"]')
        .getByText("13", { exact: true }),
    ).toBeVisible();
    await expect(
      receiver.getByRole("button", { name: /Open Staff Product Designer at Aster Cloud/i }),
    ).toBeVisible();
  } finally {
    await receiverContext.close();
  }
});
