/** Registry of long-form guides. The hub, sitemap, and each guide page all read
 * from here so the set stays in sync. Add a guide by appending an entry and
 * creating the matching page under app/guides/<slug>/. */
export type GuideMeta = {
  slug: string;
  title: string;
  /** Short label for compact spots like the footer (falls back to title). */
  navLabel?: string;
  /** Short blurb for the hub list and the page meta description. */
  description: string;
  /** ISO date (YYYY-MM-DD) of the last meaningful update. */
  updated: string;
  /** ISO date (YYYY-MM-DD) when the guide was first published. */
  published?: string;
};

export const GUIDES: GuideMeta[] = [
  {
    slug: "ats-friendly-resume",
    title: "ATS-Friendly Resume: 7 Formatting Rules That Work",
    navLabel: "ATS-friendly resume",
    description:
      "Learn which layouts, headings, fonts, keywords, and file types ATS software reads reliably—plus a 7-point checklist to use before you apply.",
    published: "2026-07-15",
    updated: "2026-07-19",
  },
];

export function guidePath(slug: string) {
  return `/guides/${slug}`;
}

export function getGuide(slug: string) {
  return GUIDES.find((guide) => guide.slug === slug);
}
