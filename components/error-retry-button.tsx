"use client";

import React, { useState, type CSSProperties } from "react";

type ErrorRetryButtonProps = {
  reset: () => void;
  className?: string;
  style?: CSSProperties;
  /** Injectable so the retry fallback can be verified without reloading a test page. */
  reload?: () => void;
};

export function ErrorRetryButton({
  reset,
  className,
  style,
  reload = () => window.location.reload(),
}: ErrorRetryButtonProps) {
  const [retrying, setRetrying] = useState(false);

  const retry = () => {
    if (retrying) return;
    setRetrying(true);

    // Give the error boundary a chance to recover without a navigation. If the
    // same error is thrown again, fall back to a real refresh so the action can
    // never leave someone on an unchanged, apparently unresponsive screen.
    window.setTimeout(reload, 250);
    reset();
  };

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={retry}
      disabled={retrying}
      aria-busy={retrying}
    >
      {retrying ? "Refreshing…" : "Try again"}
    </button>
  );
}
