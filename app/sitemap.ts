import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/** Public pages use privacv.app by default and can be overridden for previews. */
export default function sitemap(): MetadataRoute.Sitemap {
  const landerPaths = [
    "/free-resume-builder",
    "/ats-resume-checker",
    "/resume-templates",
    "/pdf-to-docx-resume",
    "/plain-text-resume",
  ];

  return [
    { url: absoluteUrl("/"), lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    ...landerPaths.map((path) => ({
      url: absoluteUrl(path),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: absoluteUrl("/about"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/privacy"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
  ];
}
