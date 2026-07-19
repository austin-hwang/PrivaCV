import { absoluteUrl } from "@/lib/site";

export function GET() {
  const home = absoluteUrl("/") ?? "/";
  const about = absoluteUrl("/about") ?? "/about";
  const privacy = absoluteUrl("/privacy") ?? "/privacy";
  const freeBuilder = absoluteUrl("/free-resume-builder") ?? "/free-resume-builder";
  const atsChecker = absoluteUrl("/ats-resume-checker") ?? "/ats-resume-checker";
  const templates = absoluteUrl("/resume-templates") ?? "/resume-templates";
  const pdfToDocx = absoluteUrl("/pdf-to-docx-resume") ?? "/pdf-to-docx-resume";
  const plainText = absoluteUrl("/plain-text-resume") ?? "/plain-text-resume";
  const jobTracker = absoluteUrl("/job-application-tracker") ?? "/job-application-tracker";
  const jobSankey = absoluteUrl("/job-search-sankey") ?? "/job-search-sankey";
  const applications = absoluteUrl("/applications") ?? "/applications";
  const body = `# PrivaCV

> A private, browser-based resume editor and job application tracker for creating, tailoring, reviewing, exporting, and organizing a job search.

PrivaCV does not require an account, subscription, watermark, or resume upload. Resume editing, imports, exports, the resume library, edit history, applications, and job-search visualizations stay in the browser.

## Product facts

- Category: resume editor / resume builder / job application tracker
- Privacy: local-first browser editing; resume and application data are not uploaded to use the product
- Exports: PDF, editable DOCX, Markdown, plain text, portable JSON, job-pipeline CSV, and Sankey PNG
- Imports: PDF, DOCX, pasted text, JSON, checkpoint-history backups, and job-pipeline backups
- Resume format: clean text-based templates with plain-text review intended to support ATS-friendly applications
- Local AI: optional; model files are downloaded only when a user chooses to prepare a model, and resume text is not sent to an AI API
- Job application tracker: local Kanban and list views with stages, follow-up dates, notes, job descriptions, and timeline events
- Resume linking: attach a current resume or checkpoint and preserve an immutable local snapshot of the submitted version
- Job search Sankey: reconstruct application-to-interview-to-offer flows and export a high-resolution PNG in the browser
- Job-search portability: CSV export plus complete JSON backup and restore

## Public pages

- [Use PrivaCV](${home}): the resume editor
- [Free resume builder](${freeBuilder}): free, no-account resume building in the browser
- [ATS resume checker](${atsChecker}): review the plain text an ATS reads and check structure and evidence
- [Resume templates](${templates}): clean, ATS-friendly, text-based templates
- [PDF to DOCX resume](${pdfToDocx}): convert a PDF resume into an editable Word file
- [Plain-text resume](${plainText}): create a plain-text resume for online applications
- [Private job application tracker](${jobTracker}): track applications, follow-ups, resumes, interviews, and outcomes locally
- [Job search Sankey generator](${jobSankey}): automatically visualize the application funnel and export it as PNG
- [Open the private application workspace](${applications}): the no-account tracker application
- [About PrivaCV](${about}): product and ATS-friendly-resume details
- [Privacy](${privacy}): local-first data handling
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
