/**
 * Data for the public resume-builder comparison page.
 *
 * IMPORTANT: these are factual, dated claims about named third-party products.
 * Pricing and feature tiers change often, so every figure is sourced and stamped
 * with {@link COMPARISON_LAST_VERIFIED}. When updating, re-check each vendor's
 * pricing page and keep the tone neutral — state facts, never disparage.
 */

/** Month the competitor pricing/features below were last checked. */
export const COMPARISON_LAST_VERIFIED = "July 2026";

export type Comparator = {
  name: string;
  /** True for PrivaCV — its column is visually emphasized. */
  isUs?: boolean;
  /** Headline price shown in the table header. */
  price: string;
  /** Smaller print under the price (trial terms, annual equivalent, …). */
  priceNote?: string;
};

/** Column order for the table; PrivaCV first. */
export const COMPARATORS: Comparator[] = [
  { name: "PrivaCV", isUs: true, price: "Free", priceNote: "No account · no trial · no watermark" },
  {
    name: "Zety",
    price: "$25.95 / 4 wks",
    priceNote: "$1.95 14-day trial, then auto-renews (~$71/yr annual)",
  },
  { name: "Resume.io", price: "$29.95 / 4 wks", priceNote: "$2.95 7-day trial (~$75/yr annual)" },
  { name: "Teal", price: "$29 / mo", priceNote: "Generous free tier; Teal+ from ~$9/wk" },
  { name: "Rezi", price: "$29 / mo", priceNote: "Free tier; $149 one-time lifetime" },
  { name: "Canva", price: "$15 / mo", priceNote: "Free tier; Pro for premium content" },
];

/**
 * A cell is a checkmark (`true`), an X (`false`), a qualified "Limited"
 * (`"partial"`), or free-text. Values are aligned to {@link COMPARATORS} order.
 */
export type Cell = boolean | "partial" | string;

export type FeatureRow = {
  label: string;
  /** Optional clarifying sub-label shown under the feature name. */
  hint?: string;
  values: Cell[];
};

/**
 * Rows deliberately include ones PrivaCV does NOT win (templates, job tracking) —
 * an honest table reads as a real comparison, not a marketing sheet.
 */
export const FEATURE_ROWS: FeatureRow[] = [
  {
    label: "Free to download a usable file",
    hint: "Export without paying or hitting a paywall",
    // Zety free exports .txt only; Resume.io free is one template; Rezi free caps PDFs at 3.
    values: [true, false, "partial", true, "partial", true],
  },
  {
    label: "No account or sign-up required",
    values: [true, false, false, false, false, false],
  },
  {
    label: "Your resume stays on your device",
    hint: "Not uploaded to a resume database",
    values: [true, false, false, false, false, false],
  },
  {
    label: "AI writing assistance",
    values: [true, true, true, true, true, "partial"],
  },
  {
    label: "AI runs locally (nothing sent to a server)",
    values: [true, false, false, false, false, false],
  },
  {
    label: "PDF export",
    values: [true, "paid", true, true, "partial", true],
  },
  {
    label: "Editable Word (DOCX) export",
    values: [true, "paid", "paid", "paid", true, "paid"],
  },
  {
    label: "Plain-text & Markdown export",
    values: [true, "partial", false, false, false, false],
  },
  {
    label: "JSON backup you own",
    hint: "Take your data with you — no lock-in",
    values: [true, false, false, false, false, false],
  },
  {
    label: "ATS-friendly output",
    values: [true, true, true, true, true, "partial"],
  },
  {
    label: "Template & design variety",
    values: ["partial", true, true, "partial", true, true],
  },
  {
    label: "Job tracking & application tools",
    values: [false, false, false, true, "partial", false],
  },
];
