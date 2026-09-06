import { describe, expect, it } from "vitest";
import { emptyState, normalizeResume, sampleState, parseResumeJson } from "@/lib/resume";
import { mergeResumeChanges, resumeChanges } from "@/lib/resume-storage-changes";
import type { ResumeLibraryItem } from "@/lib/resume-workspace";

const original: ResumeLibraryItem = {
  id: "a",
  label: "Original",
  createdAt: "2026-09-05",
  updatedAt: "2026-09-05",
  state: sampleState(),
  importReview: null,
};
describe("concurrent resume changes", () => {
  it("compares legacy and normalized drafts consistently on the first edit", () => {
    const empty = { ...original, state: emptyState() };
    const updated = { ...original, state: sampleState() };
    expect(
      mergeResumeChanges(
        [{ ...empty, state: normalizeResume(empty.state) }],
        resumeChanges([empty], [updated]),
      )[0].state.name,
    ).toBe("John Doe");
  });
  it("preserves unrelated creates and renames while editing a draft", () => {
    const updated = { ...original, state: { ...original.state, name: "New name" } };
    const merged = mergeResumeChanges(
      [
        { ...original, label: "Renamed elsewhere" },
        { ...original, id: "b" },
      ],
      resumeChanges([original], [updated]),
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ label: "Renamed elsewhere", state: { name: "New name" } });
  });
  it("rejects competing content edits and does not resurrect deleted resumes", () => {
    const updated = { ...original, state: { ...original.state, name: "Local" } };
    const changes = resumeChanges([original], [updated]);
    expect(() =>
      mergeResumeChanges([{ ...original, state: { ...original.state, name: "Remote" } }], changes),
    ).toThrow(/changed in another tab/);
    expect(() => mergeResumeChanges([], changes)).toThrow(/deleted in another tab/);
  });
  it("deletes only the specified unchanged record and replays commits idempotently", () => {
    const second = { ...original, id: "b" };
    expect(mergeResumeChanges([original, second], resumeChanges([original], []))).toEqual([second]);
    const updated = { ...original, label: "Updated" };
    expect(mergeResumeChanges([updated], resumeChanges([original], [updated]))).toEqual([updated]);
  });
});
describe("resume JSON validation", () => {
  it("rejects unrelated objects, arrays and malformed field types", () => {
    for (const value of [
      "{}",
      '{"unrelated":true}',
      "[]",
      "null",
      '{"name":42}',
      '{"name":"package","version":"1"}',
      '{"experience":[42]}',
    ])
      expect(() => parseResumeJson(value)).toThrow();
  });
  it("accepts full exports and recognizable legacy partial resumes", () => {
    expect(parseResumeJson(JSON.stringify(sampleState())).name).toBe("John Doe");
    expect(parseResumeJson('{"name":"Ada","experience":[]}').name).toBe("Ada");
  });
});
