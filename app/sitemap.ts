import type { MetadataRoute } from "next";
import { GUIDES, guidePath } from "@/lib/guides";
import { absoluteUrl } from "@/lib/site";

/** Public pages use privacv.app by default and can be overridden for previews. */
export default function sitemap(): MetadataRoute.Sitemap {
  // Update this only when the public page content or metadata changes. Using
  // the request time makes every page look freshly modified on every crawl.
  const publicPageUpdated = new Date("2026-07-19T00:00:00Z");
  const landerPaths = [
    "/free-resume-builder",
    "/ats-resume-checker",
    "/resume-templates",
    "/pdf-to-docx-resume",
    "/plain-text-resume",
    "/resume-builder-comparison",
    "/job-application-tracker",
    "/job-search-sankey",
  ];

  return [
    { url: absoluteUrl("/"), lastModified: publicPageUpdated },
    ...landerPaths.map((path) => ({
      url: absoluteUrl(path),
      lastModified: publicPageUpdated,
    })),
    { url: absoluteUrl("/guides"), lastModified: publicPageUpdated },
    ...GUIDES.map((guide) => ({
      url: absoluteUrl(guidePath(guide.slug)),
      lastModified: new Date(`${guide.updated}T00:00:00Z`),
    })),
    { url: absoluteUrl("/about"), lastModified: publicPageUpdated },
    { url: absoluteUrl("/privacy"), lastModified: publicPageUpdated },
  ];
}
