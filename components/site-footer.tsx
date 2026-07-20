import Link from "next/link";
import { GUIDES, guidePath } from "@/lib/guides";
import { SITE_NAME } from "@/lib/site";

const RESUME_TOOLS = [
  { href: "/free-resume-builder", label: "Free resume builder" },
  { href: "/ats-resume-checker", label: "ATS resume checker" },
  { href: "/resume-templates", label: "Resume templates" },
  { href: "/pdf-to-docx-resume", label: "PDF to DOCX resume" },
  { href: "/plain-text-resume", label: "Plain-text resume" },
  { href: "/resume-builder-comparison", label: "Resume builder comparison" },
];

const JOB_SEARCH_TOOLS = [
  { href: "/job-application-tracker", label: "Job application tracker" },
  { href: "/job-search-sankey", label: "Job search Sankey generator" },
];

const COMPANY = [
  { href: "/about", label: "About PrivaCV" },
  { href: "/privacy", label: "Privacy" },
];

/** Site-wide footer shared across every public page. Per-page contextual
 * "related" links live in the page body; this is the consistent navigation. */
export function SiteFooter() {
  const groups = [
    { title: "Resume tools", links: RESUME_TOOLS },
    { title: "Job search", links: JOB_SEARCH_TOOLS },
    {
      title: "Guides",
      links: [
        { href: "/guides", label: "All resume guides" },
        ...GUIDES.map((guide) => ({
          href: guidePath(guide.slug),
          label: guide.navLabel ?? guide.title,
        })),
      ],
    },
    { title: "PrivaCV", links: COMPANY },
  ];

  return (
    <footer className="border-t">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <nav className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4" aria-label="Footer">
          {groups.map((group) => (
            <div key={group.title}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {group.title}
              </h2>
              <ul className="mt-3 grid gap-2 text-sm">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <p className="mt-10 text-xs text-muted-foreground">
          <Link
            href="/"
            prefetch={false}
            className="font-semibold text-foreground transition-opacity hover:opacity-80"
          >
            {SITE_NAME}
          </Link>
          <span> · Private, ATS-friendly resume editing that stays in your browser.</span>
        </p>
      </div>
    </footer>
  );
}
