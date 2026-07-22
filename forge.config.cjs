const path = require("node:path");

module.exports = {
  packagerConfig: {
    appBundleId: "app.privacv.desktop",
    appCategoryType: "public.app-category.productivity",
    asar: true,
    executableName: "PrivaCV",
    extraResource: [path.resolve(__dirname, ".next-electron", "standalone")],
    icon:
      process.platform === "darwin"
        ? path.resolve(__dirname, "desktop", "assets", "PrivaCV.icns")
        : undefined,
    name: "PrivaCV",
    prune: false,
    ignore: [/^\/(?!desktop(?:\/|$)|package\.json$)/, /^\/desktop\/(?!main\.cjs$)/],
  },
  makers: [
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin", "linux", "win32"],
    },
  ],
};
