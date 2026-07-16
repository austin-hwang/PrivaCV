import type { MetadataRoute } from "next";
import { GUIDES, guidePath } from "@/lib/guides";
import { absoluteUrl } from "@/lib/site";

/** Public pages use privacv.app by default and can be overridden for previews. */
export default function sitemap(): MetadataRoute.Sitemap {
  const landerPaths = [
    "/free-resume-builder",
    "/ats-resume-checker",
    "/resume-templates",
    "/pdf-to-docx-resume",
    "/plain-text-resume",
    "/resume-builder-comparison",
  ];

  return [
    { url: absoluteUrl("/"), lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    ...landerPaths.map((path) => ({
      url: absoluteUrl(path),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: absoluteUrl("/guides"), lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    ...GUIDES.map((guide) => ({
      url: absoluteUrl(guidePath(guide.slug)),
      lastModified: new Date(`${guide.updated}T00:00:00Z`),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: absoluteUrl("/about"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/privacy"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
  ];
}
