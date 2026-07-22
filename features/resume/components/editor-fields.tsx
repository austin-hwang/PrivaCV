import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useId, useState, type DragEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Field as UIField,
  FieldLabel as UIFieldLabel,
  FieldLegend as UIFieldLegend,
  FieldSet as UIFieldSet,
} from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  MONTH_ABBR,
  buildYearMonth,
  entryFieldSchema,
  entryHasContent,
  entryMetaLine,
  yearMonthParts,
  type ResumeEntry,
  type TagGroup,
} from "@/lib/resume";
import { RichTextEditor } from "@/features/resume/components/rich-text-editor";
import { cn } from "@/lib/utils";

type TextInputType = "email" | "tel" | "text" | "url";

export function FieldGroup({
  id,
  title,
  header,
  actions,
  children,
  className,
  reviewRegion,
  groupId,
  collapsible,
  collapsed,
  onToggleCollapsed,
  card,
}: {
  id?: string;
  title: ReactNode;
  /** Replaces the standard title/action row for richer section-card controls. */
  header?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  reviewRegion?: boolean;
  /** Stable id used to reveal (expand) this group when a jump targets it. */
  groupId?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  card?: boolean;
}) {
  if (card) {
    return (
      <Card
        id={id}
        role="region"
        aria-label={typeof title === "string" ? `${title} section` : undefined}
        size="sm"
        data-review-region={reviewRegion ? "" : undefined}
        data-field-group={groupId}
        className={cn("scroll-mt-44 transition-colors lg:scroll-mt-16", className)}
      >
        <CardHeader>
          {header ? (
            <>
              <CardTitle className="sr-only">{title}</CardTitle>
              {header}
            </>
          ) : (
            <>
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {title}
              </CardTitle>
              <CardAction className="flex items-center gap-1">
                {actions}
                {collapsible ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onPress={onToggleCollapsed}
                    aria-expanded={!collapsed}
                    aria-label={collapsed ? "Expand section" : "Collapse section"}
                  >
                    <ChevronRight
                      data-icon="inline-start"
                      className={cn("transition-transform", !collapsed && "rotate-90")}
                    />
                  </Button>
                ) : null}
              </CardAction>
            </>
          )}
        </CardHeader>
        <CardContent className={cn("flex flex-col gap-3", collapsed && "hidden")}>
          {children}
        </CardContent>
      </Card>
    );
  }

  return (
    <section
      id={id}
      data-review-region={reviewRegion ? "" : undefined}
      data-field-group={groupId}
      className={cn(
        "scroll-mt-44 transition-colors lg:scroll-mt-16",
        "border-b last:border-b-0",
        collapsed ? "pb-3" : "pb-5",
        className,
      )}
    >
      {header ?? (
        <>
          {/* The collapse toggle lives on the RIGHT so the title (and the fields
              below it) share one flush-left edge — a left chevron would indent the
              title past its own content and look misaligned. */}
          <div
            className={cn("flex items-center justify-between gap-3", collapsed ? "mb-0" : "mb-3")}
          >
            <h2 className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {title}
            </h2>
            <div className="flex shrink-0 items-center gap-1">
              {actions}
              {collapsible ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onPress={onToggleCollapsed}
                  aria-expanded={!collapsed}
                  aria-label={collapsed ? "Expand section" : "Collapse section"}
                  className="shrink-0"
                >
                  <ChevronRight
                    data-icon="inline-start"
                    className={cn("transition-transform", !collapsed && "rotate-90")}
                  />
                </Button>
              ) : null}
            </div>
          </div>
        </>
      )}
      <div
        className={cn(
          "flex flex-col gap-3",
          header && !collapsed && "mt-3 border-t pt-3",
          collapsed && "hidden",
        )}
      >
        {children}
      </div>
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
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <UIField>
      <UIFieldLabel htmlFor={controlId}>{label}</UIFieldLabel>
      <Input
        id={controlId}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        spellCheck={spellCheck}
        onChange={(event) => onChange(event.target.value)}
      />
    </UIField>
  );
}

/** The label for the leftover `meta` text once dates move to their own control. */
export function metaRemainderLabel(section: string): string {
  if (section === "experience" || section === "education") return "Location";
  if (section === "projects") return "Link";
  return "Additional detail";
}

type DateFieldKey = "startDate" | "endDate" | "current" | "dateText";

/** Human label for a stored "YYYY-MM"/"YYYY" value, or "" when unset. */
function monthYearLabel(value: string): string {
  const { year, month } = yearMonthParts(value);
  if (!year) return "";
  return month ? `${MONTH_ABBR[Number(month) - 1]} ${year}` : year;
}

/**
 * A calendar-style month picker: a button showing the selected month/year that
 * opens a small popover with a year navigator and a 12-month grid. Portaled to
 * escape the editor's overflow-clipping and the inline sheet popover. Resumes
 * are month/year granularity, so there is no day grid — a "Year only" action
 * covers education-style year ranges. End-date instances also offer Present
 * as a non-date state within the same popover.
 */
function MonthYearField({
  idPrefix,
  legend,
  value,
  present = false,
  onPresentChange,
  onChange,
}: {
  idPrefix: string;
  legend: string;
  value: string;
  present?: boolean;
  onPresentChange?: (present: boolean) => void;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [navYear, setNavYear] = useState(() => yearMonthParts(value).year);
  const parts = yearMonthParts(value);
  const label = present ? "Present" : monthYearLabel(value);
  const selectedMonth = !present && navYear === parts.year ? Number(parts.month) : 0;

  const stepYear = (delta: number) =>
    setNavYear((current) => String((Number(current) || new Date().getFullYear()) + delta));

  const select = (next: string) => {
    if (present) onPresentChange?.(false);
    onChange(next);
    setOpen(false);
  };

  return (
    <UIField>
      <UIFieldLabel htmlFor={`${idPrefix}-trigger`}>{legend}</UIFieldLabel>
      <PopoverTrigger
        isOpen={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) setNavYear(yearMonthParts(value).year || String(new Date().getFullYear()));
        }}
      >
        <Button
          id={`${idPrefix}-trigger`}
          variant="outline"
          aria-label={`${legend} date`}
          className="h-9 w-full justify-start px-2 font-normal"
        >
          {label || <span className="text-muted-foreground">Select</span>}
        </Button>
        <Popover className="w-56 gap-0 p-2" placement="bottom start">
          {onPresentChange ? (
            <Toggle
              variant="outline"
              size="sm"
              className="mb-2 w-full"
              isSelected={present}
              onChange={(isSelected) => {
                onPresentChange(isSelected);
                setOpen(false);
              }}
            >
              Present / ongoing
            </Toggle>
          ) : null}
          <div className="flex items-center justify-between gap-1 pb-1.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous year"
              onClick={() => stepYear(-1)}
            >
              <ChevronLeft data-icon="inline-start" />
            </Button>
            <UIField className="w-16 gap-0">
              <UIFieldLabel className="sr-only" htmlFor={`${idPrefix}-calendar-year`}>
                {legend} year
              </UIFieldLabel>
              <Input
                id={`${idPrefix}-calendar-year`}
                value={navYear}
                placeholder="Year"
                inputMode="numeric"
                maxLength={4}
                spellCheck={false}
                className="h-8 text-center"
                onChange={(event) => setNavYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </UIField>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next year"
              onClick={() => stepYear(1)}
            >
              <ChevronRight data-icon="inline-start" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTH_ABBR.map((month, index) => (
              <Toggle
                key={month}
                aria-label={`${month} ${navYear}`}
                isSelected={selectedMonth === index + 1}
                isDisabled={!navYear}
                onChange={() => select(buildYearMonth(navYear, String(index + 1)))}
                size="sm"
                className="h-auto px-1 py-1.5 text-xs"
              >
                {month}
              </Toggle>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="link"
              size="xs"
              isDisabled={!navYear}
              onPress={() => select(buildYearMonth(navYear, ""))}
            >
              Year only
            </Button>
            <Button variant="link" size="xs" onPress={() => select("")}>
              Clear
            </Button>
          </div>
        </Popover>
      </PopoverTrigger>
    </UIField>
  );
}

/**
 * Structured start/end date editor with a Present option inside the end-date
 * popover and a free-text override for dates that don't fit a month/year
 * ("Expected 2026", "Summer 2021"). Shared by the form and the inline sheet
 * popover so both commit the same fields.
 */
export function DateRangeField({
  idPrefix,
  entry,
  onChange,
}: {
  idPrefix: string;
  entry: ResumeEntry;
  onChange: (key: DateFieldKey, value: string | boolean) => void;
}) {
  const [custom, setCustom] = useState(() => Boolean(entry.dateText.trim()));
  return (
    <UIFieldSet className="gap-2">
      <UIFieldLegend variant="label">Dates</UIFieldLegend>
      <ToggleGroup
        aria-label="Date entry mode"
        variant="outline"
        size="sm"
        spacing={0}
        className="w-fit self-end"
        selectedKeys={[custom ? "text" : "structured"]}
        disallowEmptySelection
        onSelectionChange={(keys) => {
          const mode = keys.values().next().value;
          if (mode === "structured" && custom) {
            onChange("dateText", "");
            setCustom(false);
          } else if (mode === "text" && !custom) {
            setCustom(true);
          }
        }}
      >
        <ToggleGroupItem id="structured">Month &amp; year</ToggleGroupItem>
        <ToggleGroupItem id="text">Exact text</ToggleGroupItem>
      </ToggleGroup>
      {custom ? (
        <UIField>
          <UIFieldLabel htmlFor={`${idPrefix}-dateText`} className="sr-only">
            Date text
          </UIFieldLabel>
          <Input
            id={`${idPrefix}-dateText`}
            value={entry.dateText}
            placeholder="e.g. Expected 2026"
            spellCheck={false}
            onChange={(event) => onChange("dateText", event.target.value)}
          />
        </UIField>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <MonthYearField
              idPrefix={`${idPrefix}-start`}
              legend="Start"
              value={entry.startDate}
              onChange={(value) => onChange("startDate", value)}
            />
            <MonthYearField
              idPrefix={`${idPrefix}-end`}
              legend="End"
              value={entry.endDate}
              present={entry.current}
              onPresentChange={(present) => onChange("current", present)}
              onChange={(value) => onChange("endDate", value)}
            />
          </div>
        </>
      )}
    </UIFieldSet>
  );
}

export function TextAreaField({
  id,
  label,
  value,
  placeholder,
  onChange,
  spellCheck = true,
  aiAssist,
}: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  spellCheck?: boolean;
  aiAssist?: {
    expanded: boolean;
    onClick: () => void;
    content?: ReactNode;
  };
}) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <UIField>
      <div className="flex items-center justify-between gap-2">
        <UIFieldLabel id={`${controlId}-label`} htmlFor={controlId}>
          {label}
        </UIFieldLabel>
        {aiAssist ? (
          <Button
            variant="brand-outline"
            size="icon-sm"
            title={value.trim() ? "Edit this text with local AI" : "Add text before using local AI"}
            onPress={aiAssist.onClick}
            isDisabled={!value.trim()}
            aria-expanded={aiAssist.expanded}
            aria-label="Open local AI text editor"
            aria-describedby={`${controlId}-label`}
            data-ai-edit-for={controlId}
          >
            <Sparkles data-icon="inline-start" />
          </Button>
        ) : null}
      </div>
      <Textarea
        id={controlId}
        value={value}
        placeholder={placeholder}
        spellCheck={spellCheck}
        onChange={(event) => onChange(event.target.value)}
      />
      {aiAssist?.expanded ? aiAssist.content : null}
    </UIField>
  );
}

function TagGroupRow({
  targetId,
  group,
  open,
  active,
  index,
  total,
  dragging,
  dropTarget,
  onToggle,
  onChange,
  onMove,
  onRemove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  targetId: string;
  group: TagGroup;
  open: boolean;
  active: boolean;
  index: number;
  total: number;
  dragging: boolean;
  dropTarget: boolean;
  onToggle: () => void;
  onChange: (next: TagGroup) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
}) {
  const [draft, setDraft] = useState("");
  const addTag = () => {
    const value = draft.trim();
    if (!value || group.tags.some((tag) => tag.toLocaleLowerCase() === value.toLocaleLowerCase()))
      return;
    onChange({ ...group, tags: [...group.tags, value] });
    setDraft("");
  };

  return (
    <div
      id={targetId}
      data-editor-tag-group=""
      data-dragging={dragging || undefined}
      data-drop-target={dropTarget || undefined}
      tabIndex={-1}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "scroll-mt-44 border-b transition-colors last:border-b-0 lg:scroll-mt-16",
        active && "bg-muted/30",
        dragging && "opacity-45 ring-2 ring-inset ring-muted-foreground/20",
        dropTarget && "bg-primary/5 ring-2 ring-inset ring-primary/25",
      )}
    >
      <div className="group/tag-group flex items-center gap-1 pr-1.5 hover:bg-muted/30">
        <Button
          variant="ghost"
          data-tag-group-toggle=""
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${group.label || "untitled"} tag group`}
          onPress={onToggle}
          className="h-auto min-w-0 flex-1 justify-start rounded-none px-2 py-2 text-left"
        >
          <ChevronRight
            data-icon="inline-start"
            className={cn("text-muted-foreground transition-transform", open && "rotate-90")}
          />
          <span className="shrink-0 truncate text-sm font-medium">
            {group.label.trim() || "Untitled group"}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            — {group.tags.length} {group.tags.length === 1 ? "tag" : "tags"}
            {group.tags.length ? ` · ${group.tags.slice(0, 3).join(", ")}` : ""}
          </span>
        </Button>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/tag-group:opacity-100 group-focus-within/tag-group:opacity-100">
          <span
            draggable
            aria-hidden="true"
            title="Drag to reorder; use the move buttons for keyboard reordering"
            className="inline-flex size-7 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <GripVertical className="size-3.5" />
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground"
            aria-label={`Move ${group.label || "tag"} group up`}
            title="Move group up"
            isDisabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp data-icon="inline-start" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground"
            aria-label={`Move ${group.label || "tag"} group down`}
            title="Move group down"
            isDisabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown data-icon="inline-start" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground"
            aria-label={`Remove ${group.label || "tag"} group`}
            onClick={onRemove}
          >
            <Trash2 data-icon="inline-start" />
          </Button>
        </div>
      </div>
      {open ? (
        <div className="grid gap-2 px-3 pb-3 pt-1">
          <UIField>
            <UIFieldLabel className="sr-only" htmlFor={`tag-group-${group.id}-label`}>
              Tag group label
            </UIFieldLabel>
            <Input
              id={`tag-group-${group.id}-label`}
              value={group.label}
              onChange={(event) => onChange({ ...group, label: event.target.value })}
              placeholder="Group label (optional)"
              className="h-8 text-xs"
            />
          </UIField>
          <div
            className="flex flex-wrap gap-1.5"
            aria-label={group.label ? `${group.label} tags` : "Tags"}
          >
            {group.tags.map((tag) => (
              <Button
                variant="secondary"
                size="xs"
                key={tag}
                title="Remove tag"
                onPress={() =>
                  onChange({ ...group, tags: group.tags.filter((candidate) => candidate !== tag) })
                }
                className="rounded-full"
                aria-label={`Remove ${tag}`}
              >
                {tag}
                <X data-icon="inline-end" aria-hidden="true" />
              </Button>
            ))}
          </div>
          <UIField>
            <UIFieldLabel className="sr-only" htmlFor={`tag-group-${group.id}-draft`}>
              Add tag to {group.label || "group"}
            </UIFieldLabel>
            <InputGroup>
              <InputGroupInput
                id={`tag-group-${group.id}-draft`}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    (event.key === "Enter" || event.key === ",") &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add a skill, then press Enter"
                className="text-xs"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton variant="outline" onClick={addTag} isDisabled={!draft.trim()}>
                  Add
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </UIField>
        </div>
      ) : null}
    </div>
  );
}

export function TagGroupEditor({
  section,
  groups,
  activeTarget,
  onChange,
  onGroupCollapse,
  onGroupActivate,
}: {
  section: string;
  groups: TagGroup[];
  activeTarget?: string | null;
  onChange: (groups: TagGroup[]) => void;
  onGroupCollapse?: () => void;
  /** Highlights the group (and its preview row) when the toggle opens it. */
  onGroupActivate?: (targetId: string) => void;
}) {
  const [openGroupIds, setOpenGroupIds] = useState<Set<string>>(() => new Set());
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const dragType = "application/x-resume-tag-group";

  const finishGroupDrag = () => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };
  const reorderGroup = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= groups.length || to >= groups.length) return;
    const next = [...groups];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  // A jump from the view-only preview targets the group row itself. Open that
  // nested row as well as the containing section so its actual fields are
  // immediately visible when focus arrives.
  useEffect(() => {
    const activeGroup = groups.find(
      (group) => activeTarget === `field-${section}-group-${group.id}`,
    );
    if (!activeGroup) return;
    setOpenGroupIds((current) => {
      if (current.has(activeGroup.id)) return current;
      const next = new Set(current);
      next.add(activeGroup.id);
      return next;
    });
  }, [activeTarget, groups, section]);

  return (
    <div className="overflow-hidden rounded-md border bg-muted/10">
      {!groups.length ? (
        <Empty className="min-h-32">
          <EmptyHeader>
            <EmptyTitle>No groups yet</EmptyTitle>
            <EmptyDescription>Add one from the section header.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      {groups.map((group, index) => {
        const open = openGroupIds.has(group.id) || (!group.label.trim() && !group.tags.length);
        const targetId = `field-${section}-group-${group.id}`;
        return (
          <TagGroupRow
            key={group.id}
            targetId={targetId}
            group={group}
            open={open}
            active={activeTarget === targetId}
            index={index}
            total={groups.length}
            dragging={draggedIndex === index}
            dropTarget={dropTargetIndex === index && draggedIndex !== index}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(dragType, String(index));
              event.dataTransfer.setData("text/plain", `taggroup:${index}`);
              setDraggedIndex(index);
              setDropTargetIndex(null);
            }}
            onDragEnd={finishGroupDrag}
            onDragOver={(event) => {
              if (draggedIndex === null) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropTargetIndex(index);
            }}
            onDrop={(event) => {
              if (draggedIndex === null) return;
              event.preventDefault();
              reorderGroup(draggedIndex, index);
              finishGroupDrag();
            }}
            onToggle={() => {
              if (open) {
                if (activeTarget === targetId) onGroupCollapse?.();
              } else {
                onGroupActivate?.(targetId);
              }
              setOpenGroupIds((current) => {
                const next = new Set(current);
                if (open) next.delete(group.id);
                else next.add(group.id);
                return next;
              });
            }}
            onChange={(next) => {
              // A new blank group is implicitly open. Persist that open state
              // before its first character makes it nonblank, otherwise the
              // input unmounts and loses focus after one keystroke.
              setOpenGroupIds((current) => {
                if (current.has(group.id)) return current;
                const openGroups = new Set(current);
                openGroups.add(group.id);
                return openGroups;
              });
              onChange(groups.map((candidate) => (candidate.id === group.id ? next : candidate)));
            }}
            onMove={(direction) => {
              const target = index + direction;
              if (target < 0 || target >= groups.length) return;
              const reordered = [...groups];
              [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
              onChange(reordered);
            }}
            onRemove={() => onChange(groups.filter((candidate) => candidate.id !== group.id))}
          />
        );
      })}
    </div>
  );
}

export function EntryList({
  section,
  sectionLabel,
  entries,
  activeTarget,
  onUpdate,
  onMove,
  onReorder,
  onRemove,
  onSwapTitleAndSubtitle,
  aiTargetId,
  aiPanel,
  onAIEdit,
  onEntryCollapse,
}: {
  section: string;
  sectionLabel: string;
  entries: ResumeEntry[];
  /** Field id currently being edited; its entry is auto-expanded. */
  activeTarget?: string | null;
  onUpdate: (
    section: string,
    index: number,
    key: keyof ResumeEntry,
    value: string | boolean,
  ) => void;
  onMove: (section: string, index: number, direction: -1 | 1) => void;
  onReorder: (section: string, index: number, target: number) => void;
  onRemove: (section: string, index: number) => void;
  onSwapTitleAndSubtitle: (index: number) => void;
  aiTargetId?: string | null;
  aiPanel?: ReactNode;
  onAIEdit?: (target: {
    id: string;
    label: string;
    value: string;
    section: string;
    index: number;
  }) => void;
  onEntryCollapse?: (section: string, index: number) => void;
}) {
  const schema = entryFieldSchema(section, sectionLabel);
  // Which entries the person has manually opened. An entry is also shown open
  // when it's empty (nothing to summarize yet) or holds the active field.
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(() => new Set());
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const prefix = `field-${section}-`;
  const activeIndex = activeTarget?.startsWith(prefix)
    ? Number(activeTarget.slice(prefix.length).split("-")[0])
    : -1;

  const finishEntryDrag = () => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const startEntryDrag = (event: DragEvent<HTMLElement>, index: number, label: string) => {
    event.dataTransfer.effectAllowed = "move";
    const value = JSON.stringify({ section, index });
    event.dataTransfer.setData("application/x-resume-entry", value);
    event.dataTransfer.setData("text/plain", `entry:${value}`);

    const dragImage = document.createElement("div");
    dragImage.textContent = `Moving ${label}`;
    Object.assign(dragImage.style, {
      position: "fixed",
      top: "-1000px",
      left: "-1000px",
      display: "flex",
      alignItems: "center",
      border: "1px solid rgb(148 163 184)",
      borderRadius: "6px",
      background: "white",
      boxShadow: "0 8px 20px rgb(15 23 42 / 22%)",
      padding: "8px 12px",
      color: "rgb(15 23 42)",
      fontSize: "13px",
      fontWeight: "600",
    });
    document.body.append(dragImage);
    event.dataTransfer.setDragImage(dragImage, 18, 18);
    window.setTimeout(() => dragImage.remove(), 0);
    setDraggedIndex(index);
    setDropTargetIndex(null);
  };

  const toggle = (index: number, open: boolean) => {
    setOpenIndexes((prev) => {
      const next = new Set(prev);
      if (open) next.delete(index);
      else next.add(index);
      return next;
    });
    if (open) onEntryCollapse?.(section, index);
    // Opening a row drops the cursor straight into it — one click to edit.
    if (!open)
      window.setTimeout(() => document.getElementById(`${prefix}${index}-title`)?.focus(), 0);
  };

  if (!entries.length) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        No {sectionLabel.toLowerCase()} entries yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border bg-muted/10">
      {entries.map((entry, index) => {
        const empty = !entryHasContent(entry);
        const open = openIndexes.has(index) || empty || activeIndex === index;
        const primary = entry.title.trim() || entry.subtitle.trim() || "Untitled entry";
        const secondary = [entry.title.trim() && entry.subtitle.trim(), entryMetaLine(entry)]
          .filter(Boolean)
          .join(" · ");

        return (
          <div
            key={index}
            data-review-region=""
            data-editor-entry=""
            data-editor-entry-index={index}
            data-dragging={draggedIndex === index || undefined}
            data-drop-target={(dropTargetIndex === index && draggedIndex !== index) || undefined}
            className={cn(
              "group/entry border-b transition-colors last:border-b-0",
              draggedIndex === index && "opacity-45 ring-2 ring-inset ring-muted-foreground/20",
              dropTargetIndex === index &&
                draggedIndex !== index &&
                "bg-primary/5 ring-2 ring-inset ring-primary/25",
            )}
            onDragEnter={(event) => {
              if (
                draggedIndex !== null &&
                (event.dataTransfer.types.includes("application/x-resume-entry") ||
                  event.dataTransfer.types.includes("text/plain"))
              ) {
                setDropTargetIndex(index);
              }
            }}
            onDragOver={(event) => {
              if (
                draggedIndex !== null &&
                (event.dataTransfer.types.includes("application/x-resume-entry") ||
                  event.dataTransfer.types.includes("text/plain"))
              ) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTargetIndex(index);
              }
            }}
            onDrop={(event) => {
              const customData = event.dataTransfer.getData("application/x-resume-entry");
              const plainData = event.dataTransfer.getData("text/plain");
              const value =
                customData || (plainData.startsWith("entry:") ? plainData.slice(6) : "");
              if (!value) return;
              event.preventDefault();
              event.stopPropagation();
              try {
                const dragged = JSON.parse(value) as { section: string; index: number };
                if (dragged.section === section && dragged.index !== index)
                  onReorder(section, dragged.index, index);
              } catch {
                // Ignore drag data from outside the editor.
              } finally {
                finishEntryDrag();
              }
            }}
          >
            <div className="flex items-center gap-1 pr-1.5 hover:bg-muted/30">
              <Button
                variant="ghost"
                data-entry-toggle=""
                aria-expanded={open}
                onPress={() => toggle(index, open)}
                className="h-auto min-w-0 flex-1 justify-start rounded-none px-2 py-2 text-left"
              >
                <ChevronRight
                  data-icon="inline-start"
                  className={cn("text-muted-foreground transition-transform", open && "rotate-90")}
                />
                <span className="shrink-0 truncate text-sm font-medium">{primary}</span>
                {secondary ? (
                  <span className="truncate text-xs text-muted-foreground">— {secondary}</span>
                ) : null}
              </Button>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/entry:opacity-100 group-focus-within/entry:opacity-100">
                <span
                  draggable
                  aria-hidden="true"
                  title="Drag to reorder; use the move buttons for keyboard reordering"
                  className="inline-flex size-7 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
                  onDragStart={(event) => startEntryDrag(event, index, primary)}
                  onDragEnd={finishEntryDrag}
                >
                  <GripVertical className="size-4" />
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Move entry up"
                  title="Move entry up"
                  isDisabled={index === 0}
                  onClick={() => onMove(section, index, -1)}
                >
                  <ArrowUp data-icon="inline-start" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Move entry down"
                  title="Move entry down"
                  isDisabled={index === entries.length - 1}
                  onClick={() => onMove(section, index, 1)}
                >
                  <ArrowDown data-icon="inline-start" />
                </Button>
                {section === "experience" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => onSwapTitleAndSubtitle(index)}
                    aria-label="Switch role and employer"
                    title="Swap job title and company"
                  >
                    <ArrowLeftRight data-icon="inline-start" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label="Remove entry"
                  title="Remove entry (Undo available)"
                  onClick={() => onRemove(section, index)}
                >
                  <Trash2 data-icon="inline-start" />
                </Button>
              </div>
            </div>
            {open ? (
              <div className="flex flex-col gap-3 px-3 pb-3 pt-1">
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
                <DateRangeField
                  idPrefix={`field-${section}-${index}`}
                  entry={entry}
                  onChange={(key, value) => onUpdate(section, index, key, value)}
                />
                <TextField
                  id={`field-${section}-${index}-meta`}
                  label={metaRemainderLabel(section)}
                  value={entry.meta}
                  onChange={(value) => onUpdate(section, index, "meta", value)}
                />
                <RichTextEditor
                  id={`field-${section}-${index}-details`}
                  label={schema.details}
                  value={entry.details}
                  legacyFormat="bullets"
                  onChange={(value) => onUpdate(section, index, "details", value)}
                  aiAssist={
                    onAIEdit
                      ? {
                          expanded: aiTargetId === `${section}:${index}`,
                          onClick: () =>
                            onAIEdit({
                              id: `${section}:${index}`,
                              label: `${sectionLabel} · ${entry.title || entry.subtitle || `Entry ${index + 1}`} · ${schema.details}`,
                              value: entry.details,
                              section,
                              index,
                            }),
                          content: aiTargetId === `${section}:${index}` ? aiPanel : undefined,
                        }
                      : undefined
                  }
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
