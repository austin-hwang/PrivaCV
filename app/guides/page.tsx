import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { GUIDES, guidePath } from "@/lib/guides";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

const title = "Resume Guides";
const description =
  "Practical, no-nonsense guides to writing, formatting, and tailoring your resume, from the team behind PrivaCV's private, ATS-friendly resume editor.";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: `${title} | ${SITE_NAME}`,
  description,
  url: absoluteUrl("/guides"),
  hasPart: GUIDES.map((guide) => ({
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    url: absoluteUrl(guidePath(guide.slug)),
  })),
};

export const metadata: Metadata = {
  title,
  description,
  alternates: SITE_URL ? { canonical: "/guides" } : undefined,
  openGraph: { title: `${title} | ${SITE_NAME}`, description, url: absoluteUrl("/guides") },
};

export default function GuidesPage() {
  return (
    <>
      <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{SITE_NAME}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Resume guides</h1>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted-foreground">{description}</p>

      <div className="mt-12 grid gap-5">
        {GUIDES.map((guide) => (
          <Link
            key={guide.slug}
            href={guidePath(guide.slug)}
            className="block rounded-lg border bg-card p-6 transition-colors hover:border-foreground/30"
          >
            <h2 className="text-xl font-semibold tracking-tight">{guide.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{guide.description}</p>
            <span className="mt-3 inline-block text-sm font-medium underline underline-offset-4">Read the guide</span>
          </Link>
        ))}
      </div>

      <nav className="mt-12 flex flex-wrap gap-5 text-sm font-medium" aria-label="Related pages">
        <Link className="underline underline-offset-4" href="/">Open the editor</Link>
        <Link className="underline underline-offset-4" href="/ats-resume-checker">ATS resume checker</Link>
        <Link className="underline underline-offset-4" href="/resume-templates">Resume templates</Link>
      </nav>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </main>
      <SiteFooter />
    </>
  );
}
