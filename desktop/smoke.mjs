import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { _electron as electron } from "@playwright/test";

const packageDirectory = path.resolve("out", `PrivaCV-${process.platform}-${process.arch}`);
const executableByPlatform = {
  darwin: path.join(packageDirectory, "PrivaCV.app", "Contents", "MacOS", "PrivaCV"),
  linux: path.join(packageDirectory, "PrivaCV"),
  win32: path.join(packageDirectory, "PrivaCV.exe"),
};
const executablePath = executableByPlatform[process.platform];
if (!executablePath) throw new Error(`Electron smoke tests do not support ${process.platform}.`);
const userDataDirectory = await mkdtemp(path.join(os.tmpdir(), "privacv-electron-smoke-"));
let electronApp;

try {
  electronApp = await electron.launch({
    executablePath,
    args: [`--user-data-dir=${userDataDirectory}`],
    timeout: 60_000,
  });
  const window = await electronApp.firstWindow();
  await window.waitForLoadState("domcontentloaded");
  await window.getByText("PrivaCV", { exact: true }).first().waitFor({ timeout: 30_000 });

  const runtime = await window.evaluate(async () => {
    localStorage.setItem("privacv-electron-smoke", "ready");
    const databaseAvailable = await new Promise((resolve) => {
      const request = indexedDB.open("privacv-electron-smoke", 1);
      request.onsuccess = () => {
        request.result.close();
        resolve(true);
      };
      request.onerror = () => resolve(false);
    });
    return {
      cacheStorage: "caches" in window,
      databaseAvailable,
      desktopMarker: document.documentElement.dataset.desktopApp,
      hasKofiLink: Boolean(document.querySelector('a[href*="ko-fi.com"]')),
      hasStructuredData: Boolean(document.querySelector('script[type="application/ld+json"]')),
      localStorage: localStorage.getItem("privacv-electron-smoke"),
      origin: window.location.origin,
      publicExplainers: document.querySelectorAll(".public-explainer").length,
      title: document.title,
      webGpu: "gpu" in navigator,
    };
  });

  if (runtime.origin !== "http://127.0.0.1:47837") {
    throw new Error(`Unexpected desktop origin: ${runtime.origin}`);
  }
  if (!runtime.databaseAvailable || runtime.localStorage !== "ready") {
    throw new Error("Desktop browser storage is unavailable.");
  }
  if (
    runtime.desktopMarker !== "true" ||
    runtime.hasKofiLink ||
    runtime.hasStructuredData ||
    runtime.publicExplainers !== 0
  ) {
    throw new Error("The desktop app exposed public-site or SEO content.");
  }

  await window.goto(`${runtime.origin}/about`);
  await window.waitForLoadState("domcontentloaded");
  if (new URL(window.url()).pathname !== "/") {
    throw new Error("Desktop public pages must redirect to the resume workspace.");
  }

  await window.goto(`${runtime.origin}/job-search-sankey`);
  await window.waitForLoadState("domcontentloaded");
  if (new URL(window.url()).pathname !== "/applications") {
    throw new Error("Desktop tracker landing pages must redirect to the applications workspace.");
  }

  await window.goto(runtime.origin);
  await window.waitForLoadState("domcontentloaded");

  await window.getByRole("button", { name: /^more actions$/i }).click();
  await window.getByRole("menuitem", { name: /^sample$/i }).click();
  await window.getByLabel("Full Name").waitFor();
  if ((await window.getByLabel("Full Name").inputValue()) !== "John Doe") {
    throw new Error("The sample resume did not load in Electron.");
  }

  const pdfPath = path.join(userDataDirectory, "John_Doe_Resume.pdf");
  const downloadPromise = electronApp.evaluate(
    ({ session }, savePath) =>
      new Promise((resolve) => {
        session.defaultSession.once("will-download", (_event, item) => {
          item.setSavePath(savePath);
          item.once("done", (_downloadEvent, state) => {
            resolve({ filename: item.getFilename(), state });
          });
        });
      }),
    pdfPath,
  );
  await window.getByRole("button", { name: /^export$/i }).click();
  await window.getByRole("menuitem", { name: /^export pdf$/i }).click();
  const download = await downloadPromise;
  const pdfBytes = (await stat(pdfPath)).size;
  if (
    download.filename !== "John_Doe_Resume.pdf" ||
    download.state !== "completed" ||
    pdfBytes < 10_000
  ) {
    throw new Error("The packaged PDF export was not created correctly.");
  }

  console.log(
    JSON.stringify(
      {
        ...runtime,
        pdfExport: { bytes: pdfBytes, filename: download.filename },
      },
      null,
      2,
    ),
  );
} finally {
  if (electronApp) await electronApp.close();
  await rm(userDataDirectory, { force: true, recursive: true });
}
