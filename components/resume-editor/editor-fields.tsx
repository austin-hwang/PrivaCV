import { ArrowDown, ArrowLeftRight, ArrowUp, Check, Eye, GripVertical, Trash2 } from "lucide-react";
import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ENTRY_SCHEMA,
  type ImportReviewItem,
} from "@/lib/resume-workspace";
import { isBuiltinSection, summarizeEvidence, type ResumeEntry } from "@/lib/resume";
import { cn } from "@/lib/utils";

export function FieldGroup({ id, title, actions, children, className }: { id?: string; title: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-16 border-b pb-5 transition-colors last:border-b-0", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>
        {actions}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
export function TextField({
  id,
  label,
  value,
  placeholder,
  reviewTarget,
  reviewItem,
  onToggleReview,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  reviewTarget?: boolean;
  reviewItem?: ImportReviewItem & { confirmed: boolean };
  onToggleReview?: (itemId: string) => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      <label htmlFor={id}>{label}</label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        className={cn(reviewTarget && "border-amber-500 bg-amber-50 ring-2 ring-amber-200")}
        onChange={(event) => onChange(event.target.value)}
      />
      <ImportReviewFieldPrompt item={reviewItem} onToggleReview={onToggleReview} />
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  value,
  placeholder,
  reviewTarget,
  reviewItem,
  onToggleReview,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  reviewTarget?: boolean;
  reviewItem?: ImportReviewItem & { confirmed: boolean };
  onToggleReview?: (itemId: string) => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      <label htmlFor={id}>{label}</label>
      <Textarea
        id={id}
        value={value}
        placeholder={placeholder}
        className={cn(reviewTarget && "border-amber-500 bg-amber-50 ring-2 ring-amber-200")}
        onChange={(event) => onChange(event.target.value)}
      />
      <ImportReviewFieldPrompt item={reviewItem} onToggleReview={onToggleReview} />
    </div>
  );
}

function ImportReviewFieldPrompt({
  item,
  onToggleReview,
}: {
  item?: ImportReviewItem & { confirmed: boolean };
  onToggleReview?: (itemId: string) => void;
}) {
  if (!item || !onToggleReview) return null;

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-xs leading-snug", item.confirmed ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-amber-300 bg-amber-50 text-amber-950")}>
      <div className="flex min-w-0 items-center gap-1.5">
        {item.confirmed ? <Check className="size-3.5 shrink-0" /> : <Eye className="size-3.5 shrink-0" />}
        <p>
          <span className="font-semibold">Imported {item.label}.</span>{" "}
          {item.confirmed ? "Confirmed for this import review." : "Edit if needed, then confirm it here."}
        </p>
      </div>
      {item.sourceExcerpt ? (
        <p className="w-full whitespace-pre-line rounded border border-current/15 bg-background/70 px-2 py-1 font-mono text-[11px] leading-relaxed text-foreground">
          <span className="font-sans font-semibold">Matching source context: </span>{item.sourceExcerpt}
        </p>
      ) : null}
      <Button
        type="button"
        variant={item.confirmed ? "secondary" : "outline"}
        size="sm"
        className="h-7 shrink-0 px-2"
        aria-pressed={item.confirmed}
        onClick={() => onToggleReview(item.id)}
      >
        <Check /> {item.confirmed ? "Confirmed" : `Mark ${item.label} reviewed`}
      </Button>
    </div>
  );
}

export function EntryList({
  section,
  sectionLabel,
  entries,
  reviewTargets,
  reviewItemsByTarget,
  onUpdate,
  onMove,
  onReorder,
  onRemove,
  onSwapTitleAndSubtitle,
  onToggleReview,
}: {
  section: string;
  sectionLabel: string;
  entries: ResumeEntry[];
  reviewTargets: Set<string>;
  reviewItemsByTarget: Map<string, ImportReviewItem & { confirmed: boolean }>;
  onUpdate: (section: string, index: number, key: keyof ResumeEntry, value: string) => void;
  onMove: (section: string, index: number, direction: -1 | 1) => void;
  onReorder: (section: string, index: number, target: number) => void;
  onRemove: (section: string, index: number) => void;
  onSwapTitleAndSubtitle: (index: number) => void;
  onToggleReview: (itemId: string) => void;
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
        const reviewLabel = evidence?.unmeasuredIndexes.length
          ? `Review ${evidence.unmeasuredIndexes.map((item) => `bullet ${item + 1}`).join(", ")}`
          : null;

        return (
          <Card
            key={index}
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
              reviewTarget={reviewTargets.has(`field-${section}-${index}-title`)}
              reviewItem={reviewItemsByTarget.get(`field-${section}-${index}-title`)}
              onToggleReview={onToggleReview}
              onChange={(value) => onUpdate(section, index, "title", value)}
            />
            <TextField
              id={`field-${section}-${index}-subtitle`}
              label={schema.subtitle}
              value={entry.subtitle}
              reviewTarget={reviewTargets.has(`field-${section}-${index}-subtitle`)}
              reviewItem={reviewItemsByTarget.get(`field-${section}-${index}-subtitle`)}
              onToggleReview={onToggleReview}
              onChange={(value) => onUpdate(section, index, "subtitle", value)}
            />
            <TextField
              id={`field-${section}-${index}-meta`}
              label={schema.meta}
              value={entry.meta}
              reviewTarget={reviewTargets.has(`field-${section}-${index}-meta`)}
              reviewItem={reviewItemsByTarget.get(`field-${section}-${index}-meta`)}
              onToggleReview={onToggleReview}
              onChange={(value) => onUpdate(section, index, "meta", value)}
            />
            <TextAreaField
              id={`field-${section}-${index}-details`}
              label={schema.details}
              value={entry.details}
              reviewTarget={reviewTargets.has(`field-${section}-${index}-details`)}
              reviewItem={reviewItemsByTarget.get(`field-${section}-${index}-details`)}
              onToggleReview={onToggleReview}
              onChange={(value) => onUpdate(section, index, "details", value)}
            />
            {evidence?.bulletCount ? (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-xs leading-snug",
                  evidence.unmeasuredIndexes.length
                    ? "border-amber-300 bg-amber-50 text-amber-950"
                    : "border-emerald-300 bg-emerald-50 text-emerald-950",
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
              </div>
            ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
