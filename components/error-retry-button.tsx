"use client";

import React, { useState, type CSSProperties } from "react";
import { Button as ButtonPrimitive } from "react-aria-components";

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
    <ButtonPrimitive
      ref={(node) => {
        // React Aria doesn't forward `aria-busy`; set it directly to keep the
        // pending state exposed to assistive tech (and to tests).
        if (node) node.setAttribute("aria-busy", String(retrying));
      }}
      className={className}
      style={style}
      onPress={retry}
      isDisabled={retrying}
    >
      {retrying ? "Refreshing…" : "Try again"}
    </ButtonPrimitive>
  );
}
