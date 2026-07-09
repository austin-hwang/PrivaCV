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
import { buildRoleFocus } from "@/lib/job-match";

describe("resume helpers", () => {
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
});
