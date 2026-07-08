import { describe, expect, it } from "vitest";
import { buildResumeChecks, normalizeResume, resumePlainText, sampleState } from "@/lib/resume";

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

    expect(checks).toHaveLength(4);
    expect(checks.every((check) => check.ok)).toBe(true);
  });
});
