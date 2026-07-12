import { strFromU8, unzipSync } from "fflate";
import { importResumeTextWithSource } from "@/lib/pdf-import";

const MAX_DOCX_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_XML_BYTES = 3 * 1024 * 1024;

function decodeXmlText(value: string) {
  return value
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, entity: string) => ({
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
    })[entity] ?? "");
}

/**
 * Extracts the readable paragraph order from a standard OOXML document. This
 * deliberately ignores layout, tables, images, comments, and tracked changes:
 * the existing conservative text parser plus its explicit review is a safer
 * route than pretending a Word document's visual layout is semantic resume
 * data. It also keeps the import entirely in the browser.
 */
export function docxParagraphsFromXml(xml: string) {
  const paragraphs: string[] = [];
  const paragraphPattern = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
  const tokenPattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(tab|br|cr)\b[^>]*\/?\s*>/g;

  for (const paragraph of xml.matchAll(paragraphPattern)) {
    let text = "";
    for (const token of paragraph[1].matchAll(tokenPattern)) {
      if (token[2] === "tab") text += "\t";
      else if (token[2] === "br" || token[2] === "cr") text += "\n";
      else text += decodeXmlText(token[1] ?? "");
    }
    paragraphs.push(...text.split(/\r?\n/).map((line) => line.replace(/\t/g, " ").trimEnd()));
  }

  return paragraphs;
}

export function extractDocxText(buffer: ArrayBuffer) {
  if (buffer.byteLength > MAX_DOCX_BYTES) {
    throw new Error("This Word file is too large to import locally. Try copying its resume text instead.");
  }

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new Error("This file is not a readable Word (.docx) document.");
  }
  const document = files["word/document.xml"];
  if (!document || document.byteLength > MAX_DOCUMENT_XML_BYTES) {
    throw new Error("This Word file does not contain a readable resume document.");
  }

  const text = docxParagraphsFromXml(strFromU8(document)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new Error("No readable text was found in this Word document. Try copying its resume text instead.");
  return text;
}

export async function importResumeDocxWithSource(file: File) {
  const sourceText = extractDocxText(await file.arrayBuffer());
  return importResumeTextWithSource(sourceText);
}
