import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { Separator } from "@/components/ui/separator";
import { GUIDES, guidePath } from "@/lib/guides";
import { createPageMetadata } from "@/lib/seo";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

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

export const metadata: Metadata = createPageMetadata({
  title,
  description,
  path: "/guides",
  socialImage: "resume-guides",
});

export default function GuidesPage() {
  return (
    <>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-sm font-medium text-primary">Practical resume notes</p>
        <h1 className="mt-4 font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Resume guides
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted-foreground">
          {description}
        </p>

        <div className="mt-12">
          <Separator />
          {GUIDES.map((guide, index) => (
            <Fragment key={guide.slug}>
              <Link
                href={guidePath(guide.slug)}
                className="grid gap-3 py-6 transition-colors hover:text-primary sm:grid-cols-[15rem_1fr] sm:gap-8"
              >
                <h2 className="font-serif text-xl font-bold">{guide.title}</h2>
                <span>
                  <span className="block text-sm leading-relaxed text-muted-foreground">
                    {guide.description}
                  </span>
                  <span className="mt-3 inline-block text-sm font-medium underline underline-offset-4">
                    Read the guide
                  </span>
                </span>
              </Link>
              {index < GUIDES.length - 1 ? <Separator /> : null}
            </Fragment>
          ))}
          <Separator />
        </div>

        <nav className="mt-12 flex flex-wrap gap-5 text-sm font-medium" aria-label="Related pages">
          <Link className="underline underline-offset-4" href="/" prefetch={false}>
            Open the editor
          </Link>
          <Link className="underline underline-offset-4" href="/ats-resume-checker">
            ATS resume checker
          </Link>
          <Link className="underline underline-offset-4" href="/resume-templates">
            Resume templates
          </Link>
        </nav>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
