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
    { title: "Build and check", links: RESUME_TOOLS },
    {
      title: "Track and learn",
      links: [
        ...JOB_SEARCH_TOOLS,
        { href: "/guides", label: "All resume guides" },
        ...GUIDES.map((guide) => ({
          href: guidePath(guide.slug),
          label: guide.navLabel ?? guide.title,
        })),
      ],
    },
    { title: "Project", links: COMPANY },
  ];

  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[minmax(14rem,0.85fr)_minmax(0,2fr)]">
        <div>
          <Link
            href="/"
            prefetch={false}
            className="font-serif text-xl font-bold text-foreground transition-opacity hover:opacity-80"
          >
            {SITE_NAME}
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Resume editing and job-search tracking that stays on this device, with no account or
            cloud database.
          </p>
        </div>
        <nav className="grid gap-8 sm:grid-cols-3" aria-label="Footer">
          {groups.map((group) => (
            <div key={group.title}>
              <h2 className="font-serif text-sm font-bold">{group.title}</h2>
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
      </div>
    </footer>
  );
}
