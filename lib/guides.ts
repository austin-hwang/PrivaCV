/** Registry of long-form guides. The hub, sitemap, and each guide page all read
 * from here so the set stays in sync. Add a guide by appending an entry and
 * creating the matching page under app/guides/<slug>/. */
export type GuideMeta = {
  slug: string;
  title: string;
  /** Short blurb for the hub list and the page meta description. */
  description: string;
  /** ISO date (YYYY-MM-DD) of the last meaningful update. */
  updated: string;
};

export const GUIDES: GuideMeta[] = [
  {
    slug: "ats-friendly-resume",
    title: "How to Make an ATS-Friendly Resume",
    description:
      "What an applicant tracking system actually does with your resume, the formatting rules that matter, and how to check your resume before you apply.",
    updated: "2026-07-15",
  },
];

export function guidePath(slug: string) {
  return `/guides/${slug}`;
}

export function getGuide(slug: string) {
  return GUIDES.find((guide) => guide.slug === slug);
}
