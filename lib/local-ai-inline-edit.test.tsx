/** @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateLocalAIText: vi.fn(async () => "Improved sentence with clearer impact."),
  interruptLocalAIGeneration: vi.fn(),
  trackInlineAIEvent: vi.fn(),
}));

vi.mock("@/features/resume/hooks/use-local-ai-runtime", () => ({ useLocalAIReady: () => true }));
vi.mock("@/lib/local-ai-engine", () => ({
  friendlyLocalAIError: (error: unknown) => String(error),
  generateLocalAIText: mocks.generateLocalAIText,
  interruptLocalAIGeneration: mocks.interruptLocalAIGeneration,
}));
vi.mock("@/lib/inline-ai-metrics", () => ({ trackInlineAIEvent: mocks.trackInlineAIEvent }));

import { LocalAIInlineEdit } from "@/features/resume/components/local-ai-inline-edit";

describe("LocalAIInlineEdit metrics", () => {
  it("records a request and acceptance without passing any text to analytics", async () => {
    const onApply = vi.fn();
    render(
      <LocalAIInlineEdit
        label="Professional summary"
        text="Original sentence with useful detail."
        onApply={onApply}
        onClose={vi.fn()}
        onOpenSetup={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/AI edit instruction/i), { target: { value: "Make this clearer." } });
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));

    await screen.findByText("Improved sentence with clearer impact.");
    expect(mocks.trackInlineAIEvent).toHaveBeenCalledWith("inline_ai_used");
    expect(mocks.trackInlineAIEvent).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /apply edit/i }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith("<p>Improved sentence with clearer impact.</p>"));
    expect(mocks.trackInlineAIEvent).toHaveBeenLastCalledWith("inline_ai_accepted");
    expect(mocks.trackInlineAIEvent).toHaveBeenCalledTimes(2);
  });
});
