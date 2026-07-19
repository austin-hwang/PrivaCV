import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PrivaCV: Private, ATS-Friendly Resume Editor",
    short_name: "PrivaCV",
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#28303d",
    icons: [
      {
        src: "/icon",
        sizes: "96x96",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "96x96",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
