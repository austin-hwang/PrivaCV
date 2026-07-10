import { blankEntry, emptyState, normalizeResume, type ResumeState } from "@/lib/resume";

const PDFJS_VERSION = "4.7.76";
const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;

type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (args: { data: ArrayBuffer }) => {
    promise: Promise<{
      numPages: number;
      getPage: (page: number) => Promise<{
        getTextContent: () => Promise<{
          items: Array<{ str?: string; transform: number[] }>;
        }>;
      }>;
    }>;
  };
};

let pdfjsLib: PdfJs | null = null;

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = (await import(/* webpackIgnore: true */ `${PDFJS_BASE}/pdf.min.mjs`)) as PdfJs;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.mjs`;
  return pdfjsLib;
}

export async function extractLines(buffer: ArrayBuffer) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: buffer }).promise;
  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows = new Map<number, Array<{ x: number; text: string }>>();

    for (const item of content.items) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5] ?? 0);
      const x = item.transform[4] ?? 0;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)?.push({ x, text: item.str });
    }

    const ys = [...rows.keys()].sort((a, b) => b - a);
    const gaps: number[] = [];
    for (let index = 1; index < ys.length; index += 1) gaps.push(ys[index - 1] - ys[index]);
    const sorted = [...gaps].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const blankThreshold = median > 0 ? median * 1.7 : Infinity;

    let prevY: number | null = null;
    for (const y of ys) {
      if (prevY !== null && prevY - y > blankThreshold) lines.push("");
      const text = (rows.get(y) ?? [])
        .sort((a, b) => a.x - b.x)
        .map((row) => row.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) lines.push(text);
      prevY = y;
    }
    lines.push("");
  }

  return lines;
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const LINK_RE = /((https?:\/\/)?(www\.)?(linkedin\.com|github\.com|gitlab\.com)\/[^\s|,]+|https?:\/\/[^\s|,]+|www\.[^\s|,]+)/i;
const CITY_RE = /\b([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)*),\s*([A-Z]{2})\b/;
const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?";
const SINGLE_DATE = `(?:${MONTH}\\s*\\d{4}|\\d{1,2}\\/\\d{4}|\\d{4})`;
const DATE_RANGE_RE = new RegExp(
  `${SINGLE_DATE}\\s*(?:[\\u2013\\u2014\\-]|to)\\s*(?:Present|Current|Now|${SINGLE_DATE})`,
  "i",
);
const SECTION_MAP: Array<[RegExp, keyof Pick<ResumeState, "summary" | "experience" | "education" | "projects" | "skills">]> = [
  [/^(summary|professional\s+summary|profile|career\s+profile|about\s+me|about|objective|career\s+objective)\b/i, "summary"],
  [/^(experience|work\s+experience|professional\s+experience|relevant\s+experience|selected\s+experience|employment(\s+(history|experience))?|work\s+history|career\s+history|professional\s+background)\b/i, "experience"],
  [/^(education|education\s+(and|&)\s+training|academic\s+background|academics)\b/i, "education"],
  [/^(projects|personal\s+projects|selected\s+projects|notable\s+projects|academic\s+projects|relevant\s+projects|project\s+experience)\b/i, "projects"],
  [/^(skills|technical\s+skills|key\s+skills|core\s+(competencies|skills)|technologies|areas?\s+of\s+expertise|expertise|competencies)\b/i, "skills"],
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

function stripBullet(line: string) {
  return line.replace(/^[*.\-\u2022\u25cf\u25aa\u2023\u00b7\u2013\u2014\u25e6]\s*/, "").trim();
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
      lineIndex > previousDate && lineIndex < nextDate && /^[*.\-\u2022\u25cf\u25aa\u2023\u00b7\u2013\u2014\u25e6]\s*/.test(line),
    );
    const nextHeader = firstBullet >= 0
      ? flat.findIndex((line, lineIndex) =>
        lineIndex > firstBullet && lineIndex < nextDate && !/^[*.\-\u2022\u25cf\u25aa\u2023\u00b7\u2013\u2014\u25e6]\s*/.test(line),
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

  let headerText = chunk[0] || "";
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

  const details = chunk
    .filter((line, index) => index !== 0 && index !== subtitleIndex && index !== dateLineIndex)
    .map(stripBullet)
    .filter((line) => line && line !== meta)
    .join("\n");

  return { title, subtitle, meta, details };
}

function parseEntries(blockLines: string[]) {
  return splitIntoChunks(blockLines)
    .map(chunkToEntry)
    .filter((entry) => entry.title || entry.subtitle || entry.meta || entry.details);
}

export function parseResume(lines: string[]) {
  const result = emptyState();
  result.experience = [];
  result.education = [];
  result.projects = [];

  const sections: Array<{ key: ReturnType<typeof detectSection>; headerIndex: number; start?: number; end?: number }> = [];
  let preambleEnd = lines.length;
  lines.forEach((line, index) => {
    const key = detectSection(line);
    if (key) {
      if (!sections.length) preambleEnd = index;
      sections.push({ key, headerIndex: index });
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
    if (!section.key) continue;
    const block = lines.slice(section.start, section.end);
    if (section.key === "summary") {
      result.summary = block.filter(Boolean).map(stripBullet).join(" ").trim();
    } else if (section.key === "skills") {
      result.skills = block.filter(Boolean).map(stripBullet).join("\n");
    } else {
      const entries = parseEntries(block);
      if (entries.length) result[section.key] = result[section.key].concat(entries);
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
