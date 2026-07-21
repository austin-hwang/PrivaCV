"use client";

import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import {
  Button as ButtonPrimitive,
  Link as LinkPrimitive,
  type ButtonProps as ButtonPrimitiveProps,
  type LinkProps as LinkPrimitiveProps,
} from "react-aria-components";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";

function Button({
  className,
  variant = "default",
  size = "default",
  title,
  ref: forwardedRef,
  ...props
}: Omit<ButtonPrimitiveProps, "className"> &
  React.RefAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    className?: string;
    // React Aria filters `title` off the DOM node, so set it via a ref effect to
    // keep hover tooltips (and title-based queries) working on icon buttons.
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
    <ButtonPrimitive
      ref={setRef}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

function LinkButton({
  className,
  variant = "default",
  size = "default",
  ...props
}: Omit<LinkPrimitiveProps, "className"> &
  VariantProps<typeof buttonVariants> & {
    className?: string;
  }) {
  return (
    <LinkPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, LinkButton, buttonVariants };
