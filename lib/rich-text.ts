/**
 * Rich-text helpers for the resume "body" fields (professional summary, entry
 * details, and free-text section bodies).
 *
 * Formatting is stored as a deliberately tiny, canonical subset of inline HTML
 * embedded inside the existing newline-delimited block strings:
 *
 *   - `<strong>` bold
 *   - `<em>`     italic
 *   - `<u>`      underline
 *
 * Block structure (bullets / numbered / paragraphs) still lives in the string's
 * line breaks and the per-field format flag — never inside a tag — so the large
 * existing plain-text pipeline (keyword extraction, quality checks, diffing,
 * plain-text/Markdown export) keeps working: it just runs each block through
 * {@link stripRichMarks} first. Only rendering and rich exports read the marks.
 */

export type InlineRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

/** Inline tags a stored block string may contain. */
const INLINE_TAG_PATTERN = /<(strong|b|em|i|u)\b/i;

/** True when a block string carries any of our inline formatting tags. */
export function hasRichMarks(value: string) {
  return INLINE_TAG_PATTERN.test(value);
}

/** Block-level tags a stored rich field may contain (new block model). */
const BLOCK_TAG_PATTERN = /<(?:ul|ol|li|p|div)\b/i;

/** True when a value uses the block-level model (mixed bullets/numbers/paragraphs). */
export function hasBlockTags(value: string) {
  return BLOCK_TAG_PATTERN.test(value);
}

function stripBlockTags(value: string) {
  return value.replace(/<\/?(?:ul|ol|li|p|div)\b[^>]*>/gi, " ");
}

function decodeEntities(value: string) {
  return value.replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/g, (_, entity) => {
    switch (entity) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
      case "#39":
        return "'";
      case "nbsp":
        return " ";
      default:
        return _;
    }
  });
}

function escapeText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function marksEqual(a: InlineRun, b: InlineRun) {
  return !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.underline === !!b.underline;
}

/** Coalesces adjacent runs that share the same marks and drops empty runs. */
function mergeRuns(runs: InlineRun[]) {
  const out: InlineRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const prev = out[out.length - 1];
    if (prev && marksEqual(prev, run)) prev.text += run.text;
    else out.push({ ...run });
  }
  return out;
}

/**
 * Parses a canonical (already-sanitized) block string into runs without a DOM,
 * so it is safe on the server. Unknown/legacy plain text simply becomes a single
 * unstyled run.
 */
function tokenizeToRuns(value: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const marks = { bold: 0, italic: 0, underline: 0 };
  const pattern = /<(\/?)(strong|b|em|i|u)\s*>|<br\s*\/?>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushText = (raw: string) => {
    if (!raw) return;
    const text = decodeEntities(raw);
    if (!text) return;
    runs.push({
      text,
      ...(marks.bold ? { bold: true } : {}),
      ...(marks.italic ? { italic: true } : {}),
      ...(marks.underline ? { underline: true } : {}),
    });
  };

  while ((match = pattern.exec(value))) {
    pushText(value.slice(lastIndex, match.index));
    lastIndex = pattern.lastIndex;
    if (/^<br/i.test(match[0])) {
      runs.push({ text: " " });
      continue;
    }
    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    const key =
      tag === "strong" || tag === "b"
        ? "bold"
        : tag === "em" || tag === "i"
          ? "italic"
          : "underline";
    marks[key] = Math.max(0, marks[key] + (closing ? -1 : 1));
  }
  pushText(value.slice(lastIndex));
  return mergeRuns(runs);
}

/**
 * Parses arbitrary editor/pasted HTML into runs using the DOM, so inline styles
 * produced by the browser (e.g. `execCommand` output like `<span
 * style="font-weight:bold">` or `<b>`) are recognized alongside real tags.
 */
function domToRuns(html: string): InlineRun[] {
  const template = document.createElement("template");
  template.innerHTML = html;
  const runs: InlineRun[] = [];

  const walk = (node: Node, marks: Omit<InlineRun, "text">) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = (child.textContent ?? "").replace(/ /g, " ").replace(/\r?\n/g, " ");
        if (text) runs.push({ text, ...marks });
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === "br") {
        runs.push({ text: " ", ...marks });
        return;
      }
      const next: Omit<InlineRun, "text"> = { ...marks };
      if (tag === "strong" || tag === "b") next.bold = true;
      if (tag === "em" || tag === "i") next.italic = true;
      if (tag === "u" || tag === "ins") next.underline = true;
      const style = el.style;
      if (style) {
        const weight = style.fontWeight;
        if (
          weight === "bold" ||
          weight === "bolder" ||
          (/^\d+$/.test(weight) && Number(weight) >= 600)
        )
          next.bold = true;
        if (style.fontStyle === "italic") next.italic = true;
        const decoration = `${style.textDecoration} ${style.textDecorationLine}`;
        if (decoration.includes("underline")) next.underline = true;
      }
      walk(el, next);
    });
  };

  walk(template.content, {});
  return mergeRuns(runs);
}

function runsToHtml(runs: InlineRun[]) {
  return runs
    .map((run) => {
      let text = escapeText(run.text);
      if (run.text.trim()) {
        if (run.italic) text = `<em>${text}</em>`;
        if (run.bold) text = `<strong>${text}</strong>`;
        if (run.underline) text = `<u>${text}</u>`;
      }
      return text;
    })
    .join("");
}

/**
 * Normalizes any inline HTML (editor output, paste, legacy plain text) to the
 * canonical stored subset. Uses the DOM in the browser so `execCommand` styling
 * is captured; falls back to the dependency-free tokenizer on the server.
 */
export function sanitizeInlineHtml(html: string) {
  if (!html) return "";
  const runs = typeof document !== "undefined" ? domToRuns(html) : tokenizeToRuns(html);
  return runsToHtml(runs);
}

/**
 * Deterministic (DOM-free) normalization of a stored block string to canonical
 * inline HTML, safe to use for both server and client rendering — unlike
 * {@link sanitizeInlineHtml}, it never branches on the DOM, so it can't cause a
 * hydration mismatch. Use this for read-only rendering; use
 * {@link sanitizeInlineHtml} only when committing live editor output.
 */
export function renderInlineHtml(value: string) {
  if (!value) return "";
  return runsToHtml(tokenizeToRuns(value));
}

/** Runs for a canonical block string — used by the DOCX exporter. */
export function inlineRuns(value: string) {
  return tokenizeToRuns(value);
}

/** Strips all inline marks and block tags, returning decoded plain text. */
export function stripRichMarks(value: string) {
  if (!value) return "";
  if (!hasRichMarks(value) && !hasBlockTags(value) && !value.includes("&")) return value;
  const source = hasBlockTags(value) ? stripBlockTags(value).replace(/<br\s*\/?>/gi, " ") : value;
  return tokenizeToRuns(source)
    .map((run) => run.text)
    .join("");
}

/**
 * Converts a canonical block string to Markdown inline syntax. Bold/italic map
 * to `**`/`*`; underline has no markdown so it stays as a `<u>` tag when
 * `keepUnderline` is set. The AI round-trip passes `false` (underline isn't
 * carried through an AI edit); Markdown export keeps it.
 */
export function inlineHtmlToMarkdown(value: string, keepUnderline = true) {
  return inlineRuns(value)
    .map((run) => {
      if (!run.text.trim()) return run.text;
      const lead = run.text.match(/^\s*/)?.[0] ?? "";
      const trail = run.text.match(/\s*$/)?.[0] ?? "";
      let core = run.text.slice(lead.length, run.text.length - trail.length);
      if (run.italic) core = `*${core}*`;
      if (run.bold) core = `**${core}**`;
      if (keepUnderline && run.underline) core = `<u>${core}</u>`;
      return `${lead}${core}${trail}`;
    })
    .join("");
}

/* ------------------------------------------------------------------ *
 * Block model: rich fields can now mix bulleted, numbered, and plain
 * paragraph lines. A field is stored as canonical block-level HTML —
 * a sequence of <ul><li>…</li></ul>, <ol>…</ol>, and <p>…</p> — with
 * inline marks inside each block. Legacy newline strings still parse
 * via a format hint, so nothing needs a one-time migration.
 * ------------------------------------------------------------------ */

export type RichBlockType = "bullet" | "number" | "paragraph";
export type RichBlock = { type: RichBlockType; html: string };

/** DOM-free parse of canonical block HTML into ordered blocks. */
export function parseRichBlocksHtml(html: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  const blockRe = /<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>|<(p|div)\b[^>]*>([\s\S]*?)<\/\3>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(html))) {
    if (match[1]) {
      const type: RichBlockType = match[1].toLowerCase() === "ol" ? "number" : "bullet";
      const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
      let li: RegExpExecArray | null;
      while ((li = liRe.exec(match[2]))) {
        const inline = renderInlineHtml(stripBlockTags(li[1]).replace(/<br\s*\/?>/gi, " "));
        if (stripRichMarks(inline).trim() !== "") blocks.push({ type, html: inline });
      }
    } else {
      const inline = renderInlineHtml(stripBlockTags(match[4]).replace(/<br\s*\/?>/gi, " "));
      if (stripRichMarks(inline).trim() !== "") blocks.push({ type: "paragraph", html: inline });
    }
  }
  return blocks;
}

/** Parses a stored value into blocks, interpreting legacy newline strings. */
export function parseRichContent(value: string, legacyFormat?: string): RichBlock[] {
  if (!value) return [];
  if (hasBlockTags(value)) return parseRichBlocksHtml(value);
  const type: RichBlockType =
    legacyFormat === "numbered" ? "number" : legacyFormat === "bullets" ? "bullet" : "paragraph";
  const parts = legacyFormat === "paragraph" ? value.split(/\n\s*\n/) : value.split("\n");
  return parts
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => stripRichMarks(part).trim() !== "")
    .map((part) => ({ type, html: renderInlineHtml(part) }));
}

/**
 * Serializes blocks to canonical block HTML, grouping consecutive list items.
 * `paragraphTag` defaults to `<p>` (canonical storage + sheet); the form editor
 * passes `"div"` because the browser's list commands nest a `<ul>` *inside* a
 * `<p>` (invalid) but replace a `<div>` cleanly.
 */
export function serializeRichBlocks(blocks: RichBlock[], paragraphTag: "p" | "div" = "p"): string {
  let out = "";
  for (let i = 0; i < blocks.length;) {
    const block = blocks[i];
    if (block.type === "paragraph") {
      out += `<${paragraphTag}>${block.html}</${paragraphTag}>`;
      i += 1;
      continue;
    }
    const tag = block.type === "number" ? "ol" : "ul";
    let items = "";
    while (i < blocks.length && blocks[i].type === block.type) {
      items += `<li>${blocks[i].html}</li>`;
      i += 1;
    }
    out += `<${tag}>${items}</${tag}>`;
  }
  return out;
}

/** Deterministic canonical block HTML for rendering (SSR-safe, DOM-free). */
export function renderRichContent(
  value: string,
  legacyFormat?: string,
  paragraphTag: "p" | "div" = "p",
): string {
  return serializeRichBlocks(parseRichContent(value, legacyFormat), paragraphTag);
}

/** Serializes a live content-editable element into canonical block HTML. */
export function commitRichContent(element: HTMLElement): string {
  const blocks: RichBlock[] = [];
  const pushBlock = (type: RichBlockType, innerHtml: string) => {
    const html = sanitizeInlineHtml(innerHtml);
    if (stripRichMarks(html).trim() !== "") blocks.push({ type, html });
  };

  const walk = (container: HTMLElement) => {
    let pending: Node[] = [];
    const flushPending = () => {
      if (!pending.length) return;
      const wrapper = document.createElement("div");
      pending.forEach((node) => wrapper.appendChild(node.cloneNode(true)));
      pushBlock("paragraph", wrapper.innerHTML);
      pending = [];
    };

    Array.from(container.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        if (tag === "ul" || tag === "ol") {
          flushPending();
          const type: RichBlockType = tag === "ol" ? "number" : "bullet";
          el.querySelectorAll(":scope > li").forEach((li) =>
            pushBlock(type, (li as HTMLElement).innerHTML),
          );
          return;
        }
        if (tag === "p" || tag === "div") {
          flushPending();
          // The browser can nest a list inside a paragraph block (e.g. Enter
          // creates a <div>, then a list command wraps a <ul> inside it). Descend
          // so nested lists keep their type instead of being flattened to text.
          if (el.querySelector("ul,ol,p,div")) walk(el);
          else pushBlock("paragraph", el.innerHTML);
          return;
        }
        if (tag === "br") return;
      } else if (node.nodeType === Node.TEXT_NODE && !(node.textContent ?? "").trim()) {
        return;
      }
      // Loose inline nodes (bare text, <strong>, …) collect into one paragraph.
      pending.push(node);
    });
    flushPending();
  };

  walk(element);
  return serializeRichBlocks(blocks);
}

/**
 * Markdown editable source for the local AI: one block per line, list items
 * marked with `-`/`1.`, and bold/italic as `**`/`*` (which small local models
 * handle far more fluently than HTML tags). Underline is dropped to plain text —
 * it has no markdown and isn't carried through an AI edit. {@link
 * sanitizeRichContent} converts the emphasis markers back to tags on apply.
 */
export function richContentToPlainMarkdown(value: string, legacyFormat?: string): string {
  return parseRichContent(value, legacyFormat)
    .map((block) => {
      const md = inlineHtmlToMarkdown(block.html, false);
      if (block.type === "bullet") return `- ${md}`;
      if (block.type === "number") return `1. ${md}`;
      return md;
    })
    .join("\n");
}

/**
 * Converts markdown emphasis (`**bold**`, `*italic*`) to our canonical
 * `<strong>`/`<em>` tags. Guards keep it from mangling literal asterisks:
 * markers may not hug whitespace, an italic `*` may not touch a word char or
 * another `*` (so `snake_case`, `5*3`, and stray asterisks survive), and a span
 * never crosses a line break. Bold is handled first so its `*` aren't re-matched.
 */
function markdownEmphasisToHtml(value: string): string {
  return value
    .replace(/\*\*(?!\s)([^*\n]+?)(?<!\s)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<![\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\w*])/g, "<em>$1</em>");
}

/**
 * Canonicalizes text coming from outside the editor (AI output) to block HTML.
 * Accepts block HTML, Markdown bullet/number lines, or plain paragraphs, and
 * converts markdown `**`/`*` emphasis to `<strong>`/`<em>` (the AI edits a
 * markdown view). Any `<u>` the model happens to emit still parses through.
 */
export function sanitizeRichContent(value: string): string {
  const withEmphasis = markdownEmphasisToHtml(value);
  if (hasBlockTags(withEmphasis)) return renderRichContent(withEmphasis);
  const blocks: RichBlock[] = [];
  withEmphasis
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .forEach((line) => {
      const text = line.trim();
      if (!text) return;
      let match = text.match(/^[-*•◦–—]\s+(.*)$/);
      if (match) {
        blocks.push({ type: "bullet", html: sanitizeInlineHtml(match[1]) });
        return;
      }
      match = text.match(/^\d+[.)]\s+(.*)$/);
      if (match) {
        blocks.push({ type: "number", html: sanitizeInlineHtml(match[1]) });
        return;
      }
      blocks.push({ type: "paragraph", html: sanitizeInlineHtml(text) });
    });
  return serializeRichBlocks(blocks);
}
