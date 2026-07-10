import type { ResumeEntry, ResumeState } from "@/lib/resume";

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
};

export type RoleFocus = {
  terms: RoleTerm[];
  matchedCount: number;
  totalCount: number;
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

function entryEvidence(section: "experience" | "projects", entries: ResumeEntry[], term: string): RoleTermEvidence[] {
  return entries.flatMap((entry, index) => {
    const detailsMatch = containsTerm(entry.details, term);
    const contextMatch = containsTerm([entry.title, entry.subtitle, entry.meta].join(" "), term);
    if (!detailsMatch && !contextMatch) return [];

    return [{
      label: `${section === "experience" ? "Experience" : "Project"} ${index + 1}`,
      targetId: `field-${section}-${index}-${detailsMatch ? "details" : "title"}`,
      isConcrete: detailsMatch,
    }];
  });
}

function findTermEvidence(state: ResumeState, term: string): RoleTermEvidence[] {
  const evidence: RoleTermEvidence[] = [];

  if (containsTerm(state.summary, term)) {
    evidence.push({ label: "Summary", targetId: "field-summary", isConcrete: false });
  }
  if (containsTerm(state.skills, term)) {
    evidence.push({ label: "Skills", targetId: "field-skills", isConcrete: false });
  }
  if (containsTerm(state.title, term)) {
    evidence.push({ label: "Title", targetId: "field-title", isConcrete: false });
  }

  return [...entryEvidence("experience", state.experience, term), ...entryEvidence("projects", state.projects, term), ...evidence];
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

  const resumeText = typeof resume === "string" ? resume : [
    resume.name,
    resume.title,
    resume.email,
    resume.phone,
    resume.location,
    resume.website,
    resume.summary,
    resume.skills,
    ...resume.experience.flatMap((entry) => [entry.title, entry.subtitle, entry.meta, entry.details]),
    ...resume.projects.flatMap((entry) => [entry.title, entry.subtitle, entry.meta, entry.details]),
    ...resume.education.flatMap((entry) => [entry.title, entry.subtitle, entry.meta, entry.details]),
  ].join(" ");
  const resumeTerms = new Set(words(resumeText));
  const terms = [...counts.entries()]
    .sort(([firstTerm, firstCount], [secondTerm, secondCount]) =>
      secondCount - firstCount || secondTerm.length - firstTerm.length || firstTerm.localeCompare(secondTerm),
    )
    .slice(0, MAX_TERMS)
    .map(([term, count]) => ({
      term,
      count,
      matched: resumeTerms.has(term),
      evidence: typeof resume === "string" ? [] : findTermEvidence(resume, term),
    }));

  return {
    terms,
    matchedCount: terms.filter((term) => term.matched).length,
    totalCount: terms.length,
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
  const matched = phraseTerms.length >= 2 && resumeTerms.some((_, index) =>
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
export function buildRolePhraseSuggestions(resumeText: string, jobDescription: string): RolePhraseSuggestion[] {
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
