"use client";

import { useMemo, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type ResumeNavigatorItem = {
  id: string;
  label: string;
  context: string;
  keywords?: string;
};

export function ResumeNavigator({
  open,
  onOpenChange,
  items,
  query,
  onQueryChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ResumeNavigatorItem[];
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
}) {
  const filteredItems = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return items;
    return items.filter((item) => {
      const haystack = `${item.label} ${item.context} ${item.keywords ?? ""}`.toLocaleLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [items, query]);

  const moveFocus = (event: KeyboardEvent<HTMLElement>, direction: -1 | 1) => {
    const buttons = Array.from(
      event.currentTarget.closest("[data-resume-navigator]")?.querySelectorAll<HTMLButtonElement>("[data-navigator-item]") ?? [],
    );
    if (!buttons.length) return;
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = currentIndex < 0
      ? direction > 0 ? 0 : buttons.length - 1
      : (currentIndex + direction + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[nextIndex]?.focus();
  };

  const choose = (id: string) => {
    onOpenChange(false);
    onQueryChange("");
    onSelect(id);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      onOpenChange(nextOpen);
      if (!nextOpen) onQueryChange("");
    }}>
      <DialogContent data-resume-navigator className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Navigate resume</DialogTitle>
          <DialogDescription>Search for a resume field and move focus directly to it.</DialogDescription>
        </DialogHeader>
        <div className="relative border-b">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && filteredItems[0]) {
                event.preventDefault();
                choose(filteredItems[0].id);
              } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                moveFocus(event, event.key === "ArrowDown" ? 1 : -1);
              }
            }}
            aria-label="Search resume fields"
            placeholder="Search fields, sections, or content…"
            className="h-14 rounded-none border-0 bg-transparent pl-11 pr-12 text-base shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-[min(55vh,28rem)] overflow-y-auto p-2" role="listbox" aria-label="Resume fields">
          {filteredItems.length ? filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              data-navigator-item
              role="option"
              aria-selected="false"
              onClick={() => choose(item.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  moveFocus(event, event.key === "ArrowDown" ? 1 : -1);
                }
              }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted focus:bg-muted focus:outline-none"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.context}</span>
              </span>
            </button>
          )) : (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No matching resume fields.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
          <span><kbd className="font-medium text-foreground">Cmd / Ctrl + K</kbd> navigate</span>
          <span><kbd className="font-medium text-foreground">Cmd / Ctrl + P</kbd> review and print</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
