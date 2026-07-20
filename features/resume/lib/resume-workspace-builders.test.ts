import { describe, expect, it, vi } from "vitest";
import { buildResumeChecks, sampleState } from "@/lib/resume";
import { buildImportCoverage, buildImportReview } from "@/lib/resume-workspace";
import {
  buildCheckTourSteps,
  buildImportTourSteps,
  buildNavigatorItems,
  buildSectionNavItems,
  reviewTourTargetId,
} from "@/features/resume/lib/resume-workspace-builders";

describe("resume workspace builders", () => {
  it("builds stable section and field navigation from resume state", () => {
    const state = sampleState();

    expect(buildSectionNavItems(state, false)).toEqual([]);
    expect(buildNavigatorItems(state, false)).toEqual([]);
    expect(buildSectionNavItems(state, true)).toEqual(expect.arrayContaining([
      { id: "edit-header", label: "Header" },
      { id: "edit-summary", label: "Summary" },
      { id: "edit-section-experience", label: "Experience" },
    ]));
    expect(buildNavigatorItems(state, true)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "field-name", context: "Header" }),
      expect.objectContaining({ id: "field-summary", context: "Summary" }),
      expect.objectContaining({ id: "section-title-experience", context: "Section heading" }),
    ]));
  });

  it("maps legacy skills review targets to the stable section region", () => {
    expect(reviewTourTargetId("field-skills")).toBe("review-region-skills");
    expect(reviewTourTargetId("field-summary")).toBe("field-summary");
  });

  it("keeps import and check actions connected to their coordinator callbacks", () => {
    const state = sampleState();
    const sourceText = "Experience\nProduct leadership\nSkills\nTypeScript";
    const importReview = buildImportReview(state, "resume.txt", sourceText);
    const toggleItem = vi.fn();
    const focusImportTarget = vi.fn();
    const skippedCoverage = buildImportCoverage(state, sourceText).filter((item) => item.sourceDetected && !item.detected);
    const importSteps = buildImportTourSteps({ importReview, skippedCoverage, onToggleItem: toggleItem, onFocusTarget: focusImportTarget });

    importSteps[0]?.action?.run();
    expect(toggleItem).toHaveBeenCalledWith(importReview.items[0]?.id);

    const focusCheckTarget = vi.fn();
    const checkSteps = buildCheckTourSteps(buildResumeChecks(state, 1), focusCheckTarget);
    const actionable = checkSteps.find((step) => step.action);
    actionable?.action?.run();
    if (actionable) expect(focusCheckTarget).toHaveBeenCalledWith(actionable.targetId);
  });
});
