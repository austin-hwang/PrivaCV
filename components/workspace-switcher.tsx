import Link from "next/link";
import { BriefcaseBusiness, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type Workspace = "resume" | "applications";

const WORKSPACES = [
  { id: "resume", href: "/", label: "Resume", icon: FileText },
  { id: "applications", href: "/applications", label: "Applications", icon: BriefcaseBusiness },
] as const;

/** Primary product navigation shared by both local-first workspaces. */
export function WorkspaceSwitcher({ active, className }: { active: Workspace; className?: string }) {
  return (
    <nav className={cn("inline-flex items-center rounded-lg border bg-background/60 p-0.5", className)} aria-label="Workspace">
      {WORKSPACES.map((workspace) => {
        const selected = workspace.id === active;
        return (
          <Link
            key={workspace.id}
            href={workspace.href}
            prefetch={false}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "inline-flex h-7 items-center gap-2 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-secondary text-secondary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <workspace.icon className="size-3.5" aria-hidden="true" />
            <span className="hidden lg:inline">{workspace.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
