import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PrivaCV — Private, ATS-Friendly Resume Editor",
    short_name: "PrivaCV",
    description:
      "Build, tailor, and export a clean resume locally in your browser with PrivaCV. No account, subscription, watermark, or uploaded resume required.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#28303d",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
