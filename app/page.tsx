import { ResumeEditor } from "@/components/resume-editor";
import Link from "next/link";
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from "@/lib/site";

const faqItems = [
  {
    question: "What is PrivaCV?",
    answer: "PrivaCV is a browser-based resume editor for creating, tailoring, reviewing, and exporting clean, text-based resumes.",
  },
  {
    question: "Does PrivaCV upload my resume?",
    answer: "No. Resume editing, imports, exports, browser autosave, and version history stay in the browser. Optional local AI model files may be downloaded to the browser when a person chooses to prepare a model, but resume text is not sent to an AI service.",
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
  "@graph": [
    {
      "@type": "WebSite",
      name: SITE_NAME,
      url: absoluteUrl(),
    },
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Resume editor",
      operatingSystem: "Web",
      url: absoluteUrl(),
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "Local browser-based resume editing",
        "PDF and DOCX export",
        "PDF, DOCX, and pasted-text resume import",
        "ATS-friendly plain-text review",
        "Browser-only autosave and version history",
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <ResumeEditor />
      <section className="app-chrome border-t bg-card px-4 py-12 lg:px-6" aria-label="About PrivaCV">
        <div className="mx-auto grid max-w-5xl gap-10">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">About PrivaCV</p>
            <h2 id="about-privacv" className="mt-3 text-3xl font-semibold tracking-tight">A private resume editor for clear, ATS-friendly applications</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              PrivaCV helps job seekers create, tailor, review, and export a clean resume without an account or a hosted resume database. Your resume stays in your browser while you work.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <article className="rounded-lg border bg-background p-5">
              <h3 className="font-semibold">Private by default</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Edit, import, save versions, and export locally. PrivaCV does not require you to upload a resume to use the editor.</p>
            </article>
            <article className="rounded-lg border bg-background p-5">
              <h3 className="font-semibold">Built for readable resumes</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Use clean text-based templates, preview the PDF layout, and inspect the exact plain text that application systems can read.</p>
            </article>
            <article className="rounded-lg border bg-background p-5">
              <h3 className="font-semibold">Make each application intentional</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Import an existing resume, tailor its content, review it, and export PDF or editable DOCX without watermarks or subscriptions.</p>
            </article>
          </div>

          <div className="grid gap-5 border-t pt-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Frequently asked questions</h2>
              <dl className="mt-5 grid gap-5">
                {faqItems.map((item) => (
                  <div key={item.question}>
                    <dt className="font-medium">{item.question}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.answer}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <aside className="rounded-lg border bg-background p-5">
              <h2 className="text-xl font-semibold tracking-tight">How PrivaCV works</h2>
              <ol className="mt-4 grid list-decimal gap-3 pl-5 text-sm leading-relaxed text-muted-foreground">
                <li>Start a new resume or import your existing PDF, DOCX, or text.</li>
                <li>Tailor the content and review the clean, text-based preview.</li>
                <li>Export a PDF or editable DOCX from your browser.</li>
              </ol>
              <div className="mt-6 flex flex-wrap gap-4 text-sm font-medium">
                <Link className="underline underline-offset-4 hover:text-foreground" href="/about">Product details</Link>
                <Link className="underline underline-offset-4 hover:text-foreground" href="/privacy">Privacy details</Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
      <footer className="app-chrome border-t px-4 py-6 text-center text-sm text-muted-foreground lg:px-6">
        <Link className="hover:text-foreground" href="/about">About PrivaCV</Link><span aria-hidden="true"> · </span><Link className="hover:text-foreground" href="/privacy">Privacy</Link>
      </footer>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </>
  );
}
