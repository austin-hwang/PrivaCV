"use client";

import { Eye, FileText, List, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function ResumeMobileNavigation({
  view,
  onViewChange,
  onOpenSections,
  onOpenTools,
  toolsOpen,
}: {
  view: "editor" | "preview";
  onViewChange: (view: "editor" | "preview") => void;
  onOpenSections: () => void;
  onOpenTools: () => void;
  toolsOpen: boolean;
}) {
  return (
    <nav
      className="mobile-workspace-nav app-chrome fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-2 pt-2 shadow-[0_-8px_24px_-20px_var(--foreground)] backdrop-blur-sm md:hidden"
      aria-label="Resume workspace"
    >
      <div className="mx-auto grid max-w-xl grid-cols-[4.25rem_minmax(0,1fr)_4.25rem] items-stretch gap-2">
        <Button
          type="button"
          variant="ghost"
          className="h-12 flex-col gap-0.5 text-[11px]"
          onClick={onOpenSections}
          aria-label="Open resume sections"
        >
          <List data-icon="inline-start" />
          Sections
        </Button>
        <ToggleGroup
          aria-label="Resume workspace view"
          variant="outline"
          spacing={0}
          selectionMode="single"
          selectedKeys={[view]}
          onSelectionChange={(keys) => {
            const selected = [...keys][0];
            if (selected === "editor" || selected === "preview") onViewChange(selected);
          }}
          className="grid min-w-0 grid-cols-2"
        >
          <ToggleGroupItem id="editor" className="h-12 flex-col gap-0.5 text-[11px]">
            <FileText data-icon="inline-start" />
            Edit
          </ToggleGroupItem>
          <ToggleGroupItem id="preview" className="h-12 flex-col gap-0.5 text-[11px]">
            <Eye data-icon="inline-start" />
            Preview
          </ToggleGroupItem>
        </ToggleGroup>
        <Button
          type="button"
          variant={toolsOpen ? "secondary" : "ghost"}
          className="h-12 flex-col gap-0.5 text-[11px]"
          onClick={onOpenTools}
          aria-expanded={toolsOpen}
        >
          <SlidersHorizontal data-icon="inline-start" />
          Tools
        </Button>
      </div>
    </nav>
  );
}
