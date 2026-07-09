export type RoleTerm = {
  term: string;
  count: number;
  matched: boolean;
};

export type RoleFocus = {
  terms: RoleTerm[];
  matchedCount: number;
  totalCount: number;
};

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

function words(text: string) {
  return text.toLocaleLowerCase().match(/[a-z][a-z0-9+#.]*/g) ?? [];
}

function isUsefulTerm(term: string) {
  return term.length >= 3 && !STOP_WORDS.has(term) && !/^\d/.test(term);
}

/**
 * Finds the most repeated, substantive terms in a pasted job description and
 * checks whether the current resume already uses those terms. This is a
 * transparent wording aid, not an ATS score or a claim about job fit.
 */
export function buildRoleFocus(resumeText: string, jobDescription: string): RoleFocus {
  const counts = new Map<string, number>();
  words(jobDescription)
    .filter(isUsefulTerm)
    .forEach((term) => counts.set(term, (counts.get(term) ?? 0) + 1));

  const resumeTerms = new Set(words(resumeText));
  const terms = [...counts.entries()]
    .sort(([firstTerm, firstCount], [secondTerm, secondCount]) =>
      secondCount - firstCount || secondTerm.length - firstTerm.length || firstTerm.localeCompare(secondTerm),
    )
    .slice(0, MAX_TERMS)
    .map(([term, count]) => ({ term, count, matched: resumeTerms.has(term) }));

  return {
    terms,
    matchedCount: terms.filter((term) => term.matched).length,
    totalCount: terms.length,
  };
}
