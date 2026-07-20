import { z } from "zod";
import {
  hasBlockTags,
  inlineHtmlToMarkdown,
  parseRichContent,
  stripRichMarks,
} from "@/lib/rich-text";

export const SECTION_KEYS = ["education", "experience", "projects", "skills"] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  education: "Education",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
};

/**
 * Common, ATS-readable headings for career details that do not belong in the
 * core resume sections. Custom headings remain available for everything else.
 */
export const CUSTOM_SECTION_PRESETS = [
  "Leadership & Activities",
  "Research Experience",
  "Relevant Coursework",
  "Licenses & Certifications",
  "Professional Affiliations",
  "Volunteer Experience",
  "Publications & Presentations",
  "Awards & Honors",
  "Languages",
  "Training & Professional Development",
] as const;

export const RESUME_TEMPLATES = [
  {
    id: "classic",
    label: "Classic",
    description: "Traditional serif type, left-aligned header, and ruled sections.",
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Airy sans-serif type with plain headings and clean dash bullets.",
  },
  {
    id: "modern",
    label: "Modern",
    description: "Centered header, navy accent bars, and contemporary sans-serif type.",
  },
  {
    id: "compact",
    label: "Compact",
    description: "Dense Carlito layout with underlined headings for longer resumes.",
  },
  {
    id: "executive",
    label: "Executive",
    description: "Centered Gelasio header with refined burgundy rules.",
  },
  {
    id: "technical",
    label: "Technical",
    description: "Tight Arimo layout with teal dividers and scannable sections.",
  },
] as const;

export type ResumeTemplateId = (typeof RESUME_TEMPLATES)[number]["id"];

/**
 * Curated, professional typefaces. Each maps to a browser font stack for the
 * live preview/PDF and a Word-safe family for the .docx export. No decorative
 * or novelty faces — every option reads cleanly and stays ATS-friendly.
 */
export const RESUME_FONTS = [
  {
    id: "merriweather",
    label: "Merriweather",
    kind: "Serif",
    stack: "var(--font-serif), Georgia, 'Times New Roman', serif",
    docx: "Georgia",
  },
  {
    id: "georgia",
    label: "Gelasio",
    kind: "Serif",
    stack: "var(--font-gelasio), Georgia, 'Times New Roman', serif",
    docx: "Georgia",
  },
  {
    id: "times",
    label: "Tinos",
    kind: "Serif",
    stack: "var(--font-tinos), 'Times New Roman', Times, serif",
    docx: "Times New Roman",
  },
  {
    id: "inter",
    label: "Inter",
    kind: "Sans",
    stack: "var(--font-sans), Arial, sans-serif",
    docx: "Calibri",
  },
  {
    id: "arial",
    label: "Arimo",
    kind: "Sans",
    stack: "var(--font-arimo), Arial, Helvetica, sans-serif",
    docx: "Arial",
  },
  {
    id: "calibri",
    label: "Carlito",
    kind: "Sans",
    stack: "var(--font-carlito), Calibri, 'Segoe UI', Arial, sans-serif",
    docx: "Calibri",
  },
] as const;

export type ResumeFontId = (typeof RESUME_FONTS)[number]["id"];

/** Professional accent presets; users can also enter a custom hex. */
export const ACCENT_PRESETS = [
  { id: "ink", label: "Ink", value: "#111827" },
  { id: "navy", label: "Navy", value: "#1f3a5f" },
  { id: "slate", label: "Slate", value: "#334155" },
  { id: "burgundy", label: "Burgundy", value: "#7f1d3a" },
  { id: "forest", label: "Forest", value: "#14532d" },
  { id: "teal", label: "Teal", value: "#0f5f5c" },
] as const;

export const HEADING_STYLES = ["ruled", "underline", "plain", "bar"] as const;
export type HeadingStyle = (typeof HEADING_STYLES)[number];
export const HEADING_STYLE_LABELS: Record<HeadingStyle, string> = {
  ruled: "Ruled",
  underline: "Underline",
  plain: "Plain",
  bar: "Accent bar",
};

export const HEADER_ALIGNS = ["left", "center"] as const;
export type HeaderAlign = (typeof HEADER_ALIGNS)[number];

export const DENSITIES = ["comfortable", "cozy", "compact"] as const;
export type Density = (typeof DENSITIES)[number];
export const DENSITY_LABELS: Record<Density, string> = {
  comfortable: "Comfortable",
  cozy: "Cozy",
  compact: "Compact",
};

export const BULLET_STYLES = ["disc", "circle", "dash"] as const;
export type BulletStyle = (typeof BULLET_STYLES)[number];
export const BULLET_STYLE_LABELS: Record<BulletStyle, string> = {
  disc: "Bullet",
  circle: "Circle",
  dash: "Dash",
};
/** Literal marker for export paths that can't use CSS list markers (DOCX). */
export const BULLET_STYLE_MARKERS: Record<BulletStyle, string> = {
  disc: "•",
  circle: "◦",
  dash: "–",
};

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const themeSchema = z.object({
  font: z.string().catch("merriweather"),
  accent: z.string().catch("#111827"),
  headerAlign: z.enum(HEADER_ALIGNS).catch("left"),
  headerDivider: z.boolean().catch(false),
  headingStyle: z.enum(HEADING_STYLES).catch("ruled"),
  density: z.enum(DENSITIES).catch("comfortable"),
  bulletStyle: z.enum(BULLET_STYLES).catch("disc"),
});

export type ResumeTheme = z.infer<typeof themeSchema>;

/** Each template preset is simply a professional starting point for the theme. */
export const TEMPLATE_THEMES: Record<ResumeTemplateId, ResumeTheme> = {
  classic: {
    font: "merriweather",
    accent: "#111827",
    headerAlign: "left",
    headerDivider: false,
    headingStyle: "ruled",
    density: "comfortable",
    bulletStyle: "disc",
  },
  minimal: {
    font: "inter",
    accent: "#334155",
    headerAlign: "left",
    headerDivider: false,
    headingStyle: "plain",
    density: "comfortable",
    bulletStyle: "dash",
  },
  modern: {
    font: "inter",
    accent: "#1f3a5f",
    headerAlign: "center",
    headerDivider: true,
    headingStyle: "bar",
    density: "cozy",
    bulletStyle: "circle",
  },
  compact: {
    font: "calibri",
    accent: "#111827",
    headerAlign: "left",
    headerDivider: true,
    headingStyle: "underline",
    density: "compact",
    bulletStyle: "dash",
  },
  executive: {
    font: "georgia",
    accent: "#7f1d3a",
    headerAlign: "center",
    headerDivider: true,
    headingStyle: "ruled",
    density: "comfortable",
    bulletStyle: "circle",
  },
  technical: {
    font: "arial",
    accent: "#0f5f5c",
    headerAlign: "left",
    headerDivider: true,
    headingStyle: "underline",
    density: "cozy",
    bulletStyle: "disc",
  },
};

export function defaultTheme(): ResumeTheme {
  return { ...TEMPLATE_THEMES.classic };
}

export function resolveFontStack(fontId: string): string {
  return RESUME_FONTS.find((font) => font.id === fontId)?.stack ?? RESUME_FONTS[0].stack;
}

export function resolveDocxFont(fontId: string): string {
  return RESUME_FONTS.find((font) => font.id === fontId)?.docx ?? RESUME_FONTS[0].docx;
}

/** Normalizes a user-entered accent to a safe hex, falling back to Ink. */
export function normalizeAccent(value: string): string {
  const trimmed = value.trim();
  return HEX_COLOR.test(trimmed) ? trimmed : "#111827";
}

export type SectionId = SectionKey | `custom-${string}`;

export const SECTION_FORMATS = ["entries", "tag-groups", "text"] as const;
export type SectionFormat = (typeof SECTION_FORMATS)[number];
export const SECTION_FORMAT_LABELS: Record<SectionFormat, string> = {
  entries: "Structured entries",
  "tag-groups": "Grouped tags",
  text: "Free text",
};

/** A useful starting layout for each common optional section. */
export const CUSTOM_SECTION_PRESET_FORMATS: Record<
  (typeof CUSTOM_SECTION_PRESETS)[number],
  SectionFormat
> = {
  "Leadership & Activities": "entries",
  "Research Experience": "entries",
  "Relevant Coursework": "tag-groups",
  "Licenses & Certifications": "entries",
  "Professional Affiliations": "entries",
  "Volunteer Experience": "entries",
  "Publications & Presentations": "entries",
  "Awards & Honors": "entries",
  Languages: "entries",
  "Training & Professional Development": "entries",
};

export const sectionTitlesSchema = z.object({
  education: z.string().catch(SECTION_LABELS.education),
  experience: z.string().catch(SECTION_LABELS.experience),
  projects: z.string().catch(SECTION_LABELS.projects),
  skills: z.string().catch(SECTION_LABELS.skills),
});

export const entrySchema = z.object({
  title: z.string().catch(""),
  subtitle: z.string().catch(""),
  meta: z.string().catch(""),
  details: z.string().catch(""),
});

export type ResumeEntry = z.infer<typeof entrySchema>;

export type EntryTextField = "title" | "subtitle" | "meta" | "details";
export type EntryFieldSchema = Record<EntryTextField, string>;

const DEFAULT_ENTRY_FIELD_SCHEMA: EntryFieldSchema = {
  title: "Title",
  subtitle: "Organization / context",
  meta: "Dates / details",
  details: "Highlights",
};

/**
 * Keeps the portable four-field entry shape while giving familiar sections
 * purpose-specific prompts. Title matching intentionally accepts common
 * heading variants so imported and user-renamed sections remain useful.
 */
export function entryFieldSchema(section: string, sectionTitle = ""): EntryFieldSchema {
  if (section === "experience")
    return {
      title: "Job Title",
      subtitle: "Company",
      meta: "Dates (e.g. Jan 2020 - Present)",
      details: "Responsibilities / achievements (one bullet per line)",
    };
  if (section === "education")
    return {
      title: "Degree",
      subtitle: "School",
      meta: "Dates / Location",
      details: "Honors / relevant coursework / details (one per line, optional)",
    };
  if (section === "projects")
    return {
      title: "Project Name",
      subtitle: "Technologies / Role",
      meta: "Dates / Link",
      details: "Description (one bullet per line)",
    };

  const title = sectionTitle.trim().toLocaleLowerCase();
  if (/\b(certifications?|licenses?|credentials?)\b/.test(title))
    return {
      title: "License / certification",
      subtitle: "Issuing organization",
      meta: "Earned / expiration dates",
      details: "Credential ID / verification link / details (optional)",
    };
  if (/\b(publications?|presentations?|conferences?|posters?)\b/.test(title))
    return {
      title: "Publication / presentation title",
      subtitle: "Venue / type",
      meta: "Date / DOI / link",
      details: "Authors / citation details (optional)",
    };
  if (/\b(awards?|honou?rs?|achievements?|accolades)\b/.test(title))
    return {
      title: "Award / honor",
      subtitle: "Issuing organization",
      meta: "Date",
      details: "Context / distinction (optional)",
    };
  if (/\blanguages?\b/.test(title))
    return {
      title: "Language",
      subtitle: "Proficiency",
      meta: "Certification / context (optional)",
      details: "Additional details (optional)",
    };
  if (/\b(research|laboratory|lab experience)\b/.test(title))
    return {
      title: "Research role / topic",
      subtitle: "Lab / institution",
      meta: "Dates / location",
      details: "Methods / findings / impact (one bullet per line)",
    };
  if (/\b(leadership|activities|involvement)\b/.test(title))
    return {
      title: "Role",
      subtitle: "Organization",
      meta: "Dates / location",
      details: "Leadership impact (one bullet per line)",
    };
  if (/\b(volunteer|community|service)\b/.test(title))
    return {
      title: "Role",
      subtitle: "Organization",
      meta: "Dates / location",
      details: "Contributions / impact (one bullet per line)",
    };
  if (/\b(affiliations?|memberships?|associations?)\b/.test(title))
    return {
      title: "Organization",
      subtitle: "Membership / role",
      meta: "Dates",
      details: "Details (optional)",
    };
  if (/\b(training|professional development|courses?)\b/.test(title))
    return {
      title: "Course / program",
      subtitle: "Provider",
      meta: "Completion date / credential",
      details: "Details (optional)",
    };
  if (/\bcoursework\b/.test(title))
    return {
      title: "Course / subject",
      subtitle: "Institution",
      meta: "Term / date",
      details: "Details (optional)",
    };
  return DEFAULT_ENTRY_FIELD_SCHEMA;
}

export const tagGroupSchema = z.object({
  id: z.string().catch(""),
  label: z.string().catch(""),
  tags: z.array(z.string()).catch([]),
});
export type TagGroup = z.infer<typeof tagGroupSchema>;

export const customSectionSchema = z.object({
  id: z.string(),
  title: z.string().catch("Custom Section"),
  entries: z.array(entrySchema).catch([]),
});

export type CustomSection = z.infer<typeof customSectionSchema>;

export const HEADER_LINK_ICON_OPTIONS = [
  { id: "website", label: "Website" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "github", label: "GitHub" },
  { id: "gitlab", label: "GitLab" },
  { id: "twitter", label: "Twitter / X" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "dribbble", label: "Dribbble" },
  { id: "figma", label: "Figma" },
  { id: "portfolio", label: "Portfolio / work" },
  { id: "blog", label: "Blog / writing" },
  { id: "calendar", label: "Calendar / scheduling" },
  { id: "code", label: "Code profile" },
  { id: "link", label: "Generic link" },
] as const;

export type HeaderLinkIconId = (typeof HEADER_LINK_ICON_OPTIONS)[number]["id"];

export function inferHeaderLinkIcon(value: string): HeaderLinkIconId {
  const clean = value.toLocaleLowerCase();
  if (clean.includes("linkedin")) return "linkedin";
  if (clean.includes("github")) return "github";
  if (clean.includes("gitlab")) return "gitlab";
  if (/twitter\.com|x\.com/.test(clean)) return "twitter";
  if (clean.includes("instagram")) return "instagram";
  if (clean.includes("youtube")) return "youtube";
  if (clean.includes("dribbble")) return "dribbble";
  if (clean.includes("figma.com")) return "figma";
  if (/behance|portfolio/.test(clean)) return "portfolio";
  if (/medium\.com|substack\.com/.test(clean)) return "blog";
  if (/calendly|cal\.com/.test(clean)) return "calendar";
  if (/codepen|codesandbox|stackoverflow|dev\.to/.test(clean)) return "code";
  return "website";
}

const explicitHeaderLinkSchema = z.object({
  id: z.string().catch(""),
  label: z.string().catch(""),
  url: z.string().catch(""),
  icon: z
    .enum(
      HEADER_LINK_ICON_OPTIONS.map((option) => option.id) as [
        HeaderLinkIconId,
        ...HeaderLinkIconId[],
      ],
    )
    .catch("website"),
});

/** Converts legacy/missing automatic icons into a durable inferred choice. */
export const headerLinkSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const candidate = value as Record<string, unknown>;
  const iconIsExplicit = HEADER_LINK_ICON_OPTIONS.some((option) => option.id === candidate.icon);
  if (iconIsExplicit) return candidate;
  return {
    ...candidate,
    icon: inferHeaderLinkIcon(
      `${typeof candidate.label === "string" ? candidate.label : ""} ${typeof candidate.url === "string" ? candidate.url : ""}`,
    ),
  };
}, explicitHeaderLinkSchema);

export type HeaderLink = z.infer<typeof headerLinkSchema>;

export const resumeSchema = z.object({
  name: z.string().catch(""),
  title: z.string().catch(""),
  email: z.string().catch(""),
  phone: z.string().catch(""),
  location: z.string().catch(""),
  /** Legacy first-link alias retained for portable JSON compatibility. */
  website: z.string().catch(""),
  headerLinks: z.array(headerLinkSchema).catch([]),
  summary: z.string().catch(""),
  skills: z.string().catch(""),
  skillEntries: z.array(entrySchema).catch([]),
  experience: z.array(entrySchema).catch([]),
  education: z.array(entrySchema).catch([]),
  projects: z.array(entrySchema).catch([]),
  sectionTitles: sectionTitlesSchema.catch({ ...SECTION_LABELS }),
  customSections: z.array(customSectionSchema).catch([]),
  sectionFormats: z.record(z.string(), z.enum(SECTION_FORMATS)).catch({}),
  sectionTagGroups: z.record(z.string(), z.array(tagGroupSchema)).catch({}),
  sectionText: z.record(z.string(), z.string()).catch({}),
  sectionOrder: z.array(z.string()).catch([...SECTION_KEYS]),
  // Sections the person has hidden from the resume output. They stay in the
  // editor (and keep their content) but are excluded from the preview and every
  // export until shown again.
  hiddenSections: z.array(z.string()).catch([]),
  template: z
    .enum(["classic", "minimal", "modern", "compact", "executive", "technical"])
    .catch("classic"),
  theme: themeSchema.catch(() => defaultTheme()),
  textScale: z.number().catch(1),
});

export type ResumeState = z.infer<typeof resumeSchema>;

export type ResumeCheck = {
  id: "length" | "contact" | "bullets" | "evidence" | "summary";
  label: string;
  ok: boolean;
  /** A useful prompt that should never hold up a confident export. */
  advisory?: boolean;
  detail: string;
  guidance: string;
  actionLabel: string;
  targetId: string;
};

type ContactField = "name" | "email" | "phone" | "location" | `header-link-${string}-url`;

export type ContactFieldIssue = {
  field: ContactField;
  label: string;
  detail: string;
};

export type EvidenceSummary = {
  bulletCount: number;
  measuredCount: number;
  unmeasuredIndexes: number[];
};

export type BulletOpeningSummary = {
  bulletCount: number;
  vagueOpeningIndexes: number[];
};

export type ExportChange = {
  id: string;
  label: string;
  detail: string;
  targetId: string;
  before?: string;
  after?: string;
  fieldLabels?: string[];
};

/** A small, portal-friendly piece of resume content that can be copied alone. */
export type ApplicationCopyField = {
  id: string;
  label: string;
  text: string;
};

/** Related application-form fields, kept in the same order as the resume. */
export type ApplicationCopyGroup = {
  id: string;
  label: string;
  detail?: string;
  fields: ApplicationCopyField[];
};

export const MIN_TEXT_SCALE = 0.8;
export const MAX_TEXT_SCALE = 1.3;

export function blankEntry(): ResumeEntry {
  return { title: "", subtitle: "", meta: "", details: "" };
}

export function emptyState(): ResumeState {
  return {
    name: "",
    title: "",
    email: "",
    phone: "",
    location: "",
    website: "",
    headerLinks: [],
    summary: "",
    skills: "",
    skillEntries: [],
    experience: [blankEntry()],
    education: [blankEntry()],
    projects: [],
    sectionTitles: { ...SECTION_LABELS },
    customSections: [],
    sectionFormats: { skills: "tag-groups" },
    sectionTagGroups: { skills: [] },
    sectionText: {},
    sectionOrder: [...SECTION_KEYS],
    hiddenSections: [],
    template: "classic",
    theme: defaultTheme(),
    textScale: 1,
  };
}

export function normalizeResume(data: unknown): ResumeState {
  const parsed = resumeSchema.catch(emptyState()).parse(data);
  const headerLinks = normalizeHeaderLinks(
    parsed.headerLinks.length
      ? parsed.headerLinks
      : parsed.website.trim()
        ? [
            {
              id: "header-link-1",
              label: inferHeaderLinkLabel(parsed.website),
              url: parsed.website,
              icon: inferHeaderLinkIcon(parsed.website),
            },
          ]
        : [],
  );
  const customSections = parsed.customSections
    .filter(
      (section, index, all) =>
        section.id.startsWith("custom-") &&
        all.findIndex((candidate) => candidate.id === section.id) === index,
    )
    .map((section) => ({
      ...section,
      title: section.title.trim(),
      entries: section.entries.map((entry) => ({ ...blankEntry(), ...entry })),
    }));
  const validSectionIds = new Set<string>([
    ...SECTION_KEYS,
    ...customSections.map((section) => section.id),
  ]);
  const order = parsed.sectionOrder.filter(
    (key, index, all) => validSectionIds.has(key) && all.indexOf(key) === index,
  );

  // A missing built-in section is intentional: users can remove any default
  // section and add it back from the editor when it becomes relevant again.
  customSections.forEach(({ id }) => {
    if (!order.includes(id)) order.push(id);
  });

  // Drop hidden ids that no longer map to a section in the order.
  const hiddenSections = parsed.hiddenSections.filter(
    (id, index, all) => order.includes(id) && all.indexOf(id) === index,
  );
  const sectionFormats = Object.fromEntries(
    order.map((id) => [
      id,
      parsed.sectionFormats[id] ?? (id === "skills" ? "tag-groups" : "entries"),
    ]),
  ) as Record<string, SectionFormat>;
  // Skills used to be stored as one line per group (for example,
  // "Languages: TypeScript, Go"). Convert that durable text into editable
  // groups the first time an older draft is opened.
  const legacySkillGroups = parseTagGroups(parsed.skills, "skills");
  const storedSkillGroups = normalizeTagGroups(parsed.sectionTagGroups.skills ?? [], "skills");
  // `skills` remains part of the portable JSON format. If another tool edits
  // that text directly, prefer its new value over stale structured groups.
  const shouldMigrateSkills =
    Boolean(parsed.skills.trim()) &&
    (!storedSkillGroups.length ||
      tagGroupsToText(storedSkillGroups).trim() !== parsed.skills.trim());
  const sectionTagGroups = Object.fromEntries(
    order.map((id) => [
      id,
      normalizeTagGroups(
        id === "skills" && shouldMigrateSkills
          ? legacySkillGroups
          : parsed.sectionTagGroups[id]?.length
            ? parsed.sectionTagGroups[id]
            : [],
        id,
      ),
    ]),
  ) as Record<string, TagGroup[]>;
  const sectionText = Object.fromEntries(
    order.map((id) => [id, parsed.sectionText[id]?.trim() ?? ""]),
  ) as Record<string, string>;
  const skills = tagGroupsToText(sectionTagGroups.skills ?? legacySkillGroups);

  // Resumes saved before the theme editor existed only carry `template`; map
  // that to the matching preset so they keep looking the way they did.
  const hasStoredTheme = Boolean(
    data && typeof data === "object" && "theme" in (data as Record<string, unknown>),
  );
  const baseTheme = hasStoredTheme ? parsed.theme : TEMPLATE_THEMES[parsed.template];
  const theme: ResumeTheme = {
    ...baseTheme,
    accent: normalizeAccent(baseTheme.accent),
    font: RESUME_FONTS.some((font) => font.id === baseTheme.font)
      ? baseTheme.font
      : TEMPLATE_THEMES[parsed.template].font,
  };

  return {
    ...emptyState(),
    ...parsed,
    // Keep the legacy scalar in sync so older JSON consumers still receive a
    // useful first website while the app uses the repeatable collection.
    website: headerLinks[0]?.url ?? "",
    headerLinks,
    skillEntries: parsed.skillEntries.map((entry) => ({ ...blankEntry(), ...entry })),
    experience: parsed.experience.map((entry) => ({ ...blankEntry(), ...entry })),
    education: parsed.education.map((entry) => ({ ...blankEntry(), ...entry })),
    projects: parsed.projects.map((entry) => ({ ...blankEntry(), ...entry })),
    sectionTitles: { ...SECTION_LABELS, ...parsed.sectionTitles },
    customSections,
    sectionFormats,
    sectionTagGroups,
    sectionText,
    skills,
    sectionOrder: order,
    hiddenSections,
    theme,
    textScale: clampTextScale(parsed.textScale),
  };
}

function headerLinkId(index: number) {
  return `header-link-${index + 1}`;
}

export function inferHeaderLinkLabel(value: string) {
  const clean = value.trim().toLocaleLowerCase();
  if (clean.includes("linkedin.com")) return "LinkedIn";
  if (clean.includes("github.com")) return "GitHub";
  if (clean.includes("gitlab.com")) return "GitLab";
  if (clean.includes("behance.net")) return "Behance";
  if (clean.includes("dribbble.com")) return "Dribbble";
  return "Website";
}

export function resolveHeaderLinkIcon(
  link: Pick<HeaderLink, "icon" | "label" | "url">,
): HeaderLinkIconId {
  return link.icon;
}

export function normalizeHeaderLinks(links: HeaderLink[], keepEmpty = false) {
  const usedIds = new Set<string>();
  return links
    .map((link, index) => {
      const baseId = link.id.trim() || headerLinkId(index);
      let id = baseId;
      let suffix = 2;
      while (usedIds.has(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      usedIds.add(id);
      const url = link.url.trim();
      return {
        id,
        label: link.label.trim() || (url ? inferHeaderLinkLabel(url) : ""),
        url,
        icon: link.icon,
      };
    })
    .filter((link) => keepEmpty || link.label || link.url);
}

/** Repeatable header links, with a fallback for pre-migration in-memory data. */
export function resumeHeaderLinks(state: ResumeState) {
  if (state.headerLinks.length) return state.headerLinks.filter((link) => link.label || link.url);
  return state.website.trim()
    ? [
        {
          id: "header-link-1",
          label: inferHeaderLinkLabel(state.website),
          url: state.website.trim(),
          icon: inferHeaderLinkIcon(state.website),
        },
      ]
    : [];
}

function tagGroupId(section: string, index: number) {
  return `${section}-group-${index + 1}`;
}

export function normalizeTagGroups(groups: TagGroup[], section = "section", keepEmpty = false) {
  return groups
    .map((group, index) => ({
      id: group.id.trim() || tagGroupId(section, index),
      label: group.label.trim(),
      tags: [...new Set(group.tags.map((tag) => tag.trim()).filter(Boolean))],
    }))
    .filter((group) => keepEmpty || group.label || group.tags.length);
}

export function parseTagGroups(value: string, section = "section") {
  return normalizeTagGroups(
    value.split("\n").map((line, index) => {
      const clean = line.trim();
      if (!clean) return { id: "", label: "", tags: [] };
      const separator = clean.indexOf(":");
      const label = separator >= 0 ? clean.slice(0, separator).trim() : "";
      const tagText = separator >= 0 ? clean.slice(separator + 1) : clean;
      return { id: tagGroupId(section, index), label, tags: tagText.split(",") };
    }),
    section,
  );
}

export function tagGroupsToText(groups: TagGroup[]) {
  return groups
    .map((group) =>
      [
        group.label.trim(),
        group.tags
          .map((tag) => tag.trim())
          .filter(Boolean)
          .join(", "),
      ]
        .filter(Boolean)
        .join(": "),
    )
    .filter(Boolean)
    .join("\n");
}

export function isBuiltinSection(section: string): section is SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(section);
}

export function getSectionTitle(state: ResumeState, section: string) {
  if (isBuiltinSection(section)) return state.sectionTitles[section];
  return (
    state.customSections.find((candidate) => candidate.id === section)?.title ?? "Custom Section"
  );
}

export function getSectionEntries(state: ResumeState, section: string): ResumeEntry[] {
  if (section === "experience") return state.experience;
  if (section === "education") return state.education;
  if (section === "projects") return state.projects;
  if (section === "skills") return state.skillEntries;
  return state.customSections.find((candidate) => candidate.id === section)?.entries ?? [];
}

export function getSectionFormat(state: ResumeState, section: string): SectionFormat {
  return state.sectionFormats[section] ?? (section === "skills" ? "tag-groups" : "entries");
}

export function getSectionTagGroups(state: ResumeState, section: string) {
  return state.sectionTagGroups[section] ?? [];
}

export function getSectionText(state: ResumeState, section: string) {
  return state.sectionText[section] ?? "";
}

export function isSectionHidden(state: ResumeState, section: string) {
  return state.hiddenSections.includes(section);
}

/** Section ids in order, minus any the person has hidden from the resume. */
export function visibleSectionOrder(state: ResumeState) {
  return state.sectionOrder.filter((section) => !isSectionHidden(state, section));
}

/** How many items a section holds — entry cards, or skill lines for Skills. */
export function sectionItemCount(state: ResumeState, section: string) {
  const format = getSectionFormat(state, section);
  if (format === "tag-groups")
    return getSectionTagGroups(state, section).reduce(
      (count, group) => count + group.tags.length,
      0,
    );
  if (format === "text") {
    return parseRichContent(getSectionText(state, section), "bullets").length;
  }
  return getSectionEntries(state, section).length;
}

export function clampTextScale(value: number) {
  if (Number.isNaN(value)) return 1;
  return Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, value));
}

export function bulletsFrom(details: string) {
  if (hasBlockTags(details)) {
    return parseRichContent(details)
      .map((block) => stripRichMarks(block.html).replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }
  return details
    .split("\n")
    .map((line) => stripRichMarks(line).trim())
    .filter(Boolean);
}

export function paragraphsFrom(details: string) {
  if (hasBlockTags(details)) {
    return parseRichContent(details)
      .map((block) => stripRichMarks(block.html).replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }
  return details
    .split(/\n\s*\n/)
    .map((paragraph) => stripRichMarks(paragraph).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * Plain-text lines for one rich field, one per block, list items prefixed with
 * `mark`. Used by plain-text export and portal copy. Honors mixed block types.
 */
function contentPlainLines(value: string, legacyFormat?: string, mark = "- ") {
  return parseRichContent(value, legacyFormat)
    .map((block) => {
      const text = stripRichMarks(block.html).replace(/\s+/g, " ").trim();
      if (!text) return "";
      return block.type === "paragraph" ? text : `${mark}${text}`;
    })
    .filter(Boolean);
}

/** Markdown for one rich field: `- `/`1. ` list items, blank-line-separated paragraphs. */
function contentMarkdown(value: string, legacyFormat?: string) {
  const blocks = parseRichContent(value, legacyFormat);
  const lines = blocks.map((block) => {
    const md = inlineHtmlToMarkdown(block.html);
    if (block.type === "bullet") return { list: true, md: `- ${md}` };
    if (block.type === "number") return { list: true, md: `1. ${md}` };
    return { list: false, md };
  });
  return lines.reduce((out, line, index) => {
    if (index === 0) return line.md;
    const separator = line.list && lines[index - 1].list ? "\n" : "\n\n";
    return `${out}${separator}${line.md}`;
  }, "");
}

/** Returns the list items (bullets/numbers) of an entry — its concise lines. */
export function includedBulletsFrom(entry: ResumeEntry) {
  if (hasBlockTags(entry.details)) {
    return parseRichContent(entry.details)
      .filter((block) => block.type !== "paragraph")
      .map((block) => stripRichMarks(block.html).replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }
  return bulletsFrom(entry.details);
}

export function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function hasAnyContent(state: ResumeState) {
  if (
    state.name ||
    state.title ||
    state.summary ||
    state.skills ||
    Object.values(state.sectionText).some(Boolean)
  )
    return true;
  if (
    Object.values(state.sectionTagGroups).some((groups) =>
      groups.some((group) => group.label || group.tags.length),
    )
  )
    return true;
  if (
    state.email ||
    state.phone ||
    state.location ||
    resumeHeaderLinks(state).some((link) => link.url)
  )
    return true;
  if (state.skillEntries.some(entryHasContent)) return true;
  if (state.customSections.some((section) => section.entries.some(entryHasContent))) return true;
  return ["experience", "education", "projects"].some((section) =>
    state[section as "experience" | "education" | "projects"].some(
      (entry) => entry.title || entry.subtitle || entry.meta || entry.details,
    ),
  );
}

export function entryHasContent(entry: ResumeEntry) {
  return Boolean(entry.title || entry.subtitle || entry.meta || entry.details);
}

export function allBullets(state: ResumeState) {
  // Iterate visible sections so hidden sections don't count toward resume checks
  // (length, bullet length) — they aren't in the exported resume.
  return visibleSectionOrder(state).flatMap((section) => {
    const format = getSectionFormat(state, section);
    if (format === "text") return bulletsFrom(getSectionText(state, section));
    if (format !== "entries") return [];
    return getSectionEntries(state, section).flatMap((entry) => includedBulletsFrom(entry));
  });
}

export function hasMeasuredEvidence(bullet: string) {
  return /(?:[$€£]\s?\d[\d,.]*(?:[kmb])?|\b\d[\d,.]*(?:%|\+|x\b|[kmb]\b)|\b\d[\d,.]*\s+(?:users?|customers?|clients?|teams?|engineers?|people|projects?|releases?|hours?|days?|weeks?|months?|years?|requests?|transactions?|applications?|companies|locations|markets|reports?|experiments?|campaigns?)\b)/i.test(
    bullet,
  );
}

function isPlausibleEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPlausiblePhone(value: string) {
  // Keep international and extension formats flexible, while catching an
  // accidental partial number before it reaches a finished PDF.
  return (value.match(/\d/g) ?? []).length >= 7;
}

function isPlausibleWebsite(value: string) {
  if (/\s/.test(value)) return false;

  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    return Boolean(url.hostname) && url.hostname.includes(".");
  } catch {
    return false;
  }
}

/**
 * A deliberately light contact review. It checks only the obvious copy/paste
 * mistakes that make a resume impossible to follow up on, without imposing a
 * country-specific phone format or requiring a personal website.
 */
export function contactFieldIssues(state: ResumeState): ContactFieldIssue[] {
  const required: Array<["name" | "email" | "phone" | "location", string]> = [
    ["name", "name"],
    ["email", "email"],
    ["phone", "phone"],
    ["location", "location"],
  ];
  const missing = required
    .filter(([field]) => !state[field].trim())
    .map(([field, label]) => ({ field, label, detail: `Missing ${label}` }));
  const invalid: ContactFieldIssue[] = [];

  if (state.email.trim() && !isPlausibleEmail(state.email.trim())) {
    invalid.push({ field: "email", label: "email", detail: "Invalid email" });
  }
  if (state.phone.trim() && !isPlausiblePhone(state.phone.trim())) {
    invalid.push({ field: "phone", label: "phone", detail: "Invalid phone" });
  }
  resumeHeaderLinks(state).forEach((link) => {
    if (!link.url.trim() || isPlausibleWebsite(link.url.trim())) return;
    const label = link.label.trim() || "website";
    invalid.push({
      field: `header-link-${link.id}-url`,
      label,
      detail: `Invalid ${label.toLocaleLowerCase()} link`,
    });
  });

  return [...missing, ...invalid];
}

/**
 * Builds a browser- and PDF-safe contact link for values that have already
 * passed the same light validation used by Resume Check. Invalid values stay
 * as visible text instead of becoming misleading or unsafe links.
 */
export function contactHref(field: "email" | "phone" | "website", value: string) {
  const cleanValue = value.trim();
  if (!cleanValue) return undefined;

  if (field === "email") return isPlausibleEmail(cleanValue) ? `mailto:${cleanValue}` : undefined;
  if (field === "phone") return isPlausiblePhone(cleanValue) ? `tel:${cleanValue}` : undefined;

  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(cleanValue) ? cleanValue : `https://${cleanValue}`,
    );
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Gives the editor a small, transparent evidence cue for one experience or
 * project entry. It deliberately recognizes scope as well as numeric outcomes
 * so users can decide which bullets can truthfully be made more specific.
 */
export function summarizeEvidence(details: string): EvidenceSummary {
  const bullets = bulletsFrom(details);
  const unmeasuredIndexes = bullets
    .map((bullet, index) => (hasMeasuredEvidence(bullet) ? -1 : index))
    .filter((index) => index >= 0);

  return {
    bulletCount: bullets.length,
    measuredCount: bullets.length - unmeasuredIndexes.length,
    unmeasuredIndexes,
  };
}

const VAGUE_BULLET_OPENINGS = [
  /^responsib(?:le|ilities)\s+(?:for|included)\b/i,
  /^worked\s+on\b/i,
  /^helped\s+(?:with|to)\b/i,
  /^assisted\s+(?:with|in)\b/i,
  /^participated\s+in\b/i,
  /^tasked\s+with\b/i,
  /^duties\s+included\b/i,
  /^was\s+responsible\s+for\b/i,
];

/**
 * Finds a deliberately small set of generic openings that can obscure the
 * contribution in an otherwise truthful bullet. This is a prompt to clarify
 * wording, never a claim that the described work is weak or inaccurate.
 */
export function summarizeBulletOpenings(details: string): BulletOpeningSummary {
  const bullets = bulletsFrom(details);

  return {
    bulletCount: bullets.length,
    vagueOpeningIndexes: bullets
      .map((bullet, index) =>
        VAGUE_BULLET_OPENINGS.some((pattern) => pattern.test(bullet.trim())) ? index : -1,
      )
      .filter((index) => index >= 0),
  };
}

function evidenceBullets(state: ResumeState) {
  return (["experience", "projects"] as const)
    .filter((section) => !isSectionHidden(state, section))
    .flatMap((section) =>
      state[section].flatMap((entry, index) =>
        bulletsFrom(entry.details).map((bullet) => ({ section, index, bullet })),
      ),
    );
}

export function buildResumeChecks(state: ResumeState, pageCount: number): ResumeCheck[] {
  const contactIssues = contactFieldIssues(state);
  const missingContact = contactIssues.filter((issue) => issue.detail.startsWith("Missing"));
  const invalidContact = contactIssues.filter((issue) => issue.detail.startsWith("Invalid"));
  const contactDetail = [
    missingContact.length ? `Missing ${missingContact.map((issue) => issue.label).join(", ")}` : "",
    ...invalidContact.map((issue) => issue.detail),
  ]
    .filter(Boolean)
    .join(", ");

  const bullets = allBullets(state);
  const longBullets = bullets.filter((bullet) => wordCount(bullet) > 28);
  const detailedEntries = visibleSectionOrder(state)
    .filter((section) => section !== "skills")
    .flatMap((section) =>
      getSectionEntries(state, section).map((entry, index) => ({
        section,
        index,
        details: entry.details,
      })),
    );
  const firstLongBulletEntry = detailedEntries.find(({ details }) =>
    bulletsFrom(details).some((bullet) => wordCount(bullet) > 28),
  );
  const evidence = evidenceBullets(state);
  const measuredEvidence = evidence.filter(({ bullet }) => hasMeasuredEvidence(bullet));
  const evidenceIsBalanced = !evidence.length || measuredEvidence.length / evidence.length >= 0.5;
  const firstUnmeasuredEvidence = evidence.find(({ bullet }) => !hasMeasuredEvidence(bullet));
  const summaryWords = wordCount(stripRichMarks(state.summary));
  const firstBulletTarget = visibleSectionOrder(state)
    .filter((section) => section !== "skills")
    .map(
      (section) => [section, getSectionEntries(state, section).findIndex(entryHasContent)] as const,
    )
    .find(([, index]) => index >= 0) ?? ["experience", state.experience.length ? 0 : -1];
  const firstBulletTargetId =
    firstBulletTarget[1] >= 0
      ? `field-${firstBulletTarget[0]}-${firstBulletTarget[1]}-details`
      : "add-experience-entry";
  const longBulletTargetId = firstLongBulletEntry
    ? `field-${firstLongBulletEntry.section}-${firstLongBulletEntry.index}-details`
    : firstBulletTargetId;
  return [
    {
      id: "length",
      label: "Length",
      ok: pageCount <= 2,
      advisory: pageCount === 2,
      detail:
        pageCount <= 1
          ? "One-page PDF"
          : pageCount === 2
            ? "Two pages — review relevance"
            : `${pageCount} pages in preview`,
      guidance:
        pageCount <= 1
          ? "A one-page resume keeps the strongest evidence easy to scan."
          : pageCount === 2
            ? "Two pages can be appropriate for deeper experience. Keep the most relevant evidence near the top and follow any application-specific limit."
            : "Most resumes are strongest at one or two pages. Trim lower-impact details or adjust the text size so the strongest evidence stays easy to scan.",
      actionLabel: "Adjust size",
      targetId: "resume-text-scale",
    },
    {
      id: "contact",
      label: "Contact",
      ok: contactIssues.length === 0,
      detail: contactIssues.length ? contactDetail : "Core details present",
      guidance: contactIssues.some((issue) => issue.detail.startsWith("Invalid"))
        ? "Check the contact details exactly as a recruiter would use them. Email needs an @ and domain, phone needs enough digits to dial, and a link needs a valid domain."
        : "Missing contact details can make a strong resume impossible to follow up on.",
      actionLabel: "Fix contact",
      targetId: `field-${contactIssues[0]?.field ?? "name"}`,
    },
    {
      id: "bullets",
      label: "Bullets",
      ok: bullets.length > 0 && longBullets.length === 0,
      detail: longBullets.length
        ? `${longBullets.length} over 28 words`
        : bullets.length
          ? "Concise bullet length"
          : "Add achievement bullets",
      guidance: "Short bullets are easier to skim and make measurable results stand out.",
      actionLabel: bullets.length ? "Tighten bullets" : "Add bullets",
      targetId: longBullets.length ? longBulletTargetId : firstBulletTargetId,
    },
    {
      id: "evidence",
      label: "Evidence",
      ok: evidenceIsBalanced,
      detail: evidence.length
        ? `${measuredEvidence.length} of ${evidence.length} experience or project bullets show scope or results`
        : "No experience or project bullets to review yet",
      guidance:
        "Not every bullet needs a number, but measurable scope or results make your strongest work more credible at a glance.",
      actionLabel: evidence.length ? "Strengthen a bullet" : "Add bullets",
      targetId: firstUnmeasuredEvidence
        ? `field-${firstUnmeasuredEvidence.section}-${firstUnmeasuredEvidence.index}-details`
        : firstBulletTargetId,
    },
    {
      id: "summary",
      label: "Summary",
      // A summary can help someone frame a career change or specialization,
      // but experienced candidates should not have to add filler just to make
      // a generic checker turn green. Other checks still surface missing proof.
      ok: summaryWords === 0 || summaryWords <= 65,
      advisory: summaryWords === 0,
      detail:
        summaryWords === 0
          ? "Optional — experience leads"
          : summaryWords > 65
            ? `${summaryWords} words`
            : "Focused opening",
      guidance:
        summaryWords === 0
          ? "Add a short summary only when it helps explain a pivot, specialty, or career direction."
          : "A tight summary frames your fit before the reader reaches the details.",
      actionLabel: summaryWords === 0 ? "Add optional summary" : "Shorten summary",
      targetId: "field-summary",
    },
  ];
}

function cleanTextLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function pushBlock(lines: string[], block: string[]) {
  const clean = block.filter(Boolean);
  if (!clean.length) return;
  if (lines.length && lines[lines.length - 1] !== "") lines.push("");
  lines.push(...clean);
}

function entryPlainText(entry: ResumeEntry) {
  const lines: string[] = [];
  const title = cleanTextLine(entry.title);
  const subtitle = cleanTextLine(entry.subtitle);
  const meta = cleanTextLine(entry.meta);

  if (title) lines.push(title);
  if (subtitle || meta) lines.push([subtitle, meta].filter(Boolean).join(" | "));
  lines.push(...contentPlainLines(entry.details, "bullets"));
  return lines;
}

function sectionPlainText(state: ResumeState, label: string, section: string) {
  const format = getSectionFormat(state, section);
  const heading = label ? [label] : [];
  if (format === "tag-groups") {
    const groups = getSectionTagGroups(state, section);
    const lines = groups
      .map((group) =>
        [cleanTextLine(group.label), group.tags.map(cleanTextLine).filter(Boolean).join(", ")]
          .filter(Boolean)
          .join(": "),
      )
      .filter(Boolean);
    return lines.length ? [...heading, ...lines] : [];
  }
  if (format === "text") {
    const lines = contentPlainLines(getSectionText(state, section), "bullets");
    return lines.length ? [...heading, ...lines] : [];
  }
  const entries = getSectionEntries(state, section).filter(entryHasContent);
  if (!entries.length) return [];
  const lines = heading;
  entries.forEach((entry, index) => {
    if (index > 0) lines.push("");
    lines.push(...entryPlainText(entry));
  });
  return lines;
}

export function resumePlainText(state: ResumeState) {
  if (!hasAnyContent(state)) return "";

  const lines: string[] = [];
  pushBlock(lines, [
    cleanTextLine(state.name),
    cleanTextLine(state.title),
    [state.email, state.phone, state.location, ...resumeHeaderLinks(state).map((link) => link.url)]
      .map(cleanTextLine)
      .filter(Boolean)
      .join(" | "),
  ]);
  pushBlock(lines, state.summary ? ["Summary", cleanTextLine(stripRichMarks(state.summary))] : []);
  visibleSectionOrder(state).forEach((key) => {
    pushBlock(lines, sectionPlainText(state, getSectionTitle(state, key), key));
  });
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function entryMarkdown(entry: ResumeEntry): string {
  const blocks: string[] = [];
  const title = cleanTextLine(entry.title);
  const subtitle = cleanTextLine(entry.subtitle);
  const meta = cleanTextLine(entry.meta);
  if (title) blocks.push(`### ${title}`);
  const metaLine = [subtitle, meta].filter(Boolean).join(" · ");
  if (metaLine) blocks.push(`*${metaLine}*`);
  const details = contentMarkdown(entry.details, "bullets");
  if (details) blocks.push(details);
  return blocks.join("\n\n");
}

function sectionMarkdown(state: ResumeState, section: string): string {
  const format = getSectionFormat(state, section);
  const title = getSectionTitle(state, section).trim();
  const heading = title ? `## ${title}` : "";
  const blocks: string[] = [];

  if (format === "tag-groups") {
    const lines = getSectionTagGroups(state, section)
      .map((group) => {
        const label = cleanTextLine(group.label);
        const tags = group.tags.map(cleanTextLine).filter(Boolean).join(", ");
        if (!tags) return "";
        return label ? `**${label}:** ${tags}` : tags;
      })
      .filter(Boolean);
    if (lines.length) blocks.push(lines.join("\n\n"));
  } else if (format === "text") {
    const md = contentMarkdown(getSectionText(state, section), "bullets");
    if (md) blocks.push(md);
  } else {
    const entries = getSectionEntries(state, section)
      .filter(entryHasContent)
      .map(entryMarkdown)
      .filter(Boolean);
    if (entries.length) blocks.push(entries.join("\n\n"));
  }

  if (!blocks.length) return "";
  return [heading, ...blocks].filter(Boolean).join("\n\n");
}

/**
 * Serializes the resume to portable Markdown. Like {@link resumePlainText} this
 * follows the visible section order and every section format, but keeps headings,
 * links, and bullets as Markdown for pasting into docs, git, or an LLM. It is a
 * lossy view (theme, template, and layout live only in the JSON), so it is an
 * export, not the save format.
 */
export function resumeMarkdown(state: ResumeState) {
  if (!hasAnyContent(state)) return "";

  const blocks: string[] = [];
  const name = cleanTextLine(state.name);
  if (name) blocks.push(`# ${name}`);
  const title = cleanTextLine(state.title);
  if (title) blocks.push(title);

  const contactBits = [state.email, state.phone, state.location].map(cleanTextLine).filter(Boolean);
  const linkBits = resumeHeaderLinks(state)
    .map((link) => {
      const url = cleanTextLine(link.url);
      if (!url) return "";
      return `[${cleanTextLine(link.label) || url}](${url})`;
    })
    .filter(Boolean);
  const contact = [...contactBits, ...linkBits].join(" · ");
  if (contact) blocks.push(contact);

  if (stripRichMarks(state.summary).trim()) {
    blocks.push("## Summary");
    blocks.push(contentMarkdown(state.summary, "paragraph") || inlineHtmlToMarkdown(state.summary));
  }

  visibleSectionOrder(state).forEach((section) => {
    const md = sectionMarkdown(state, section);
    if (md) blocks.push(md);
  });

  return `${blocks
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

function applicationCopyValue(value: string) {
  return value.trim();
}

function entryApplicationCopyGroup(
  section: string,
  label: string,
  entry: ResumeEntry,
  index: number,
): ApplicationCopyGroup {
  const title = applicationCopyValue(entry.title);
  const subtitle = applicationCopyValue(entry.subtitle);
  const meta = applicationCopyValue(entry.meta);
  const details = contentPlainLines(entry.details, "bullets", "• ").join("\n");
  const entryText = entryPlainText(entry).join("\n");
  // Portal copy labels stay compact, while optional sections still benefit
  // from the same specific metadata names shown in the editor.
  const schema =
    section === "experience"
      ? { title: "Job title", subtitle: "Employer", meta: "Dates", details: "Achievements" }
      : section === "education"
        ? { title: "Degree", subtitle: "School", meta: "Dates / location", details: "Details" }
        : section === "projects"
          ? {
              title: "Project name",
              subtitle: "Technologies / role",
              meta: "Dates / link",
              details: "Description",
            }
          : entryFieldSchema(section, label);
  const fields: ApplicationCopyField[] = [
    { id: "entry", label: "Whole entry", text: entryText },
    { id: "title", label: schema.title, text: title },
    { id: "subtitle", label: schema.subtitle, text: subtitle },
    { id: "meta", label: schema.meta, text: meta },
    { id: "details", label: schema.details, text: details },
  ].filter((field) => Boolean(field.text));

  return {
    id: `${section}-${index}`,
    label: `${label} ${index + 1}`,
    detail: [title, subtitle].filter(Boolean).join(" · ") || undefined,
    fields,
  };
}

/**
 * Builds copy-ready chunks for application portals that ask for resume details
 * one field at a time. This deliberately mirrors the current resume rather
 * than inventing a different, opaque application profile.
 */
export function applicationCopyGroups(state: ResumeState): ApplicationCopyGroup[] {
  const groups: ApplicationCopyGroup[] = [];
  const headerLinks = resumeHeaderLinks(state).filter((link) => link.url.trim());
  const profileFields: ApplicationCopyField[] = [
    {
      id: "profile",
      label: "Full profile",
      text: [
        state.name,
        state.title,
        state.email,
        state.phone,
        state.location,
        ...headerLinks.map((link) => link.url),
      ]
        .map(applicationCopyValue)
        .filter(Boolean)
        .join("\n"),
    },
    { id: "name", label: "Full name", text: applicationCopyValue(state.name) },
    { id: "title", label: "Title / role", text: applicationCopyValue(state.title) },
    { id: "email", label: "Email", text: applicationCopyValue(state.email) },
    { id: "phone", label: "Phone", text: applicationCopyValue(state.phone) },
    { id: "location", label: "Location", text: applicationCopyValue(state.location) },
    ...headerLinks.map((link) => ({
      id: `link-${link.id}`,
      label: link.label || "Website",
      text: applicationCopyValue(link.url),
    })),
  ].filter((field) => Boolean(field.text));
  if (profileFields.length) groups.push({ id: "profile", label: "Profile", fields: profileFields });

  const summary = applicationCopyValue(state.summary);
  if (summary)
    groups.push({
      id: "summary",
      label: "Summary",
      fields: [{ id: "summary", label: "Summary", text: summary }],
    });

  visibleSectionOrder(state).forEach((section) => {
    const sectionLabel = getSectionTitle(state, section).trim() || "Untitled section";
    const format = getSectionFormat(state, section);
    if (format !== "entries") {
      const text = sectionPlainText(state, "", section).join("\n");
      if (text)
        groups.push({
          id: section,
          label: sectionLabel,
          fields: [{ id: section, label: sectionLabel, text }],
        });
      return;
    }
    getSectionEntries(state, section)
      .filter(entryHasContent)
      .forEach((entry, index) =>
        groups.push(entryApplicationCopyGroup(section, sectionLabel, entry, index)),
      );
  });

  return groups;
}

export function resumeExportFingerprint(state: ResumeState) {
  return JSON.stringify(normalizeResume(state));
}

function changedFields<K extends keyof ResumeState>(
  previous: ResumeState,
  current: ResumeState,
  fields: K[],
) {
  return fields.filter((field) => String(previous[field] ?? "") !== String(current[field] ?? ""));
}

const CONTACT_FIELD_LABELS: Record<"name" | "title" | "email" | "phone" | "location", string> = {
  name: "Full name",
  title: "Title / role",
  email: "Email",
  phone: "Phone",
  location: "Location",
};

const ENTRY_FIELD_LABELS: Record<
  "experience" | "education" | "projects",
  Record<EntryTextField, string>
> = {
  experience: {
    title: "Job title",
    subtitle: "Company",
    meta: "Dates",
    details: "Achievements",
  },
  education: {
    title: "Degree",
    subtitle: "School",
    meta: "Dates / location",
    details: "Details",
  },
  projects: {
    title: "Project name",
    subtitle: "Technologies / role",
    meta: "Dates / link",
    details: "Description",
  },
};

function sectionTargetId(section: "experience" | "education" | "projects") {
  return `field-${section}-0-title`;
}

function snippet(value: string) {
  const cleaned = cleanTextLine(stripRichMarks(value));
  if (!cleaned) return "Empty";
  return cleaned.length > 86 ? `${cleaned.slice(0, 83)}...` : cleaned;
}

function contactSnapshot(state: ResumeState) {
  return [
    state.name,
    state.title,
    state.email,
    state.phone,
    state.location,
    ...resumeHeaderLinks(state).map((link) => link.url),
  ]
    .map(cleanTextLine)
    .filter(Boolean)
    .join(" | ");
}

function sectionSnapshot(state: ResumeState, section: "experience" | "education" | "projects") {
  const entries = state[section].filter(
    (entry) => entry.title || entry.subtitle || entry.meta || entry.details,
  );
  if (!entries.length) return "";
  return entries
    .map((entry) => {
      const firstBullet = bulletsFrom(entry.details)[0] ?? "";
      return [entry.title, entry.subtitle, entry.meta, firstBullet]
        .map(cleanTextLine)
        .filter(Boolean)
        .join(" | ");
    })
    .join(" / ");
}

function skillsSnapshot(state: ResumeState) {
  return sectionPlainText(state, "", "skills").join(" / ");
}

function visualStyleSnapshot(state: ResumeState) {
  const template =
    RESUME_TEMPLATES.find((candidate) => candidate.id === state.template)?.label ?? "Custom";
  const font =
    RESUME_FONTS.find((candidate) => candidate.id === state.theme.font)?.label ?? "Custom";
  const heading = HEADING_STYLE_LABELS[state.theme.headingStyle];
  const density = DENSITY_LABELS[state.theme.density];
  return [
    template,
    font,
    state.theme.accent.toUpperCase(),
    `${state.theme.headerAlign === "center" ? "Centered" : "Left-aligned"} header`,
    state.theme.headerDivider ? "Header divider" : "No header divider",
    heading,
    density,
    `${BULLET_STYLE_LABELS[state.theme.bulletStyle]} bullets`,
  ].join(" · ");
}

function visualStyleChangeLabels(previous: ResumeState, current: ResumeState) {
  const labels: string[] = [];
  if (previous.template !== current.template) labels.push("Layout template");
  if (previous.theme.font !== current.theme.font) labels.push("Font");
  if (previous.theme.accent !== current.theme.accent) labels.push("Accent color");
  if (previous.theme.headerAlign !== current.theme.headerAlign) labels.push("Header alignment");
  if (previous.theme.headerDivider !== current.theme.headerDivider) labels.push("Header divider");
  if (previous.theme.headingStyle !== current.theme.headingStyle) labels.push("Heading style");
  if (previous.theme.density !== current.theme.density) labels.push("Spacing density");
  if (previous.theme.bulletStyle !== current.theme.bulletStyle) labels.push("Bullet style");
  return labels;
}

function entryIsEmpty(entry: ResumeEntry) {
  return !entry.title && !entry.subtitle && !entry.meta && !entry.details;
}

function repeatableSectionChangeDetails(
  previous: ResumeState,
  current: ResumeState,
  section: "experience" | "education" | "projects",
) {
  const fieldLabels: string[] = [];
  let targetId = current[section].length ? sectionTargetId(section) : `add-${section}-entry`;
  let foundTarget = false;
  const maxEntries = Math.max(previous[section].length, current[section].length);

  for (let index = 0; index < maxEntries; index += 1) {
    const before = previous[section][index] ?? blankEntry();
    const after = current[section][index] ?? blankEntry();

    if (JSON.stringify(before) === JSON.stringify(after)) continue;

    if (entryIsEmpty(before) && !entryIsEmpty(after)) {
      fieldLabels.push(`Entry ${index + 1} added`);
      if (!foundTarget) {
        targetId = `field-${section}-${index}-title`;
        foundTarget = true;
      }
      continue;
    }

    if (!entryIsEmpty(before) && entryIsEmpty(after)) {
      fieldLabels.push(`Entry ${index + 1} removed`);
      continue;
    }

    (["title", "subtitle", "meta", "details"] as const).forEach((field) => {
      if (before[field] === after[field]) return;
      fieldLabels.push(`Entry ${index + 1} ${ENTRY_FIELD_LABELS[section][field]}`);
      if (!foundTarget) {
        targetId = `field-${section}-${index}-${field}`;
        foundTarget = true;
      }
    });
  }

  return { fieldLabels, targetId };
}

export function exportChangeSummary(
  previousState: ResumeState,
  currentState: ResumeState,
): ExportChange[] {
  const previous = normalizeResume(previousState);
  const current = normalizeResume(currentState);
  const changes: ExportChange[] = [];
  const contactFields = changedFields(previous, current, [
    "name",
    "title",
    "email",
    "phone",
    "location",
  ]);
  const linksChanged = JSON.stringify(previous.headerLinks) !== JSON.stringify(current.headerLinks);

  if (contactFields.length || linksChanged) {
    const firstField = contactFields[0];
    const editCount = contactFields.length + (linksChanged ? 1 : 0);
    changes.push({
      id: "contact",
      label: "Header changed",
      detail: `${editCount} ${editCount === 1 ? "field" : "fields"} edited`,
      targetId: firstField
        ? `field-${firstField}`
        : current.headerLinks[0]
          ? `field-header-link-${current.headerLinks[0].id}-url`
          : "add-header-link",
      before: snippet(contactSnapshot(previous)),
      after: snippet(contactSnapshot(current)),
      fieldLabels: [
        ...contactFields.map((field) => CONTACT_FIELD_LABELS[field]),
        ...(linksChanged ? ["Header links"] : []),
      ],
    });
  }

  if (previous.summary !== current.summary) {
    changes.push({
      id: "summary",
      label: "Summary changed",
      detail: `${wordCount(stripRichMarks(current.summary))} words now`,
      targetId: "field-summary",
      before: snippet(previous.summary),
      after: snippet(current.summary),
    });
  }

  (["experience", "education", "projects"] as const).forEach((section) => {
    if (JSON.stringify(previous[section]) === JSON.stringify(current[section])) return;
    const sectionDetails = repeatableSectionChangeDetails(previous, current, section);
    const entryCount = current[section].filter(
      (entry) => entry.title || entry.subtitle || entry.meta || entry.details,
    ).length;
    changes.push({
      id: section,
      label: `${getSectionTitle(current, section)} changed`,
      detail: sectionDetails.fieldLabels.length
        ? `${sectionDetails.fieldLabels.length} ${sectionDetails.fieldLabels.length === 1 ? "field" : "fields"} edited`
        : `${entryCount} entries now`,
      targetId: sectionDetails.targetId,
      before: snippet(sectionSnapshot(previous, section)),
      after: snippet(sectionSnapshot(current, section)),
      fieldLabels: sectionDetails.fieldLabels,
    });
  });

  if (previous.skills !== current.skills) {
    changes.push({
      id: "skills",
      label: "Skills changed",
      detail: `${current.skills.split("\n").filter((line) => line.trim()).length} lines now`,
      targetId: "field-skills",
      before: snippet(skillsSnapshot(previous)),
      after: snippet(skillsSnapshot(current)),
    });
  }

  if (JSON.stringify(previous.sectionTitles) !== JSON.stringify(current.sectionTitles)) {
    changes.push({
      id: "section-titles",
      label: "Section titles changed",
      detail: "One or more section headings were renamed",
      targetId: "section-order-controls",
    });
  }

  if (JSON.stringify(previous.customSections) !== JSON.stringify(current.customSections)) {
    changes.push({
      id: "custom-sections",
      label: "Custom sections changed",
      detail: `${current.customSections.length} custom ${current.customSections.length === 1 ? "section" : "sections"} now`,
      targetId: current.customSections[0]
        ? `section-title-${current.customSections[0].id}`
        : "add-custom-section",
    });
  }

  if (JSON.stringify(previous.sectionOrder) !== JSON.stringify(current.sectionOrder)) {
    changes.push({
      id: "section-order",
      label: "Section order changed",
      detail: current.sectionOrder
        .map((section) => getSectionTitle(current, section) || "Untitled section")
        .join(", "),
      targetId: "section-order-controls",
    });
  }

  const visualStyleChanges = visualStyleChangeLabels(previous, current);
  if (visualStyleChanges.length) {
    changes.push({
      id: "visual-style",
      label: "Visual style changed",
      detail: `${visualStyleChanges.length} ${visualStyleChanges.length === 1 ? "setting" : "settings"} edited`,
      targetId: "edit-layout",
      before: visualStyleSnapshot(previous),
      after: visualStyleSnapshot(current),
      fieldLabels: visualStyleChanges,
    });
  }

  if (previous.textScale !== current.textScale) {
    changes.push({
      id: "text-size",
      label: "Text size changed",
      detail: `${Math.round(previous.textScale * 100)}% to ${Math.round(current.textScale * 100)}%`,
      targetId: "resume-text-scale",
    });
  }

  return changes;
}

export function plainTextStats(text: string) {
  const words = wordCount(text);
  const lines = text.split("\n").filter((line) => line.trim()).length;
  return `${words} words - ${lines} lines`;
}

export function sampleState(): ResumeState {
  return normalizeResume({
    name: "John Doe",
    title: "Product Operations Manager",
    email: "john.doe@example.com",
    phone: "(555) 014-7823",
    location: "Chicago, IL",
    website: "linkedin.com/in/johndoe",
    summary:
      "Product operations leader with 8 years of experience turning customer insights into scalable workflows, clearer metrics, and faster launches across growing teams.",
    experience: [
      {
        title: "Product Operations Manager",
        subtitle: "Northstar Health - Chicago, IL",
        meta: "Mar 2022 - Present",
        details:
          "Rebuilt intake and prioritization across four teams, reducing request turnaround by 35%.\nLaunched a weekly KPI dashboard used by 12 leaders to track adoption, risk, and delivery.",
      },
      {
        title: "Business Operations Analyst",
        subtitle: "Harbor Market - Chicago, IL",
        meta: "Jul 2019 - Feb 2022",
        details:
          "Automated weekly reporting, saving 8 hours of manual work each month.\nMapped fulfillment bottlenecks and helped improve on-time delivery by 18%.",
      },
      {
        title: "Operations Coordinator",
        subtitle: "Civic Works - Chicago, IL",
        meta: "Jun 2017 - Jun 2019",
        details:
          "Coordinated launch plans across sales, support, and operations for 15 regional programs.\nStandardized vendor tracking and reduced late deliverables by 22%.",
      },
    ],
    education: [
      {
        title: "B.A. in Economics",
        subtitle: "University of Illinois Chicago - Chicago, IL",
        meta: "2015 - 2019",
        details: "",
      },
      {
        title: "Certificate in Data Analytics",
        subtitle: "City Colleges of Chicago - Chicago, IL",
        meta: "2020",
        details: "",
      },
    ],
    projects: [
      {
        title: "Neighborhood Food Access Study",
        subtitle: "Volunteer Data Lead",
        meta: "2023",
        details:
          "Analyzed transit and grocery-access data for a community nonprofit and presented three expansion priorities to its board.",
      },
      {
        title: "Launch Readiness Playbook",
        subtitle: "Cross-functional Program Lead",
        meta: "2024",
        details:
          "Created a reusable launch checklist and ownership model adopted by five product teams.",
      },
    ],
    skills:
      "Analysis: SQL, Excel, Tableau\nOperations: Process mapping, KPI design, Experiment planning\nMethods: Customer research, Launch planning, Workflow design\nTools: Airtable, Jira, Notion",
  });
}
