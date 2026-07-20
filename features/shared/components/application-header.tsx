import Link from "next/link";
import type { ReactNode } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/brand-mark";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { APP_STAGE, SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

export type LocalSaveState = "loading" | "saving" | "saved" | "conflict";

const SAVE_STATUS: Record<LocalSaveState, { label: string; ariaLabel: string; title: string }> = {
  loading: {
    label: "Loading",
    ariaLabel: "Loading local data",
    title: "Loading data from this browser",
  },
  saving: { label: "Saving", ariaLabel: "Saving locally", title: "Saving changes in this browser" },
  saved: { label: "Saved", ariaLabel: "Saved locally", title: "Saved in this browser" },
  conflict: {
    label: "Not saved",
    ariaLabel: "Local save unavailable",
    title: "Changes are not currently saved in this browser",
  },
};

export function LocalSaveStatus({ state }: { state: LocalSaveState }) {
  const status = SAVE_STATUS[state];
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={status.ariaLabel}
      title={status.title}
      data-local-save-status={state}
      data-autosave-status={state}
      className="flex size-9 shrink-0 items-center justify-center gap-1.5 rounded-md border bg-background text-xs text-muted-foreground sm:h-8 sm:w-auto sm:px-2"
    >
      {state === "loading" || state === "saving" ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : state === "conflict" ? (
        <AlertCircle className="size-3.5 text-warning" aria-hidden="true" />
      ) : (
        <Check className="size-3.5 text-success" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">Local · </span>
      <span className="hidden sm:inline">{status.label}</span>
    </div>
  );
}

export function ApplicationHeader({
  active,
  saveState,
  context,
  actions,
  secondary,
  className,
}: {
  active: "resume" | "applications";
  saveState: LocalSaveState;
  context?: ReactNode;
  actions?: ReactNode;
  secondary?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "app-chrome sticky top-0 z-50 border-b bg-card/95 shadow-xs backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/"
            prefetch={false}
            aria-label={`${SITE_NAME} home`}
            className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandMark className="size-8" />
            <span className="hidden truncate text-base font-semibold tracking-tight sm:inline lg:text-lg">
              PrivaCV
            </span>
          </Link>
          <Badge
            variant="secondary"
            className="hidden shrink-0 rounded-full px-1.5 py-0 text-[10px] font-semibold uppercase tracking-widest sm:inline-flex"
          >
            {APP_STAGE}
          </Badge>
          <WorkspaceSwitcher active={active} className="ml-1" />
          {context}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LocalSaveStatus state={saveState} />
          {actions}
        </div>
      </div>
      {secondary}
    </header>
  );
}
