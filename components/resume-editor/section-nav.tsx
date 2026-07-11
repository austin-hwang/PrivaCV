"use client";

import { cn } from "@/lib/utils";

export type SectionNavItem = { id: string; label: string };

/**
 * Sticky in-pane navigator. Chips scroll the editor pane to each section so a
 * long resume no longer means scrolling past every block to reach one field.
 */
export function SectionNav({ items, className }: { items: SectionNavItem[]; className?: string }) {
  if (!items.length) return null;

  const jump = (id: string) => {
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      aria-label="Jump to a resume section"
      className={cn(
        "app-chrome sticky top-0 z-20 -mx-4 mb-5 border-b bg-background/85 px-4 py-2 backdrop-blur lg:-mx-6 lg:px-6",
        className,
      )}
    >
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => jump(item.id)}
            className="shrink-0 whitespace-nowrap rounded-full border border-transparent bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
