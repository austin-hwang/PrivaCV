import { describe, expect, it } from "vitest";
import {
  buildResumeChecks,
  emptyState,
  exportChangeSummary,
  normalizeResume,
  resumeExportFingerprint,
  resumePlainText,
  sampleState,
} from "@/lib/resume";
import { buildRoleFocus, buildRolePhraseSuggestions, reviewRolePhrase } from "@/lib/job-match";
import { importResumeText } from "@/lib/pdf-import";
import {
  MAX_VERSION_HISTORY,
  VERSION_HISTORY_BACKUP_FORMAT,
  VERSION_HISTORY_BACKUP_VERSION,
  buildImportReview,
  mergeVersionHistory,
  parseExportCheckpoint,
  parseVersionHistoryBackup,
  roleContextFingerprint,
  versionContentBadges,
  versionHistoryFingerprint,
  type VersionHistoryItem,
} from "@/lib/resume-workspace";

describe("resume helpers", () => {
  it("imports pasted resume text with line-ending cleanup", () => {
    const state = importResumeText(
      "Ada Lovelace\r\nPlatform Engineer\r\nada@example.com | San Francisco, CA\r\n\r\nExperience\r\nEngineer | Analytical Engines | 2022–Present\r\n• Built reliable systems.",
    );

    expect(state).toMatchObject({
      name: "Ada Lovelace",
      title: "Platform Engineer",
      email: "ada@example.com",
      location: "San Francisco, CA",
    });
    expect(state.experience[0]).toMatchObject({ title: "Engineer", subtitle: "Analytical Engines" });
  });

  it("rejects an empty pasted resume", () => {
    expect(() => importResumeText(" \n\t ")).toThrow("Paste some resume text to import.");
  });

  it("normalizes legacy JSON into a complete resume state", () => {
    const state = normalizeResume({ name: "Ada", sectionOrder: ["skills"] });

    expect(state.name).toBe("Ada");
    expect(state.sectionOrder).toEqual(["skills", "education", "experience", "projects"]);
    expect(state.experience).toHaveLength(0);
  });

  it("renders deterministic plain text in section order", () => {
    const state = sampleState();
    const text = resumePlainText(state);

    expect(text).toContain("Jane Doe");
    expect(text.indexOf("Education")).toBeLessThan(text.indexOf("Experience"));
    expect(text).toContain("- Led migration of monolith to microservices, cutting deploy time by 60%.");
  });

  it("builds useful export-readiness checks", () => {
    const state = sampleState();
    const checks = buildResumeChecks(state, 1);

    expect(checks).toHaveLength(5);
    expect(checks.every((check) => check.ok)).toBe(true);
  });

  it("targets the first missing contact field", () => {
    const checks = buildResumeChecks({ ...sampleState(), phone: "" }, 1);
    const contact = checks.find((check) => check.id === "contact");

    expect(contact).toMatchObject({
      ok: false,
      actionLabel: "Fix contact",
      targetId: "field-phone",
    });
  });

  it("explains sparse resumes with actionable density guidance", () => {
    const checks = buildResumeChecks({ ...emptyState(), name: "Ada Lovelace", email: "ada@example.com" }, 1);
    const density = checks.find((check) => check.id === "density");

    expect(density).toMatchObject({
      ok: false,
      actionLabel: "Add proof",
      targetId: "field-experience-0-details",
    });
    expect(density?.guidance).toContain("proof");
  });

  it("fingerprints export-relevant resume changes", () => {
    const exported = sampleState();
    const edited = { ...exported, summary: `${exported.summary} Edited.` };
    const resized = { ...exported, textScale: 0.9 };

    expect(resumeExportFingerprint(exported)).toBe(resumeExportFingerprint(normalizeResume(exported)));
    expect(resumeExportFingerprint(edited)).not.toBe(resumeExportFingerprint(exported));
    expect(resumeExportFingerprint(resized)).not.toBe(resumeExportFingerprint(exported));
  });

  it("summarizes changes since the last export snapshot", () => {
    const exported = sampleState();
    const edited = {
      ...exported,
      phone: "",
      summary: "Focused product engineer with strong launch experience.",
      textScale: 0.92,
    };

    expect(exportChangeSummary(exported, edited)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "contact", label: "Header changed", targetId: "field-phone" }),
        expect.objectContaining({ id: "summary", label: "Summary changed", targetId: "field-summary" }),
        expect.objectContaining({ id: "text-size", label: "Text size changed", targetId: "resume-text-scale" }),
      ]),
    );
  });

  it("includes before and after snippets for edited export areas", () => {
    const exported = sampleState();
    const edited = {
      ...exported,
      summary: "Focused product engineer with strong launch experience.",
      skills: "Languages: TypeScript, Go\nTools: Docker, AWS",
    };
    const changes = exportChangeSummary(exported, edited);

    expect(changes.find((change) => change.id === "summary")).toMatchObject({
      before: expect.stringContaining("Software engineer specializing"),
      after: "Focused product engineer with strong launch experience.",
    });
    expect(changes.find((change) => change.id === "skills")).toMatchObject({
      before: expect.stringContaining("Languages: JavaScript"),
      after: "Languages: TypeScript, Go / Tools: Docker, AWS",
    });
  });

  it("names exact fields changed inside repeatable sections", () => {
    const exported = sampleState();
    const edited = {
      ...exported,
      experience: exported.experience.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              title: "Staff Software Engineer",
              details: `${entry.details}\nLaunched a hiring dashboard used by every recruiting coordinator.`,
            }
          : entry,
      ),
    };

    expect(exportChangeSummary(exported, edited).find((change) => change.id === "experience")).toMatchObject({
      detail: "2 fields edited",
      targetId: "field-experience-0-title",
      fieldLabels: ["Entry 1 Job title", "Entry 1 Achievements"],
    });
  });

  it("returns no export changes when normalized resume states match", () => {
    const saved = sampleState();

    expect(exportChangeSummary(saved, normalizeResume(saved))).toEqual([]);
  });

  it("surfaces substantive role terms without presenting an ATS score", () => {
    const focus = buildRoleFocus(
      "Product engineer building TypeScript services and React interfaces.",
      "The product engineer will build TypeScript services, partner with product teams, and improve TypeScript systems.",
    );

    expect(focus.terms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ term: "typescript", count: 2, matched: true }),
        expect.objectContaining({ term: "product", matched: true }),
        expect.objectContaining({ term: "services", matched: true }),
        expect.objectContaining({ term: "partner", matched: false }),
      ]),
    );
    expect(focus.matchedCount).toBeGreaterThan(0);
    expect(focus.totalCount).toBeLessThanOrEqual(14);
  });

  it("checks an opted-in role phrase in word order while ignoring punctuation", () => {
    const resume = "Built TypeScript services, improving release reliability.";

    expect(reviewRolePhrase(resume, "TypeScript services")).toMatchObject({
      termCount: 2,
      matched: true,
    });
    expect(reviewRolePhrase(resume, "services TypeScript")).toMatchObject({
      termCount: 2,
      matched: false,
    });
    expect(reviewRolePhrase(resume, "TypeScript")).toMatchObject({
      termCount: 1,
      matched: false,
    });
    expect(reviewRolePhrase("Chart leadership", "art lead")).toMatchObject({
      termCount: 2,
      matched: false,
    });
  });

  it("suggests a small set of exact job-description phrases with transparent matches", () => {
    const suggestions = buildRolePhraseSuggestions(
      "Built TypeScript services and React interfaces for product teams.",
      "Build TypeScript services, partner with product teams, and improve TypeScript services.",
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phrase: "TypeScript services", termCount: 2, matched: true }),
      ]),
    );
  });

  it("normalizes saved export checkpoints and rejects malformed data", () => {
    const state = sampleState();
    const checkpoint = parseExportCheckpoint(
      JSON.stringify({
        fingerprint: "abc",
        exportedAt: "2026-07-09T12:00:00.000Z",
        pageCount: 1,
        issueCount: 0,
        snapshot: { ...state, sectionOrder: ["skills"] },
      }),
    );

    expect(checkpoint?.snapshot?.sectionOrder).toEqual(["skills", "education", "experience", "projects"]);
    expect(parseExportCheckpoint(JSON.stringify({ fingerprint: "abc" }))).toBeNull();
    expect(parseExportCheckpoint("not json")).toBeNull();
  });

  it("parses version-history backups without applying the browser slot limit early", () => {
    const checkpoints = Array.from({ length: MAX_VERSION_HISTORY + 2 }, (_, index): VersionHistoryItem => ({
      id: `${index}`,
      savedAt: `2026-07-0${index + 1}T12:00:00.000Z`,
      label: `Draft ${index}`,
      fingerprint: `fingerprint-${index}`,
      state: sampleState(),
      importReview: null,
    }));

    expect(
      parseVersionHistoryBackup({
        format: VERSION_HISTORY_BACKUP_FORMAT,
        version: VERSION_HISTORY_BACKUP_VERSION,
        exportedAt: "2026-07-09T12:00:00.000Z",
        checkpoints,
      }),
    ).toHaveLength(MAX_VERSION_HISTORY + 2);
  });

  it("deduplicates version history by resume and role context when merging backups", () => {
    const baseState = sampleState();
    const existing: VersionHistoryItem[] = [
      {
        id: "1",
        savedAt: "2026-07-09T12:00:00.000Z",
        label: "Current",
        fingerprint: "same-resume",
        state: baseState,
        importReview: null,
        roleLabel: "Frontend",
      },
    ];
    const incoming: VersionHistoryItem[] = [
      {
        ...existing[0],
        id: "incoming-duplicate",
      },
      {
        ...existing[0],
        id: "incoming-new-role",
        savedAt: "2026-07-10T12:00:00.000Z",
        label: "Backend",
        roleLabel: "Backend",
      },
    ];

    const merged = mergeVersionHistory(existing, incoming);

    expect(merged.matchingCheckpoints).toHaveLength(1);
    expect(merged.incomingUnique).toHaveLength(1);
    expect(merged.checkpoints.map((item) => item.label)).toEqual(["Backend", "Current"]);
    expect(versionHistoryFingerprint(existing[0])).toBe(`same-resume\u0000${roleContextFingerprint(undefined, "Frontend")}`);
  });

  it("builds import-review targets for likely PDF parser guesses", () => {
    const state = sampleState();
    const review = buildImportReview(state, "resume.pdf");

    expect(review.fileName).toBe("resume.pdf");
    expect(review.sections).toEqual(expect.arrayContaining(["Header", "Summary", "Experience", "Education", "Projects", "Skills"]));
    expect(review.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "contact", targetId: "field-name" }),
        expect.objectContaining({ id: "experience", targetId: "field-experience-0-title" }),
        expect.objectContaining({ id: "skills", targetId: "field-skills" }),
      ]),
    );
  });

  it("summarizes version content badges from normalized resume content", () => {
    expect(versionContentBadges(emptyState())).toEqual(["Empty draft"]);
    expect(versionContentBadges(sampleState())).toEqual(
      expect.arrayContaining(["2 roles", "1 education", "1 project", "4 skill lines"]),
    );
  });
});
