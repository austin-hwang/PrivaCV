import type { Metadata } from "next";
import Link from "next/link";
import { ComparisonTable } from "@/components/comparison-table";
import { breadcrumbJsonLd, faqJsonLd, type FaqItem } from "@/components/seo-landing";
import { SiteFooter } from "@/components/site-footer";
import { COMPARISON_LAST_VERIFIED } from "@/lib/competitors";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

const title = "Resume Builder Comparison";
const description =
  "Compare PrivaCV to Zety, Resume.io, Teal, Rezi, and Canva on price, privacy, exports, and ATS-friendliness. Most resume builders need an account and a subscription to download; PrivaCV is free and keeps your resume on your device.";

const faqItems: FaqItem[] = [
  {
    question: "What's the catch with a free resume builder?",
    answer:
      "With most builders, 'free' means you can build a resume but must pay to download it without a watermark, and your data is stored on their servers. PrivaCV is free to build and export, needs no account, and keeps everything in your browser.",
  },
  {
    question: "Do these resume builders store my data?",
    answer:
      "Zety, Resume.io, Teal, Rezi, and Canva are cloud tools: you create an account and your resume is saved on their servers. PrivaCV runs entirely in your browser, so your resume and its history never leave your device.",
  },
  {
    question: "Which resume builder is actually free to download from?",
    answer:
      "PrivaCV exports PDF, editable Word, plain text, Markdown, and a JSON backup at no cost. Several paid tools restrict free downloads — Zety's free tier exports plain text only, and Rezi's free tier caps PDF downloads.",
  },
  {
    question: "Is the pricing here up to date?",
    answer: `Prices and tiers change often. The figures were last verified in ${COMPARISON_LAST_VERIFIED}; check each vendor's own pricing page for the latest before subscribing.`,
  },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: SITE_URL ? { canonical: "/resume-builder-comparison" } : undefined,
  openGraph: { title: `${title} | ${SITE_NAME}`, description, url: absoluteUrl("/resume-builder-comparison") },
};

export default function ResumeBuilderComparisonPage() {
  return (
    <>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{SITE_NAME}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">PrivaCV vs Zety, Resume.io, Teal, Rezi &amp; Canva</h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted-foreground">{description}</p>

        <div className="mt-6">
          <Link
            className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            href="/"
          >
            Build your resume free
          </Link>
        </div>

        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">Feature &amp; pricing comparison</h2>
            <span className="shrink-0 text-xs text-muted-foreground">Last verified {COMPARISON_LAST_VERIFIED}</span>
          </div>
          <div className="mt-5">
            <ComparisonTable />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Pricing and tiers change frequently. Figures reflect each vendor&apos;s publicly listed plans as of{" "}
            {COMPARISON_LAST_VERIFIED}; confirm current details on their own pricing pages.
          </p>
        </section>

        <section className="mt-12 max-w-3xl text-base leading-relaxed text-muted-foreground">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">How to read this comparison</h2>
          <p className="mt-3">
            Zety, Resume.io, Teal, Rezi, and Canva are capable, well-known tools. They&apos;re also cloud services: you
            create an account, your resume is saved on their servers, and in most cases you subscribe to download a
            clean, watermark-free file. Trials often auto-renew into recurring charges if you forget to cancel.
          </p>
          <p className="mt-3">
            PrivaCV takes the opposite approach. There&apos;s no account and no subscription, the AI runs locally in your
            browser, and your resume, saved versions, and edit history stay on your own device. You can export a
            print-ready PDF, an editable Word file, plain text, Markdown, or a JSON backup — all free.
          </p>
          <p className="mt-3">
            It&apos;s a fair trade-off, not a clean sweep: the paid tools ship larger template libraries, and Teal and
            Rezi add job-tracking features PrivaCV doesn&apos;t. If a big template gallery or an all-in-one job tracker is
            what you need most, those tools may fit better. If price and privacy matter most, PrivaCV is built for that.
          </p>
        </section>

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
          <Link className="underline underline-offset-4" href="/">Open the editor</Link>
          <Link className="underline underline-offset-4" href="/free-resume-builder">Free resume builder</Link>
          <Link className="underline underline-offset-4" href="/ats-resume-checker">ATS resume checker</Link>
          <Link className="underline underline-offset-4" href="/resume-templates">Resume templates</Link>
        </nav>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faqItems)) }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(title, "/resume-builder-comparison")) }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
