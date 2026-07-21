"use client";

import {
  Checkbox as CheckboxPrimitive,
  composeRenderProps,
  type CheckboxProps,
} from "react-aria-components";

import { cn } from "@/lib/utils";
import { CheckIcon, MinusIcon } from "lucide-react";

function Checkbox({ className, children, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive
      data-slot="checkbox"
      className={cn(
        // Root is the full control: a row holding the box and an optional label,
        // so labeled checkboxes lay out beside the box instead of inside it.
        "group/checkbox inline-flex items-center gap-2 text-sm leading-none font-medium outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      {composeRenderProps(children, (children, { isSelected, isIndeterminate }) => (
        <>
          <span
            data-slot="checkbox-box"
            className={cn(
              "relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input text-primary-foreground transition-colors dark:bg-input/30",
              "group-data-[selected]/checkbox:border-primary group-data-[selected]/checkbox:bg-primary dark:group-data-[selected]/checkbox:bg-primary",
              "group-data-[indeterminate]/checkbox:border-primary group-data-[indeterminate]/checkbox:bg-primary group-data-[indeterminate]/checkbox:text-primary-foreground",
              "group-data-[focus-visible]/checkbox:border-ring group-data-[focus-visible]/checkbox:ring-3 group-data-[focus-visible]/checkbox:ring-ring/50",
              "group-data-[invalid]/checkbox:border-destructive group-data-[invalid]/checkbox:ring-3 group-data-[invalid]/checkbox:ring-destructive/20",
            )}
          >
            <span
              data-slot="checkbox-indicator"
              className="grid place-content-center text-current [&>svg]:size-3.5"
            >
              {isIndeterminate ? <MinusIcon /> : isSelected ? <CheckIcon /> : null}
            </span>
          </span>
          {children != null ? <span className="min-w-0">{children}</span> : null}
        </>
      ))}
    </CheckboxPrimitive>
  );
}

export { Checkbox };
