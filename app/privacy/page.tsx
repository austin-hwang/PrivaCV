import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { createPageMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = createPageMetadata({
  title: "Privacy",
  description:
    "See what PrivaCV keeps in your browser, what anonymous metrics contain, and when optional local AI model downloads occur.",
  path: "/privacy",
  socialImage: "privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {SITE_NAME}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Privacy, in plain language</h1>
        <div className="mt-10 grid gap-8 text-base leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold text-foreground">
              Your resume and job search stay in your browser
            </h2>
            <p className="mt-3">
              PrivaCV runs as a local-first editor. Resume drafts, saved versions, applications,
              notes, timeline events, job descriptions, and submitted-resume snapshots are stored in
              your browser&apos;s IndexedDB databases. PrivaCV does not require an account or upload
              this information to a PrivaCV server.
            </p>
          </section>
          <section>
            <h2 className="text-2xl font-semibold text-foreground">Files you choose to import</h2>
            <p className="mt-3">
              PDF, DOCX, JSON, and pasted resume content are used by the editor in the browser.
              Review imported content before exporting because document formats can contain layout
              artifacts that need correction.
            </p>
          </section>
          <section>
            <h2 className="text-2xl font-semibold text-foreground">Optional local AI</h2>
            <p className="mt-3">
              If you explicitly prepare a local AI model, the browser downloads model files from the
              listed model hosts. The model runs locally in the browser; PrivaCV does not send your
              resume text to an AI API for that feature.
            </p>
          </section>
          <section>
            <h2 className="text-2xl font-semibold text-foreground">Anonymous aggregate metrics</h2>
            <p className="mt-3">
              PrivaCV records limited aggregate metrics for resume exports, local-AI usage
              milestones, and the number of applications created. These metrics never include
              company names, roles, job descriptions, notes, URLs, resume content, prompts,
              generated text, or account or device identifiers.
            </p>
          </section>
          <section>
            <h2 className="text-2xl font-semibold text-foreground">Your control</h2>
            <p className="mt-3">
              You can save portable JSON backups, export the job pipeline as CSV, delete individual
              applications, or delete all saved browser data. If you share a device, export or back
              up anything you want to keep before deleting local data.
            </p>
          </section>
        </div>
        <nav className="mt-12 flex flex-wrap gap-5 text-sm font-medium" aria-label="Related pages">
          <Link className="underline underline-offset-4" href="/" prefetch={false}>
            Open the editor
          </Link>
          <Link className="underline underline-offset-4" href="/job-application-tracker">
            Learn about the private job tracker
          </Link>
          <Link className="underline underline-offset-4" href="/applications">
            Open the job pipeline
          </Link>
          <Link className="underline underline-offset-4" href="/about">
            About PrivaCV
          </Link>
        </nav>
      </main>
      <SiteFooter />
    </>
  );
}
