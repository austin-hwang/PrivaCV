import type { ResumeEntry, ResumeState } from "@/lib/resume";
import { stripRichMarks } from "@/lib/rich-text";

export type RoleTermEvidence = {
  label: string;
  targetId: string;
  isConcrete: boolean;
};

export type RoleTerm = {
  term: string;
  count: number;
  matched: boolean;
  evidence: RoleTermEvidence[];
  isRequirement: boolean;
};

export type RoleFocus = {
  terms: RoleTerm[];
  matchedCount: number;
  totalCount: number;
  requirementCount: number;
};

export type RolePhraseReview = {
  phrase: string;
  termCount: number;
  matched: boolean;
};

export type RolePhraseSuggestion = RolePhraseReview;

const STOP_WORDS = new Set([
  "about",
  "across",
  "after",
  "also",
  "and",
  "are",
  "around",
  "because",
  "been",
  "being",
  "both",
  "but",
  "can",
  "candidate",
  "company",
  "customers",
  "develop",
  "development",
  "employment",
  "ensure",
  "experience",
  "for",
  "from",
  "have",
  "highly",
  "ideal",
  "including",
  "into",
  "job",
  "join",
  "looking",
  "more",
  "must",
  "new",
  "our",
  "preferred",
  "required",
  "role",
  "skills",
  "strong",
  "successful",
  "team",
  "teams",
  "that",
  "the",
  "their",
  "they",
  "this",
  "through",
  "using",
  "what",
  "will",
  "with",
  "work",
  "working",
  "years",
  "you",
  "your",
]);

const MAX_TERMS = 14;
const MAX_REQUIREMENT_TERMS = 7;
const MAX_PHRASE_SUGGESTIONS = 3;
const PHRASE_STOP_WORDS = new Set([
  ...STOP_WORDS,
  "build",
  "builds",
  "collaborate",
  "collaborating",
  "create",
  "creating",
  "deliver",
  "delivering",
  "drive",
  "driving",
  "improve",
  "improving",
  "lead",
  "leading",
  "manage",
  "managing",
  "partner",
  "partnering",
  "support",
  "supporting",
]);

const REQUIREMENT_HEADINGS = new Set([
  "basic qualifications",
  "desired qualifications",
  "minimum qualifications",
  "must have",
  "must-haves",
  "nice to have",
  "nice-to-haves",
  "preferred qualifications",
  "qualifications",
  "requirements",
  "skills",
  "what we are looking for",
  "what we're looking for",
  "what you bring",
  "what you'll bring",
  "you have",
]);

const NON_REQUIREMENT_HEADINGS = new Set([
  "about the company",
  "about the role",
  "about us",
  "application process",
  "benefits",
  "compensation",
  "equal opportunity",
  "interview process",
  "responsibilities",
  "the role",
  "what you'll do",
  "what you will do",
  "who we are",
]);

function rawWords(text: string) {
  return (text.match(/[a-z][a-z0-9+#.]*/gi) ?? [])
    .map((term) => term.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
}

function words(text: string) {
  return rawWords(text).map((term) => term.toLocaleLowerCase());
}

function isUsefulTerm(term: string) {
  return term.length >= 3 && !STOP_WORDS.has(term) && !/^\d/.test(term);
}

function isUsefulPhraseTerm(term: string) {
  return term.length >= 3 && !PHRASE_STOP_WORDS.has(term) && !/^\d/.test(term);
}

function containsTerm(text: string, term: string) {
  return words(text).includes(term);
}

function normalizeHeading(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[\s:–—-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function requirementHeading(line: string) {
  const [heading, ...remainder] = line.split(":");
  const normalizedHeading = normalizeHeading(heading);
  if (!REQUIREMENT_HEADINGS.has(normalizedHeading)) return null;
  return remainder.join(":").trim();
}

/**
 * Pulls terms from common qualification-style job-description sections. The
 * parser intentionally recognizes only explicit headings, so it can elevate
 * a stated requirement without guessing whether a sentence is essential.
 */
function requirementTermOrder(jobDescription: string) {
  const terms = new Map<string, number>();
  let isReadingRequirements = false;

  jobDescription.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const headingRemainder = requirementHeading(trimmed);
    if (headingRemainder !== null) {
      isReadingRequirements = true;
      words(headingRemainder)
        .filter(isUsefulTerm)
        .forEach((term) => {
          if (!terms.has(term)) terms.set(term, terms.size);
        });
      return;
    }

    if (NON_REQUIREMENT_HEADINGS.has(normalizeHeading(trimmed))) {
      isReadingRequirements = false;
      return;
    }

    if (!isReadingRequirements) return;
    words(trimmed)
      .filter(isUsefulTerm)
      .forEach((term) => {
        if (!terms.has(term)) terms.set(term, terms.size);
      });
  });

  return terms;
}

function entryEvidence(
  section: "experience" | "projects",
  entries: ResumeEntry[],
  term: string,
): RoleTermEvidence[] {
  return entries.flatMap((entry, index) => {
    const detailsMatch = containsTerm(stripRichMarks(entry.details), term);
    const contextMatch = containsTerm([entry.title, entry.subtitle, entry.meta].join(" "), term);
    if (!detailsMatch && !contextMatch) return [];

    return [
      {
        label: `${section === "experience" ? "Experience" : "Project"} ${index + 1}`,
        targetId: `field-${section}-${index}-${detailsMatch ? "details" : "title"}`,
        isConcrete: detailsMatch,
      },
    ];
  });
}

function findTermEvidence(state: ResumeState, term: string): RoleTermEvidence[] {
  const evidence: RoleTermEvidence[] = [];

  if (containsTerm(stripRichMarks(state.summary), term)) {
    evidence.push({ label: "Summary", targetId: "field-summary", isConcrete: false });
  }
  if (containsTerm(state.skills, term)) {
    evidence.push({ label: "Skills", targetId: "field-skills", isConcrete: false });
  }
  if (containsTerm(state.title, term)) {
    evidence.push({ label: "Title", targetId: "field-title", isConcrete: false });
  }

  return [
    ...entryEvidence("experience", state.experience, term),
    ...entryEvidence("projects", state.projects, term),
    ...evidence,
  ];
}

/**
 * Finds the most repeated, substantive terms in a pasted job description and
 * checks whether the current resume already uses those terms. This is a
 * transparent wording aid, not an ATS score or a claim about job fit.
 */
export function buildRoleFocus(resume: ResumeState | string, jobDescription: string): RoleFocus {
  const counts = new Map<string, number>();
  words(jobDescription)
    .filter(isUsefulTerm)
    .forEach((term) => counts.set(term, (counts.get(term) ?? 0) + 1));

  const resumeText =
    typeof resume === "string"
      ? resume
      : [
          resume.name,
          resume.title,
          resume.email,
          resume.phone,
          resume.location,
          resume.website,
          stripRichMarks(resume.summary),
          resume.skills,
          ...resume.experience.flatMap((entry) => [
            entry.title,
            entry.subtitle,
            entry.meta,
            stripRichMarks(entry.details),
          ]),
          ...resume.projects.flatMap((entry) => [
            entry.title,
            entry.subtitle,
            entry.meta,
            stripRichMarks(entry.details),
          ]),
          ...resume.education.flatMap((entry) => [
            entry.title,
            entry.subtitle,
            entry.meta,
            stripRichMarks(entry.details),
          ]),
        ].join(" ");
  const resumeTerms = new Set(words(resumeText));
  const rankedTerms = [...counts.entries()].sort(
    ([firstTerm, firstCount], [secondTerm, secondCount]) =>
      secondCount - firstCount ||
      secondTerm.length - firstTerm.length ||
      firstTerm.localeCompare(secondTerm),
  );
  const requirements = requirementTermOrder(jobDescription);
  const requirementTerms = rankedTerms
    .filter(([term]) => requirements.has(term))
    .sort(
      ([firstTerm, firstCount], [secondTerm, secondCount]) =>
        secondCount - firstCount ||
        (requirements.get(firstTerm) ?? 0) - (requirements.get(secondTerm) ?? 0),
    )
    .slice(0, MAX_REQUIREMENT_TERMS);
  const generalTerms = rankedTerms.filter(([term]) => !requirements.has(term));
  const selectedTerms = [...requirementTerms, ...generalTerms].slice(0, MAX_TERMS);
  const terms = selectedTerms.map(([term, count]) => ({
    term,
    count,
    matched: resumeTerms.has(term),
    evidence: typeof resume === "string" ? [] : findTermEvidence(resume, term),
    isRequirement: requirements.has(term),
  }));

  return {
    terms,
    matchedCount: terms.filter((term) => term.matched).length,
    totalCount: terms.length,
    requirementCount: terms.filter((term) => term.isRequirement).length,
  };
}

/**
 * Checks whether a user-selected multi-word phrase appears in the resume in
 * the same word order. Punctuation and whitespace do not affect the result,
 * which keeps the review useful for resume bullets and skill lists while
 * remaining explicit about what is (and is not) being compared.
 */
export function reviewRolePhrase(resumeText: string, phrase: string): RolePhraseReview {
  const phraseTerms = words(phrase);
  const resumeTerms = words(resumeText);
  const matched =
    phraseTerms.length >= 2 &&
    resumeTerms.some((_, index) =>
      phraseTerms.every((term, phraseIndex) => resumeTerms[index + phraseIndex] === term),
    );

  return {
    phrase: phrase.trim(),
    termCount: phraseTerms.length,
    matched,
  };
}

/**
 * Surfaces a small set of exact two-word phrases from the role description so
 * people can review useful concepts without having to spot every phrase on
 * their own. Suggestions remain deterministic, local, and deliberately avoid
 * inferring missing skills or job fit.
 */
export function buildRolePhraseSuggestions(
  resumeText: string,
  jobDescription: string,
): RolePhraseSuggestion[] {
  const sourceTerms = rawWords(jobDescription);
  const normalizedTerms = sourceTerms.map((term) => term.toLocaleLowerCase());
  const counts = new Map<string, number>();
  normalizedTerms
    .filter(isUsefulTerm)
    .forEach((term) => counts.set(term, (counts.get(term) ?? 0) + 1));

  const candidates = new Map<string, { phrase: string; score: number; occurrences: number }>();
  normalizedTerms.forEach((term, index) => {
    const nextTerm = normalizedTerms[index + 1];
    if (!nextTerm || !isUsefulPhraseTerm(term) || !isUsefulPhraseTerm(nextTerm)) return;

    const key = `${term} ${nextTerm}`;
    const existing = candidates.get(key);
    const score = (counts.get(term) ?? 0) + (counts.get(nextTerm) ?? 0);
    candidates.set(key, {
      phrase: existing?.phrase ?? `${sourceTerms[index]} ${sourceTerms[index + 1]}`,
      score,
      occurrences: (existing?.occurrences ?? 0) + 1,
    });
  });

  return [...candidates.values()]
    .sort(
      (first, second) =>
        second.occurrences - first.occurrences ||
        second.score - first.score ||
        first.phrase.localeCompare(second.phrase),
    )
    .slice(0, MAX_PHRASE_SUGGESTIONS)
    .map(({ phrase }) => reviewRolePhrase(resumeText, phrase));
}
