/* ============================================================
   PDF import — extract text from a resume PDF (via pdf.js) and
   parse it heuristically into the editor's fields.

   Parsing a PDF is inherently approximate: PDFs store positioned
   glyphs, not a document outline. So this does a best-effort pass
   and hands the result to the editor for the user to review/fix.
   ============================================================ */

const PDFJS_VERSION = "4.7.76";
const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;

let pdfjsLib = null;

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import(`${PDFJS_BASE}/pdf.min.mjs`);
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.mjs`;
  return pdfjsLib;
}

/* ---------------- Text extraction ---------------- */
// Reconstruct lines from positioned glyphs, inserting "" where a
// noticeably large vertical gap suggests a blank line / new block.
async function extractLines(buffer) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: buffer }).promise;
  const lines = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    // Group glyph items into rows keyed by rounded y position.
    const rows = new Map();
    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: item.transform[4], s: item.str });
    }

    // Top of page first (higher y = higher on page).
    const ys = [...rows.keys()].sort((a, b) => b - a);

    // Median row spacing → threshold for "blank line".
    const gaps = [];
    for (let i = 1; i < ys.length; i++) gaps.push(ys[i - 1] - ys[i]);
    const sorted = [...gaps].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const blankThreshold = median > 0 ? median * 1.7 : Infinity;

    let prevY = null;
    for (const y of ys) {
      if (prevY !== null && prevY - y > blankThreshold) lines.push("");
      const text = rows
        .get(y)
        .sort((a, b) => a.x - b.x)
        .map((o) => o.s)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) lines.push(text);
      prevY = y;
    }
    lines.push(""); // page boundary acts as a block separator
  }

  return lines;
}

/* ---------------- Patterns ---------------- */
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const LINK_RE = /((https?:\/\/)?(www\.)?(linkedin\.com|github\.com|gitlab\.com)\/[^\s|,]+|https?:\/\/[^\s|,]+|www\.[^\s|,]+)/i;
const CITY_RE = /\b([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)*),\s*([A-Z]{2})\b/;
const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?";
const SINGLE_DATE = `(?:${MONTH}\\s*\\d{4}|\\d{1,2}\\/\\d{4}|\\d{4})`;
const DATE_RANGE_RE = new RegExp(
  `${SINGLE_DATE}\\s*(?:[\\u2013\\u2014\\-]|to)\\s*(?:Present|Current|Now|${SINGLE_DATE})`,
  "i"
);
const SECTION_MAP = [
  [/^(summary|professional\s+summary|profile|about\s+me|about|objective|career\s+objective)\b/i, "summary"],
  [/^(experience|work\s+experience|professional\s+experience|employment(\s+history)?|work\s+history)\b/i, "experience"],
  [/^(education|academic\s+background|academics)\b/i, "education"],
  [/^(projects|personal\s+projects|selected\s+projects|notable\s+projects)\b/i, "projects"],
  [/^(skills|technical\s+skills|core\s+(competencies|skills)|technologies|expertise)\b/i, "skills"],
];

function extractPhone(text) {
  const candidates = text.match(/\+?\(?\d[\d().\-\s]{7,}\d/g) || [];
  for (const c of candidates) {
    const digits = c.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) return c.trim();
  }
  return "";
}

function detectSection(line) {
  const norm = line.replace(/[:.\s]+$/, "").trim();
  if (norm.length > 40) return null; // headings are short
  for (const [re, key] of SECTION_MAP) {
    if (re.test(norm)) return key;
  }
  return null;
}

function stripBullet(line) {
  return line.replace(/^[•●▪‣·*\-–—◦]\s*/, "").trim();
}

// A short, non-sentence line under a job title — typically
// "Company • Location" or a tech-stack list — rather than a bullet.
const ACTION_VERB_RE = /^(developed|led|built|designed|managed|implemented|created|spearheaded|scaled|deployed|automated|trained|executed|integrated|secured|owned|improved|launched|architected|drove|delivered)\b/i;
function looksLikeSubtitle(line) {
  const t = line.trim();
  if (!t) return false;
  if (DATE_RANGE_RE.test(t)) return false;
  if (ACTION_VERB_RE.test(t)) return false;
  const words = t.split(/\s+/).length;
  return /[•|]/.test(t) || CITY_RE.test(t) || (words <= 9 && !/[.;]$/.test(t));
}

/* ---------------- Parse a section block into entries ---------------- */
function splitIntoChunks(blockLines) {
  // Primary: split on blank lines.
  const chunks = [];
  let current = [];
  for (const line of blockLines) {
    if (line === "") {
      if (current.length) chunks.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) chunks.push(current);

  // Fallback: if everything collapsed into one chunk but it clearly
  // contains several dated roles, split before each dated line.
  if (chunks.length <= 1 && blockLines.filter(Boolean).length > 2) {
    const dated = [];
    let buf = [];
    const flat = blockLines.filter(Boolean);
    flat.forEach((line, i) => {
      if (i > 0 && DATE_RANGE_RE.test(line) && buf.length) {
        dated.push(buf);
        buf = [];
      }
      buf.push(line);
    });
    if (buf.length) dated.push(buf);
    if (dated.length > 1) return dated;
  }

  return chunks;
}

function chunkToEntry(chunk) {
  // Find a date range anywhere in the chunk for the meta column.
  let meta = "";
  let dateLineIdx = -1;
  chunk.forEach((line, i) => {
    if (meta) return;
    const m = line.match(DATE_RANGE_RE) || line.match(new RegExp(SINGLE_DATE));
    if (m) {
      meta = m[0].trim();
      dateLineIdx = i;
    }
  });

  // Header line: prefer the line that carried the date, else the first.
  const headerIdx = dateLineIdx >= 0 ? Math.min(dateLineIdx, 0) : 0;
  let headerText = chunk[0] || "";
  if (meta) headerText = headerText.replace(meta, "").replace(/[\s|,–—-]+$/, "").trim();

  // Split "Title, Company" / "Title | Company" / "Title at Company".
  let title = headerText;
  let subtitle = "";
  const sep = headerText.match(/\s*(?:[|,–—]|\sat\s|\s-\s)\s*/);
  if (sep) {
    const idx = sep.index;
    title = headerText.slice(0, idx).trim();
    subtitle = headerText.slice(idx + sep[0].length).trim();
  }

  // If the title line had no company, the second line is often the
  // "Company • Location" / "Tech stack" line (not a bullet).
  let subtitleIdx = -1;
  if (!subtitle && chunk[1] && looksLikeSubtitle(chunk[1])) {
    subtitle = chunk[1].trim();
    subtitleIdx = 1;
  }

  // Remaining lines → bullet details (skip header, the consumed
  // subtitle line, and any line that was purely the date).
  const details = chunk
    .filter((line, i) => i !== 0 && i !== subtitleIdx)
    .map(stripBullet)
    .filter((line) => line && line !== meta)
    .join("\n");

  return { title, subtitle, meta, details };
}

function parseEntries(blockLines) {
  return splitIntoChunks(blockLines)
    .map(chunkToEntry)
    .filter((e) => e.title || e.subtitle || e.meta || e.details);
}

/* ---------------- Top-level parse ---------------- */
function parseResume(lines) {
  const result = {
    name: "", title: "", email: "", phone: "", location: "", website: "",
    summary: "", skills: "", experience: [], education: [], projects: [],
  };

  // Find section boundaries.
  const sections = []; // {key, start, end}
  let preambleEnd = lines.length;
  lines.forEach((line, i) => {
    const key = detectSection(line);
    if (key) {
      if (!sections.length) preambleEnd = i;
      sections.push({ key, headerIdx: i });
    }
  });
  sections.forEach((s, i) => {
    s.start = s.headerIdx + 1;
    s.end = i + 1 < sections.length ? sections[i + 1].headerIdx : lines.length;
  });

  const fullText = lines.join("\n");
  const preamble = lines.slice(0, preambleEnd);

  // --- Contact info (search preamble first, then whole doc) ---
  const emailM = (preamble.join("\n").match(EMAIL_RE) || fullText.match(EMAIL_RE));
  if (emailM) result.email = emailM[0];
  result.phone = extractPhone(preamble.join(" ")) || extractPhone(fullText);
  const linkM = preamble.join("\n").match(LINK_RE) || fullText.match(LINK_RE);
  if (linkM) result.website = linkM[0].replace(/[.,;]+$/, "");
  for (const line of preamble) {
    const c = line.match(CITY_RE);
    if (c) { result.location = c[0]; break; }
  }

  // --- Name & title from preamble (lines that aren't contact info) ---
  const isContactLine = (line) =>
    EMAIL_RE.test(line) ||
    LINK_RE.test(line) ||
    extractPhone(line) ||
    (result.location && line.includes(result.location));
  const nameCandidates = preamble.filter((l) => l && !isContactLine(l) && !detectSection(l));
  if (nameCandidates[0]) result.name = nameCandidates[0];

  // After the name, a short line with no sentence punctuation reads as a
  // role/title; anything longer is the summary tagline (which often has
  // no "Summary" heading). Remaining lines join into the summary.
  let rest = nameCandidates.slice(1);
  if (rest[0] && rest[0].length <= 60 && !/[.;]/.test(rest[0])) {
    result.title = rest[0];
    rest = rest.slice(1);
  }
  if (rest.length) result.summary = rest.join(" ").trim();

  // --- Sections ---
  for (const s of sections) {
    const block = lines.slice(s.start, s.end);
    if (s.key === "summary") {
      result.summary = block.filter(Boolean).map(stripBullet).join(" ").trim();
    } else if (s.key === "skills") {
      result.skills = block.filter(Boolean).map(stripBullet).join("\n");
    } else {
      // experience / education / projects — keep the longest if duplicated
      const entries = parseEntries(block);
      if (entries.length) result[s.key] = (result[s.key] || []).concat(entries);
    }
  }

  return result;
}

/* ---------------- Wiring ---------------- */
function setBusy(busy) {
  const btn = document.getElementById("btnImport");
  if (!btn) return;
  btn.disabled = busy;
  btn.textContent = busy ? "Importing…" : "Import PDF";
}

async function handleFile(file) {
  if (!file) return;
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    alert("Please choose a PDF file.");
    return;
  }
  setBusy(true);
  try {
    const buffer = await file.arrayBuffer();
    const lines = await extractLines(buffer);
    if (!lines.filter(Boolean).length) {
      alert(
        "No text could be extracted. This PDF may be a scanned image — " +
          "text-based PDFs are required for import."
      );
      return;
    }
    const parsed = parseResume(lines);
    if (typeof window.applyParsedResume === "function") {
      window.applyParsedResume(parsed);
    }
  } catch (err) {
    console.error("PDF import failed:", err);
    alert(
      "Could not import this PDF: " +
        (err && err.message ? err.message : "unknown error") +
        "\n(Importing needs an internet connection to load the PDF engine.)"
    );
  } finally {
    setBusy(false);
  }
}

function initImport() {
  const btn = document.getElementById("btnImport");
  const input = document.getElementById("pdfInput");
  if (!btn || !input) return;
  btn.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    handleFile(input.files[0]);
    input.value = ""; // allow re-importing the same file
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initImport);
  } else {
    initImport();
  }
}

// Exposed for testing in non-browser environments; unused by the page.
export { parseResume, extractLines, extractPhone, detectSection };
