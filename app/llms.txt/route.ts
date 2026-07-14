import { absoluteUrl } from "@/lib/site";

export function GET() {
  const home = absoluteUrl("/") ?? "/";
  const about = absoluteUrl("/about") ?? "/about";
  const privacy = absoluteUrl("/privacy") ?? "/privacy";
  const body = `# PrivaCV\n\n> A private, browser-based resume editor for creating, tailoring, reviewing, and exporting clean, text-based resumes.\n\nPrivaCV does not require an account, subscription, watermark, or resume upload. Resume editing, imports, exports, browser autosave, and version history stay in the browser.\n\n## Product facts\n\n- Category: resume editor / resume builder\n- Privacy: local-first browser editing; resume text is not uploaded to use the editor\n- Exports: PDF, editable DOCX, plain text, and portable JSON\n- Imports: PDF, DOCX, pasted text, JSON, and version-history backups\n- Resume format: clean text-based templates with plain-text review intended to support ATS-friendly applications\n- Local AI: optional; model files are downloaded only when a user chooses to prepare a model, and resume text is not sent to an AI API\n\n## Public pages\n\n- [Use PrivaCV](${home}): the resume editor\n- [About PrivaCV](${about}): product and ATS-friendly-resume details\n- [Privacy](${privacy}): local-first data handling\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
