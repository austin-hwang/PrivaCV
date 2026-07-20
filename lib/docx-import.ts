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
    .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(
      /&(amp|lt|gt|quot|apos);/g,
      (_, entity: string) =>
        ({
          amp: "&",
          lt: "<",
          gt: ">",
          quot: '"',
          apos: "'",
        })[entity] ?? "",
    );
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

  for (
    let offset = bytes.length - minimumEndRecordLength;
    offset >= firstPossibleEndRecord;
    offset -= 1
  ) {
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
    throw new Error(
      "This Word file is too complex to import locally. Try copying its resume text instead.",
    );
  }

  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd > endRecordOffset || centralDirectoryEnd < centralDirectoryOffset) {
    throw new Error("This file is not a readable Word (.docx) document.");
  }

  let cursor = centralDirectoryOffset;
  let expandedSize = 0;
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    const fixedHeaderLength = 46;
    if (
      cursor + fixedHeaderLength > centralDirectoryEnd ||
      view.getUint32(cursor, true) !== ZIP_CENTRAL_DIRECTORY_FILE
    ) {
      throw new Error("This file is not a readable Word (.docx) document.");
    }

    const uncompressedSize = view.getUint32(cursor + 24, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraFieldLength = view.getUint16(cursor + 30, true);
    const fileCommentLength = view.getUint16(cursor + 32, true);
    const entryLength = fixedHeaderLength + fileNameLength + extraFieldLength + fileCommentLength;

    if (
      uncompressedSize === 0xffffffff ||
      cursor + entryLength > centralDirectoryEnd ||
      cursor + entryLength < cursor
    ) {
      throw new Error(
        "This Word file is too complex to import locally. Try copying its resume text instead.",
      );
    }

    expandedSize += uncompressedSize;
    if (expandedSize > MAX_DOCX_EXPANDED_BYTES || !Number.isSafeInteger(expandedSize)) {
      throw new Error(
        "This Word file would expand to too much data to import locally. Try copying its resume text instead.",
      );
    }
    cursor += entryLength;
  }

  if (cursor !== centralDirectoryEnd)
    throw new Error("This file is not a readable Word (.docx) document.");
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
    if (
      !id ||
      !target ||
      targetMode?.toLowerCase() !== "external" ||
      !/\/hyperlink$/i.test(type ?? "")
    )
      continue;
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
    if (!target || targetMode?.toLowerCase() === "external" || !/\/header$/i.test(type ?? ""))
      continue;

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

/**
 * Lists footer XML parts referenced by the main document. Footers can contain
 * a compact email/phone/portfolio strip, but they also commonly contain page
 * numbers or template branding, so callers must recover only explicit contact
 * lines rather than treating the footer as ordinary resume body text.
 */
export function docxFooterPartPathsFromXml(xml: string) {
  const paths: string[] = [];
  const relationshipPattern = /<Relationship\b([^>]*)\/?\s*>/g;

  for (const relationship of xml.matchAll(relationshipPattern)) {
    const attributes = relationship[1];
    const type = relationshipAttribute(attributes, "Type");
    const target = relationshipAttribute(attributes, "Target");
    const targetMode = relationshipAttribute(attributes, "TargetMode");
    if (!target || targetMode?.toLowerCase() === "external" || !/\/footer$/i.test(type ?? ""))
      continue;

    // As with headers, accept only ordinary sibling footer parts so this
    // browser-only importer cannot follow arbitrary paths inside the archive.
    const match = target.replace(/\\/g, "/").match(/^(?:\.\/)?(footer\d+\.xml)$/i);
    if (!match) continue;
    const path = `word/${match[1]}`;
    if (!paths.includes(path)) paths.push(path);
  }

  return paths;
}

function hyperlinkTargetFromInstruction(value: string) {
  // Word can store a hyperlink as a field instead of an r:id relationship.
  // The field instruction may contain switches after the target, so accept
  // only the first quoted or unquoted argument and run it through the same
  // scheme allow-list used for relationship targets.
  const instruction = decodeXmlText(value).replace(/\s+/g, " ").trim();
  const match = instruction.match(/\bHYPERLINK\s+(?:"([^"]+)"|'([^']+)'|([^\s\\]+))/i);
  return match ? safeHyperlinkTarget(match[1] ?? match[2] ?? match[3] ?? "") : null;
}

function instructionTextFromXml(xml: string) {
  return [...xml.matchAll(/<w:instrText(?:\s[^>]*)?>([\s\S]*?)<\/w:instrText>/g)]
    .map((match) => decodeXmlText(match[1] ?? ""))
    .join("");
}

function appendHiddenHyperlinkTarget(contents: string, target: string) {
  // Exported Word files commonly show the address already. Avoid repeating it
  // in the source review, while still recovering label-only hyperlinks.
  const visibleText = textFromRuns(contents).replace(/\s+/g, " ").trim();
  const comparableTarget = target.replace(/^(mailto:|tel:)/i, "");
  if (visibleText.includes(comparableTarget)) return contents;

  return `${contents}<w:r><w:t xml:space="preserve"> — ${escapeXmlText(target)}</w:t></w:r>`;
}

function addHiddenHyperlinkTargets(xml: string, relationshipTargets: Map<string, string>) {
  const hyperlinkPattern = /<w:hyperlink\b([^>]*)>([\s\S]*?)<\/w:hyperlink>/g;
  const simpleFieldPattern = /<w:fldSimple\b([^>]*)>([\s\S]*?)<\/w:fldSimple>/g;
  // A manually inserted Word hyperlink can be represented as a complex field:
  // begin marker, instruction text, visible result, and end marker. Keep this
  // deliberately scoped to a complete begin/end pair; other field types (page
  // numbers, merge fields, dates) remain ordinary visible text.
  const complexFieldPattern =
    /<w:r(?:\s[^>]*)?>[\s\S]*?<w:fldChar\b(?=[^>]*\bw:fldCharType\s*=\s*["']begin["'])[^>]*\/?\s*>[\s\S]*?<\/w:r>([\s\S]*?)<w:r(?:\s[^>]*)?>[\s\S]*?<w:fldChar\b(?=[^>]*\bw:fldCharType\s*=\s*["']end["'])[^>]*\/?\s*>[\s\S]*?<\/w:r>/g;

  const relationshipLinks = xml.replace(
    hyperlinkPattern,
    (match, attributes: string, contents: string) => {
      const relationshipId = relationshipAttribute(attributes, "r:id");
      const target = relationshipId ? relationshipTargets.get(relationshipId) : undefined;
      return target ? appendHiddenHyperlinkTarget(contents, target) : match;
    },
  );

  const simpleFieldLinks = relationshipLinks.replace(
    simpleFieldPattern,
    (match, attributes: string, contents: string) => {
      const target = hyperlinkTargetFromInstruction(
        relationshipAttribute(attributes, "w:instr") ?? "",
      );
      return target ? appendHiddenHyperlinkTarget(contents, target) : match;
    },
  );

  return simpleFieldLinks.replace(complexFieldPattern, (match) => {
    // The surrounding begin/end runs are part of the match. Reading the
    // instruction from the complete field is more resilient to the optional
    // result-separator run that Word may place between instruction and label.
    const target = hyperlinkTargetFromInstruction(instructionTextFromXml(match));
    return target ? appendHiddenHyperlinkTarget(match, target) : match;
  });
}

/**
 * Extracts readable paragraph text from a standard OOXML document. Paragraphs
 * nested in simple tables remain in document order, but no visual table layout
 * is reconstructed. The existing conservative text parser plus its explicit
 * review is a safer route than pretending Word layout is semantic resume data.
 * It also keeps the import entirely in the browser.
 */
export function docxParagraphsFromXml(
  xml: string,
  relationshipTargets = new Map<string, string>(),
) {
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
    throw new Error(
      "This Word file has a text section that is too large to import locally. Try copying its resume text instead.",
    );
  }

  const relationshipsPath = `word/_rels/${path.slice("word/".length)}.rels`;
  const relationships = files[relationshipsPath];
  const relationshipTargets = relationships
    ? docxHyperlinkTargetsFromXml(strFromU8(relationships))
    : new Map<string, string>();
  return docxParagraphsFromXml(strFromU8(part), relationshipTargets);
}

function isFooterContactLine(value: string) {
  const line = value.trim();
  if (!line) return false;

  // Keep recovery intentionally narrow. A footer can include page numbers,
  // document titles, or an employer's branding; only an explicit phone,
  // email, web/link target, or city/state line belongs in the resume's
  // contact block. This also recognizes safe targets added for label-only
  // Word hyperlinks above.
  return (
    /[\w.+-]+@[\w-]+\.[\w.-]+/.test(line) ||
    /(?:https?:\/\/|mailto:|tel:|www\.)/i.test(line) ||
    /(?:\+?\d[\d().\s-]{6,}\d)/.test(line) ||
    /\b[A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)*,\s*[A-Z]{2}\b/.test(line)
  );
}

export function extractDocxText(buffer: ArrayBuffer) {
  if (buffer.byteLength > MAX_DOCX_BYTES) {
    throw new Error(
      "This Word file is too large to import locally. Try copying its resume text instead.",
    );
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
  const documentRelationships = relationships ? strFromU8(relationships) : "";
  const headerPaths = documentRelationships
    ? docxHeaderPartPathsFromXml(documentRelationships)
    : [];
  const footerPaths = documentRelationships
    ? docxFooterPartPathsFromXml(documentRelationships)
    : [];
  const headerParagraphs = headerPaths.flatMap((path) => paragraphsFromDocxPart(files, path));
  const footerContactParagraphs = footerPaths
    .flatMap((path) => paragraphsFromDocxPart(files, path))
    .filter(isFooterContactLine)
    .filter((line) => !headerParagraphs.includes(line))
    .filter((line, index, lines) => lines.indexOf(line) === index);
  const documentParagraphs = paragraphsFromDocxPart(files, "word/document.xml");
  // Put referenced header text and narrowly recovered footer contact lines
  // before the body so the existing conservative parser sees them in its
  // preamble. A blank separation prevents the final contact line from merging
  // with the first document-body section.
  const contactPreamble = [...headerParagraphs, ...footerContactParagraphs];
  const text = [...contactPreamble, ...(contactPreamble.length ? [""] : []), ...documentParagraphs]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text)
    throw new Error(
      "No readable text was found in this Word document. Try copying its resume text instead.",
    );
  return text;
}

export async function importResumeDocxWithSource(file: File) {
  const sourceText = extractDocxText(await file.arrayBuffer());
  return importResumeTextWithSource(sourceText);
}
