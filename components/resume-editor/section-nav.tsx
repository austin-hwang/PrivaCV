"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SectionNavItem = { id: string; label: string };

function getScrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Sticky in-pane navigator on larger workspaces. On a phone it stays in the
 * document flow so it never competes with the persistent workspace header.
 * Highlights the section currently scrolled into view so it doubles as a
 * position indicator.
 */
export function SectionNav({ items, className }: { items: SectionNavItem[]; className?: string }) {
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

  useEffect(() => {
    if (!activeId) return;
    navRef.current
      ?.querySelector<HTMLElement>(`[data-nav-id="${activeId}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId]);

  if (!items.length) return null;

  const jump = (id: string) => {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      ref={navRef}
      aria-label="Jump to a resume section"
      className={cn(
        "app-chrome -mx-4 mb-5 border-b bg-background/85 px-4 py-2 backdrop-blur lg:sticky lg:top-0 lg:z-20 lg:-mx-6 lg:px-6",
        className,
      )}
    >
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              data-nav-id={item.id}
              aria-current={active ? "true" : undefined}
              onClick={() => jump(item.id)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-transparent bg-muted text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
