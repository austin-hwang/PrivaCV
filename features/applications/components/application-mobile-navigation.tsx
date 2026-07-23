"use client";

import { AlarmClock, BarChart3, BriefcaseBusiness, GitBranch } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type MobileApplicationView = "board" | "reminders" | "insights" | "sankey";

export function ApplicationMobileNavigation({
  view,
  onViewChange,
}: {
  view: MobileApplicationView;
  onViewChange: (view: MobileApplicationView) => void;
}) {
  return (
    <nav
      className="mobile-workspace-nav app-chrome fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-2 pt-2 shadow-[0_-8px_24px_-20px_var(--foreground)] backdrop-blur-sm md:hidden"
      aria-label="Application workspace"
    >
      <ToggleGroup
        aria-label="Application view"
        variant="outline"
        spacing={0}
        selectionMode="single"
        selectedKeys={[view]}
        onSelectionChange={(keys) => {
          const selected = [...keys][0];
          if (
            selected === "board" ||
            selected === "reminders" ||
            selected === "insights" ||
            selected === "sankey"
          ) {
            onViewChange(selected);
          }
        }}
        className="mx-auto grid w-full max-w-xl grid-cols-4"
      >
        <ToggleGroupItem id="board" className="h-12 flex-col gap-0.5 text-[11px]">
          <BriefcaseBusiness data-icon="inline-start" />
          Pipeline
        </ToggleGroupItem>
        <ToggleGroupItem id="reminders" className="h-12 flex-col gap-0.5 text-[11px]">
          <AlarmClock data-icon="inline-start" />
          Reminders
        </ToggleGroupItem>
        <ToggleGroupItem id="insights" className="h-12 flex-col gap-0.5 text-[11px]">
          <BarChart3 data-icon="inline-start" />
          Insights
        </ToggleGroupItem>
        <ToggleGroupItem id="sankey" className="h-12 flex-col gap-0.5 text-[11px]">
          <GitBranch data-icon="inline-start" />
          Flow
        </ToggleGroupItem>
      </ToggleGroup>
    </nav>
  );
}
