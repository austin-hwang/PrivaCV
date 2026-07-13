import { resumePlainText, type ResumeState } from "@/lib/resume";

export type JobMatchTerm = {
  term: string;
  count: number;
  matched: boolean;
};

export type JobMatchAnalysis = {
  terms: JobMatchTerm[];
  matchedTerms: JobMatchTerm[];
  missingTerms: JobMatchTerm[];
};

// These are connective or broadly applicable words, not useful tailoring
// signals. Keeping the list deliberately conservative leaves recognizable
// role, tool, domain, and skill terms for the person to evaluate.
const STOP_WORDS = new Set([
  "about", "across", "after", "also", "and", "are", "around", "as", "at", "be", "been", "being", "both",
  "build", "building", "business", "but", "by", "can", "candidate", "company", "customers", "deliver", "delivering",
  "demonstrated", "detail", "do", "drive", "driving", "each", "ensure", "for", "from", "have", "help", "high",
  "ideal", "in", "including", "into", "is", "it", "its", "job", "join", "knowledge", "looking", "make", "more",
  "must", "need", "new", "of", "on", "or", "our", "out", "people", "preferred", "proven", "role", "skills",
  "strong", "such", "team", "teams", "that", "the", "their", "this", "to", "using", "we", "well", "will", "with",
  "work", "working", "you", "your",
]);

function normalizedToken(token: string) {
  return token.toLocaleLowerCase().replace(/^[^\p{L}\p{N}+#.]+|[^\p{L}\p{N}+#.]+$/gu, "");
}

function displayTerm(token: string) {
  return token.replace(/^[^\p{L}\p{N}+#.]+|[^\p{L}\p{N}+#.]+$/gu, "");
}

function termPattern(term: string) {
  return new RegExp(`(^|[^\\p{L}\\p{N}+#.])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}+#.])`, "iu");
}

/**
 * Finds distinctive, exact terms shared by a pasted job description and the
 * current resume. It intentionally makes no claim that a missing term should
 * be added: the person remains responsible for truthful tailoring.
 */
export function analyzeJobMatch(jobDescription: string, state: ResumeState): JobMatchAnalysis {
  const terms = new Map<string, { term: string; count: number }>();

  for (const rawToken of jobDescription.match(/[\p{L}][\p{L}\p{N}+#.\-/]*/gu) ?? []) {
    const term = normalizedToken(rawToken);
    if (
      !term ||
      STOP_WORDS.has(term) ||
      (term.length < 3 && !/[+#.]/.test(term) && rawToken !== "R" && rawToken !== "Go")
    ) continue;

    const existing = terms.get(term);
    if (existing) existing.count += 1;
    else terms.set(term, { term: displayTerm(rawToken), count: 1 });
  }

  const resumeText = resumePlainText(state);
  const ranked = [...terms.entries()]
    .map(([normalized, candidate]) => ({
      ...candidate,
      normalized,
      matched: termPattern(normalized).test(resumeText),
    }))
    .sort((left, right) => right.count - left.count || Number(right.matched) - Number(left.matched) || left.term.localeCompare(right.term))
    .slice(0, 24)
    .map(({ normalized: _normalized, ...term }) => term);

  return {
    terms: ranked,
    matchedTerms: ranked.filter((term) => term.matched),
    missingTerms: ranked.filter((term) => !term.matched),
  };
}
