const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const { app, BrowserWindow, dialog, session, shell } = require("electron");

const DESKTOP_PORT = 47837;
const DESKTOP_HOST = "127.0.0.1";
const PRODUCTION_URL = `http://${DESKTOP_HOST}:${DESKTOP_PORT}`;
const DEVELOPMENT_URL = process.env.ELECTRON_START_URL;
const APP_URL = DEVELOPMENT_URL || PRODUCTION_URL;
const APP_ORIGIN = new URL(APP_URL).origin;
const EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

let mainWindow = null;
let serverProcess = null;
let quitting = false;
const serverOutput = [];

function rememberServerOutput(chunk) {
  const text = chunk.toString();
  process.stderr.write(text);
  serverOutput.push(...text.split(/\r?\n/).filter(Boolean));
  if (serverOutput.length > 30) serverOutput.splice(0, serverOutput.length - 30);
}

function canOpenExternally(candidate) {
  try {
    return EXTERNAL_PROTOCOLS.has(new URL(candidate).protocol);
  } catch {
    return false;
  }
}

function isApplicationUrl(candidate) {
  try {
    return new URL(candidate).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

async function openExternal(candidate) {
  if (canOpenExternally(candidate)) await shell.openExternal(candidate);
}

function assertPortAvailable() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => reject(error));
    server.listen({ host: DESKTOP_HOST, port: DESKTOP_PORT, exclusive: true }, () => {
      server.close(resolve);
    });
  });
}

function standaloneServerPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, "standalone", "server.js");
  return path.join(__dirname, "..", ".next-electron", "standalone", "server.js");
}

async function waitForServer(url, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!serverProcess) throw new Error("The local server exited before it became ready.");
    if (serverProcess.exitCode !== null)
      throw new Error(`The local server exited with code ${serverProcess.exitCode}.`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
    } catch {
      // The local server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("The local PrivaCV server did not become ready in time.");
}

async function startProductionServer() {
  if (DEVELOPMENT_URL || serverProcess) return;
  await assertPortAvailable();

  const serverPath = standaloneServerPath();
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: DESKTOP_HOST,
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      PORT: String(DESKTOP_PORT),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProcess.stdout.on("data", rememberServerOutput);
  serverProcess.stderr.on("data", rememberServerOutput);
  serverProcess.once("error", rememberServerOutput);
  serverProcess.once("exit", (code, signal) => {
    serverProcess = null;
    if (!quitting) {
      dialog.showErrorBox(
        "PrivaCV stopped unexpectedly",
        `The local application server exited (${signal || code || "unknown reason"}).`,
      );
      app.quit();
    }
  });

  await waitForServer(PRODUCTION_URL);
}

function stopProductionServer() {
  quitting = true;
  if (!serverProcess || serverProcess.killed) return;
  serverProcess.kill("SIGTERM");
  serverProcess = null;
}

function secureWebContents(webContents) {
  webContents.setWindowOpenHandler(({ url }) => {
    void openExternal(url);
    return { action: "deny" };
  });
  webContents.on("will-navigate", (event, url) => {
    if (isApplicationUrl(url)) return;
    event.preventDefault();
    void openExternal(url);
  });
  webContents.on("will-attach-webview", (event) => event.preventDefault());
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: "#16181d",
    show: false,
    title: "PrivaCV",
    webPreferences: {
      contextIsolation: true,
      devTools: !app.isPackaged,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow = window;
  secureWebContents(window.webContents);
  window.once("ready-to-show", () => window.show());
  window.once("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  await window.loadURL(APP_URL);
}

app.on("before-quit", () => {
  quitting = true;
});
app.on("will-quit", stopProductionServer);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (!mainWindow) void createWindow();
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false);
    });
    session.defaultSession.setPermissionCheckHandler(() => false);

    try {
      await startProductionServer();
      await createWindow();
    } catch (error) {
      stopProductionServer();
      const detail = error instanceof Error ? error.message : String(error);
      const logs = serverOutput.length ? `\n\n${serverOutput.join("\n")}` : "";
      dialog.showErrorBox("PrivaCV could not start", `${detail}${logs}`);
      app.quit();
    }
  });
}
