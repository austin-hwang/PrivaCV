import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { createPageMetadata } from "@/lib/seo";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

const faqItems = [
  {
    question: "What is PrivaCV?",
    answer: "PrivaCV is a browser-based resume editor for creating, tailoring, reviewing, and exporting clean, text-based resumes.",
  },
  {
    question: "Does PrivaCV upload my resume?",
    answer: "No. Resume editing, imports, exports, the resume library, and edit history stay in the browser. Optional local AI model files may be downloaded to the browser when a person chooses to prepare a model, but resume text is not sent to an AI service.",
  },
  {
    question: "Is PrivaCV free to use?",
    answer: "PrivaCV does not require an account, subscription, or watermark. It provides free PDF export and local DOCX export.",
  },
  {
    question: "Are PrivaCV resumes ATS-friendly?",
    answer: "PrivaCV creates clean, text-based resume formats and provides a plain-text review to help people prepare an ATS-friendly resume. Compatibility can still vary by the employer's application system.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export const metadata: Metadata = createPageMetadata({
  title: "About the Private Resume Editor",
  description: "Learn how PrivaCV creates clean, ATS-friendly resumes locally in your browser—with no account, subscription, watermark, or resume upload.",
  path: "/about",
  socialImage: "about",
});

export default function AboutPage() {
  return (
    <>
      <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{SITE_NAME}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">A resume editor that keeps the work in your browser</h1>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted-foreground">{SITE_DESCRIPTION}</p>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <article className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Private by default</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Edit, import, save versions, and export locally. PrivaCV does not require you to upload a resume to use the editor.</p>
        </article>
        <article className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Built for readable resumes</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Use clean text-based templates, preview the PDF layout, and inspect the exact plain text that application systems can read.</p>
        </article>
        <article className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Make each application intentional</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Tailor and export the right resume, then privately track the role, next action, interviews, and outcome in your browser.</p>
        </article>
      </div>

      <div className="mt-12 grid gap-10 text-base leading-relaxed text-muted-foreground md:grid-cols-2">
        <section>
          <h2 className="text-2xl font-semibold text-foreground">What PrivaCV is for</h2>
          <p className="mt-3">PrivaCV is for people who want to create a clean resume and organize their job search without creating an account or handing personal data to a career platform. It supports structured editing, ATS-friendly review, PDF and DOCX export, and a <Link className="underline underline-offset-4" href="/job-application-tracker">local job application tracker</Link> with resume snapshots and Sankey export.</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-foreground">What makes a resume ATS-friendly</h2>
          <p className="mt-3">Applicant tracking systems vary, so no tool can promise a result with every employer. PrivaCV uses straightforward text-based resume structure and lets you inspect the exported plain text before applying. That makes it easier to catch missing contact information, unclear section titles, and formatting that may not travel well.</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-foreground">How PrivaCV works</h2>
          <ol className="mt-3 grid list-decimal gap-2 pl-5">
            <li>Start a new resume or import your existing PDF, DOCX, JSON, or text.</li>
            <li>Tailor the content and review the clean, text-based preview.</li>
            <li>Export a PDF or editable DOCX from your browser.</li>
          </ol>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-foreground">Features</h2>
          <ul className="mt-3 grid list-disc gap-2 pl-5">
            <li>Create a resume from a blank draft, sample, imported PDF or DOCX, pasted text, or saved JSON.</li>
            <li>Tailor experience, projects, education, skills, and custom sections for a specific application.</li>
            <li>Review resume checks, compare versions, and export clean PDF, DOCX, or plain-text copies.</li>
            <li>Keep your resume library and per-resume edit history in browser storage under your control.</li>
            <li><Link className="underline underline-offset-4" href="/job-application-tracker">Track applications</Link>, next actions, interviews, resume versions, and outcomes in a private local pipeline.</li>
          </ul>
        </section>
      </div>

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
        <Link className="underline underline-offset-4" href="/privacy">Read the privacy details</Link>
      </nav>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </main>
      <SiteFooter />
    </>
  );
}
