import { blankEntry, emptyState, normalizeResume, type ResumeState } from "@/lib/resume";

export type PositionedTextItem = {
  str?: string;
  transform: number[];
};

type PositionedTextLine = {
  y: number;
  items: Array<{ x: number; text: string }>;
};

// PDF text is positioned glyph-by-glyph rather than stored as semantic lines.
// A strict coordinate match splits otherwise normal text when a font, glyph, or
// PDF producer gives adjacent fragments slightly different baselines. Keep the
// tolerance deliberately small: it repairs those fragments without guessing at
// nearby visual rows or attempting to reflow multi-column documents.
const LINE_BASELINE_TOLERANCE = 2;

/**
 * Rebuilds readable lines from positioned PDF text while preserving the source
 * reading order as conservatively as possible. Exported for focused tests so
 * the fragile coordinate behavior stays covered without loading pdf.js.
 */
export function linesFromPositionedTextItems(items: PositionedTextItem[]) {
  const rows: PositionedTextLine[] = [];

  [...items]
    .filter((item) => item.str?.trim())
    .sort((a, b) => (b.transform[5] ?? 0) - (a.transform[5] ?? 0))
    .forEach((item) => {
      const y = item.transform[5] ?? 0;
      const existing = rows.find((row) => Math.abs(row.y - y) <= LINE_BASELINE_TOLERANCE);
      const text = item.str!.trim();
      const x = item.transform[4] ?? 0;
      if (existing) {
        existing.items.push({ x, text });
        // Stabilize a row whose fragments land above and below its baseline.
        existing.y = (existing.y * (existing.items.length - 1) + y) / existing.items.length;
      } else {
        rows.push({ y, items: [{ x, text }] });
      }
    });

  const sortedRows = rows.sort((a, b) => b.y - a.y);
  const gaps = sortedRows.slice(1).map((row, index) => sortedRows[index].y - row.y);
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const median = sortedGaps.length ? sortedGaps[Math.floor(sortedGaps.length / 2)] : 0;
  const blankThreshold = median > 0 ? median * 1.7 : Infinity;
  const lines: string[] = [];

  sortedRows.forEach((row, index) => {
    if (index > 0 && sortedRows[index - 1].y - row.y > blankThreshold) lines.push("");
    const text = row.items
      .sort((a, b) => a.x - b.x)
      .map((item) => item.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) lines.push(text);
  });

  return lines;
}

type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (args: { data: ArrayBuffer }) => {
    promise: Promise<{
      numPages: number;
      getPage: (page: number) => Promise<{
        getTextContent: () => Promise<{
          items: PositionedTextItem[];
        }>;
      }>;
    }>;
  };
};

let pdfjsLib: PdfJs | null = null;

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  // Keep parsing code and its worker on the app's own origin. Loading these
  // files from a CDN would make a sensitive local import depend on a third
  // party and would make the product's local-first promise less accurate.
  pdfjsLib = (await import("pdfjs-dist")) as PdfJs;
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  return pdfjsLib;
}

export async function extractLines(buffer: ArrayBuffer) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: buffer }).promise;
  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    lines.push(...linesFromPositionedTextItems(content.items));
    lines.push("");
  }

  return lines;
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const LINK_RE = /((https?:\/\/)?(www\.)?(linkedin\.com|github\.com|gitlab\.com)\/[^\s|,]+|https?:\/\/[^\s|,]+|www\.[^\s|,]+)/i;
const CITY_RE = /\b([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)*),\s*([A-Z]{2})\b/;
const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?";
const SINGLE_DATE = `(?:${MONTH}\\s*\\d{4}|\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4}|\\d{1,2}\\/\\d{4}|\\d{4})`;
const DATE_RANGE_RE = new RegExp(
  `${SINGLE_DATE}\\s*(?:[\\u2013\\u2014\\-]|to)\\s*(?:Present|Current|Now|${SINGLE_DATE})`,
  "i",
);
const SECTION_MAP: Array<[RegExp, keyof Pick<ResumeState, "summary" | "experience" | "education" | "projects" | "skills">]> = [
  [/^(summary|professional\s+summary|professional\s+overview|executive\s+summary|career\s+summary|profile|professional\s+profile|career\s+profile|about\s+me|about|objective|career\s+objective|summary\s+of\s+qualifications|qualifications\s+(summary|profile))\b/i, "summary"],
  [/^(experience|work\s+experience|professional\s+experience|relevant\s+experience|selected\s+experience|employment(\s+(history|experience))?|work\s+history|career\s+history|professional\s+(background|history)|internships?)\b/i, "experience"],
  [/^(education|education\s+(and|&)\s+(training|credentials)|academic\s+background|academics)\b/i, "education"],
  [/^(projects|personal\s+projects|selected\s+projects|notable\s+projects|academic\s+projects|relevant\s+projects|research\s+projects|project\s+experience|portfolio\s+projects)\b/i, "projects"],
  [/^(skills|relevant\s+skills|technical\s+skills|professional\s+skills|key\s+skills|core\s+(competencies|skills)|technical\s+proficiencies|computer\s+skills|skills\s*(?:&|and)\s*(?:tools|technologies)|tools\s*(?:&|and)\s*technologies|technology\s+stack|tech\s+stack|technical\s+toolkit|programming\s+languages|technologies|areas?\s+of\s+expertise|expertise|competencies)\b/i, "skills"],
];

type ResumeSection = keyof Pick<ResumeState, "summary" | "experience" | "education" | "projects" | "skills">;

type BuiltinSectionHeading = {
  key: ResumeSection;
  inlineContent: string;
};

type CustomSectionHeading = {
  key: "custom";
  title: string;
  inlineContent: string;
};

type SectionHeading = BuiltinSectionHeading | CustomSectionHeading;

const CUSTOM_SECTION_MAP: Array<[RegExp, string]> = [
  [/^(certifications?|licenses?)\b/i, "Certifications"],
  [/^(volunteer(ing)?|community)\s+(experience|work|service)\b/i, "Volunteer Experience"],
  [/^publications?\b/i, "Publications"],
  [/^(awards?|achievements?|honou?rs?|accolades)\b/i, "Achievements"],
  [/^languages?\b/i, "Languages"],
  [/^(training|courses?|coursework|professional\s+development)\b/i, "Training"],
  [/^research\s+(experience|interests?|activities?)\b/i, "Research Experience"],
  [/^teaching\s+(experience|interests?)\b/i, "Teaching Experience"],
  [/^(leadership|campus\s+involvement|activities|extracurricular(\s+activities)?)\b/i, "Leadership & Activities"],
  [/^(professional\s+)?(affiliations?|memberships?|associations?)\b/i, "Professional Affiliations"],
  [/^(presentations?|conferences?|poster\s+presentations?)\b/i, "Presentations"],
  [/^(relevant\s+)?coursework\b/i, "Relevant Coursework"],
  [/^(interests?|additional\s+information|other\s+information)\b/i, "Additional Information"],
  [/^references?\b/i, "References"],
  [/^relevant\s+(expertise|qualifications?)\b/i, "Relevant Expertise"],
];

export function extractPhone(text: string) {
  const candidates = text.match(/\+?\(?\d[\d().\-\s]{7,}\d/g) || [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) return candidate.trim();
  }
  return "";
}

export function detectSection(line: string) {
  const norm = line.replace(/[:.\s]+$/, "").trim();
  if (norm.length > 40) return null;
  for (const [re, key] of SECTION_MAP) {
    if (re.test(norm)) return key;
  }
  return null;
}

/**
 * Finds a known heading and preserves content that follows a colon on the
 * same line. Compact resumes commonly use forms such as "Skills: TypeScript,
 * React"; treating that entire line only as a heading silently loses the
 * useful part. Other suffixes remain ordinary text to avoid guessing.
 */
function sectionHeading(line: string): SectionHeading | null {
  const value = line.trim();
  const colonIndex = value.indexOf(":");
  const headingText = colonIndex < 0 ? value : value.slice(0, colonIndex).trim();
  const inlineContent = colonIndex < 0 ? "" : value.slice(colonIndex + 1).trim();
  const key = detectSection(headingText);
  if (key) return { key, inlineContent };

  const norm = headingText.replace(/[:.\s]+$/, "").trim();
  if (norm.length > 40) return null;
  const custom = CUSTOM_SECTION_MAP.find(([re]) => re.test(norm));
  if (custom) return { key: "custom", title: custom[1], inlineContent };

  // A PDF loses type size and bolding, but an all-caps, short, standalone line
  // is a strong enough signal to preserve an unfamiliar section instead of
  // appending it to the preceding experience entry. Title-case lines are not
  // used here because they are often employers, schools, or job titles.
  const words = norm.split(/\s+/).filter(Boolean);
  if (
    words.length <= 5 &&
    /^[A-Z][A-Z\s&/]{2,39}$/.test(norm) &&
    norm === norm.toUpperCase()
  ) {
    const title = norm
      .toLocaleLowerCase()
      .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
    return { key: "custom", title, inlineContent };
  }
  return null;
}

const BULLET_RE = /^[*.\-\u2022\u25cf\u25aa\u2023\u00b7\u2013\u2014\u25e6]\s*/;

function stripBullet(line: string) {
  return line.replace(BULLET_RE, "").trim();
}

const ACTION_VERB_RE = /^(developed|led|built|designed|managed|implemented|created|spearheaded|scaled|deployed|automated|trained|executed|integrated|secured|owned|improved|launched|architected|drove|delivered)\b/i;

function looksLikeSubtitle(line: string) {
  const value = line.trim();
  if (!value) return false;
  if (DATE_RANGE_RE.test(value)) return false;
  if (ACTION_VERB_RE.test(value)) return false;
  const words = value.split(/\s+/).length;
  return /[|]/.test(value) || CITY_RE.test(value) || (words <= 9 && !/[.;]$/.test(value));
}

function isStandaloneDateLine(line: string) {
  const match = line.match(DATE_RANGE_RE);
  if (!match) return false;
  return line.replace(match[0], "").replace(/[\s|,;()\[\].]+/g, "").length === 0;
}

/**
 * Some exported resumes put a role and company above a separate dates line,
 * without blank lines between roles. A date is then the end of an entry's
 * header rather than the start of the next entry. When the details are
 * explicitly bulleted, or the next short header follows immediately, use that
 * boundary to keep adjacent entries separate. The latter also covers compact
 * education histories that do not use bullets.
 */
function splitStandaloneDateEntries(flat: string[]) {
  const dateIndexes = flat.flatMap((line, index) => (isStandaloneDateLine(line) ? [index] : []));
  if (dateIndexes.length < 2) return null;

  const boundaries = [0];
  for (let index = 1; index < dateIndexes.length; index += 1) {
    const previousDate = dateIndexes[index - 1];
    const nextDate = dateIndexes[index];
    const firstBullet = flat.findIndex((line, lineIndex) =>
      lineIndex > previousDate && lineIndex < nextDate && BULLET_RE.test(line),
    );
    const nextHeader = firstBullet >= 0
      ? flat.findIndex((line, lineIndex) =>
        lineIndex > firstBullet && lineIndex < nextDate && !BULLET_RE.test(line),
      )
      : flat.findIndex((line, lineIndex) =>
        lineIndex > previousDate && lineIndex < nextDate && looksLikeSubtitle(line),
      );
    if (nextHeader < 0) return null;
    boundaries.push(nextHeader);
  }

  return boundaries.map((start, index) => flat.slice(start, boundaries[index + 1] ?? flat.length));
}

function splitIntoChunks(blockLines: string[]) {
  const chunks: string[][] = [];
  let current: string[] = [];
  for (const line of blockLines) {
    if (line === "") {
      if (current.length) chunks.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) chunks.push(current);

  if (chunks.length <= 1 && blockLines.filter(Boolean).length > 2) {
    const dated: string[][] = [];
    let buffer: string[] = [];
    const flat = blockLines.filter(Boolean);

    const standaloneDateEntries = splitStandaloneDateEntries(flat);
    if (standaloneDateEntries) return standaloneDateEntries;

    flat.forEach((line, index) => {
      if (index > 0 && DATE_RANGE_RE.test(line) && buffer.length) {
        dated.push(buffer);
        buffer = [];
      }
      buffer.push(line);
    });
    if (buffer.length) dated.push(buffer);
    if (dated.length > 1) return dated;
  }

  return chunks;
}

/** Separates list-style project and custom-section entries that have no blank lines. */
function splitBulletEntries(blockLines: string[]) {
  const flat = blockLines.filter(Boolean);
  const bulletIndexes = flat.flatMap((line, index) => (BULLET_RE.test(line) ? [index] : []));
  if (!bulletIndexes.length || bulletIndexes[0] !== 0) return null;
  return bulletIndexes.map((start, index) => flat.slice(start, bulletIndexes[index + 1] ?? flat.length));
}

function joinDetailLines(lines: string[]) {
  const details: string[] = [];
  for (const line of lines) {
    const value = stripBullet(line);
    if (!value) continue;
    const previous = details[details.length - 1];
    const isContinuation = !BULLET_RE.test(line) && previous && (
      /[,;:]$/.test(previous) ||
      /^[a-z(]/.test(value) ||
      previous.split(/\s+/).length < 4
    );
    if (isContinuation) details[details.length - 1] = `${previous} ${value}`;
    else details.push(value);
  }
  return details.join("\n");
}

function chunkToEntry(chunk: string[]) {
  let meta = "";
  let dateLineIndex = -1;
  chunk.forEach((line, index) => {
    if (meta) return;
    const match = line.match(DATE_RANGE_RE) || line.match(new RegExp(SINGLE_DATE));
    if (match) {
      meta = match[0].trim();
      dateLineIndex = index;
    }
  });

  const startsWithBullet = BULLET_RE.test(chunk[0] || "");
  let headerText = stripBullet(chunk[0] || "");
  if (meta) headerText = headerText.replace(meta, "").replace(/[\s|,\u2013\u2014-]+$/, "").trim();

  let title = headerText;
  let subtitle = "";
  const separator = headerText.match(/\s*(?:[|,\u2013\u2014]|\sat\s|\s-\s)\s*/);
  if (separator?.index !== undefined) {
    title = headerText.slice(0, separator.index).trim();
    subtitle = headerText.slice(separator.index + separator[0].length).trim();
  }

  let subtitleIndex = -1;
  if (!subtitle && chunk[1] && looksLikeSubtitle(chunk[1])) {
    subtitle = chunk[1].trim();
    subtitleIndex = 1;
  }

  const detailLines = chunk
    .filter((line, index) => index !== 0 && index !== subtitleIndex && index !== dateLineIndex)
    .filter((line) => stripBullet(line) && stripBullet(line) !== meta);
  const details = startsWithBullet && !meta && /\s-\s/.test(headerText)
    ? joinDetailLines([subtitle, ...detailLines])
    : joinDetailLines(detailLines);
  if (startsWithBullet && !meta && /\s-\s/.test(headerText)) subtitle = "";

  return { title, subtitle, meta, details };
}

function parseEntries(blockLines: string[]) {
  const chunks = splitBulletEntries(blockLines) ?? splitIntoChunks(blockLines);
  return chunks
    .map(chunkToEntry)
    .filter((entry) => entry.title || entry.subtitle || entry.meta || entry.details);
}

export function parseResume(lines: string[]) {
  const result = emptyState();
  result.experience = [];
  result.education = [];
  result.projects = [];

  const sections: Array<{ heading: SectionHeading; headerIndex: number; start?: number; end?: number }> = [];
  let preambleEnd = lines.length;
  lines.forEach((line, index) => {
    const heading = sectionHeading(line);
    if (heading) {
      // Before the first recognized section, all-caps text is more likely to
      // be the candidate's name than an unfamiliar section heading.
      if (
        heading.key === "custom" &&
        !sections.length &&
        line.trim() === line.trim().toUpperCase() &&
        !CUSTOM_SECTION_MAP.some(([re]) => re.test(line.trim()))
      ) return;
      if (!sections.length) preambleEnd = index;
      sections.push({ heading, headerIndex: index });
    }
  });
  sections.forEach((section, index) => {
    section.start = section.headerIndex + 1;
    section.end = index + 1 < sections.length ? sections[index + 1].headerIndex : lines.length;
  });

  const fullText = lines.join("\n");
  const preamble = lines.slice(0, preambleEnd);
  const emailMatch = preamble.join("\n").match(EMAIL_RE) || fullText.match(EMAIL_RE);
  if (emailMatch) result.email = emailMatch[0];
  result.phone = extractPhone(preamble.join(" ")) || extractPhone(fullText);
  const linkMatch = preamble.join("\n").match(LINK_RE) || fullText.match(LINK_RE);
  if (linkMatch) result.website = linkMatch[0].replace(/[.,;]+$/, "");
  for (const line of preamble) {
    const city = line.match(CITY_RE);
    if (city) {
      result.location = city[0];
      break;
    }
  }

  const isContactLine = (line: string) =>
    EMAIL_RE.test(line) ||
    LINK_RE.test(line) ||
    extractPhone(line) ||
    (result.location && line.includes(result.location));
  const nameCandidates = preamble.filter((line) => line && !isContactLine(line) && !detectSection(line));
  if (nameCandidates[0]) result.name = nameCandidates[0];

  let rest = nameCandidates.slice(1);
  if (rest[0] && rest[0].length <= 60 && !/[.;]/.test(rest[0])) {
    result.title = rest[0];
    rest = rest.slice(1);
  }
  if (rest.length) result.summary = rest.join(" ").trim();

  for (const section of sections) {
    const block = section.heading.inlineContent
      ? [section.heading.inlineContent, ...lines.slice(section.start, section.end)]
      : lines.slice(section.start, section.end);
    if (section.heading.key === "summary") {
      result.summary = block.filter(Boolean).map(stripBullet).join(" ").trim();
    } else if (section.heading.key === "skills") {
      result.skills = block.filter(Boolean).map(stripBullet).join("\n");
    } else {
      const entries = parseEntries(block);
      if (!entries.length) continue;
      if (section.heading.key === "custom") {
        const normalizedTitle = section.heading.title.toLocaleLowerCase();
        const existing = result.customSections.find((custom) => custom.title.toLocaleLowerCase() === normalizedTitle);
        if (existing) existing.entries.push(...entries);
        else {
          const id = `custom-${normalizedTitle.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section"}`;
          result.customSections.push({ id, title: section.heading.title, entries });
          result.sectionOrder.push(id);
        }
      } else {
        result[section.heading.key] = result[section.heading.key].concat(entries);
      }
    }
  }

  if (!result.experience.length) result.experience = [blankEntry()];
  return normalizeResume(result);
}

export function importResumeText(text: string) {
  return importResumeTextWithSource(text).state;
}

function normalizedTextLines(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.trim());
}

export function importResumeTextWithSource(text: string) {
  const lines = normalizedTextLines(text);

  if (!lines.some(Boolean)) {
    throw new Error("Paste some resume text to import.");
  }

  return { state: parseResume(lines), sourceText: lines.join("\n").trim() };
}

export async function importResumePdf(file: File) {
  return (await importResumePdfWithSource(file)).state;
}

export async function importResumePdfWithSource(file: File) {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    throw new Error("Please choose a PDF file.");
  }
  const buffer = await file.arrayBuffer();
  const lines = await extractLines(buffer);
  if (!lines.filter(Boolean).length) {
    throw new Error("No text could be extracted. Scanned PDFs are not supported yet.");
  }
  return { state: parseResume(lines), sourceText: lines.join("\n").trim() };
}
