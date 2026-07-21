"use client";

import * as React from "react";
import {
  SliderFill,
  Slider as SliderPrimitive,
  SliderThumb,
  SliderTrack,
  type SliderProps as SliderPrimitiveProps,
} from "react-aria-components";

import { cn } from "@/lib/utils";

type SliderValue = number | number[];

function Slider<T extends SliderValue = SliderValue>({
  className,
  thumbValueText,
  ...props
}: Omit<SliderPrimitiveProps<T>, "className"> & {
  className?: string;
  // React Aria derives the thumb's spoken value from the numeric value. Pass a
  // string to expose a richer aria-valuetext (set on the hidden range input) —
  // e.g. a checkpoint label instead of just its index.
  thumbValueText?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const input = ref.current?.querySelector<HTMLInputElement>('input[type="range"]');
    if (!input) return;
    if (thumbValueText != null) input.setAttribute("aria-valuetext", thumbValueText);
    else input.removeAttribute("aria-valuetext");
  }, [thumbValueText, props.value]);
  return (
    <SliderPrimitive
      ref={ref}
      data-slot="slider"
      className={cn(
        "group relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    >
      {({ state }) => (
        <>
          <SliderTrack
            data-slot="slider-track"
            className="relative grow overflow-hidden rounded-full bg-muted select-none data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
          >
            <SliderFill
              data-slot="slider-range"
              className="absolute bg-primary select-none data-[orientation=horizontal]:h-full data-[orientation=vertical]:bottom-0 data-[orientation=vertical]:w-full"
            />
          </SliderTrack>
          {state.values.map((_, index) => (
            <SliderThumb
              data-slot="slider-thumb"
              key={index}
              index={index}
              className="relative block size-3.5 shrink-0 rounded-full border border-primary bg-background shadow-sm ring-ring/50 transition-[color,box-shadow] select-none group-data-[orientation=horizontal]:top-[50%] group-data-[orientation=vertical]:left-[50%] after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden data-dragging:ring-3 data-focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
            />
          ))}
        </>
      )}
    </SliderPrimitive>
  );
}

export { Slider };
