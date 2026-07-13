import { ArrowDown, ArrowLeftRight, ArrowUp, ChevronRight, GripVertical, Trash2 } from "lucide-react";
import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ENTRY_SCHEMA } from "@/lib/resume-workspace";
import { isBuiltinSection, summarizeBulletOpenings, summarizeEvidence, type ResumeEntry } from "@/lib/resume";
import { cn } from "@/lib/utils";

type TextInputType = "email" | "tel" | "text" | "url";

export function FieldGroup({
  id,
  title,
  actions,
  children,
  className,
  reviewRegion,
  groupId,
  collapsible,
  collapsed,
  onToggleCollapsed,
}: {
  id?: string;
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  reviewRegion?: boolean;
  /** Stable id used to reveal (expand) this group when a jump targets it. */
  groupId?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  return (
    <section
      id={id}
      data-review-region={reviewRegion ? "" : undefined}
      data-field-group={groupId}
      className={cn("scroll-mt-32 border-b transition-colors last:border-b-0 lg:scroll-mt-16", collapsed ? "pb-3" : "pb-5", className)}
    >
      <div className={cn("flex items-center justify-between gap-3", collapsed ? "mb-0" : "mb-3")}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {collapsible ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand section" : "Collapse section"}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className={cn("size-4 transition-transform", !collapsed && "rotate-90")} />
            </button>
          ) : null}
          <h2 className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>
        </div>
        {actions}
      </div>
      <div className={cn("space-y-3", collapsed && "hidden")}>{children}</div>
    </section>
  );
}
export function TextField({
  id,
  label,
  value,
  placeholder,
  onChange,
  type = "text",
  autoComplete,
  inputMode,
  spellCheck,
}: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  type?: TextInputType;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  spellCheck?: boolean;
}) {
  return (
    <div className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      <label htmlFor={id}>{label}</label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        spellCheck={spellCheck}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  value,
  placeholder,
  onChange,
  spellCheck = true,
}: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  spellCheck?: boolean;
}) {
  return (
    <div className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      <label htmlFor={id}>{label}</label>
      <Textarea
        id={id}
        value={value}
        placeholder={placeholder}
        spellCheck={spellCheck}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function EntryList({
  section,
  sectionLabel,
  entries,
  onUpdate,
  onMove,
  onReorder,
  onRemove,
  onSwapTitleAndSubtitle,
  onToggleBullet,
}: {
  section: string;
  sectionLabel: string;
  entries: ResumeEntry[];
  onUpdate: (section: string, index: number, key: keyof ResumeEntry, value: string) => void;
  onMove: (section: string, index: number, direction: -1 | 1) => void;
  onReorder: (section: string, index: number, target: number) => void;
  onRemove: (section: string, index: number) => void;
  onSwapTitleAndSubtitle: (index: number) => void;
  onToggleBullet: (section: string, index: number, bulletIndex: number) => void;
}) {
  const schema = isBuiltinSection(section) && section !== "skills"
    ? ENTRY_SCHEMA[section]
    : { title: "Title", subtitle: "Organization / context", meta: "Dates / details", details: "Highlights" };
  const supportsEvidenceReview = section === "experience" || section === "projects";

  if (!entries.length) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        No {sectionLabel.toLowerCase()} entries yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => {
        const evidence = supportsEvidenceReview ? summarizeEvidence(entry.details) : null;
        const openings = supportsEvidenceReview ? summarizeBulletOpenings(entry.details) : null;
        const bullets = entry.details.split("\n").map((bullet) => bullet.trim()).filter(Boolean);
        const excludedBulletIndexes = entry.excludedBulletIndexes ?? [];
        const includedBulletCount = bullets.filter((_, bulletIndex) => !excludedBulletIndexes.includes(bulletIndex)).length;
        const reviewLabel = evidence?.unmeasuredIndexes.length
          ? `Review ${evidence.unmeasuredIndexes.map((item) => `bullet ${item + 1}`).join(", ")}`
          : null;
        const openingReviewLabel = openings?.vagueOpeningIndexes.length
          ? `Consider a more specific opening for ${openings.vagueOpeningIndexes.map((item) => `bullet ${item + 1}`).join(", ")}`
          : null;

        return (
          <Card
            key={index}
            data-review-region=""
            data-editor-entry=""
            data-editor-entry-index={index}
            className="bg-muted/20 shadow-none transition-colors"
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes("application/x-resume-entry") || event.dataTransfer.types.includes("text/plain")) event.preventDefault();
            }}
            onDrop={(event) => {
              const customData = event.dataTransfer.getData("application/x-resume-entry");
              const plainData = event.dataTransfer.getData("text/plain");
              const value = customData || (plainData.startsWith("entry:") ? plainData.slice(6) : "");
              if (!value) return;
              event.preventDefault();
              event.stopPropagation();
              try {
                const dragged = JSON.parse(value) as { section: string; index: number };
                if (dragged.section === section && dragged.index !== index) onReorder(section, dragged.index, index);
              } catch {
                // Ignore drag data from outside the editor.
              }
            }}
          >
            <CardContent className="space-y-3 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <span
                  draggable
                  aria-hidden="true"
                  title="Drag to reorder; use the move buttons for keyboard reordering"
                  className="inline-flex size-9 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    const value = JSON.stringify({ section, index });
                    event.dataTransfer.setData("application/x-resume-entry", value);
                    event.dataTransfer.setData("text/plain", `entry:${value}`);
                  }}
                >
                  <GripVertical className="size-4" />
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Move entry up"
                  aria-keyshortcuts="Alt+Shift+ArrowUp"
                  title="Move entry up (Alt+Shift+Up while focused in this entry)"
                  disabled={index === 0}
                  onClick={() => onMove(section, index, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Move entry down"
                  aria-keyshortcuts="Alt+Shift+ArrowDown"
                  title="Move entry down (Alt+Shift+Down while focused in this entry)"
                  disabled={index === entries.length - 1}
                  onClick={() => onMove(section, index, 1)}
                >
                  <ArrowDown />
                </Button>
              </div>
              <div className="flex items-center gap-1">
                {section === "experience" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSwapTitleAndSubtitle(index)}
                    aria-label="Switch role and employer"
                    title="Swap job title and company"
                  >
                    <ArrowLeftRight /> Swap
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(section, index)}>
                  <Trash2 /> Remove
                </Button>
              </div>
            </div>
            {section === "experience" ? (
              <p className="-mt-1 text-xs leading-snug text-muted-foreground">
                Imported resumes sometimes list the company before the role. Use Swap to correct the order without retyping.
              </p>
            ) : null}
            <TextField
              id={`field-${section}-${index}-title`}
              label={schema.title}
              value={entry.title}
              onChange={(value) => onUpdate(section, index, "title", value)}
            />
            <TextField
              id={`field-${section}-${index}-subtitle`}
              label={schema.subtitle}
              value={entry.subtitle}
              onChange={(value) => onUpdate(section, index, "subtitle", value)}
            />
            <TextField
              id={`field-${section}-${index}-meta`}
              label={schema.meta}
              value={entry.meta}
              onChange={(value) => onUpdate(section, index, "meta", value)}
            />
            <TextAreaField
              id={`field-${section}-${index}-details`}
              label={schema.details}
              value={entry.details}
              onChange={(value) => onUpdate(section, index, "details", value)}
            />
            {supportsEvidenceReview && bullets.length ? (
              <fieldset className="rounded-md border bg-background p-3">
                <legend className="px-1 text-xs font-semibold text-foreground">Tailor this version</legend>
                <p className="mb-2 text-xs leading-snug text-muted-foreground">
                  {includedBulletCount} of {bullets.length} {bullets.length === 1 ? "bullet is" : "bullets are"} included in your preview and downloads. Uncheck a lower-relevance bullet without deleting it.
                </p>
                {excludedBulletIndexes.length ? (
                  <p className="mb-2 text-xs leading-snug text-muted-foreground">
                    To edit the full Highlights list, use the field above; changing it includes every bullet again.
                  </p>
                ) : null}
                <div className="space-y-2">
                  {bullets.map((bullet, bulletIndex) => {
                    const included = !excludedBulletIndexes.includes(bulletIndex);
                    return (
                      <label key={`${bulletIndex}-${bullet}`} className="flex cursor-pointer items-start gap-2 text-xs leading-snug text-foreground">
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={() => onToggleBullet(section, index, bulletIndex)}
                          aria-label={`${included ? "Include" : "Exclude"} bullet ${bulletIndex + 1}: ${bullet}`}
                          className="mt-0.5 size-3.5 shrink-0 accent-primary"
                        />
                        <span className={cn(!included && "text-muted-foreground line-through")}>{bullet}</span>
                      </label>
                    );
                  })}
                </div>
                {excludedBulletIndexes.length ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-7 px-1.5 text-xs"
                    onClick={() => excludedBulletIndexes.forEach((bulletIndex) => onToggleBullet(section, index, bulletIndex))}
                  >
                    Include all bullets
                  </Button>
                ) : null}
              </fieldset>
            ) : null}
            {evidence?.bulletCount ? (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-xs leading-snug",
                  evidence.unmeasuredIndexes.length
                    ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100"
                    : "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100",
                )}
                aria-live="polite"
              >
                <p className="font-semibold">
                  {evidence.measuredCount} of {evidence.bulletCount} {evidence.bulletCount === 1 ? "bullet shows" : "bullets show"}{" "}
                  measurable scope or results.
                </p>
                {reviewLabel ? (
                  <p className="mt-1 text-muted-foreground">
                    {reviewLabel}. Add a truthful scale or outcome where you know it; not every bullet needs a number.
                  </p>
                ) : (
                  <p className="mt-1 text-muted-foreground">Each bullet includes a concrete scope or result.</p>
                )}
                {openingReviewLabel ? (
                  <p className="mt-1 text-muted-foreground">
                    {openingReviewLabel}. Starting with what you did can make the contribution easier to scan; keep the wording truthful.
                  </p>
                ) : null}
              </div>
            ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
