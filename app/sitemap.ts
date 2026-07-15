import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/** Public pages use privacv.app by default and can be overridden for previews. */
export default function sitemap(): MetadataRoute.Sitemap {
  const home = absoluteUrl("/");
  const about = absoluteUrl("/about");
  const privacy = absoluteUrl("/privacy");

  return [
    { url: home, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: about, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: privacy, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
  ];
}
