import { safeFilename } from "@/lib/browser-files";

export function safeResumeFilename(name: string) {
  return safeFilename(name, "resume");
}

/** A descriptive, filesystem-safe filename stem for the generated PDF. */
export function pdfDocumentTitle(name: string) {
  const filename = safeResumeFilename(name);
  return filename === "resume" ? "Resume" : `${filename}_Resume`;
}
