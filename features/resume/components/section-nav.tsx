"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SectionNavItem = { id: string; label: string };

function getScrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight)
      return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Sticky in-pane navigator. On a phone it sits below the two-row workspace
 * header, keeping section jumps available without covering the editor.
 * Highlights the section currently scrolled into view so it doubles as a
 * position indicator.
 */
export function SectionNav({
  items,
  className,
  onJump,
}: {
  items: SectionNavItem[];
  className?: string;
  onJump?: (id: string) => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const idsKey = items.map((item) => item.id).join("|");

  useEffect(() => {
    const ids = idsKey ? idsKey.split("|") : [];
    const first = ids[0] ? document.getElementById(ids[0]) : null;
    if (!first) return;
    const scroller = getScrollParent(first);
    const scrollTarget: HTMLElement | Window = scroller ?? window;

    const compute = () => {
      // A short final section can never scroll to the top, so treat reaching the
      // bottom of the scroll region as "last section active".
      const atBottom = scroller
        ? scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
        : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) {
        setActiveId(ids[ids.length - 1]);
        return;
      }
      // Reference line just below the sticky header/nav; the active section is
      // the last one whose top has scrolled above it.
      const line = (scroller ? scroller.getBoundingClientRect().top : 0) + 96;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - line <= 1) current = id;
        else break;
      }
      setActiveId(current);
    };

    compute();
    scrollTarget.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      scrollTarget.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [idsKey]);

  // Keep the active chip visible by scrolling the horizontal strip ONLY. Using
  // element.scrollIntoView here would also scroll the page vertically to reveal
  // the chip — on mobile, where this nav sits in the document flow, that yanks
  // the whole editor back to the top on every scroll.
  useEffect(() => {
    if (!activeId) return;
    const strip = navRef.current?.querySelector<HTMLElement>("[data-nav-strip]");
    const chip = strip?.querySelector<HTMLElement>(`[data-nav-id="${activeId}"]`);
    if (!strip || !chip) return;
    const stripRect = strip.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    const delta = chipRect.left - stripRect.left - (strip.clientWidth - chipRect.width) / 2;
    strip.scrollBy({ left: delta, behavior: "smooth" });
  }, [activeId]);

  if (!items.length) return null;

  const jump = (id: string) => {
    setActiveId(id);
    onJump?.(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      ref={navRef}
      aria-label="Jump to a resume section"
      className={cn(
        "app-chrome sticky top-[61px] z-40 -mx-4 mb-5 border-b bg-background/85 px-4 py-2 backdrop-blur-sm md:top-[104px] lg:top-0 lg:z-20 lg:-mx-6 lg:px-6",
        className,
      )}
    >
      <div
        data-nav-strip
        className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <Button
              key={item.id}
              variant={active ? "secondary" : "ghost"}
              size="xs"
              data-nav-id={item.id}
              aria-current={active ? "page" : undefined}
              onPress={() => jump(item.id)}
              className="shrink-0 rounded-full"
            >
              {item.label}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
