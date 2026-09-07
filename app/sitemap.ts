import type { MetadataRoute } from "next";
import { GUIDES, guidePath } from "@/lib/guides";
import { absoluteUrl } from "@/lib/site";

/** Public pages use privacv.app by default and can be overridden for previews. */
export default function sitemap(): MetadataRoute.Sitemap {
  // Update this only when the public page content or metadata changes. Using
  // the request time makes every page look freshly modified on every crawl.
  const publicPageUpdated = new Date("2026-07-19T00:00:00Z");
  const updatedPages: Record<string, string> = {
    "/resume-templates": "2026-09-06",
    "/pdf-to-docx-resume": "2026-09-06",
    "/job-application-tracker": "2026-09-06",
    "/job-search-sankey": "2026-09-06",
    "/privacy": "2026-09-06",
  };
  const updated = (path: string) =>
    updatedPages[path] ? new Date(`${updatedPages[path]}T00:00:00Z`) : publicPageUpdated;
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
      lastModified: updated(path),
    })),
    {
      url: absoluteUrl("/guides"),
      lastModified: new Date(
        Math.max(...GUIDES.map((guide) => Date.parse(`${guide.updated}T00:00:00Z`))),
      ),
    },
    ...GUIDES.map((guide) => ({
      url: absoluteUrl(guidePath(guide.slug)),
      lastModified: new Date(`${guide.updated}T00:00:00Z`),
    })),
    { url: absoluteUrl("/about"), lastModified: publicPageUpdated },
    { url: absoluteUrl("/privacy"), lastModified: updated("/privacy") },
  ];
}
