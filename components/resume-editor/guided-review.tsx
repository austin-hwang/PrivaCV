"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GuidedReviewStep = {
  id: string;
  /** Element id to highlight and scroll into view for this step. */
  targetId: string;
  eyebrow: string;
  title: string;
  description?: string;
  /** Optional monospace excerpt (e.g. the matching imported source text). */
  excerpt?: string;
  tone?: "default" | "ok" | "warn" | "info";
  done?: boolean;
  /** Primary action for the step (e.g. confirm an imported field, jump to fix). */
  action?: { label: string; run: () => void };
};

const CARD_WIDTH = 340;
const GAP = 10;

function toneRing(tone: GuidedReviewStep["tone"]) {
  switch (tone) {
    case "warn":
      return "shadow-[0_0_0_2px_rgb(217_119_6),0_0_0_6px_rgb(217_119_6/0.18)]";
    case "ok":
      return "shadow-[0_0_0_2px_rgb(5_150_105),0_0_0_6px_rgb(5_150_105/0.18)]";
    case "info":
      return "shadow-[0_0_0_2px_rgb(2_132_199),0_0_0_6px_rgb(2_132_199/0.18)]";
    default:
      return "shadow-[0_0_0_2px_hsl(var(--ring)),0_0_0_6px_hsl(var(--ring)/0.16)]";
  }
}

/**
 * A lightweight, dependency-free product-tour: it ring-highlights the current
 * step's target element (no page dimming, so the field stays editable) and
 * floats a review card beside it with Back / Next and a per-step action.
 */
export function GuidedReview({
  open,
  title,
  steps,
  index,
  onIndexChange,
  onClose,
  onFinish,
  finishLabel = "Done",
  finishDisabled = false,
}: {
  open: boolean;
  title: string;
  steps: GuidedReviewStep[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onFinish: () => void;
  finishLabel?: string;
  finishDisabled?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number; placement: "below" | "above" | "bottom" } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps[index];

  useEffect(() => setMounted(true), []);

  const clampedIndex = Math.min(Math.max(index, 0), Math.max(steps.length - 1, 0));
  useEffect(() => {
    if (open && clampedIndex !== index) onIndexChange(clampedIndex);
  }, [open, clampedIndex, index, onIndexChange]);

  // Scroll the current target into view when the step changes. Keyed on the
  // target id (a stable string) so re-renders that hand us a new steps array
  // don't restart the smooth scroll and leave it stuck.
  const targetId = step?.targetId;
  useEffect(() => {
    if (!open || !targetId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: "center" });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [open, targetId]);

  // Keep the ring + card positioned over the moving target while the tour is open.
  const reposition = useCallback(() => {
    if (!step) return;
    const el = document.getElementById(step.targetId);
    if (!el) {
      setRect((prev) => (prev === null ? prev : null));
      return;
    }
    const r = el.getBoundingClientRect();
    setRect((prev) =>
      prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height ? prev : r,
    );

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardH = cardRef.current?.offsetHeight ?? 200;

    const setPos = (next: { top: number; left: number; placement: "below" | "above" | "bottom" }) =>
      setCardPos((prev) =>
        prev && Math.abs(prev.top - next.top) < 1 && Math.abs(prev.left - next.left) < 1 && prev.placement === next.placement
          ? prev
          : next,
      );

    if (vw < 640) {
      // On phones, pin the card to the bottom so it never crowds the field.
      setPos({ top: vh - cardH - 12, left: Math.max(12, (vw - Math.min(CARD_WIDTH, vw - 24)) / 2), placement: "bottom" });
      return;
    }

    const width = Math.min(CARD_WIDTH, vw - 24);
    let left = r.left;
    if (left + width > vw - 12) left = vw - width - 12;
    if (left < 12) left = 12;

    let top = r.bottom + GAP;
    let placement: "below" | "above" = "below";
    if (top + cardH > vh - 12) {
      const above = r.top - cardH - GAP;
      if (above >= 12) {
        top = above;
        placement = "above";
      } else {
        top = Math.max(12, vh - cardH - 12);
      }
    }
    setPos({ top, left, placement });
  }, [step]);

  useLayoutEffect(() => {
    if (!open) return;
    let raf = 0;
    const loop = () => {
      reposition();
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowRight" && index < steps.length - 1) {
        onIndexChange(index + 1);
      } else if (event.key === "ArrowLeft" && index > 0) {
        onIndexChange(index - 1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, index, steps.length, onClose, onIndexChange]);

  if (!open || !mounted || !step) return null;
  const isLast = index === steps.length - 1;

  return createPortal(
    <div className="app-chrome pointer-events-none fixed inset-0 z-[60]" aria-hidden={false}>
      {rect ? (
        <div
          className={cn("pointer-events-none absolute rounded-md transition-[top,left,width,height] duration-150", toneRing(step.tone))}
          style={{
            top: Math.max(rect.top - 4, 2),
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      ) : null}

      <div
        ref={cardRef}
        role="dialog"
        aria-label={`${title} — guided review`}
        className={cn(
          "pointer-events-auto fixed w-[min(340px,calc(100vw-24px))] rounded-xl border bg-popover p-4 text-popover-foreground shadow-2xl",
          !cardPos && "opacity-0",
        )}
        style={cardPos ? { top: cardPos.top, left: cardPos.left } : undefined}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{step.eyebrow}</p>
            <p className="text-sm font-semibold leading-snug">{step.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guided review"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        </div>

        {step.description ? <p className="text-xs leading-snug text-muted-foreground">{step.description}</p> : null}
        {step.excerpt ? (
          <p className="mt-2 max-h-24 overflow-y-auto whitespace-pre-line rounded-md border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed text-foreground">
            {step.excerpt}
          </p>
        ) : null}

        {step.action ? (
          <Button
            type="button"
            variant={step.done ? "secondary" : "default"}
            size="sm"
            className="mt-3 w-full"
            aria-pressed={step.done}
            onClick={step.action.run}
          >
            {step.done ? <Check /> : null} {step.action.label}
          </Button>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
          <span className="text-xs tabular-nums text-muted-foreground">
            Step {index + 1} of {steps.length}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              disabled={index === 0}
              onClick={() => onIndexChange(index - 1)}
            >
              <ArrowLeft /> Back
            </Button>
            {isLast ? (
              <Button type="button" size="sm" className="h-8 px-3" disabled={finishDisabled} onClick={onFinish}>
                <Check /> {finishLabel}
              </Button>
            ) : (
              <Button type="button" size="sm" className="h-8 px-3" onClick={() => onIndexChange(index + 1)}>
                Next <ArrowRight />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
