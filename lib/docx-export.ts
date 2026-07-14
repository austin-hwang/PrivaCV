import { strToU8, zipSync } from "fflate";
import {
  BULLET_STYLE_MARKERS,
  contactHref,
  entryHasContent,
  getSectionEntries,
  getSectionTitle,
  includedBulletsFrom,
  normalizeAccent,
  resolveDocxFont,
  visibleSectionOrder,
  type ResumeEntry,
  type ResumeState,
} from "@/lib/resume";

function accentHex(state: ResumeState) {
  return normalizeAccent(state.theme.accent).slice(1);
}

type DocxRelationship = {
  id: string;
  target: string;
};

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function escapeXml(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function textRun(value: string, options: { bold?: boolean; size?: number; color?: string } = {}) {
  if (!value) return "";
  const properties = [
    options.bold ? "<w:b/>" : "",
    options.size ? `<w:sz w:val=\"${options.size}\"/>` : "",
    options.color ? `<w:color w:val=\"${options.color}\"/>` : "",
  ].join("");
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ""}<w:t xml:space=\"preserve\">${escapeXml(value)}</w:t></w:r>`;
}

function paragraph(content: string, options: { alignment?: "center"; before?: number; after?: number; bullet?: boolean; marker?: string } = {}) {
  const properties = [
    options.alignment ? `<w:jc w:val=\"${options.alignment}\"/>` : "",
    options.before || options.after
      ? `<w:spacing${options.before ? ` w:before=\"${options.before}\"` : ""}${options.after ? ` w:after=\"${options.after}\"` : ""}/>`
      : "",
    options.bullet ? '<w:ind w:left="360" w:hanging="180"/>' : "",
  ].join("");
  const bulletRun = options.bullet ? textRun(`${options.marker ?? "•"}\t`) : "";
  return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ""}${bulletRun}${content}</w:p>`;
}

function contactRuns(state: ResumeState, relationships: DocxRelationship[]) {
  const contacts = [
    ["email", state.email],
    ["phone", state.phone],
    ["location", state.location],
    ["website", state.website],
  ] as const;

  return contacts
    .filter(([, value]) => Boolean(value.trim()))
    .map(([field, value], index) => {
      const separator = index ? textRun(" | ") : "";
      const href = field === "location" ? undefined : contactHref(field, value);
      if (!href) return `${separator}${textRun(value)}`;
      const id = `rId${relationships.length + 1}`;
      relationships.push({ id, target: href });
      return `${separator}<w:hyperlink r:id=\"${id}\">${textRun(value, { color: "0563C1" })}</w:hyperlink>`;
    })
    .join("");
}

function entryParagraphs(entry: ResumeEntry, bulletMarker: string) {
  const parts = [
    entry.title ? textRun(entry.title, { bold: true }) : "",
    entry.subtitle ? textRun(`${entry.title ? " | " : ""}${entry.subtitle}`) : "",
    entry.meta ? textRun(`${entry.title || entry.subtitle ? " | " : ""}${entry.meta}`) : "",
  ].join("");
  const bullets = includedBulletsFrom(entry);
  const heading = parts ? paragraph(parts, { after: bullets.length ? 20 : 90 }) : "";
  // A "none" style drops the marker and its hanging indent — the line becomes a
  // plain paragraph so it reads as an unmarked list.
  const bulleted = bulletMarker !== "";
  const details = bullets
    .map((bullet) => paragraph(textRun(bullet), { bullet: bulleted, marker: bulletMarker, after: 24 }))
    .join("");
  return `${heading}${details}`;
}

function sectionParagraphs(state: ResumeState, section: string) {
  const title = getSectionTitle(state, section).trim();
  const heading = (text: string) =>
    paragraph(textRun(text.toUpperCase(), { bold: true, size: 22, color: accentHex(state) }), { before: 150, after: 55 });
  if (section === "skills") {
    const skills = state.skills.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!skills.length) return "";
    return `${title ? heading(title) : ""}${skills.map((skill) => paragraph(textRun(skill), { after: 30 })).join("")}`;
  }

  const entries = getSectionEntries(state, section).filter(entryHasContent);
  if (!entries.length) return "";
  const bulletMarker = BULLET_STYLE_MARKERS[state.theme.bulletStyle];
  return `${title ? heading(title) : ""}${entries.map((entry) => entryParagraphs(entry, bulletMarker)).join("")}`;
}

function documentXml(state: ResumeState, relationships: DocxRelationship[]) {
  const contacts = contactRuns(state, relationships);
  const align = state.theme.headerAlign === "center" ? "center" : undefined;
  const body = [
    state.name ? paragraph(textRun(state.name, { bold: true, size: 32, color: accentHex(state) }), { alignment: align, after: 40 }) : "",
    state.title ? paragraph(textRun(state.title, { size: 22 }), { alignment: align, after: 25 }) : "",
    contacts ? paragraph(contacts, { alignment: align, after: 120 }) : "",
    state.summary ? paragraph(textRun(state.summary), { after: 90 }) : "",
    ...visibleSectionOrder(state).map((section) => sectionParagraphs(state, section)),
  ].join("");

  return `${XML_DECLARATION}<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><w:body>${body}<w:sectPr><w:pgSz w:w=\"12240\" w:h=\"15840\"/><w:pgMar w:top=\"1008\" w:right=\"1008\" w:bottom=\"1008\" w:left=\"1008\" w:header=\"720\" w:footer=\"720\" w:gutter=\"0\"/></w:sectPr></w:body></w:document>`;
}

/**
 * Creates a deliberately simple, single-column Word document. The export is
 * local-only and prioritizes editable text over matching the PDF pixel-for-pixel.
 */
export function resumeDocx(state: ResumeState) {
  const relationships: DocxRelationship[] = [];
  const document = documentXml(state, relationships);
  const font = resolveDocxFont(state.theme.font);
  const stylesXml = `${XML_DECLARATION}<w:styles xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii=\"${escapeXml(font)}\" w:hAnsi=\"${escapeXml(font)}\" w:cs=\"${escapeXml(font)}\"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
  const hyperlinkRelationships = relationships
    .map((relationship) => `<Relationship Id=\"${relationship.id}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink\" Target=\"${escapeXml(relationship.target)}\" TargetMode=\"External\"/>`)
    .join("");
  const documentRelationships = `${XML_DECLARATION}<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rIdStyles\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>${hyperlinkRelationships}</Relationships>`;

  return zipSync({
    "[Content_Types].xml": strToU8(`${XML_DECLARATION}<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/><Override PartName=\"/word/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/><Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/><Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/></Types>`),
    "_rels/.rels": strToU8(`${XML_DECLARATION}<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/><Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties\" Target=\"docProps/app.xml\"/></Relationships>`),
    "word/document.xml": strToU8(document),
    "word/styles.xml": strToU8(stylesXml),
    "word/_rels/document.xml.rels": strToU8(documentRelationships),
    "docProps/core.xml": strToU8(`${XML_DECLARATION}<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:dcterms=\"http://purl.org/dc/terms/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><dc:title>${escapeXml(state.name ? `${state.name} resume` : "Resume")}</dc:title><dc:creator>PrivaCV</dc:creator><dcterms:created xsi:type=\"dcterms:W3CDTF\">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`),
    "docProps/app.xml": strToU8(`${XML_DECLARATION}<Properties xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties\"><Application>PrivaCV</Application></Properties>`),
  });
}

export function resumeDocxBlob(state: ResumeState) {
  return new Blob([resumeDocx(state)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
