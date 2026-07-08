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
  label: string;
  ok: boolean;
  detail: string;
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

  return [
    {
      label: "Length",
      ok: pageCount <= 1,
      detail: pageCount <= 1 ? "One-page PDF" : `${pageCount} pages in preview`,
    },
    {
      label: "Contact",
      ok: missingContact.length === 0,
      detail: missingContact.length ? `Missing ${missingContact.join(", ")}` : "Core details present",
    },
    {
      label: "Bullets",
      ok: bullets.length > 0 && longBullets.length === 0,
      detail: longBullets.length
        ? `${longBullets.length} over 28 words`
        : bullets.length
          ? "Concise bullet length"
          : "Add achievement bullets",
    },
    {
      label: "Summary",
      ok: summaryWords > 0 && summaryWords <= 65,
      detail:
        summaryWords === 0
          ? "Missing summary"
          : summaryWords > 65
            ? `${summaryWords} words`
            : "Focused opening",
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
