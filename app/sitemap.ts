import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/** Public pages become discoverable in search after NEXT_PUBLIC_SITE_URL is set. */
export default function sitemap(): MetadataRoute.Sitemap {
  const home = absoluteUrl("/");
  const about = absoluteUrl("/about");
  const privacy = absoluteUrl("/privacy");
  if (!home || !about || !privacy) return [];

  return [
    { url: home, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: about, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: privacy, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
  ];
}
