import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SiteFooter } from "@/components/site-footer";
import { absoluteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

export type FaqItem = { question: string; answer: string };
type Card = { title: string; body: string; image?: { src: string; alt: string } };
type ProseSection = { heading: string; paragraphs: string[] };
type RelatedLink = { href: string; label: string };
export type LandingCardLayout = "evidence" | "ledger" | "process" | "gallery";

export type SeoLandingProps = {
  h1: string;
  context: string;
  lede: string;
  ctaLabel: string;
  ctaHref?: string;
  heroImage?: { src: string; alt: string };
  cards: Card[];
  cardLayout?: LandingCardLayout;
  prose?: ProseSection[];
  faqHeading?: string;
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
export function SeoLanding({
  h1,
  context,
  lede,
  ctaLabel,
  ctaHref = "/",
  heroImage,
  cards,
  cardLayout = "evidence",
  prose = [],
  faqHeading = "Questions before you use it",
  faqItems,
  related,
  breadcrumb,
}: SeoLandingProps) {
  return (
    <>
      <main className="mx-auto max-w-6xl px-6 py-14 sm:py-18">
        <header
          className={cn(
            heroImage
              ? "grid items-center gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]"
              : "max-w-4xl",
          )}
        >
          <div>
            <p className="text-sm font-medium text-primary">{context}</p>
            <h1 className="mt-4 max-w-3xl font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              {h1}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{lede}</p>
            <div className="mt-7">
              <Link className={buttonVariants({ size: "lg" })} href={ctaHref} prefetch={false}>
                {ctaLabel}
              </Link>
            </div>
          </div>

          {heroImage ? (
            <Image
              className="h-auto w-full rounded-lg border bg-stage"
              src={heroImage.src}
              alt={heroImage.alt}
              width={1200}
              height={630}
              sizes="(max-width: 1024px) 100vw, 56vw"
              priority
            />
          ) : null}
        </header>

        {cards.length > 0 ? (
          <section className="mt-16" aria-label="What this tool does">
            {cardLayout === "gallery" ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((card) => (
                  <Card key={card.title} className="py-0">
                    {card.image ? (
                      <Image
                        className="h-auto w-full border-b bg-muted"
                        src={card.image.src}
                        alt={card.image.alt}
                        width={800}
                        height={1040}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : null}
                    <CardHeader className="py-5">
                      <CardTitle>{card.title}</CardTitle>
                      <CardDescription>{card.body}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : cardLayout === "process" ? (
              <>
                <Separator />
                <ol className="grid gap-8 py-8 md:grid-cols-3">
                  {cards.map((card, index) => (
                    <li key={card.title} className="grid grid-cols-[2rem_1fr] gap-3 md:block">
                      <span className="text-sm font-semibold tabular-nums text-primary">
                        {index + 1}
                      </span>
                      <div className="md:mt-5">
                        <h2 className="font-serif text-xl font-bold">{card.title}</h2>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {card.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <Separator />
              </>
            ) : cardLayout === "ledger" ? (
              <div className="grid gap-x-12 md:grid-cols-2">
                {cards.map((card) => (
                  <div key={card.title}>
                    <Separator />
                    <article className="py-6">
                      <h2 className="font-serif text-xl font-bold">{card.title}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {card.body}
                      </p>
                    </article>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <Separator />
                {cards.map((card, index) => (
                  <Fragment key={card.title}>
                    <article className="grid gap-3 py-6 sm:grid-cols-[16rem_1fr] sm:gap-8">
                      <h2 className="font-serif text-xl font-bold">{card.title}</h2>
                      <p className="text-sm leading-relaxed text-muted-foreground">{card.body}</p>
                    </article>
                    {index < cards.length - 1 ? <Separator /> : null}
                  </Fragment>
                ))}
                <Separator />
              </div>
            )}
          </section>
        ) : null}

        {prose.length > 0 ? (
          <div className="mt-18 flex flex-col gap-12">
            {prose.map((section) => (
              <section
                key={section.heading}
                className="grid gap-5 lg:grid-cols-[minmax(12rem,17rem)_minmax(0,42rem)] lg:gap-12"
              >
                <h2 className="font-serif text-2xl font-bold leading-tight text-foreground">
                  {section.heading}
                </h2>
                <div className="flex flex-col gap-4 text-base leading-relaxed text-muted-foreground">
                  {section.paragraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}

        <Separator className="mt-18" />
        <section className="py-10">
          <h2 className="font-serif text-2xl font-bold">{faqHeading}</h2>
          <dl className="mt-6 grid gap-x-10 gap-y-7 md:grid-cols-2">
            {faqItems.map((item) => (
              <div key={item.question}>
                <dt className="font-medium">{item.question}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <Separator />

        <nav
          className="mt-10 flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-5"
          aria-label="Related pages"
        >
          <span className="font-serif font-bold">Continue with PrivaCV</span>
          <Link
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            href="/"
            prefetch={false}
          >
            Open the editor
          </Link>
          {related.map((link) => (
            <Link
              key={link.href}
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
              href={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faqItems)) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(breadcrumbJsonLd(breadcrumb.name, breadcrumb.path)),
          }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
