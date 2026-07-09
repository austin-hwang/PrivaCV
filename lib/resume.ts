import { z } from "zod";

export const SECTION_KEYS = ["education", "experience", "projects", "skills"] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  education: "Education",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
};

export const entrySchema = z.object({
  title: z.string().catch(""),
  subtitle: z.string().catch(""),
  meta: z.string().catch(""),
  details: z.string().catch(""),
});

export type ResumeEntry = z.infer<typeof entrySchema>;

export const resumeSchema = z.object({
  name: z.string().catch(""),
  title: z.string().catch(""),
  email: z.string().catch(""),
  phone: z.string().catch(""),
  location: z.string().catch(""),
  website: z.string().catch(""),
  summary: z.string().catch(""),
  skills: z.string().catch(""),
  experience: z.array(entrySchema).catch([]),
  education: z.array(entrySchema).catch([]),
  projects: z.array(entrySchema).catch([]),
  sectionOrder: z.array(z.enum(SECTION_KEYS)).catch([...SECTION_KEYS]),
  textScale: z.number().catch(1),
});

export type ResumeState = z.infer<typeof resumeSchema>;

export type ResumeCheck = {
  id: "length" | "contact" | "bullets" | "summary" | "density";
  label: string;
  ok: boolean;
  detail: string;
  guidance: string;
  actionLabel: string;
  targetId: string;
};

export type ExportChange = {
  id: string;
  label: string;
  detail: string;
  targetId: string;
  before?: string;
  after?: string;
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
    summary: "",
    skills: "",
    experience: [blankEntry()],
    education: [blankEntry()],
    projects: [],
    sectionOrder: [...SECTION_KEYS],
    textScale: 1,
  };
}

export function normalizeResume(data: unknown): ResumeState {
  const parsed = resumeSchema.catch(emptyState()).parse(data);
  const order = parsed.sectionOrder.filter(
    (key, index, all) => SECTION_KEYS.includes(key) && all.indexOf(key) === index,
  );

  SECTION_KEYS.forEach((key) => {
    if (!order.includes(key)) order.push(key);
  });

  return {
    ...emptyState(),
    ...parsed,
    experience: parsed.experience.map((entry) => ({ ...blankEntry(), ...entry })),
    education: parsed.education.map((entry) => ({ ...blankEntry(), ...entry })),
    projects: parsed.projects.map((entry) => ({ ...blankEntry(), ...entry })),
    sectionOrder: order,
    textScale: clampTextScale(parsed.textScale),
  };
}

export function clampTextScale(value: number) {
  if (Number.isNaN(value)) return 1;
  return Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, value));
}

export function bulletsFrom(details: string) {
  return details
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function hasAnyContent(state: ResumeState) {
  if (state.name || state.title || state.summary || state.skills) return true;
  if (state.email || state.phone || state.location || state.website) return true;
  return ["experience", "education", "projects"].some((section) =>
    state[section as "experience" | "education" | "projects"].some(
      (entry) => entry.title || entry.subtitle || entry.meta || entry.details,
    ),
  );
}

export function allBullets(state: ResumeState) {
  return ["experience", "education", "projects"].flatMap((section) =>
    state[section as "experience" | "education" | "projects"].flatMap((entry) =>
      bulletsFrom(entry.details),
    ),
  );
}

export function buildResumeChecks(state: ResumeState, pageCount: number): ResumeCheck[] {
  const missingContact = [
    ["name", "name"],
    ["email", "email"],
    ["phone", "phone"],
    ["location", "location"],
  ]
    .filter(([key]) => !String(state[key as keyof ResumeState] || "").trim())
    .map(([, label]) => label);

  const bullets = allBullets(state);
  const longBullets = bullets.filter((bullet) => wordCount(bullet) > 28);
  const summaryWords = wordCount(state.summary);
  const totalWords = wordCount(resumePlainText(state));
  const firstBulletTarget =
    state.sectionOrder
      .filter((section): section is "experience" | "education" | "projects" => section !== "skills")
      .map((section) => [section, state[section].findIndex((entry) => entry.title || entry.subtitle || entry.meta || entry.details)] as const)
      .find(([, index]) => index >= 0) ?? ["experience", state.experience.length ? 0 : -1];
  const firstBulletTargetId =
    firstBulletTarget[1] >= 0
      ? `field-${firstBulletTarget[0]}-${firstBulletTarget[1]}-details`
      : "add-experience-entry";

  return [
    {
      id: "length",
      label: "Length",
      ok: pageCount <= 1,
      detail: pageCount <= 1 ? "One-page PDF" : `${pageCount} pages in preview`,
      guidance: "Recruiters scan quickly, so a one-page resume keeps the strongest evidence in view.",
      actionLabel: "Adjust size",
      targetId: "resume-text-scale",
    },
    {
      id: "contact",
      label: "Contact",
      ok: missingContact.length === 0,
      detail: missingContact.length ? `Missing ${missingContact.join(", ")}` : "Core details present",
      guidance: "Missing contact details can make a strong resume impossible to follow up on.",
      actionLabel: "Fix contact",
      targetId: `field-${missingContact[0] ?? "name"}`,
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
      targetId: firstBulletTargetId,
    },
    {
      id: "summary",
      label: "Summary",
      ok: summaryWords > 0 && summaryWords <= 65,
      detail:
        summaryWords === 0
          ? "Missing summary"
          : summaryWords > 65
            ? `${summaryWords} words`
            : "Focused opening",
      guidance: "A tight summary frames your fit before the reader reaches the details.",
      actionLabel: summaryWords === 0 ? "Add summary" : "Shorten summary",
      targetId: "field-summary",
    },
    {
      id: "density",
      label: "Density",
      ok: totalWords >= 90 && totalWords <= 650,
      detail:
        totalWords < 90
          ? `${totalWords} words feels sparse`
          : totalWords > 650
            ? `${totalWords} words may feel crowded`
            : `${totalWords} words balanced`,
      guidance:
        totalWords < 90
          ? "A little more proof helps the resume feel credible instead of like a placeholder."
          : totalWords > 650
            ? "Trim lower-impact details so the page does not look crowded before anyone reads it."
            : "Balanced substance gives the reader enough proof without crowding the page.",
      actionLabel: totalWords < 90 ? "Add proof" : "Trim details",
      targetId: firstBulletTargetId,
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
  const bullets = bulletsFrom(entry.details);

  if (title) lines.push(title);
  if (subtitle || meta) lines.push([subtitle, meta].filter(Boolean).join(" | "));
  bullets.forEach((bullet) => lines.push(`- ${cleanTextLine(bullet)}`));
  return lines;
}

function sectionPlainText(state: ResumeState, label: string, section: "experience" | "education" | "projects") {
  const entries = state[section].filter(
    (entry) => entry.title || entry.subtitle || entry.meta || entry.details,
  );
  if (!entries.length) return [];
  const lines = [label];
  entries.forEach((entry, index) => {
    if (index > 0) lines.push("");
    lines.push(...entryPlainText(entry));
  });
  return lines;
}

function skillsPlainText(state: ResumeState) {
  const lines = state.skills
    .split("\n")
    .map(cleanTextLine)
    .filter(Boolean);
  return lines.length ? ["Skills", ...lines] : [];
}

export function resumePlainText(state: ResumeState) {
  if (!hasAnyContent(state)) return "";

  const lines: string[] = [];
  pushBlock(lines, [
    cleanTextLine(state.name),
    cleanTextLine(state.title),
    [state.email, state.phone, state.location, state.website].map(cleanTextLine).filter(Boolean).join(" | "),
  ]);
  pushBlock(lines, state.summary ? ["Summary", cleanTextLine(state.summary)] : []);
  state.sectionOrder.forEach((key) => {
    if (key === "skills") pushBlock(lines, skillsPlainText(state));
    else pushBlock(lines, sectionPlainText(state, SECTION_LABELS[key], key));
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function resumeExportFingerprint(state: ResumeState) {
  return JSON.stringify(normalizeResume(state));
}

function changedFields(previous: ResumeState, current: ResumeState, fields: Array<keyof ResumeState>) {
  return fields.filter((field) => String(previous[field] ?? "") !== String(current[field] ?? ""));
}

function sectionTargetId(section: "experience" | "education" | "projects") {
  return `field-${section}-0-title`;
}

function snippet(value: string) {
  const cleaned = cleanTextLine(value);
  if (!cleaned) return "Empty";
  return cleaned.length > 86 ? `${cleaned.slice(0, 83)}...` : cleaned;
}

function contactSnapshot(state: ResumeState) {
  return [state.name, state.title, state.email, state.phone, state.location, state.website]
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
      return [entry.title, entry.subtitle, entry.meta, firstBullet].map(cleanTextLine).filter(Boolean).join(" | ");
    })
    .join(" / ");
}

function skillsSnapshot(state: ResumeState) {
  return state.skills
    .split("\n")
    .map(cleanTextLine)
    .filter(Boolean)
    .join(" / ");
}

export function exportChangeSummary(previousState: ResumeState, currentState: ResumeState): ExportChange[] {
  const previous = normalizeResume(previousState);
  const current = normalizeResume(currentState);
  const changes: ExportChange[] = [];
  const contactFields = changedFields(previous, current, ["name", "title", "email", "phone", "location", "website"]);

  if (contactFields.length) {
    const firstField = contactFields[0];
    changes.push({
      id: "contact",
      label: "Header changed",
      detail: `${contactFields.length} ${contactFields.length === 1 ? "field" : "fields"} edited`,
      targetId: `field-${firstField}`,
      before: snippet(contactSnapshot(previous)),
      after: snippet(contactSnapshot(current)),
    });
  }

  if (previous.summary !== current.summary) {
    changes.push({
      id: "summary",
      label: "Summary changed",
      detail: `${wordCount(current.summary)} words now`,
      targetId: "field-summary",
      before: snippet(previous.summary),
      after: snippet(current.summary),
    });
  }

  (["experience", "education", "projects"] as const).forEach((section) => {
    if (JSON.stringify(previous[section]) === JSON.stringify(current[section])) return;
    changes.push({
      id: section,
      label: `${SECTION_LABELS[section]} changed`,
      detail: `${current[section].filter((entry) => entry.title || entry.subtitle || entry.meta || entry.details).length} entries now`,
      targetId: current[section].length ? sectionTargetId(section) : `add-${section}-entry`,
      before: snippet(sectionSnapshot(previous, section)),
      after: snippet(sectionSnapshot(current, section)),
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

  if (JSON.stringify(previous.sectionOrder) !== JSON.stringify(current.sectionOrder)) {
    changes.push({
      id: "section-order",
      label: "Section order changed",
      detail: current.sectionOrder.map((section) => SECTION_LABELS[section]).join(", "),
      targetId: "section-order-controls",
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
    name: "Jane Doe",
    title: "",
    email: "jane.doe@example.com",
    phone: "(555) 123-4567",
    location: "San Francisco, CA",
    website: "linkedin.com/in/janedoe",
    summary:
      "Software engineer specializing in applied AI, scaling backend microservices, and optimizing system performance to support high-traffic, production-grade applications.",
    experience: [
      {
        title: "Senior Software Engineer",
        subtitle: "Acme Corp - San Francisco, CA",
        meta: "Jan 2021 - Present",
        details:
          "Led migration of monolith to microservices, cutting deploy time by 60%.\nMentored a team of 5 engineers and established code review standards.\nDesigned the billing service handling $40M in annual transactions.",
      },
      {
        title: "Software Engineer",
        subtitle: "Globex Inc - Palo Alto, CA",
        meta: "Jun 2017 - Dec 2020",
        details:
          "Built customer-facing analytics dashboard used by 10,000+ businesses.\nImproved API response times by 45% through query optimization.",
      },
    ],
    education: [
      {
        title: "B.S. in Computer Science",
        subtitle: "University of California, Berkeley - Berkeley, CA",
        meta: "2013 - 2017",
        details: "",
      },
    ],
    projects: [
      {
        title: "Verichain",
        subtitle: "React, Node.js, Solidity, Web3",
        meta: "",
        details:
          "Built a decentralized open-data marketplace letting consumers bid on high-value IoT data.\nExecuted transactions on the Ethereum testnet via MetaMask.",
      },
    ],
    skills:
      "Languages: JavaScript, TypeScript, Python, Go\nFrameworks: React, Node.js, Django\nDatabases: PostgreSQL, MongoDB, Redis\nTools: Docker, Kubernetes, AWS, Terraform",
  });
}
