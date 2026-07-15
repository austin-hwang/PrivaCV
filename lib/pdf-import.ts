import { blankEntry, emptyState, inferHeaderLinkIcon, normalizeResume, type ResumeState } from "@/lib/resume";

// A resume PDF is normally far smaller than this. Check the selected file
// before loading pdf.js so an accidentally huge or hostile upload cannot tie
// up the browser while this local-only importer is trying to recover text.
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 30;

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
  if (pdf.numPages > MAX_PDF_PAGES) {
    throw new Error(`This PDF has more than ${MAX_PDF_PAGES} pages. Try copying the resume text instead.`);
  }
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
// Bare portfolio domains are common in compact contact rows. Keep the TLDs
// intentionally web-oriented so prose such as "Node.js" is not mistaken for
// a website, and only use this broader pattern in the preamble.
const BARE_PORTFOLIO_LINK_RE = /(?<!@)\b(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+(?:app|com|dev|io|me|net|org|tech)(?:\/[^\s|,]*)?/i;
const CITY_RE = /\b([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+)*),\s*([A-Z]{2})\b/;
const PREAMBLE_CITY_STATE_RE = /(?:^|[,|\u2022\u00b7])\s*([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+)*),\s*([A-Z]{2})\b/;
const LOCATION_RE = /\b([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+)*),\s*([A-Z]{2}|[A-Z][a-z.'-]+(?:\s+[A-Z][a-z.'-]+)*)\b/;
const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?,?";
const SEASON_DATE = "(?:Spring|Summer|Fall|Autumn|Winter)\\s+\\d{4}(?:\\s+(?:and|&)\\s+\\d{4})?";
const SINGLE_DATE = `(?:${MONTH}\\s*\\d{4}|${SEASON_DATE}|\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4}|\\d{1,2}\\/\\d{4}|\\d{4})`;
const DATE_SEPARATOR = "(?:[\\u2010\\u2011\\u2012\\u2013\\u2014\\u2212-]|to)";
const DATE_RANGE_RE = new RegExp(
  `${SINGLE_DATE}\\s*${DATE_SEPARATOR}\\s*(?:Present|Current|Now|${SINGLE_DATE})`,
  "i",
);

function extractHeaderLinks(value: string) {
  const explicitMatches = [...value.matchAll(new RegExp(LINK_RE.source, "gi"))];
  const occupied = explicitMatches.map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
  const bareMatches = [...value.matchAll(new RegExp(BARE_PORTFOLIO_LINK_RE.source, "gi"))]
    .filter((match) => {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      return !occupied.some((range) => start >= range.start && end <= range.end);
    });

  return [...explicitMatches, ...bareMatches]
    .sort((first, second) => (first.index ?? 0) - (second.index ?? 0))
    .map((match) => match[0].replace(/[.,;]+$/, ""))
    .filter((link, index, all) => all.findIndex((candidate) => candidate.toLocaleLowerCase() === link.toLocaleLowerCase()) === index);
}
const TRAILING_DATE_RE = new RegExp(`(?:${SINGLE_DATE}\\s*${DATE_SEPARATOR}\\s*(?:Present|Current|Now|${SINGLE_DATE})|${SINGLE_DATE})\\s*$`, "i");
const SECTION_MAP: Array<[RegExp, keyof Pick<ResumeState, "summary" | "experience" | "education" | "projects" | "skills">]> = [
  [/^(summary|professional\s+summary|professional\s+overview|executive\s+(summary|profile)|career\s+(summary|profile|highlights)|professional\s+(profile|highlights|qualifications)|profile|key\s+qualifications|core\s+qualifications|about\s+me|about|objective|career\s+objective|summary\s+of\s+(qualifications|experience)|qualifications\s+(summary|profile))\b/i, "summary"],
  [/^(experience|expirience|work\s+(experience|expirience)|professional\s+(experience|expirience)|relevant\s+(experience|expirience)|selected\s+(experience|expirience)|career\s+(experience|expirience)|professional\s+roles|employment(\s+(history|experience|expirience))?|work\s+history|career\s+history|professional\s+(background|history)|internships?)\b/i, "experience"],
  [/^(education|education\s+(and|&)\s+(training|credentials)|academic\s+background|academics)\b/i, "education"],
  [/^(projects|personal\s+projects|selected\s+(projects|work)|notable\s+projects|academic\s+projects|relevant\s+projects|related\s+projects|research\s+projects|project\s+experience|portfolio\s+projects|work\s+samples)\b/i, "projects"],
  [/^(skills|relevant\s+skills|technical\s+(skills|proficiencies|expertise|toolkit)|professional\s+(skills|competencies)|key\s+(skills|competencies)|skills\s+summary|core\s+(competencies|skills|strengths)|technical\s+areas|computer\s+skills|skills\s*(?:&|and)\s*(?:tools|technologies)|tools\s*(?:&|and)\s*technologies|technology\s+stack|tech\s+stack|programming\s+languages|technologies|areas?\s+of\s+expertise|expertise|competencies)\b/i, "skills"],
];

// Some exported PDFs retain purely decorative characters around a section
// heading (for example, "— EXPERIENCE —" or "• Skills:"). Strip only those
// characters at the edges, never within the heading, so parsing stays
// conservative while preserving the content people most often have to retype.
const HEADING_DECORATION_RE = /^[\s*\u2022\u25cf\u25aa\u25e6|/\\\-\u2013\u2014\u00b7]+|[\s*\u2022\u25cf\u25aa\u25e6|/\\\-\u2013\u2014\u00b7]+$/g;

function normalizedHeadingText(line: string) {
  return line.replace(HEADING_DECORATION_RE, "").replace(/[:.\s]+$/, "").trim();
}

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
  [/^(training|courses?|coursework|professional\s+development)$/i, "Training"],
  [/^research\s+(experience|interests?|activities?)\b/i, "Research Experience"],
  [/^teaching\s+(experience|interests?)\b/i, "Teaching Experience"],
  [/^(leadership|campus\s+involvement|activities|extracurricular(\s+activities)?)\b/i, "Leadership & Activities"],
  [/^(professional\s+)?(affiliations?|memberships?|associations?)\b/i, "Professional Affiliations"],
  [/^(presentations?|conferences?|poster\s+presentations?)\b/i, "Presentations"],
  [/^(relevant\s+)?coursework\b/i, "Relevant Coursework"],
  [/^(interests?|hobbies|misc(?:ellaneous)?|additional\s+information|other\s+information)\b/i, "Additional Information"],
  [/^references?\b/i, "References"],
  [/^relevant\s+(expertise|qualifications?)\b/i, "Relevant Expertise"],
];

/**
 * Identifies a familiar specialty heading without treating arbitrary title-case
 * text as a section. Import review uses this to call out a section whose
 * content could not be reconstructed, rather than making a person discover
 * the omission later in the editor.
 */
export function detectSpecialtySection(line: string) {
  const norm = normalizedHeadingText(line);
  if (norm.length > 40) return null;
  return CUSTOM_SECTION_MAP.find(([re]) => re.test(norm))?.[1] ?? null;
}

export function extractPhone(text: string) {
  const candidates = text.match(/\+?\(?\d[\d().\-\s]{7,}\d/g) || [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) return candidate.trim();
  }
  return "";
}

export function detectSection(line: string) {
  const norm = normalizedHeadingText(line);
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
  const undecoratedHeading = normalizedHeadingText(headingText);
  // A nested bullet such as "Course Dashboards: ..." is content, not a
  // Courses section. Keep decorated standalone headings and explicit all-caps
  // inline headings, but do not promote an ordinary bullet label to a section.
  if (BULLET_RE.test(value) && inlineContent && undecoratedHeading !== undecoratedHeading.toUpperCase()) {
    return null;
  }
  const key = detectSection(headingText);
  if (key) return { key, inlineContent };

  const norm = undecoratedHeading;
  if (norm.length > 40) return null;
  const custom = detectSpecialtySection(headingText);
  if (custom) return { key: "custom", title: custom, inlineContent };

  // A PDF loses type size and bolding, but an all-caps, short, standalone line
  // is a strong enough signal to preserve an unfamiliar section instead of
  // appending it to the preceding experience entry. Title-case lines are not
  // used here because they are often employers, schools, or job titles.
  const words = norm.split(/\s+/).filter(Boolean);
  if (
    words.length <= 5 &&
    (words.length > 1 || norm.length >= 5) &&
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

const BULLET_MARKER_RE = /^[*.\-\u2022\u25cf\u25aa\u2023\u00b7\u2013\u2014\u25e6]/;
const BULLET_RE = /^[*.\-\u2022\u25cf\u25aa\u2023\u00b7\u2013\u2014\u25e6]\s*/;

function stripBullet(line: string) {
  return line.replace(BULLET_RE, "").trim();
}

const ACTION_VERB_RE = /^(aggregated|analyzed|applied|automated|architected|built|collaborated|conducted|consulted|created|delivered|deployed|designed|developed|drove|executed|generated|implemented|improved|integrated|launched|learned|led|leveraged|managed|migrated|modernized|optimized|organized|owned|performed|promoted|provided|rebuilt|reconsolidated|reduced|scaled|secured|served|spearheaded|trained|transformed|utilized|worked)\b/i;
// Only use the employer-first recovery when the dated line has a recognisable
// role word. A PDF can put either an employer or a role beside dates, and
// guessing for every two-line header would silently swap otherwise usable
// imports. This narrow list covers the common exported-resume pattern while
// leaving ambiguous headers available for the existing explicit review flow.
const ROLE_TITLE_RE = /\b(engineer|developer|manager|designer|analyst|architect|scientist|consultant|specialist|director|coordinator|administrator|strategist|lead|intern|researcher|officer|associate|assistant|producer|editor|writer|advisor|representative|technician|bachelors?|masters?|doctor(?:ate)?|ph\.?d\.?|diploma|degree|certificate)\b/i;
const ACADEMIC_TITLE_RE = /\b(bachelors?|masters?|doctor(?:ate)?|ph\.?d\.?|diploma|degree|certificate|[BMA]\.?[AS]\.?|M\.?S\.?|B\.?S\.?)\b/i;
const ORGANIZATION_NAME_RE = /\b(inc\.?|incorporated|llc|ltd\.?|limited|corp\.?|corporation|company|co\.?|technologies|technology|systems|solutions|group|labs?|laborator(?:y|ies)|university|college|institute|foundation|agency|studio|partners?)\b/i;
const WORK_LOCATION_RE = /^(?:remote|hybrid|on-?site)$/i;

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

function isLikelyEntryHeader(line: string) {
  const value = stripBullet(line);
  if (!value || BULLET_RE.test(line) || ACTION_VERB_RE.test(value)) return false;
  if (value.split(/\s+/).length > 24 || /[.;:]$/.test(value)) return false;
  return /^[A-Z\d]/.test(value);
}

function isLikelyDatedEntryHeader(line: string) {
  const value = stripBullet(line);
  if (!value || BULLET_RE.test(line) || ACTION_VERB_RE.test(value) || !TRAILING_DATE_RE.test(value)) return false;
  return value.split(/\s+/).length <= 24 && !/[.;:]$/.test(value);
}

/**
 * Uses repeated document structure instead of employer, school, or project
 * vocabularies to recover entries from PDFs and Word tables that omit blank
 * paragraphs. A short header followed by a dated line or bullet is a strong
 * boundary; so is a dated header followed by bullets once it is not merely
 * the second line of an employer-first header.
 */
function splitStructuredEntries(flat: string[]) {
  if (flat.length < 3) return null;
  // The dedicated standalone-date recovery below understands three-line
  // role/company/date headers. Let it handle that shape without competing
  // boundary guesses.
  if (flat.filter(isStandaloneDateLine).length >= 2) return null;

  // When the block itself begins with a dated header, every later short dated
  // header is a stronger boundary than intervening description lines. This
  // covers compact entries that omit bullets entirely or mix bulleted and
  // unbulleted roles without relying on employer or job-title vocabulary.
  const datedHeaders = flat.flatMap((line, index) =>
    isLikelyDatedEntryHeader(line) ? [index] : [],
  );
  if (datedHeaders.length > 1 && datedHeaders[0] === 0) {
    return datedHeaders.map((start, index) => flat.slice(start, datedHeaders[index + 1] ?? flat.length));
  }

  const boundaries = [0];

  for (let index = 1; index < flat.length; index += 1) {
    const line = flat[index];
    const next = flat[index + 1] ?? "";
    const nextIsBullet = BULLET_RE.test(next);
    const nextIsDatedHeader = isLikelyDatedEntryHeader(next);
    const currentIsDatedHeader = isLikelyDatedEntryHeader(line);
    const previousIsDatedHeader = TRAILING_DATE_RE.test(stripBullet(flat[index - 1] ?? ""));
    const previousForcesContinuation = /(?:\b(?:and|for|in|of|to|using|with|over|under|by|from|across|while|that|which|than|into|through|per)|[-\u2010\u2011\u2012\u2013\u2014])\s*$/i.test(stripBullet(flat[index - 1] ?? ""));
    const datedHeaderWithSubtitle = currentIsDatedHeader &&
      isLikelyEntryHeader(next) &&
      BULLET_RE.test(flat[index + 2] ?? "");
    const employerFirstHeader = nextIsDatedHeader &&
      ROLE_TITLE_RE.test(stripBullet(next).replace(TRAILING_DATE_RE, "")) &&
      stripBullet(line).split(/\s+/).length <= 9;
    const roleFirstHeader = nextIsDatedHeader &&
      ROLE_TITLE_RE.test(stripBullet(line)) &&
      !ROLE_TITLE_RE.test(stripBullet(next).replace(TRAILING_DATE_RE, "")) &&
      stripBullet(line).split(/\s+/).length <= 9;
    const currentStartsEntry = isLikelyEntryHeader(line) &&
      ((nextIsBullet && !previousIsDatedHeader && !previousForcesContinuation) || employerFirstHeader || roleFirstHeader || datedHeaderWithSubtitle);
    const isSecondHeaderLine = boundaries[boundaries.length - 1] === index - 1;

    if (currentStartsEntry && !(currentIsDatedHeader && nextIsBullet && isSecondHeaderLine)) {
      boundaries.push(index);
    }
  }

  if (boundaries.length > 1) {
    return boundaries.map((start, index) => flat.slice(start, boundaries[index + 1] ?? flat.length));
  }

  // Word list formatting is not stored as a literal bullet character. In
  // those files, repeated header lines ending in a date are the remaining
  // reliable structure. Require the first block line to be one of them so a
  // year mentioned later in prose cannot split an otherwise ordinary entry.
  return null;
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

    // A school is sometimes printed once above several dated degrees. Repeat
    // that shared institution in each chunk instead of emitting it as an
    // empty education entry and detaching the degrees beneath it.
    if (
      flat.length >= 3 &&
      !TRAILING_DATE_RE.test(stripBullet(flat[0])) &&
      flat.slice(1).every((line) => isLikelyDatedEntryHeader(line) && ACADEMIC_TITLE_RE.test(line))
    ) {
      return flat.slice(1).map((line) => [flat[0], line]);
    }

    const structuredEntries = splitStructuredEntries(flat);
    if (structuredEntries) return structuredEntries;

    const standaloneDateEntries = splitStandaloneDateEntries(flat);
    if (standaloneDateEntries) return standaloneDateEntries;

    flat.forEach((line, index) => {
      if (index > 0 && DATE_RANGE_RE.test(line) && buffer.length) {
        const dateMatch = line.match(DATE_RANGE_RE)?.[0] ?? "";
        const datedRole = stripBullet(line)
          .replace(dateMatch, "")
          .replace(/[\s|,\u2010\u2011\u2012\u2013\u2014\u2212-]+$/, "")
          .trim();
        // A role can share its dates on the second line of an employer-first
        // header. Keep that header together so chunkToEntry can recover both
        // fields; a normal dated role remains the boundary for the next entry.
        const isEmployerFirstHeader = datedRole &&
          ROLE_TITLE_RE.test(datedRole) &&
          !BULLET_RE.test(buffer[buffer.length - 1] || "");
        if (isEmployerFirstHeader) {
          // With no blank line between entries, keep only the immediately
          // preceding employer with this dated role and finish the prior
          // entry. This preserves repeated employer-first headers instead of
          // merging all of their bullets into one entry.
          if (buffer.length > 1) {
            dated.push(buffer.slice(0, -1));
            buffer = [buffer[buffer.length - 1]];
          }
        } else {
          dated.push(buffer);
          buffer = [];
        }
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
  const entryMarker = flat[0]?.match(BULLET_MARKER_RE)?.[0];
  if (!entryMarker) return null;
  const bulletIndexes = flat.flatMap((line, index) =>
    line.match(BULLET_MARKER_RE)?.[0] === entryMarker ? [index] : [],
  );
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

/**
 * Recovers a common two-line header where an employer (often with a location)
 * precedes a role on the line that also carries dates. Previously the parser
 * used the employer as the title and discarded the dated role line altogether.
 * Keep this deliberately high-confidence so unusual layouts still stay
 * reviewable rather than being silently reinterpreted.
 */
function employerFirstDatedRole(chunk: string[], meta: string, dateLineIndex: number) {
  if (dateLineIndex !== 1 || !meta) return null;

  const role = stripBullet(chunk[dateLineIndex])
    .replace(meta, "")
    .replace(/[\s|,\u2010\u2011\u2012\u2013\u2014\u2212-]+$/, "")
    .trim();
  if (!role || (!ROLE_TITLE_RE.test(role) && !ACADEMIC_TITLE_RE.test(role))) return null;

  // Preserve a location when it is printed directly after an employer or
  // school ("Example Co Seattle, WA"). Without a separator there is no safe
  // generic way to tell where the organization ends and the city begins.
  // Pipes are explicit enough to keep the left side only.
  const employer = stripBullet(chunk[0])
    .split(/\s*\|\s*/)[0]
    .replace(/\s*(?:[|,\u2013\u2014-]\s*)?(?:remote|hybrid)\s*$/i, "")
    .replace(/[\s|,\u2010\u2011\u2012\u2013\u2014\u2212-]+$/, "")
    .trim();
  if (!employer) return null;

  return { title: role, subtitle: employer };
}

/** Recovers the inverse two-line shape: role, then organization/location plus dates. */
function roleFirstDatedOrganization(chunk: string[], meta: string, dateLineIndex: number) {
  if (dateLineIndex !== 1 || !meta) return null;

  const role = stripBullet(chunk[0]).trim();
  const organization = stripBullet(chunk[dateLineIndex])
    .replace(meta, "")
    .replace(/[\s|,\u2010\u2011\u2012\u2013\u2014\u2212-]+$/, "")
    .trim();
  if (!role || !organization || !ROLE_TITLE_RE.test(role) || ROLE_TITLE_RE.test(organization)) return null;
  return { title: role, subtitle: organization };
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
  if (meta) headerText = headerText.replace(meta, "").replace(/[\s|,\u2010\u2011\u2012\u2013\u2014\u2212-]+$/, "").trim();

  let title = headerText;
  let subtitle = "";
  const separator = headerText.match(/\s*(?:[|,\u2013\u2014]|\sat\s|\s-\s)\s*/);
  if (separator?.index !== undefined) {
    title = headerText.slice(0, separator.index).trim();
    subtitle = headerText.slice(separator.index + separator[0].length).trim();
    // Compact ATS templates use both "Company | Role" and "Role | Company".
    // Prefer the side with a recognizable role word, leaving ambiguous pairs
    // in their source order for review.
    if (
      (!ROLE_TITLE_RE.test(title) && ROLE_TITLE_RE.test(subtitle)) ||
      (!ROLE_TITLE_RE.test(title) &&
        ORGANIZATION_NAME_RE.test(title) &&
        !ORGANIZATION_NAME_RE.test(subtitle) &&
        !WORK_LOCATION_RE.test(subtitle) &&
        !LOCATION_RE.test(subtitle))
    ) {
      [title, subtitle] = [subtitle, title];
    }
  }

  let subtitleIndex = -1;
  if (!subtitle && chunk[1] && looksLikeSubtitle(chunk[1])) {
    subtitle = chunk[1].trim();
    subtitleIndex = 1;
  }

  const recoveredHeader = employerFirstDatedRole(chunk, meta, dateLineIndex);
  const roleFirstHeader = roleFirstDatedOrganization(chunk, meta, dateLineIndex);
  if (recoveredHeader || roleFirstHeader) {
    const header = recoveredHeader ?? roleFirstHeader!;
    title = header.title;
    subtitle = header.subtitle;
    subtitleIndex = -1;
  }

  let bulletInlineDetail = "";
  if (startsWithBullet && !meta) {
    const inlineSeparator = headerText.match(/\s+(?:-|:)\s+/);
    if (inlineSeparator?.index !== undefined) {
      const inlineTitle = headerText.slice(0, inlineSeparator.index).trim();
      if (inlineTitle && inlineTitle.split(/\s+/).length <= 10) {
        title = inlineTitle;
        subtitle = "";
        subtitleIndex = -1;
        bulletInlineDetail = headerText.slice(inlineSeparator.index + inlineSeparator[0].length).trim();
      }
    }
  }

  const detailLines = chunk
    .filter((line, index) => index !== 0 && index !== subtitleIndex && index !== dateLineIndex)
    .filter((line) => stripBullet(line) && stripBullet(line) !== meta);
  const details = bulletInlineDetail
    ? joinDetailLines([bulletInlineDetail, ...detailLines])
    : joinDetailLines(detailLines);

  return { title, subtitle, meta, details };
}

function parseEntries(blockLines: string[], inheritOrganization = false) {
  const chunks = splitBulletEntries(blockLines) ?? splitIntoChunks(blockLines);
  const entries = chunks
    .map(chunkToEntry)
    .filter((entry) => entry.title || entry.subtitle || entry.meta || entry.details);

  if (!inheritOrganization) return entries;
  let previousOrganization = "";
  return entries.map((entry) => {
    if (entry.subtitle) previousOrganization = entry.subtitle;
    if (!entry.subtitle && entry.meta && previousOrganization && ROLE_TITLE_RE.test(entry.title)) {
      return { ...entry, subtitle: previousOrganization };
    }
    return entry;
  });
}

function hasReadableWords(line: string) {
  const compact = line.replace(/\s/g, "");
  if (!compact) return false;
  const readable = compact.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  return readable >= 2 && readable / compact.length >= 0.55;
}

function looksLikePersonName(line: string) {
  if (!hasReadableWords(line) || /[|/@]|https?:|\d/.test(line)) return false;
  const withoutCredentials = line.replace(/,?\s+(?:Ph\.?D\.?|PsyD|MD|MBA|CPA|JD|RN|PE)\.?$/i, "").trim();
  const words = withoutCredentials.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  return words.every((word) => /^[\p{Lu}][\p{L}'-]*$/u.test(word) || /^[\p{Lu}][\p{Lu}'-]+$/u.test(word));
}

function combineSplitNameLines(lines: string[]) {
  const combined: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1];
    if (/^[\p{Lu}][\p{Lu}'-]+$/u.test(line) && /^[\p{Lu}][\p{Lu}'-]+$/u.test(next ?? "")) {
      combined.push(`${line} ${next}`);
      index += 1;
    } else {
      combined.push(line);
    }
  }
  return combined;
}

function namePrefixFromContactLine(line: string) {
  const contactIndexes = [
    line.search(EMAIL_RE),
    line.search(LINK_RE),
    line.search(BARE_PORTFOLIO_LINK_RE),
    line.search(/\b(?:e-?mail|mobile|phone|tel(?:ephone)?)\s*:/i),
    line.search(/\+?\(?\d[\d().\-\s]{7,}\d/),
  ].filter((index) => index > 0);
  if (!contactIndexes.length) return "";

  const prefix = line
    .slice(0, Math.min(...contactIndexes))
    .replace(/[\s|,;:\u2022\u00b7-]+$/, "")
    .trim();
  return looksLikePersonName(prefix) ? prefix : "";
}

function isLikelyPageArtifact(line: string, name: string) {
  const value = stripBullet(line).trim();
  if (/^(?:\[\s*)?\d{1,3}(?:\s*\/\s*\d{1,3})?(?:\s*\])?$/.test(value)) return true;
  if (!name) return false;

  const plainName = name.replace(/,?\s+(?:Ph\.?D\.?|PsyD|MD|MBA|CPA|JD|RN|PE)\.?$/i, "").trim();
  if (!plainName) return false;
  const lower = value.toLocaleLowerCase();
  const lowerName = plainName.toLocaleLowerCase();
  return (lower.includes(lowerName) && /\bresume\b/i.test(value)) ||
    lower.endsWith(lowerName) ||
    new RegExp(`${lowerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*,\\s*[a-z.]+$`, "i").test(lower);
}

export function parseResume(lines: string[]) {
  const result = emptyState();
  result.experience = [];
  result.education = [];
  result.projects = [];

  const sections: Array<{ heading: SectionHeading; headerIndex: number; start?: number; end?: number }> = [];
  let preambleEnd = lines.length;
  let activeSectionKey: SectionHeading["key"] | null = null;
  lines.forEach((line, index) => {
    const heading = sectionHeading(line);
    if (heading) {
      // Within Skills, labels such as "Languages: Python, C" are subgroups,
      // not new top-level resume sections. Standalone Languages headings still
      // remain custom sections when they appear outside a Skills block.
      if (activeSectionKey === "skills" && heading.key === "custom" && heading.inlineContent) return;
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
      activeSectionKey = heading.key;
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
  // Phone numbers belong in the header. Searching the entire resume produces
  // convincing false positives from DOIs, publication IDs, and long metrics.
  result.phone = preamble.map(extractPhone).find(Boolean) || "";
  const preambleText = preamble.join("\n");
  const importedLinks = extractHeaderLinks(preambleText);
  const links = importedLinks.length ? importedLinks : extractHeaderLinks(fullText).slice(0, 1);
  result.headerLinks = links.map((url, index) => ({ id: `header-link-${index + 1}`, label: "", url, icon: inferHeaderLinkIcon(url) }));
  result.website = links[0] ?? "";
  for (const line of preamble) {
    const shortState = line.match(PREAMBLE_CITY_STATE_RE);
    if (shortState) {
      result.location = `${shortState[1]}, ${shortState[2]}`;
      break;
    }
    const city = line.match(LOCATION_RE);
    if (city && city[0].split(/\s+/).length <= 5 && !/\b(?:PsyD|Ph\.?D\.?|MD|MBA|CPA|JD|RN|PE)\b/i.test(city[0])) {
      result.location = city[0];
      break;
    }
  }

  const isContactLine = (line: string) =>
    EMAIL_RE.test(line) ||
    LINK_RE.test(line) ||
    BARE_PORTFOLIO_LINK_RE.test(line) ||
    extractPhone(line) ||
    (result.location && line.includes(result.location));
  const nameCandidates = combineSplitNameLines(preamble.flatMap((line) => {
    if (!line || !hasReadableWords(line) || detectSection(line)) return [];
    if (isContactLine(line)) {
      const namePrefix = namePrefixFromContactLine(line);
      return namePrefix ? [namePrefix] : [];
    }
    return [line];
  }));
  const likelyNameIndex = nameCandidates.findIndex(looksLikePersonName);
  const nameIndex = likelyNameIndex >= 0 ? likelyNameIndex : 0;
  if (nameCandidates[nameIndex]) result.name = nameCandidates[nameIndex];

  const preceding = nameCandidates[nameIndex - 1];
  const following = nameCandidates[nameIndex + 1];
  let titleIndex = -1;
  if (preceding && ROLE_TITLE_RE.test(preceding) && preceding.length <= 60 && !/[.;]$/.test(preceding)) {
    result.title = preceding;
    titleIndex = nameIndex - 1;
  } else if (following && following.length <= 60 && !/[.;]$/.test(following)) {
    result.title = following;
    titleIndex = nameIndex + 1;
  }

  const rest = nameCandidates.filter((_, index) => index > nameIndex && index !== titleIndex);
  if (rest.length) result.summary = rest.join(" ").trim();

  for (const section of sections) {
    const unfilteredBlock = section.heading.inlineContent
      ? [section.heading.inlineContent, ...lines.slice(section.start, section.end)]
      : lines.slice(section.start, section.end);
    const block = unfilteredBlock.filter((line) => !isLikelyPageArtifact(line, result.name));
    if (section.heading.key === "summary") {
      result.summary = block.filter(Boolean).map(stripBullet).join(" ").trim();
    } else if (section.heading.key === "skills") {
      result.skills = block.filter(Boolean).map(stripBullet).join("\n");
    } else {
      const entries = parseEntries(block, section.heading.key === "experience");
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
  if (file.size > MAX_PDF_BYTES) {
    throw new Error("This PDF is too large to import locally. Try copying the resume text instead.");
  }
  const buffer = await file.arrayBuffer();
  const lines = await extractLines(buffer);
  if (!lines.filter(Boolean).length) {
    throw new Error("No text could be extracted. Scanned PDFs are not supported yet.");
  }
  return { state: parseResume(lines), sourceText: lines.join("\n").trim() };
}
