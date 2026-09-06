import { Fragment } from "react";
import Link from "next/link";
import { ResumeEditor } from "@/features/resume";
import { VisitorMetrics } from "@/components/visitor-metrics";
import { Separator } from "@/components/ui/separator";
import { SiteFooter } from "@/components/site-footer";
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from "@/lib/site";

const isDesktopApp = process.env.PRIVACV_DESKTOP_APP === "1";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: SITE_NAME,
      alternateName: "privacv.app",
      url: absoluteUrl(),
    },
    {
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl(),
      logo: absoluteUrl("/icon"),
    },
    {
      "@type": "WebApplication",
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Resume editor",
      operatingSystem: "Web",
      url: absoluteUrl(),
      image: absoluteUrl("/social/home"),
      screenshot: absoluteUrl("/social/home"),
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "Local browser-based resume editing",
        "PDF and DOCX export",
        "PDF, DOCX, and pasted-text resume import",
        "ATS-friendly plain-text review",
        "Browser-only resume library and edit history",
        "Private browser-only job application tracking with resume snapshots",
        "Job search Sankey diagram with local PNG export",
      ],
    },
  ],
};

const features: Array<{ title: string; body: string; href?: string }> = [
  {
    title: "Nothing leaves your browser",
    body: "You write, save versions, track applications, and export on your own device. Your resume and job search are not uploaded to our servers.",
  },
  {
    title: "Reads cleanly in an ATS",
    body: "The templates are plain and text-based. Before you apply, you can preview the exact text an applicant tracking system will pull out of your resume.",
  },
  {
    title: "Works with the files you have",
    body: "Import a PDF, Word file, pasted text, or JSON to get started. Export a PDF, an editable Word doc, plain text, or a JSON backup.",
  },
  {
    title: "Free, no sign-up",
    body: "There's no account to create and no watermark on what you download. Open the page and start typing.",
  },
  {
    title: "Track applications privately",
    body: "Organize follow-ups, interviews, outcomes, and submitted resume versions, then turn the full search into a shareable Sankey image.",
    href: "/job-application-tracker",
  },
];

const steps = [
  "Start a blank resume, or import the PDF, Word file, text, or JSON you already have.",
  "Edit each section and watch the printable layout update as you type.",
  "Run the ATS checks, then download a PDF or an editable Word file.",
];

const faqs = [
  {
    q: "Is it actually free?",
    a: "Yes. No account, no subscription, and no watermark. PDF, Word, plain-text, and JSON export are all included.",
  },
  {
    q: "Where does my resume go?",
    a: "It stays in your browser. Editing, imports, exports, saved resumes, edit history, and your job pipeline all live in browser storage on your device.",
  },
  {
    q: "Will it get through an ATS?",
    a: "It gives you a good shot. The output is clean text, and you can read exactly what the parser sees before you apply. The result still depends on each employer's system.",
  },
];

export default function Home() {
  return (
    <>
      <ResumeEditor />
      {!isDesktopApp && <VisitorMetrics workspace="resume" />}
      {!isDesktopApp && (
        <>
          <section className="public-explainer app-chrome border-t px-4 py-16 lg:px-6">
            <div className="mx-auto max-w-5xl">
              <p className="text-sm font-medium text-primary">Private resume workspace</p>
              <h1 className="mt-4 max-w-3xl font-serif text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                A free, private resume editor that runs in your browser
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
                {SITE_DESCRIPTION}
              </p>

              <div className="mt-10">
                <Separator />
                {features.map((feature, index) => (
                  <Fragment key={feature.title}>
                    <article className="grid gap-2 py-5 sm:grid-cols-[14rem_1fr] sm:gap-8">
                      <h2 className="font-serif text-lg font-bold">
                        {feature.href ? (
                          <Link className="underline-offset-4 hover:underline" href={feature.href}>
                            {feature.title}
                          </Link>
                        ) : (
                          feature.title
                        )}
                      </h2>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {feature.body}
                      </p>
                    </article>
                    {index < features.length - 1 ? <Separator /> : null}
                  </Fragment>
                ))}
                <Separator />
              </div>

              <div className="mt-12 grid gap-10 md:grid-cols-2">
                <section>
                  <h2 className="font-serif text-2xl font-bold">How the resume editor works</h2>
                  <ol className="mt-4 grid list-decimal gap-2 pl-5 text-base leading-relaxed text-muted-foreground">
                    {steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </section>
                <section>
                  <h2 className="font-serif text-2xl font-bold">Common questions</h2>
                  <dl className="mt-4 grid gap-5">
                    {faqs.map((faq) => (
                      <div key={faq.q}>
                        <dt className="font-medium">{faq.q}</dt>
                        <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {faq.a}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>
            </div>
          </section>
          <div className="public-explainer">
            <SiteFooter />
          </div>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
          />
        </>
      )}
    </>
  );
}
