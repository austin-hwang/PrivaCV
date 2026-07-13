import { strFromU8, unzipSync } from "fflate";
import { importResumeTextWithSource } from "@/lib/pdf-import";

const MAX_DOCX_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_XML_BYTES = 3 * 1024 * 1024;
export const MAX_DOCX_EXPANDED_BYTES = 32 * 1024 * 1024;

const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_FILE = 0x02014b50;

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

/**
 * Checks the ZIP central directory before decompression. A .docx file is a
 * ZIP archive, so its compressed file size alone does not prevent a small
 * archive from expanding into enough data to freeze the browser. We support
 * ordinary single-disk Word archives and deliberately ask for pasted text
 * when an archive uses a more complex ZIP64/multi-disk layout.
 */
export function docxArchiveUncompressedSize(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const minimumEndRecordLength = 22;
  const firstPossibleEndRecord = Math.max(0, bytes.length - minimumEndRecordLength - 0xffff);
  let endRecordOffset = -1;

  for (let offset = bytes.length - minimumEndRecordLength; offset >= firstPossibleEndRecord; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_END_OF_CENTRAL_DIRECTORY) {
      endRecordOffset = offset;
      break;
    }
  }

  if (endRecordOffset < 0) throw new Error("This file is not a readable Word (.docx) document.");

  const diskNumber = view.getUint16(endRecordOffset + 4, true);
  const centralDirectoryDisk = view.getUint16(endRecordOffset + 6, true);
  const entriesOnDisk = view.getUint16(endRecordOffset + 8, true);
  const entryCount = view.getUint16(endRecordOffset + 10, true);
  const centralDirectorySize = view.getUint32(endRecordOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(endRecordOffset + 16, true);

  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    throw new Error("This Word file is too complex to import locally. Try copying its resume text instead.");
  }

  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd > endRecordOffset || centralDirectoryEnd < centralDirectoryOffset) {
    throw new Error("This file is not a readable Word (.docx) document.");
  }

  let cursor = centralDirectoryOffset;
  let expandedSize = 0;
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    const fixedHeaderLength = 46;
    if (cursor + fixedHeaderLength > centralDirectoryEnd || view.getUint32(cursor, true) !== ZIP_CENTRAL_DIRECTORY_FILE) {
      throw new Error("This file is not a readable Word (.docx) document.");
    }

    const uncompressedSize = view.getUint32(cursor + 24, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraFieldLength = view.getUint16(cursor + 30, true);
    const fileCommentLength = view.getUint16(cursor + 32, true);
    const entryLength = fixedHeaderLength + fileNameLength + extraFieldLength + fileCommentLength;

    if (uncompressedSize === 0xffffffff || cursor + entryLength > centralDirectoryEnd || cursor + entryLength < cursor) {
      throw new Error("This Word file is too complex to import locally. Try copying its resume text instead.");
    }

    expandedSize += uncompressedSize;
    if (expandedSize > MAX_DOCX_EXPANDED_BYTES || !Number.isSafeInteger(expandedSize)) {
      throw new Error("This Word file would expand to too much data to import locally. Try copying its resume text instead.");
    }
    cursor += entryLength;
  }

  if (cursor !== centralDirectoryEnd) throw new Error("This file is not a readable Word (.docx) document.");
  return expandedSize;
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

/**
 * Lists the header XML parts actually referenced by the main Word document.
 * A resume's name and contact details are often placed in a header, while
 * unused template headers may remain in the archive. Following document
 * relationships lets us recover the useful text without treating every
 * archived header as resume content.
 */
export function docxHeaderPartPathsFromXml(xml: string) {
  const paths: string[] = [];
  const relationshipPattern = /<Relationship\b([^>]*)\/?\s*>/g;

  for (const relationship of xml.matchAll(relationshipPattern)) {
    const attributes = relationship[1];
    const type = relationshipAttribute(attributes, "Type");
    const target = relationshipAttribute(attributes, "Target");
    const targetMode = relationshipAttribute(attributes, "TargetMode");
    if (!target || targetMode?.toLowerCase() === "external" || !/\/header$/i.test(type ?? "")) continue;

    // Word's main-document relationships point to sibling header files. Keep
    // the accepted path intentionally narrow so an archive cannot cause this
    // local importer to read unrelated OOXML parts.
    const match = target.replace(/\\/g, "/").match(/^(?:\.\/)?(header\d+\.xml)$/i);
    if (!match) continue;
    const path = `word/${match[1]}`;
    if (!paths.includes(path)) paths.push(path);
  }

  return paths;
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

function paragraphsFromDocxPart(files: Record<string, Uint8Array>, path: string) {
  const part = files[path];
  if (!part) return [];
  if (part.byteLength > MAX_DOCUMENT_XML_BYTES) {
    throw new Error("This Word file has a text section that is too large to import locally. Try copying its resume text instead.");
  }

  const relationshipsPath = `word/_rels/${path.slice("word/".length)}.rels`;
  const relationships = files[relationshipsPath];
  const relationshipTargets = relationships ? docxHyperlinkTargetsFromXml(strFromU8(relationships)) : new Map<string, string>();
  return docxParagraphsFromXml(strFromU8(part), relationshipTargets);
}

export function extractDocxText(buffer: ArrayBuffer) {
  if (buffer.byteLength > MAX_DOCX_BYTES) {
    throw new Error("This Word file is too large to import locally. Try copying its resume text instead.");
  }

  docxArchiveUncompressedSize(buffer);

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
  const headerPaths = relationships ? docxHeaderPartPathsFromXml(strFromU8(relationships)) : [];
  const headerParagraphs = headerPaths.flatMap((path) => paragraphsFromDocxPart(files, path));
  const documentParagraphs = paragraphsFromDocxPart(files, "word/document.xml");
  // Put referenced header text before the body so the existing conservative
  // parser sees the contact block in the same order a reader does. A blank
  // separation prevents a header's final contact line from merging with the
  // first document-body section.
  const text = [...headerParagraphs, ...(headerParagraphs.length ? [""] : []), ...documentParagraphs]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) throw new Error("No readable text was found in this Word document. Try copying its resume text instead.");
  return text;
}

export async function importResumeDocxWithSource(file: File) {
  const sourceText = extractDocxText(await file.arrayBuffer());
  return importResumeTextWithSource(sourceText);
}
