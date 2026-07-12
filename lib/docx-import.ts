import { strFromU8, unzipSync } from "fflate";
import { importResumeTextWithSource } from "@/lib/pdf-import";

const MAX_DOCX_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_XML_BYTES = 3 * 1024 * 1024;

const TEXT_TOKEN_PATTERN = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(tab|br|cr)\b[^>]*\/?\s*>/g;

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

function escapeXmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function textFromRuns(xml: string) {
  let text = "";
  for (const token of xml.matchAll(TEXT_TOKEN_PATTERN)) {
    if (token[2] === "tab") text += "\t";
    else if (token[2] === "br" || token[2] === "cr") text += "\n";
    else text += decodeXmlText(token[1] ?? "");
  }
  return text;
}

function relationshipAttribute(attributes: string, name: string) {
  return attributes.match(new RegExp(`\\b${name}\\s*=\\s*[\"']([^\"']*)[\"']`, "i"))?.[1];
}

function safeHyperlinkTarget(value: string) {
  const target = decodeXmlText(value).trim();
  // Restrict recovered relationship targets to the same contact-link schemes
  // the editor can safely render. A document relationship is still untrusted
  // input, so it must not become arbitrary source text or a dangerous link.
  return /^(https?:\/\/|mailto:|tel:)/i.test(target) ? target : null;
}

/**
 * Reads external hyperlink destinations from the companion OOXML relationship
 * file. Word often displays a label such as "LinkedIn" while storing the
 * actual address only here; retaining it means the existing text parser can
 * recover a useful website field without guessing.
 */
export function docxHyperlinkTargetsFromXml(xml: string) {
  const targets = new Map<string, string>();
  const relationshipPattern = /<Relationship\b([^>]*)\/?\s*>/g;

  for (const relationship of xml.matchAll(relationshipPattern)) {
    const attributes = relationship[1];
    const id = relationshipAttribute(attributes, "Id");
    const target = relationshipAttribute(attributes, "Target");
    const targetMode = relationshipAttribute(attributes, "TargetMode");
    const type = relationshipAttribute(attributes, "Type");
    if (!id || !target || targetMode?.toLowerCase() !== "external" || !/\/hyperlink$/i.test(type ?? "")) continue;
    const safeTarget = safeHyperlinkTarget(target);
    if (safeTarget) targets.set(id, safeTarget);
  }

  return targets;
}

function addHiddenHyperlinkTargets(xml: string, relationshipTargets: Map<string, string>) {
  if (!relationshipTargets.size) return xml;
  const hyperlinkPattern = /<w:hyperlink\b([^>]*)>([\s\S]*?)<\/w:hyperlink>/g;

  return xml.replace(hyperlinkPattern, (match, attributes: string, contents: string) => {
    const relationshipId = relationshipAttribute(attributes, "r:id");
    const target = relationshipId ? relationshipTargets.get(relationshipId) : undefined;
    if (!target) return match;

    // Exported Word files commonly show the address already. Avoid repeating
    // it in the source review, while still recovering label-only hyperlinks.
    const visibleText = textFromRuns(contents).replace(/\s+/g, " ").trim();
    const comparableTarget = target.replace(/^(mailto:|tel:)/i, "");
    if (visibleText.includes(comparableTarget)) return match;

    return `${contents}<w:t xml:space="preserve"> — ${escapeXmlText(target)}</w:t>`;
  });
}

/**
 * Extracts readable paragraph text from a standard OOXML document. Paragraphs
 * nested in simple tables remain in document order, but no visual table layout
 * is reconstructed. The existing conservative text parser plus its explicit
 * review is a safer route than pretending Word layout is semantic resume data.
 * It also keeps the import entirely in the browser.
 */
export function docxParagraphsFromXml(xml: string, relationshipTargets = new Map<string, string>()) {
  const paragraphs: string[] = [];
  const paragraphPattern = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;

  for (const paragraph of xml.matchAll(paragraphPattern)) {
    const text = textFromRuns(addHiddenHyperlinkTargets(paragraph[1], relationshipTargets));
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

  const relationships = files["word/_rels/document.xml.rels"];
  const relationshipTargets = relationships ? docxHyperlinkTargetsFromXml(strFromU8(relationships)) : new Map<string, string>();
  const text = docxParagraphsFromXml(strFromU8(document), relationshipTargets).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new Error("No readable text was found in this Word document. Try copying its resume text instead.");
  return text;
}

export async function importResumeDocxWithSource(file: File) {
  const sourceText = extractDocxText(await file.arrayBuffer());
  return importResumeTextWithSource(sourceText);
}
