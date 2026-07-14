import type { Metadata } from "next";
import Link from "next/link";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "About the private resume editor",
  description: "Learn how PrivaCV helps job seekers create clean, ATS-friendly resumes locally in their browser without accounts, subscriptions, or resume uploads.",
  alternates: SITE_URL ? { canonical: "/about" } : undefined,
};

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{SITE_NAME}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">A resume editor that keeps the work in your browser</h1>
      <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{SITE_DESCRIPTION}</p>

      <div className="mt-12 grid gap-8 text-base leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-2xl font-semibold text-foreground">What PrivaCV is for</h2>
          <p className="mt-3">PrivaCV is for people who want a clean, editable resume without creating an account or handing a document to a resume-builder service. It supports structured editing, a printable preview, an ATS-friendly plain-text review, and PDF and DOCX export.</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-foreground">What makes a resume ATS-friendly</h2>
          <p className="mt-3">Applicant tracking systems vary, so no tool can promise a result with every employer. PrivaCV uses straightforward text-based resume structure and lets you inspect the exported plain text before applying. That makes it easier to catch missing contact information, unclear section titles, and formatting that may not travel well.</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-foreground">Features</h2>
          <ul className="mt-3 grid list-disc gap-2 pl-5">
            <li>Create a resume from a blank draft, sample, imported PDF or DOCX, pasted text, or saved JSON.</li>
            <li>Tailor experience, projects, education, skills, and custom sections for a specific application.</li>
            <li>Review resume checks, compare versions, and export clean PDF, DOCX, or plain-text copies.</li>
            <li>Keep drafts and version history in browser storage under your control.</li>
          </ul>
        </section>
      </div>

      <nav className="mt-12 flex flex-wrap gap-5 text-sm font-medium" aria-label="PrivaCV pages">
        <Link className="underline underline-offset-4" href="/">Open the editor</Link>
        <Link className="underline underline-offset-4" href="/privacy">Read the privacy details</Link>
      </nav>
    </main>
  );
}
