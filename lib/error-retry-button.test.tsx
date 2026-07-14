/** @vitest-environment jsdom */

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorRetryButton } from "@/components/error-retry-button";

describe("ErrorRetryButton", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows progress, retries the boundary, and falls back to a page refresh", () => {
    vi.useFakeTimers();
    const reset = vi.fn();
    const reload = vi.fn();
    render(<ErrorRetryButton reset={reset} reload={reload} />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledOnce();
    expect((screen.getByRole("button", { name: "Refreshing…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(reload).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(250));
    expect(reload).toHaveBeenCalledOnce();
  });
});
