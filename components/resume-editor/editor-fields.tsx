import { ArrowDown, ArrowLeftRight, ArrowUp, ChevronRight, GripVertical, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ENTRY_SCHEMA } from "@/lib/resume-workspace";
import { entryHasContent, isBuiltinSection, type ResumeEntry, type TagGroup } from "@/lib/resume";
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
  return (
    <section
      id={id}
      data-review-region={reviewRegion ? "" : undefined}
      data-field-group={groupId}
      className={cn(
        "scroll-mt-44 transition-colors lg:scroll-mt-16",
        card ? "rounded-lg border bg-background p-3" : "border-b last:border-b-0",
        !card && (collapsed ? "pb-3" : "pb-5"),
        className,
      )}
    >
      {header ?? (
        <>
          {/* The collapse toggle lives on the RIGHT so the title (and the fields
              below it) share one flush-left edge — a left chevron would indent the
              title past its own content and look misaligned. */}
          <div className={cn("flex items-center justify-between gap-3", collapsed ? "mb-0" : "mb-3")}>
            <h2 className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>
            <div className="flex shrink-0 items-center gap-1">
              {actions}
              {collapsible ? (
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  aria-expanded={!collapsed}
                  aria-label={collapsed ? "Expand section" : "Collapse section"}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronRight className={cn("size-4 transition-transform", !collapsed && "rotate-90")} />
                </button>
              ) : null}
            </div>
          </div>
        </>
      )}
      <div className={cn("space-y-3", header && !collapsed && "mt-3 border-t pt-3", collapsed && "hidden")}>{children}</div>
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
  return (
    <div className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      <div className="flex items-center justify-between gap-2">
        <label id={id ? `${id}-label` : undefined} htmlFor={id}>{label}</label>
        {aiAssist ? (
          <button
            type="button"
            onClick={aiAssist.onClick}
            disabled={!value.trim()}
            aria-expanded={aiAssist.expanded}
            aria-label="Open local AI text editor"
            aria-describedby={id ? `${id}-label` : undefined}
            data-ai-edit-for={id}
            title={value.trim() ? "Edit this text with local AI" : "Add text before using local AI"}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md border text-violet-600 transition-colors hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 dark:text-violet-300 dark:hover:bg-violet-950/40",
              aiAssist.expanded && "bg-violet-50 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:ring-violet-500/40",
            )}
          >
            <Sparkles className="size-3.5" />
          </button>
        ) : null}
      </div>
      <Textarea
        id={id}
        value={value}
        placeholder={placeholder}
        spellCheck={spellCheck}
        onChange={(event) => onChange(event.target.value)}
      />
      {aiAssist?.expanded ? aiAssist.content : null}
    </div>
  );
}

function TagGroupRow({
  targetId,
  group,
  open,
  active,
  onToggle,
  onChange,
  onRemove,
}: {
  targetId: string;
  group: TagGroup;
  open: boolean;
  active: boolean;
  onToggle: () => void;
  onChange: (next: TagGroup) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState("");
  const addTag = () => {
    const value = draft.trim();
    if (!value || group.tags.some((tag) => tag.toLocaleLowerCase() === value.toLocaleLowerCase())) return;
    onChange({ ...group, tags: [...group.tags, value] });
    setDraft("");
  };

  return (
    <div
      id={targetId}
      data-editor-tag-group=""
      tabIndex={-1}
      className={cn(
        "scroll-mt-44 border-b transition-colors last:border-b-0 lg:scroll-mt-16",
        active && "bg-brand-soft/10 ring-1 ring-inset ring-brand/30",
      )}
    >
      <div className="group/tag-group flex items-center gap-1 pr-1.5 hover:bg-muted/30">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${group.label || "untitled"} tag group`}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-2 pl-2 text-left"
        >
          <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
          <span className="shrink-0 truncate text-sm font-medium">{group.label.trim() || "Untitled group"}</span>
          <span className="truncate text-xs text-muted-foreground">
            — {group.tags.length} {group.tags.length === 1 ? "tag" : "tags"}
            {group.tags.length ? ` · ${group.tags.slice(0, 3).join(", ")}` : ""}
          </span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/tag-group:opacity-100 group-focus-within/tag-group:opacity-100"
          aria-label={`Remove ${group.label || "tag"} group`}
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {open ? (
        <div className="grid gap-2 px-3 pb-3 pt-1">
          <Input
            id={`tag-group-${group.id}-label`}
            value={group.label}
            onChange={(event) => onChange({ ...group, label: event.target.value })}
            placeholder="Group label (optional)"
            aria-label="Tag group label"
            className="h-8 text-xs"
          />
          <div className="flex flex-wrap gap-1.5" aria-label={group.label ? `${group.label} tags` : "Tags"}>
            {group.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onChange({ ...group, tags: group.tags.filter((candidate) => candidate !== tag) })}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Remove ${tag}`}
                title="Remove tag"
              >
                {tag}<X className="size-3" aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === ",") && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add a skill, then press Enter"
              aria-label={`Add tag to ${group.label || "group"}`}
              className="h-8 text-xs"
            />
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={addTag} disabled={!draft.trim()}>
              Add
            </Button>
          </div>
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
}: {
  section: string;
  groups: TagGroup[];
  activeTarget?: string | null;
  onChange: (groups: TagGroup[]) => void;
  onGroupCollapse?: () => void;
}) {
  const [openGroupIds, setOpenGroupIds] = useState<Set<string>>(() => new Set());

  // A jump from the view-only preview targets the group row itself. Open that
  // nested row as well as the containing section so its actual fields are
  // immediately visible when focus arrives.
  useEffect(() => {
    const activeGroup = groups.find((group) => activeTarget === `field-${section}-group-${group.id}`);
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
        <p className="p-3 text-xs text-muted-foreground">No groups yet. Add one from the section header.</p>
      ) : null}
      {groups.map((group) => {
        const open = openGroupIds.has(group.id) || (!group.label.trim() && !group.tags.length);
        const targetId = `field-${section}-group-${group.id}`;
        return (
          <TagGroupRow
            key={group.id}
            targetId={targetId}
            group={group}
            open={open}
            active={activeTarget === targetId}
            onToggle={() => {
              if (open && activeTarget === targetId) onGroupCollapse?.();
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
              onChange(groups.map((candidate) => candidate.id === group.id ? next : candidate));
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
  onUpdate: (section: string, index: number, key: keyof ResumeEntry, value: string) => void;
  onMove: (section: string, index: number, direction: -1 | 1) => void;
  onReorder: (section: string, index: number, target: number) => void;
  onRemove: (section: string, index: number) => void;
  onSwapTitleAndSubtitle: (index: number) => void;
  aiTargetId?: string | null;
  aiPanel?: ReactNode;
  onAIEdit?: (target: { id: string; label: string; value: string; section: string; index: number }) => void;
  onEntryCollapse?: (section: string, index: number) => void;
}) {
  const schema = isBuiltinSection(section) && section !== "skills"
    ? ENTRY_SCHEMA[section]
    : { title: "Title", subtitle: "Organization / context", meta: "Dates / details", details: "Highlights" };
  // Which entries the person has manually opened. An entry is also shown open
  // when it's empty (nothing to summarize yet) or holds the active field.
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(() => new Set());
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const prefix = `field-${section}-`;
  const activeIndex = activeTarget?.startsWith(prefix) ? Number(activeTarget.slice(prefix.length).split("-")[0]) : -1;

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
    if (!open) window.setTimeout(() => document.getElementById(`${prefix}${index}-title`)?.focus(), 0);
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
        const secondary = [entry.title.trim() && entry.subtitle.trim(), entry.meta.trim()].filter(Boolean).join(" · ");

        return (
          <div
            key={index}
            data-review-region=""
            data-editor-entry=""
            data-editor-entry-index={index}
            data-dragging={draggedIndex === index || undefined}
            data-drop-target={dropTargetIndex === index && draggedIndex !== index || undefined}
            className={cn(
              "group/entry border-b transition-colors last:border-b-0",
              draggedIndex === index && "opacity-45 ring-2 ring-inset ring-muted-foreground/20",
              dropTargetIndex === index && draggedIndex !== index && "bg-primary/5 ring-2 ring-inset ring-primary/25",
            )}
            onDragEnter={(event) => {
              if (draggedIndex !== null && (event.dataTransfer.types.includes("application/x-resume-entry") || event.dataTransfer.types.includes("text/plain"))) {
                setDropTargetIndex(index);
              }
            }}
            onDragOver={(event) => {
              if (draggedIndex !== null && (event.dataTransfer.types.includes("application/x-resume-entry") || event.dataTransfer.types.includes("text/plain"))) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTargetIndex(index);
              }
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
              } finally {
                finishEntryDrag();
              }
            }}
          >
            <div className="flex items-center gap-1 pr-1.5 hover:bg-muted/30">
              <button
                type="button"
                data-entry-toggle=""
                aria-expanded={open}
                onClick={() => toggle(index, open)}
                className="flex min-w-0 flex-1 items-center gap-1.5 py-2 pl-2 text-left"
              >
                <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
                <span className="shrink-0 truncate text-sm font-medium">{primary}</span>
                {secondary ? <span className="truncate text-xs text-muted-foreground">— {secondary}</span> : null}
              </button>
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
                  disabled={index === 0}
                  onClick={() => onMove(section, index, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Move entry down"
                  title="Move entry down"
                  disabled={index === entries.length - 1}
                  onClick={() => onMove(section, index, 1)}
                >
                  <ArrowDown />
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
                    <ArrowLeftRight />
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
                  <Trash2 />
                </Button>
              </div>
            </div>
            {open ? (
              <div className="space-y-3 px-3 pb-3 pt-1">
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
                  aiAssist={onAIEdit ? {
                    expanded: aiTargetId === `${section}:${index}`,
                    onClick: () => onAIEdit({
                      id: `${section}:${index}`,
                      label: `${sectionLabel} · ${entry.title || entry.subtitle || `Entry ${index + 1}`} · ${schema.details}`,
                      value: entry.details,
                      section,
                      index,
                    }),
                    content: aiTargetId === `${section}:${index}` ? aiPanel : undefined,
                  } : undefined}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
