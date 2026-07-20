"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import type { DragEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { EntryList, FieldGroup, TagGroupEditor } from "@/features/resume/components/editor-fields";
import { RichTextEditor } from "@/features/resume/components/rich-text-editor";
import type { useResumeEditor } from "@/features/resume/hooks/use-resume-editor";
import type {
  LocalAIInlineTarget,
  useResumeWorkspaceUI,
} from "@/features/resume/hooks/use-resume-workspace-ui";
import {
  CUSTOM_SECTION_PRESET_FORMATS,
  CUSTOM_SECTION_PRESETS,
  getSectionEntries,
  getSectionFormat,
  getSectionTagGroups,
  getSectionText,
  getSectionTitle,
  isBuiltinSection,
  isSectionHidden,
  sectionItemCount,
  SECTION_FORMAT_LABELS,
  SECTION_KEYS,
  SECTION_LABELS,
} from "@/lib/resume";
import { cn } from "@/lib/utils";

const ACTIVE_SECTION_CLASS = "rounded-md bg-brand-soft/10 px-3 pt-3 ring-1 ring-brand/40";

type ResumeEditorController = ReturnType<typeof useResumeEditor>;
type ResumeWorkspaceUI = ReturnType<typeof useResumeWorkspaceUI>;

export function ResumeSectionList({
  editor,
  ui,
  localAIInlinePanel,
  toggleLocalAIInlineEdit,
  expandGroup,
  focusEditorTarget,
}: {
  editor: ResumeEditorController;
  ui: ResumeWorkspaceUI;
  localAIInlinePanel: ReactNode;
  toggleLocalAIInlineEdit: (target: LocalAIInlineTarget) => void;
  expandGroup: (groupId: string) => void;
  focusEditorTarget: (targetId: string) => void;
}) {
  const {
    addBuiltinSection,
    addCustomSection,
    addEntry,
    moveEntry,
    moveSection,
    removeBuiltinSection,
    removeCustomSection,
    removeEntry,
    reorderEntry,
    reorderSection,
    state,
    swapExperienceTitleAndCompany,
    toggleSectionHidden,
    updateEntry,
    updateSectionFormat,
    updateSectionTagGroups,
    updateSectionText,
    updateSectionTitle,
  } = editor;
  const {
    activeTarget,
    collapsedGroups,
    draggedSection,
    dropTargetSection,
    localAIEnabled,
    localAIInlineTarget,
    setActiveTarget,
    setCollapsedGroups,
    setDraggedSection,
    setDropTargetSection,
  } = ui;
  const removedBuiltinSections = SECTION_KEYS.filter(
    (section) => !state.sectionOrder.includes(section),
  );
  const toggleGroup = (groupId: string) =>
    setCollapsedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  const groupProps = (groupId: string) => ({
    groupId,
    collapsible: true,
    collapsed: collapsedGroups.has(groupId),
    onToggleCollapsed: () => toggleGroup(groupId),
  });
  const startSectionDrag = (event: DragEvent<HTMLElement>, section: string, title: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-resume-section", section);
    event.dataTransfer.setData("text/plain", `section:${section}`);
    const dragImage = document.createElement("div");
    dragImage.textContent = `Moving ${title.trim() || "Untitled section"}`;
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
    setDraggedSection(section);
    setDropTargetSection(null);
  };
  const finishSectionDrag = () => {
    setDraggedSection(null);
    setDropTargetSection(null);
  };

  return (
    <section
      id="section-order-controls"
      tabIndex={-1}
      className="scroll-mt-44 space-y-3 lg:scroll-mt-16"
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Resume sections
          </h2>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Drag to reorder. Expand a section to edit it.
          </p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {state.sectionOrder.length} {state.sectionOrder.length === 1 ? "section" : "sections"}
        </span>
      </div>

      {state.sectionOrder.map((section, sectionIndex) => {
        const sectionTitle = getSectionTitle(state, section);
        const sectionDisplayTitle = sectionTitle.trim() || "Untitled section";
        const customSection = !isBuiltinSection(section);
        const entries = getSectionEntries(state, section);
        const sectionFormat = getSectionFormat(state, section);
        const sectionIsText = sectionFormat === "text";
        const tagGroups = getSectionTagGroups(state, section);
        const sectionText = getSectionText(state, section);
        const sectionHidden = isSectionHidden(state, section);
        const sectionCount = sectionItemCount(state, section);
        const sectionCollapsed = collapsedGroups.has(section);
        const sectionTextAITargetId = `section-text:${section}`;
        const sectionTextAIAssist = localAIEnabled
          ? {
              expanded: localAIInlineTarget?.id === sectionTextAITargetId,
              onClick: () =>
                toggleLocalAIInlineEdit({
                  id: sectionTextAITargetId,
                  label: `${sectionDisplayTitle} · ${SECTION_FORMAT_LABELS[sectionFormat]}`,
                  value: sectionText,
                  section,
                }),
              content:
                localAIInlineTarget?.id === sectionTextAITargetId ? localAIInlinePanel : undefined,
            }
          : undefined;
        const sectionIsActive =
          activeTarget === `section-title-${section}` ||
          activeTarget === `field-${section}` ||
          activeTarget?.startsWith(`field-${section}-`) ||
          activeTarget === `add-${section}-group` ||
          activeTarget === `add-${section}-entry`;

        return (
          <div
            key={section}
            id={`edit-section-${section}`}
            data-editor-section={section}
            data-arrange-section={section}
            className="scroll-mt-44 lg:scroll-mt-16"
            data-dragging={draggedSection === section || undefined}
            data-drop-target={
              (dropTargetSection === section && draggedSection !== section) || undefined
            }
            onDragEnter={(event) => {
              if (
                draggedSection &&
                (event.dataTransfer.types.includes("application/x-resume-section") ||
                  event.dataTransfer.types.includes("text/plain"))
              )
                setDropTargetSection(section);
            }}
            onDragOver={(event) => {
              if (
                draggedSection &&
                (event.dataTransfer.types.includes("application/x-resume-section") ||
                  event.dataTransfer.types.includes("text/plain"))
              ) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTargetSection(section);
              }
            }}
            onDrop={(event) => {
              const customData = event.dataTransfer.getData("application/x-resume-section");
              const plainData = event.dataTransfer.getData("text/plain");
              if (!customData && !plainData.startsWith("section:")) return;
              const movedSection = customData || plainData.replace(/^section:/, "");
              if (!movedSection || movedSection === section) return;
              event.preventDefault();
              reorderSection(movedSection, sectionIndex);
              finishSectionDrag();
            }}
          >
            <FieldGroup
              {...groupProps(section)}
              id={`review-region-${section}`}
              card
              reviewRegion={section === "skills"}
              className={cn(
                sectionIsActive && ACTIVE_SECTION_CLASS,
                sectionHidden && "opacity-60",
                draggedSection === section && "opacity-45 ring-2 ring-muted-foreground/20",
                dropTargetSection === section &&
                  draggedSection !== section &&
                  "border-primary bg-primary/5 ring-2 ring-primary/25",
              )}
              title={sectionDisplayTitle}
              header={
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    draggable
                    aria-hidden="true"
                    title="Drag to reorder; keyboard move actions are in the section menu"
                    className="inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
                    onDragStart={(event) => startSectionDrag(event, section, sectionTitle)}
                    onDragEnd={finishSectionDrag}
                  >
                    <GripVertical className="size-4" />
                  </span>
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {sectionIndex + 1}
                  </span>
                  <Input
                    id={`section-title-${section}`}
                    value={sectionTitle}
                    aria-label={
                      sectionTitle.trim()
                        ? `${sectionTitle} section title`
                        : "Untitled section title"
                    }
                    onChange={(event) => updateSectionTitle(section, event.target.value)}
                    className={cn(
                      "h-8 min-w-20 flex-1 border-transparent bg-transparent px-2 text-sm font-semibold shadow-none hover:bg-muted/60 focus-visible:border-input focus-visible:bg-background",
                      sectionHidden && "text-muted-foreground line-through",
                    )}
                  />
                  {sectionCount > 0 ? (
                    <span
                      className="editor-pane-wide shrink-0 tabular-nums text-xs text-muted-foreground"
                      title={`${sectionCount} ${sectionCount === 1 ? "item" : "items"}`}
                    >
                      ({sectionCount})
                    </span>
                  ) : null}
                  {sectionFormat === "tag-groups" ? (
                    <Button
                      id={`add-${section}-group`}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 px-2"
                      aria-label={`Add group to ${sectionDisplayTitle}`}
                      onClick={() => {
                        const groupId = `group-${Date.now().toString(36)}`;
                        expandGroup(section);
                        updateSectionTagGroups(section, [
                          ...tagGroups,
                          { id: groupId, label: "", tags: [] },
                        ]);
                        window.setTimeout(
                          () => document.getElementById(`tag-group-${groupId}-label`)?.focus(),
                          0,
                        );
                      }}
                    >
                      <Plus /> <span className="editor-pane-wide">Add</span>
                    </Button>
                  ) : sectionFormat === "entries" ? (
                    <Button
                      id={`add-${section}-entry`}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 px-2"
                      onClick={() => {
                        expandGroup(section);
                        addEntry(section);
                      }}
                    >
                      <Plus /> <span className="editor-pane-wide">Add</span>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={
                      sectionHidden
                        ? `Show ${sectionDisplayTitle} section in resume`
                        : `Hide ${sectionDisplayTitle} section from resume`
                    }
                    aria-pressed={sectionHidden}
                    title={sectionHidden ? "Show in resume" : "Hide from resume"}
                    onClick={() => toggleSectionHidden(section)}
                  >
                    {sectionHidden ? <EyeOff /> : <Eye />}
                  </Button>
                  <Menu>
                    <MenuTrigger>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        aria-label={`More actions for ${sectionDisplayTitle}`}
                      >
                        <MoreHorizontal />
                      </Button>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem
                        disabled={sectionIndex === 0}
                        onSelect={() => moveSection(section, -1)}
                      >
                        <ArrowUp /> Move section up
                      </MenuItem>
                      <MenuItem
                        disabled={sectionIndex === state.sectionOrder.length - 1}
                        onSelect={() => moveSection(section, 1)}
                      >
                        <ArrowDown /> Move section down
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem
                        destructive
                        onSelect={() =>
                          customSection
                            ? removeCustomSection(section)
                            : removeBuiltinSection(section)
                        }
                      >
                        <Trash2 /> Remove section
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                  <button
                    type="button"
                    onClick={() => toggleGroup(section)}
                    aria-expanded={!sectionCollapsed}
                    aria-label={
                      sectionCollapsed
                        ? `Expand ${sectionDisplayTitle}`
                        : `Collapse ${sectionDisplayTitle}`
                    }
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronRight
                      className={cn(
                        "size-4 transition-transform",
                        !sectionCollapsed && "rotate-90",
                      )}
                    />
                  </button>
                </div>
              }
            >
              <div className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                <span id={`section-format-${section}`}>Content format</span>
                <div
                  role="group"
                  aria-labelledby={`section-format-${section}`}
                  className="flex w-full overflow-x-auto rounded-md border border-input bg-background shadow-xs"
                >
                  {(
                    [
                      { key: "entries", label: "Entries" },
                      { key: "tag-groups", label: "Tags" },
                      { key: "text", label: "Text" },
                    ] as const
                  ).map((option, index) => (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={sectionFormat === option.key}
                      aria-label={`${option.label} format`}
                      title={option.label}
                      onClick={() => updateSectionFormat(section, option.key)}
                      className={cn(
                        "min-w-fit flex-1 border-l px-2 py-2 text-xs font-medium transition-colors first:border-l-0 focus-visible:relative focus-visible:z-10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        index === 0 && "border-l-0",
                        sectionFormat === option.key
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] font-normal leading-snug text-muted-foreground">
                  {sectionFormat === "tag-groups"
                    ? "Use labeled groups and removable tags for concise skills, tools, languages, or competencies."
                    : sectionFormat === "entries"
                      ? "Use a heading, supporting details, and optional bullets for each item."
                      : "A free text body. Use the toolbar to make each line a bullet, a number, or a plain paragraph — mix them freely."}
                </p>
              </div>
              {sectionFormat === "tag-groups" ? (
                <TagGroupEditor
                  section={section}
                  groups={tagGroups}
                  activeTarget={activeTarget}
                  onChange={(groups) => updateSectionTagGroups(section, groups)}
                  onGroupCollapse={() => setActiveTarget(null)}
                  onGroupActivate={(targetId) => setActiveTarget(targetId)}
                />
              ) : sectionIsText ? (
                <RichTextEditor
                  id={`field-${section}-content`}
                  label={`${sectionDisplayTitle} content`}
                  value={sectionText}
                  legacyFormat="bullets"
                  placeholder="Add a line, then use the toolbar for bullets or numbers"
                  onChange={(value) => updateSectionText(section, value)}
                  aiAssist={sectionTextAIAssist}
                />
              ) : (
                <EntryList
                  section={section}
                  sectionLabel={sectionTitle}
                  entries={entries}
                  activeTarget={activeTarget}
                  onUpdate={updateEntry}
                  onMove={moveEntry}
                  onReorder={reorderEntry}
                  onRemove={removeEntry}
                  onSwapTitleAndSubtitle={swapExperienceTitleAndCompany}
                  aiTargetId={
                    localAIEnabled && localAIInlineTarget?.section ? localAIInlineTarget.id : null
                  }
                  aiPanel={localAIInlinePanel}
                  onAIEdit={localAIEnabled ? toggleLocalAIInlineEdit : undefined}
                  onEntryCollapse={() => setActiveTarget(null)}
                />
              )}
            </FieldGroup>
          </div>
        );
      })}

      <div className="rounded-lg border border-dashed bg-muted/20 p-3">
        <p className="text-sm font-medium">Add a section</p>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">
          Choose a familiar heading or make your own.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {removedBuiltinSections.map((section) => (
            <Button
              key={section}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                addBuiltinSection(section);
                focusEditorTarget(`section-title-${section}`);
              }}
            >
              <Plus /> {SECTION_LABELS[section]}
            </Button>
          ))}
          {CUSTOM_SECTION_PRESETS.map((title) => (
            <Button
              key={title}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const id = addCustomSection(title, CUSTOM_SECTION_PRESET_FORMATS[title]);
                focusEditorTarget(`section-title-${id}`);
              }}
            >
              <Plus /> {title}
            </Button>
          ))}
          <Button
            id="add-custom-section"
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              const id = addCustomSection();
              focusEditorTarget(`section-title-${id}`);
            }}
          >
            <Plus /> Add custom section
          </Button>
        </div>
      </div>
    </section>
  );
}
