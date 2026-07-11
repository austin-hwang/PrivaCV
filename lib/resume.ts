import { z } from "zod";

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
  "Certifications",
  "Volunteer Experience",
  "Publications",
  "Awards",
  "Languages",
  "Training",
] as const;

export type SectionId = SectionKey | `custom-${string}`;

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

export const customSectionSchema = z.object({
  id: z.string(),
  title: z.string().catch("Custom Section"),
  entries: z.array(entrySchema).catch([]),
});

export type CustomSection = z.infer<typeof customSectionSchema>;

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
  sectionTitles: sectionTitlesSchema.catch({ ...SECTION_LABELS }),
  customSections: z.array(customSectionSchema).catch([]),
  sectionOrder: z.array(z.string()).catch([...SECTION_KEYS]),
  textScale: z.number().catch(1),
});

export type ResumeState = z.infer<typeof resumeSchema>;

export type ResumeCheck = {
  id: "length" | "contact" | "bullets" | "evidence" | "summary" | "density";
  label: string;
  ok: boolean;
  /** A useful prompt that should never hold up a confident export. */
  advisory?: boolean;
  detail: string;
  guidance: string;
  actionLabel: string;
  targetId: string;
};

export type EvidenceSummary = {
  bulletCount: number;
  measuredCount: number;
  unmeasuredIndexes: number[];
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
    sectionTitles: { ...SECTION_LABELS },
    customSections: [],
    sectionOrder: [...SECTION_KEYS],
    textScale: 1,
  };
}

export function normalizeResume(data: unknown): ResumeState {
  const parsed = resumeSchema.catch(emptyState()).parse(data);
  const customSections = parsed.customSections
    .filter((section, index, all) =>
      section.id.startsWith("custom-") && all.findIndex((candidate) => candidate.id === section.id) === index,
    )
    .map((section) => ({
      ...section,
      title: section.title.trim() || "Custom Section",
      entries: section.entries.map((entry) => ({ ...blankEntry(), ...entry })),
    }));
  const validSectionIds = new Set<string>([...SECTION_KEYS, ...customSections.map((section) => section.id)]);
  const order = parsed.sectionOrder.filter(
    (key, index, all) => validSectionIds.has(key) && all.indexOf(key) === index,
  );

  SECTION_KEYS.forEach((key) => {
    if (!order.includes(key)) order.push(key);
  });
  customSections.forEach(({ id }) => {
    if (!order.includes(id)) order.push(id);
  });

  return {
    ...emptyState(),
    ...parsed,
    experience: parsed.experience.map((entry) => ({ ...blankEntry(), ...entry })),
    education: parsed.education.map((entry) => ({ ...blankEntry(), ...entry })),
    projects: parsed.projects.map((entry) => ({ ...blankEntry(), ...entry })),
    sectionTitles: { ...SECTION_LABELS, ...parsed.sectionTitles },
    customSections,
    sectionOrder: order,
    textScale: clampTextScale(parsed.textScale),
  };
}

export function isBuiltinSection(section: string): section is SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(section);
}

export function getSectionTitle(state: ResumeState, section: string) {
  if (isBuiltinSection(section)) return state.sectionTitles[section] || SECTION_LABELS[section];
  return state.customSections.find((candidate) => candidate.id === section)?.title || "Custom Section";
}

export function getSectionEntries(state: ResumeState, section: string): ResumeEntry[] {
  if (section === "experience") return state.experience;
  if (section === "education") return state.education;
  if (section === "projects") return state.projects;
  if (section === "skills") return [];
  return state.customSections.find((candidate) => candidate.id === section)?.entries ?? [];
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
  return ["experience", "education", "projects"].flatMap((section) =>
    state[section as "experience" | "education" | "projects"].flatMap((entry) =>
      bulletsFrom(entry.details),
    ),
  ).concat(state.customSections.flatMap((section) => section.entries.flatMap((entry) => bulletsFrom(entry.details))));
}

export function hasMeasuredEvidence(bullet: string) {
  return /(?:[$€£]\s?\d[\d,.]*(?:[kmb])?|\b\d[\d,.]*(?:%|\+|x\b|[kmb]\b)|\b\d[\d,.]*\s+(?:users?|customers?|clients?|teams?|engineers?|people|projects?|releases?|hours?|days?|weeks?|months?|years?|requests?|transactions?|applications?|companies|locations|markets|reports?|experiments?|campaigns?)\b)/i.test(
    bullet,
  );
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

function evidenceBullets(state: ResumeState) {
  return (["experience", "projects"] as const).flatMap((section) =>
    state[section].flatMap((entry, index) =>
      bulletsFrom(entry.details).map((bullet) => ({ section, index, bullet })),
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
  const evidence = evidenceBullets(state);
  const measuredEvidence = evidence.filter(({ bullet }) => hasMeasuredEvidence(bullet));
  const evidenceIsBalanced = !evidence.length || measuredEvidence.length / evidence.length >= 0.5;
  const firstUnmeasuredEvidence = evidence.find(({ bullet }) => !hasMeasuredEvidence(bullet));
  const summaryWords = wordCount(state.summary);
  const totalWords = wordCount(resumePlainText(state));
  const firstBulletTarget =
    state.sectionOrder
      .filter((section) => section !== "skills")
      .map((section) => [section, getSectionEntries(state, section).findIndex(entryHasContent)] as const)
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
      id: "evidence",
      label: "Evidence",
      ok: evidenceIsBalanced,
      detail: evidence.length
        ? `${measuredEvidence.length} of ${evidence.length} experience or project bullets show scope or results`
        : "No experience or project bullets to review yet",
      guidance: "Not every bullet needs a number, but measurable scope or results make your strongest work more credible at a glance.",
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
      guidance: summaryWords === 0
        ? "Add a short summary only when it helps explain a pivot, specialty, or career direction."
        : "A tight summary frames your fit before the reader reaches the details.",
      actionLabel: summaryWords === 0 ? "Add optional summary" : "Shorten summary",
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

function sectionPlainText(state: ResumeState, label: string, section: string) {
  const entries = getSectionEntries(state, section).filter(entryHasContent);
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
  return lines.length ? [getSectionTitle(state, "skills"), ...lines] : [];
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
    else pushBlock(lines, sectionPlainText(state, getSectionTitle(state, key), key));
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function resumeExportFingerprint(state: ResumeState) {
  return JSON.stringify(normalizeResume(state));
}

function changedFields<K extends keyof ResumeState>(previous: ResumeState, current: ResumeState, fields: K[]) {
  return fields.filter((field) => String(previous[field] ?? "") !== String(current[field] ?? ""));
}

const CONTACT_FIELD_LABELS: Record<"name" | "title" | "email" | "phone" | "location" | "website", string> = {
  name: "Full name",
  title: "Title / role",
  email: "Email",
  phone: "Phone",
  location: "Location",
  website: "Website",
};

const ENTRY_FIELD_LABELS: Record<
  "experience" | "education" | "projects",
  Record<keyof ResumeEntry, string>
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
      fieldLabels: contactFields.map((field) => CONTACT_FIELD_LABELS[field]),
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
    const sectionDetails = repeatableSectionChangeDetails(previous, current, section);
    const entryCount = current[section].filter((entry) => entry.title || entry.subtitle || entry.meta || entry.details).length;
    changes.push({
      id: section,
      label: `${getSectionTitle(current, section)} changed`,
      detail:
        sectionDetails.fieldLabels.length
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
      targetId: current.customSections[0] ? `section-title-${current.customSections[0].id}` : "add-custom-section",
    });
  }

  if (JSON.stringify(previous.sectionOrder) !== JSON.stringify(current.sectionOrder)) {
    changes.push({
      id: "section-order",
      label: "Section order changed",
      detail: current.sectionOrder.map((section) => getSectionTitle(current, section)).join(", "),
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
