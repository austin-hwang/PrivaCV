import { safeFilename } from "@/lib/browser-files";

export function safeResumeFilename(name: string) {
  return safeFilename(name, "resume");
}

/**
 * Browsers commonly use document.title as the initial Save as PDF filename.
 * Keep that transient title descriptive, but restore the public page title as
 * soon as printing finishes.
 */
export function pdfDocumentTitle(name: string) {
  const filename = safeResumeFilename(name);
  return filename === "resume" ? "Resume" : `${filename}_Resume`;
}
