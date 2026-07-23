"use client";

import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();
  const choose = (id: string) => {
    onOpenChange(false);
    onQueryChange("");
    onSelect(id);
  };

  // Match every whitespace-delimited term (AND) against the combined
  // label/context/keywords — the same behavior the hand-rolled listbox had,
  // rather than React Aria's default single contiguous-substring contains().
  const matchesQuery = (textValue: string, inputValue: string) => {
    const terms = inputValue.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    const haystack = textValue.toLocaleLowerCase();
    return terms.every((term) => haystack.includes(term));
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) onQueryChange("");
  };
  const command = (
    <>
      <Command
        filter={matchesQuery}
        inputValue={query}
        onInputChange={onQueryChange}
        className="min-h-0 bg-transparent"
      >
        <div className="border-b">
          <CommandInput
            aria-label="Search resume fields"
            placeholder="Search fields, sections, or content…"
          />
        </div>
        <CommandList
          aria-label="Resume fields"
          onAction={(key) => choose(String(key))}
          renderEmptyState={() => <CommandEmpty>No matching resume fields.</CommandEmpty>}
        >
          <CommandGroup items={items}>
            {(item: ResumeNavigatorItem) => (
              <CommandItem
                id={item.id}
                textValue={`${item.label} ${item.context} ${item.keywords ?? ""}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.context}
                  </span>
                </span>
              </CommandItem>
            )}
          </CommandGroup>
        </CommandList>
      </Command>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Kbd>Cmd / Ctrl + K</Kbd>
          <span>navigate</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>Cmd / Ctrl + P</Kbd>
          <span>review and print</span>
        </span>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange} showSwipeHandle>
        <DrawerContent className="h-[min(42rem,calc(100dvh-3rem))]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Navigate resume</DrawerTitle>
            <DrawerDescription>
              Search for a resume field and move focus directly to it.
            </DrawerDescription>
          </DrawerHeader>
          {command}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog
      isOpen={open}
      onOpenChange={handleOpenChange}
      className="max-w-xl gap-0 overflow-hidden p-0"
    >
      <DialogHeader className="sr-only">
        <DialogTitle>Navigate resume</DialogTitle>
        <DialogDescription>
          Search for a resume field and move focus directly to it.
        </DialogDescription>
      </DialogHeader>
      {command}
    </Dialog>
  );
}
