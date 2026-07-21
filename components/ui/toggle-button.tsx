"use client";

import * as React from "react";
import {
  ToggleButton as ToggleButtonPrimitive,
  type ToggleButtonProps as ToggleButtonPrimitiveProps,
} from "react-aria-components";

import { cn } from "@/lib/utils";

function ToggleButton({
  className,
  title,
  ref: forwardedRef,
  ...props
}: Omit<ToggleButtonPrimitiveProps, "className"> &
  React.RefAttributes<HTMLButtonElement> & {
    className?: string;
    // React Aria filters `title` off the DOM node, so set it via a ref effect to
    // keep hover tooltips (and title-based queries) working on icon toggles.
    title?: string;
  }) {
  const innerRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    const node = innerRef.current;
    if (!node) return;
    if (title != null) node.setAttribute("title", title);
    else node.removeAttribute("title");
  }, [title]);
  const setRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );
  return (
    <ToggleButtonPrimitive
      ref={setRef}
      data-slot="toggle-button"
      className={cn(className)}
      {...props}
    />
  );
}

export { ToggleButton };
