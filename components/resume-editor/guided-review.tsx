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

/**
 * Highlight the whole section a step references (e.g. the full experience
 * entry), not just the single input — clearer context and it keeps every field
 * inside editable. Falls back to the target element itself when it isn't inside
 * a review region (e.g. the text-size control).
 */
function resolveRegionEl(targetId: string): HTMLElement | null {
  const el = document.getElementById(targetId);
  if (!el) return null;
  return (el.closest("[data-review-region]") as HTMLElement | null) ?? el;
}

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
  // Only animate the ring when moving between steps. During scrolling the ring
  // tracks the element every frame; a position transition would make it lag
  // behind and look detached from the section it frames.
  const [animate, setAnimate] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [offscreenDirection, setOffscreenDirection] = useState<"above" | "below" | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number; placement: "below" | "above" | "bottom" | "right" } | null>(null);
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
    // Animate the ring toward the new target, then settle so subsequent scroll
    // repositioning is instant.
    setAnimate(true);
    const settle = window.setTimeout(() => setAnimate(false), 220);
    const timer = window.setTimeout(() => {
      resolveRegionEl(targetId)?.scrollIntoView({ block: "center" });
    }, 30);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(settle);
    };
  }, [open, targetId]);

  // Keep the ring + card positioned over the moving target while the tour is open.
  const reposition = useCallback(() => {
    if (!step) return;
    const el = resolveRegionEl(step.targetId);
    if (!el) {
      setRect((prev) => (prev === null ? prev : null));
      return;
    }
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardH = cardRef.current?.offsetHeight ?? 200;
    const isInViewport = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
    const nextOffscreenDirection = !isInViewport ? (r.bottom <= 0 ? "above" : "below") : null;

    setOffscreenDirection((prev) => (prev === nextOffscreenDirection ? prev : nextOffscreenDirection));
    // A ring without its element looks like a rendering error. Hide it when a
    // person scrolls the active field away, then leave the tour card available
    // with a direct route back to the exact field.
    if (!isInViewport) {
      setRect((prev) => (prev === null ? prev : null));
      setCardPos((prev) => {
        const width = Math.min(CARD_WIDTH, vw - 24);
        const next = {
          top: nextOffscreenDirection === "above" ? 12 : Math.max(12, vh - cardH - 12),
          left: Math.max(12, (vw - width) / 2),
          placement: (vw < 640 ? "bottom" : "below") as "below" | "above" | "bottom" | "right",
        };
        return prev && Math.abs(prev.top - next.top) < 1 && Math.abs(prev.left - next.left) < 1 && prev.placement === next.placement
          ? prev
          : next;
      });
      return;
    }

    setRect((prev) =>
      prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height ? prev : r,
    );

    const setPos = (next: { top: number; left: number; placement: "below" | "above" | "bottom" | "right" }) =>
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
    const clampTop = (value: number) => Math.min(Math.max(value, 12), Math.max(12, vh - cardH - 12));

    // Prefer floating to the right of the highlighted region so every field
    // inside it stays visible and editable.
    if (r.right + GAP + width <= vw - 12) {
      setPos({ top: clampTop(r.top), left: r.right + GAP, placement: "right" });
      return;
    }

    // Otherwise drop below the region, flipping above when there's no room.
    const left = Math.min(Math.max(r.left, 12), Math.max(12, vw - width - 12));
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
    if (!open || !targetId) return;

    const target = resolveRegionEl(targetId);
    let frame = 0;
    const scheduleReposition = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(reposition);
    };

    scheduleReposition();
    window.addEventListener("resize", scheduleReposition);
    // Capture scroll events from the editor's nested scrolling container too.
    window.addEventListener("scroll", scheduleReposition, true);

    const observer = new ResizeObserver(scheduleReposition);
    if (target) observer.observe(target);
    if (cardRef.current) observer.observe(cardRef.current);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleReposition);
      window.removeEventListener("scroll", scheduleReposition, true);
      observer.disconnect();
    };
  }, [open, reposition, targetId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
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
  const returnToTarget = () => {
    resolveRegionEl(step.targetId)?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  return createPortal(
    <div className="app-chrome pointer-events-none fixed inset-0 z-[60]" aria-hidden={false}>
      {rect ? (
        <div
          data-guided-review-highlight
          className={cn(
            "pointer-events-none absolute rounded-md",
            animate && "transition-[top,left,width,height] duration-150",
            toneRing(step.tone),
          )}
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
        {offscreenDirection ? (
          <div className="mt-3 rounded-md border bg-muted/40 p-2.5">
            <p className="text-xs leading-snug text-muted-foreground">
              The current field is {offscreenDirection}. Return to it to continue this step.
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-2 w-full" onClick={returnToTarget}>
              Return to field
            </Button>
          </div>
        ) : null}
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
