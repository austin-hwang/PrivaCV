import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "PrivaCV is a local-first resume editor. Learn what stays in your browser and when optional model downloads occur.",
  alternates: SITE_URL ? { canonical: "/privacy" } : undefined,
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{SITE_NAME}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Privacy, in plain language</h1>
      <div className="mt-10 grid gap-8 text-base leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-2xl font-semibold text-foreground">Your resume stays in your browser</h2>
          <p className="mt-3">PrivaCV runs as a local-first editor. The resume content you type or import is processed in your browser. Browser autosave, version history, and exports are also handled locally; the editor does not require an account or a resume upload.</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-foreground">Files you choose to import</h2>
          <p className="mt-3">PDF, DOCX, JSON, and pasted resume content are used by the editor in the browser. Review imported content before exporting because document formats can contain layout artifacts that need correction.</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-foreground">Optional local AI</h2>
          <p className="mt-3">If you explicitly prepare a local AI model, the browser downloads model files from the listed model hosts. The model runs locally in the browser; PrivaCV does not send your resume text to an AI API for that feature.</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-foreground">Anonymous export totals</h2>
          <p className="mt-3">When you export a resume, PrivaCV records one anonymous event and the export format so we can understand whether the editor is helping people finish resumes. The event contains no resume text, name, email, draft identifier, account, or device identifier. PDF is counted when the browser print dialog opens because the browser does not reveal whether a file is ultimately saved.</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-foreground">Your control</h2>
          <p className="mt-3">You can save portable JSON backups and delete saved browser data from the editor. If you share a device, export or back up anything you want to keep before deleting local data.</p>
        </section>
      </div>
      <nav className="mt-12 flex flex-wrap gap-5 text-sm font-medium" aria-label="PrivaCV pages">
        <Link className="underline underline-offset-4" href="/">Open the editor</Link>
        <Link className="underline underline-offset-4" href="/about">About PrivaCV</Link>
      </nav>
    </main>
  );
}
