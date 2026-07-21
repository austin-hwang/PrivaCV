import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { type GuideMeta, guidePath } from "@/lib/guides";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

type RelatedLink = { href: string; label: string };

function formatUpdated(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function articleJsonLd(guide: GuideMeta) {
  const url = absoluteUrl(guidePath(guide.slug));
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    image: absoluteUrl("/social/ats-friendly-resume"),
    datePublished: guide.published ?? guide.updated,
    dateModified: guide.updated,
    mainEntityOfPage: url,
    author: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl("/"),
      logo: { "@type": "ImageObject", url: absoluteUrl("/icon"), width: 96, height: 96 },
    },
  };
}

function breadcrumbJsonLd(guide: GuideMeta) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Guides", item: absoluteUrl("/guides") },
      {
        "@type": "ListItem",
        position: 3,
        name: guide.title,
        item: absoluteUrl(guidePath(guide.slug)),
      },
    ],
  };
}

/** Shared chrome and structured data for a long-form guide. The page supplies
 * its own route-level metadata and writes the article body as children. */
export function GuideLayout({
  guide,
  related,
  children,
}: {
  guide: GuideMeta;
  related: RelatedLink[];
  children: ReactNode;
}) {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <nav className="text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link className="hover:text-foreground" href="/" prefetch={false}>
            Home
          </Link>
          <span aria-hidden="true"> / </span>
          <Link className="hover:text-foreground" href="/guides">
            Guides
          </Link>
        </nav>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {SITE_NAME} Guide
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{guide.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Last updated {formatUpdated(guide.updated)}
        </p>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{guide.description}</p>

        <Image
          className="mt-8 h-auto w-full rounded-xl border shadow-xs"
          src="/social/ats-friendly-resume"
          alt="ATS-friendly resume checklist covering layout, headings, selectable text, and plain-text review"
          width={1200}
          height={630}
          sizes="(max-width: 768px) 100vw, 768px"
          priority
        />

        <div className="typeset typeset-docs mt-10">{children}</div>

        <div className="mt-12 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Put this into practice</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Build or import your resume in PrivaCV, review the exact text an applicant tracking
            system reads, and export a clean PDF or Word file. Everything stays in your browser.
          </p>
          <Link
            className="mt-4 inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            href="/"
            prefetch={false}
          >
            Open the editor
          </Link>
        </div>

        {related.length > 0 ? (
          <nav
            className="mt-12 flex flex-wrap gap-5 text-sm font-medium"
            aria-label="Related pages"
          >
            {related.map((link) => (
              <Link key={link.href} className="underline underline-offset-4" href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(guide)) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(guide)) }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
