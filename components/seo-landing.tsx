import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

export type FaqItem = { question: string; answer: string };
type Card = { title: string; body: string; image?: { src: string; alt: string } };
type ProseSection = { heading: string; paragraphs: string[] };
type RelatedLink = { href: string; label: string };

export type SeoLandingProps = {
  h1: string;
  lede: string;
  ctaLabel: string;
  ctaHref?: string;
  heroImage?: { src: string; alt: string };
  cards: Card[];
  prose?: ProseSection[];
  faqItems: FaqItem[];
  related: RelatedLink[];
  /** Trail from the home page to this page, used for BreadcrumbList structured data. */
  breadcrumb: { name: string; path: string };
};

/** Semantic FAQ data. Search engines decide whether a page type is eligible
 * for an enhanced result; the visible FAQ remains useful either way. */
export function faqJsonLd(faqItems: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** JSON-LD breadcrumb trail (Home > page) so results can show a breadcrumb. */
export function breadcrumbJsonLd(name: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name, item: absoluteUrl(path) },
    ],
  };
}

/**
 * Shared layout for the query-targeted SEO landing pages. Each page supplies its
 * own copy plus a route-level `metadata` export; this renders the crawlable body
 * and the FAQ structured data.
 */
export function SeoLanding({ h1, lede, ctaLabel, ctaHref = "/", heroImage, cards, prose = [], faqItems, related, breadcrumb }: SeoLandingProps) {
  return (
    <>
      <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{SITE_NAME}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{h1}</h1>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted-foreground">{lede}</p>

      <div className="mt-6">
        <Link
          className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          href={ctaHref}
          prefetch={false}
        >
          {ctaLabel}
        </Link>
      </div>

      {heroImage ? (
        <Image
          className="mt-10 h-auto w-full max-w-4xl rounded-xl border shadow-sm"
          src={heroImage.src}
          alt={heroImage.alt}
          width={1200}
          height={630}
          sizes="(max-width: 1024px) 100vw, 896px"
        />
      ) : null}

      {cards.length > 0 ? (
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <article key={card.title} className="rounded-lg border bg-card p-5">
              {card.image ? (
                <Image
                  className="mb-5 h-auto w-full rounded-md border bg-muted"
                  src={card.image.src}
                  alt={card.image.alt}
                  width={800}
                  height={1040}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              ) : null}
              <h2 className="font-semibold">{card.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
            </article>
          ))}
        </div>
      ) : null}

      {prose.map((section) => (
        <section key={section.heading} className="mt-12 max-w-3xl text-base leading-relaxed text-muted-foreground">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{section.heading}</h2>
          {section.paragraphs.map((paragraph, index) => (
            <p key={index} className="mt-3">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <section className="mt-12 border-t pt-10">
        <h2 className="text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
        <dl className="mt-6 grid gap-x-10 gap-y-7 md:grid-cols-2">
          {faqItems.map((item) => (
            <div key={item.question}>
              <dt className="font-medium">{item.question}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <nav className="mt-12 flex flex-wrap gap-5 text-sm font-medium" aria-label="Related pages">
        <Link className="underline underline-offset-4" href="/" prefetch={false}>Open the editor</Link>
        {related.map((link) => (
          <Link key={link.href} className="underline underline-offset-4" href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faqItems)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumb.name, breadcrumb.path)) }} />
      </main>
      <SiteFooter />
    </>
  );
}
