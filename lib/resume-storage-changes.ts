import type { ResumeLibraryItem } from "@/lib/resume-workspace";
import { normalizeResume } from "@/lib/resume";

export type ResumeChange = { before?: ResumeLibraryItem; after?: ResumeLibraryItem };
const fields = ["label", "state", "importReview"] as const;
const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const normalizeItem = (item: ResumeLibraryItem): ResumeLibraryItem => ({
  ...item,
  state: normalizeResume(item.state),
});

export class ResumeConflictError extends Error {
  constructor(
    public readonly resumeId: string,
    public readonly current?: ResumeLibraryItem,
  ) {
    super(
      current
        ? "This resume changed in another tab. Review that draft before saving again."
        : "This resume was deleted in another tab. Duplicate your draft to keep it.",
    );
  }
}

export function resumeChanges(
  before: ResumeLibraryItem[],
  after: ResumeLibraryItem[],
): ResumeChange[] {
  const previous = new Map(before.map((item) => [item.id, normalizeItem(item)]));
  const next = new Map(after.map((item) => [item.id, normalizeItem(item)]));
  return [...new Set([...previous.keys(), ...next.keys()])].flatMap((id) => {
    const oldItem = previous.get(id);
    const newItem = next.get(id);
    if (oldItem && newItem && fields.every((field) => equal(oldItem[field], newItem[field])))
      return [];
    return [{ before: oldItem, after: newItem }];
  });
}

/** Merge only deliberate changes. Never resurrect a deleted record or overwrite a competing edit. */
export function mergeResumeChanges(current: ResumeLibraryItem[], changes: ResumeChange[]) {
  const merged = new Map(current.map((item) => [item.id, normalizeItem(item)]));
  for (const { before, after } of changes) {
    const id = (after ?? before)!.id;
    const stored = merged.get(id);
    if (!after) {
      if (stored && fields.some((field) => !equal(stored[field], before?.[field]))) {
        throw new ResumeConflictError(id, stored);
      }
      merged.delete(id);
    } else if (!before) {
      if (stored && fields.some((field) => !equal(stored[field], after[field]))) {
        throw new ResumeConflictError(id, stored);
      }
      if (!stored) merged.set(id, after);
    } else {
      if (!stored) throw new ResumeConflictError(id);
      const updated = { ...stored, updatedAt: after.updatedAt };
      for (const field of fields) {
        if (equal(before[field], after[field])) continue;
        if (!equal(stored[field], before[field]) && !equal(stored[field], after[field])) {
          throw new ResumeConflictError(id, stored);
        }
        Object.assign(updated, { [field]: after[field] });
      }
      merged.set(id, updated);
    }
  }
  return [...merged.values()];
}
