import type { Metadata } from "next";
import { SeoLanding, type FaqItem } from "@/components/seo-landing";
import { createPageMetadata, webApplicationJsonLd } from "@/lib/seo";

const title = "Free Private Job Application Tracker — No Sign-Up";
const description =
  "Track applications, interviews, follow-ups, resumes, and outcomes free in your browser. No account or cloud database; export CSV, backups, and a Sankey chart.";

const faqItems: FaqItem[] = [
  {
    question: "Is the PrivaCV job application tracker free?",
    answer:
      "Yes. The board, list, follow-up dates, resume links, backups, CSV export, and Sankey image export are free, with no account or trial.",
  },
  {
    question: "Where is my job-search data stored?",
    answer:
      "Applications, notes, job descriptions, timeline events, and submitted-resume snapshots are stored in IndexedDB in your browser. PrivaCV does not upload them to a PrivaCV account or server.",
  },
  {
    question: "Can I track which resume I used for each application?",
    answer:
      "Yes. Attach a current resume or saved checkpoint. When an application reaches Applied, PrivaCV captures an immutable local snapshot of that submitted version.",
  },
  {
    question: "Can I export or back up my applications?",
    answer:
      "Yes. Download a CSV for a spreadsheet or a complete JSON backup containing applications, events, job descriptions, and resume snapshots.",
  },
  {
    question: "Does the tracker apply to jobs automatically?",
    answer:
      "No. PrivaCV is a private organizer, not an auto-apply service. You add opportunities and update their stages yourself, keeping you in control of every application.",
  },
];

export const metadata: Metadata = createPageMetadata({
  title,
  description,
  path: "/job-application-tracker",
  socialImage: "job-application-tracker",
});

const structuredData = webApplicationJsonLd({
  name: "PrivaCV Private Job Application Tracker",
  description,
  path: "/job-application-tracker",
  featureList: [
    "Kanban job application pipeline",
    "Application list and search",
    "Interview and outcome timeline",
    "Follow-up dates and overdue reminders",
    "Resume checkpoint linking and submitted-resume snapshots",
    "Job search Sankey diagram with PNG export",
    "CSV and JSON backup export",
    "Local browser-only IndexedDB storage",
  ],
});

export default function JobApplicationTrackerPage() {
  return (
    <>
      <SeoLanding
        context="Job-search workspace"
        h1="A free, private job application tracker"
        lede={description}
        ctaLabel="Track your applications"
        ctaHref="/applications"
        heroImage={{
          src: "/social/job-application-tracker",
          alt: "Private job application tracker with a Kanban pipeline and application cards",
        }}
        breadcrumb={{ name: title, path: "/job-application-tracker" }}
        cards={[
          {
            title: "See the whole pipeline",
            body: "Move opportunities from Saved and Preparing through Applied, Interviewing, Offer, and final outcomes on a focused Kanban board.",
          },
          {
            title: "Never lose the next step",
            body: "Record a follow-up or interview action with a due date. Overdue work is called out without sending your calendar or job search to a server.",
          },
          {
            title: "Know which resume you sent",
            body: "Link each application to a live resume or checkpoint. At Applied, an immutable local snapshot preserves the exact submitted version.",
          },
          {
            title: "Keep the job description",
            body: "Save the posting URL, description, company, role, compensation, contacts, and notes alongside the application timeline.",
          },
          {
            title: "Visualize the outcome",
            body: "Turn recorded stages into a Sankey funnel showing applications, interviews, offers, and outcomes, then download it as a shareable PNG.",
          },
          {
            title: "Portable, not locked in",
            body: "Export a spreadsheet-ready CSV or a complete JSON backup. Import the backup later on another browser when you choose.",
          },
        ]}
        cardLayout="ledger"
        prose={[
          {
            heading: "A job tracker without another account",
            paragraphs: [
              "A job search contains sensitive details: where you applied, what a company offered, private notes, recruiter contacts, and the resume tailored for each role. Most online trackers attach that history to a cloud account. PrivaCV keeps the working database in your browser instead.",
              "Open the tracker and start adding applications without an email address. Search and filter the pipeline, drag cards between stages, record next actions, and inspect the full activity timeline. Your data remains on the device unless you deliberately download a backup.",
            ],
          },
          {
            heading: "Connect each application to the resume behind it",
            paragraphs: [
              "Resume tailoring only helps when you can remember which version went to which company. PrivaCV connects its resume editor and application tracker locally. Choose a current draft or named checkpoint for an opportunity, and the tracker captures a frozen copy when the status reaches Applied.",
              "That submitted snapshot does not change when you continue editing the original resume. Months later, you can still see the label and timeline associated with the application while your current resume keeps evolving.",
            ],
          },
        ]}
        faqHeading="Data, backups, and workflow"
        faqItems={faqItems}
        related={[
          { href: "/job-search-sankey", label: "Job search Sankey generator" },
          { href: "/free-resume-builder", label: "Free resume builder" },
          { href: "/ats-resume-checker", label: "ATS resume checker" },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
}
