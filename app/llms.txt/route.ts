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
  const body = `# PrivaCV\n\n> A private, browser-based resume editor for creating, tailoring, reviewing, and exporting clean, text-based resumes.\n\nPrivaCV does not require an account, subscription, watermark, or resume upload. Resume editing, imports, exports, the resume library, and edit history stay in the browser.\n\n## Product facts\n\n- Category: resume editor / resume builder\n- Privacy: local-first browser editing; resume text is not uploaded to use the editor\n- Exports: PDF, editable DOCX, Markdown, plain text, and portable JSON\n- Imports: PDF, DOCX, pasted text, JSON, and checkpoint-history backups\n- Resume format: clean text-based templates with plain-text review intended to support ATS-friendly applications\n- Local AI: optional; model files are downloaded only when a user chooses to prepare a model, and resume text is not sent to an AI API\n\n## Public pages\n\n- [Use PrivaCV](${home}): the resume editor\n- [Free resume builder](${freeBuilder}): free, no-account resume building in the browser\n- [ATS resume checker](${atsChecker}): review the plain text an ATS reads and check structure and evidence\n- [Resume templates](${templates}): clean, ATS-friendly, text-based templates\n- [PDF to DOCX resume](${pdfToDocx}): convert a PDF resume into an editable Word file\n- [Plain-text resume](${plainText}): create a plain-text resume for online applications\n- [About PrivaCV](${about}): product and ATS-friendly-resume details\n- [Privacy](${privacy}): local-first data handling\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
