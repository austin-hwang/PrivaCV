import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ENTRY_SCHEMA,
  REPEATABLE_SECTIONS,
} from "@/lib/resume-workspace";
import { SECTION_LABELS, type ResumeEntry } from "@/lib/resume";
import { cn } from "@/lib/utils";

export function FieldGroup({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b pb-5 last:border-b-0">
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
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  reviewTarget?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        className={cn(reviewTarget && "border-amber-500 bg-amber-50 ring-2 ring-amber-200")}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function TextAreaField({
  id,
  label,
  value,
  placeholder,
  reviewTarget,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  reviewTarget?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <Textarea
        id={id}
        value={value}
        placeholder={placeholder}
        className={cn(reviewTarget && "border-amber-500 bg-amber-50 ring-2 ring-amber-200")}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function EntryList({
  section,
  entries,
  reviewTargets,
  onUpdate,
  onMove,
  onRemove,
}: {
  section: (typeof REPEATABLE_SECTIONS)[number];
  entries: ResumeEntry[];
  reviewTargets: Set<string>;
  onUpdate: (section: (typeof REPEATABLE_SECTIONS)[number], index: number, key: keyof ResumeEntry, value: string) => void;
  onMove: (section: (typeof REPEATABLE_SECTIONS)[number], index: number, direction: -1 | 1) => void;
  onRemove: (section: (typeof REPEATABLE_SECTIONS)[number], index: number) => void;
}) {
  const schema = ENTRY_SCHEMA[section];

  if (!entries.length) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        No {SECTION_LABELS[section].toLowerCase()} entries yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <Card key={index} className="bg-muted/20 shadow-none">
          <CardContent className="space-y-3 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
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
              <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(section, index)}>
                <Trash2 /> Remove
              </Button>
            </div>
            <TextField
              id={`field-${section}-${index}-title`}
              label={schema.title}
              value={entry.title}
              reviewTarget={reviewTargets.has(`field-${section}-${index}-title`)}
              onChange={(value) => onUpdate(section, index, "title", value)}
            />
            <TextField
              id={`field-${section}-${index}-subtitle`}
              label={schema.subtitle}
              value={entry.subtitle}
              reviewTarget={reviewTargets.has(`field-${section}-${index}-subtitle`)}
              onChange={(value) => onUpdate(section, index, "subtitle", value)}
            />
            <TextField
              id={`field-${section}-${index}-meta`}
              label={schema.meta}
              value={entry.meta}
              reviewTarget={reviewTargets.has(`field-${section}-${index}-meta`)}
              onChange={(value) => onUpdate(section, index, "meta", value)}
            />
            <TextAreaField
              id={`field-${section}-${index}-details`}
              label={schema.details}
              value={entry.details}
              reviewTarget={reviewTargets.has(`field-${section}-${index}-details`)}
              onChange={(value) => onUpdate(section, index, "details", value)}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
