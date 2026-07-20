import { describe, expect, it } from "vitest";
import { sampleState } from "@/lib/resume";
import { buildLegacyResumeWorkspace } from "@/lib/resume-db";

const NOW = "2026-07-19T12:00:00.000Z";

describe("resume IndexedDB migration", () => {
  it("turns the legacy active draft and version list into a resume workspace", () => {
    const active = { ...sampleState, name: "Current resume" };
    const archived = { ...sampleState, name: "Archived resume" };
    const workspace = buildLegacyResumeWorkspace(
      {
        savedDraft: JSON.stringify(active),
        legacyDraft: null,
        importReview: null,
        resumeLibrary: null,
        activeResumeId: null,
        checkpointHistory: null,
        legacyVersionHistory: JSON.stringify([
          {
            id: "product-checkpoint",
            savedAt: "2026-07-18T12:00:00.000Z",
            label: "Product role",
            fingerprint: "product-role",
            state: archived,
            importReview: null,
          },
        ]),
        autosaveTime: NOW,
      },
      NOW,
    );

    expect(workspace.resumeLibrary).toHaveLength(2);
    expect(workspace.activeState.name).toBe("Current resume");
    expect(workspace.activeUpdatedAt).toBe(NOW);
    expect(workspace.resumeLibrary[1]).toMatchObject({
      id: "resume-migrated-product-checkpoint",
      label: "Product role",
      state: { name: "Archived resume" },
    });
  });

  it("preserves an existing multi-resume library and per-resume checkpoints", () => {
    const first = {
      id: "resume-first",
      label: "Engineering",
      createdAt: NOW,
      updatedAt: NOW,
      state: sampleState,
      importReview: null,
    };
    const second = {
      ...first,
      id: "resume-second",
      label: "Product",
      state: { ...sampleState, name: "Grace Hopper" },
    };
    const checkpoint = {
      id: "checkpoint-one",
      savedAt: NOW,
      label: "Baseline",
      fingerprint: "baseline",
      state: sampleState,
      importReview: null,
    };
    const workspace = buildLegacyResumeWorkspace(
      {
        savedDraft: null,
        legacyDraft: null,
        importReview: null,
        resumeLibrary: JSON.stringify([first, second]),
        activeResumeId: second.id,
        checkpointHistory: JSON.stringify({ [second.id]: [checkpoint] }),
        legacyVersionHistory: null,
        autosaveTime: null,
      },
      NOW,
    );

    expect(workspace.activeResumeId).toBe(second.id);
    expect(workspace.activeState.name).toBe("Grace Hopper");
    expect(workspace.checkpointHistoryByResume[second.id]).toHaveLength(1);
  });
});
