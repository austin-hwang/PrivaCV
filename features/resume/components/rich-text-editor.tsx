"use client";

import { Bold, Italic, List, ListOrdered, Sparkles, Underline } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ToggleButton } from "@/components/ui/toggle-button";
import { commitRichContent, renderRichContent, stripRichMarks } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

type ActiveState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  bulleted: boolean;
  numbered: boolean;
};
const NO_ACTIVE: ActiveState = {
  bold: false,
  italic: false,
  underline: false,
  bulleted: false,
  numbered: false,
};

/**
 * A block-level WYSIWYG editor for the resume "body" fields. Each line can
 * independently be a bulleted item, a numbered item, or a plain paragraph — the
 * bullet/number toolbar buttons toggle the current line(s), like a document
 * editor, so bulleted and non-bulleted lines can be freely mixed. Content is
 * edited in place (uncontrolled while focused so the caret is never fought) and
 * committed on blur as canonical block HTML. `legacyFormat` only interprets old
 * newline-based values on first load.
 */
export function RichTextEditor({
  id,
  label,
  value,
  legacyFormat,
  placeholder,
  spellCheck = true,
  onChange,
  aiAssist,
}: {
  id?: string;
  label: string;
  value: string;
  legacyFormat?: string;
  placeholder?: string;
  spellCheck?: boolean;
  onChange: (value: string) => void;
  aiAssist?: {
    expanded: boolean;
    onClick: () => void;
    content?: ReactNode;
  };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);
  const [showPlaceholder, setShowPlaceholder] = useState(() => !stripRichMarks(value).trim());
  const [active, setActive] = useState<ActiveState>(NO_ACTIVE);

  // Re-sync the editor from the canonical value only while unfocused, so
  // external updates (AI edits, resets) land without disturbing a live caret.
  // While focused the element is uncontrolled — list toggles happen live via
  // the browser's own list commands.
  useEffect(() => {
    const el = ref.current;
    if (!el || focusedRef.current) return;
    el.innerHTML = renderRichContent(value, legacyFormat, "div");
    setShowPlaceholder(!stripRichMarks(value).trim());
  }, [value, legacyFormat]);

  const refreshActive = useCallback(() => {
    if (typeof window === "undefined") return;
    const el = ref.current;
    const selection = window.getSelection();
    const inside = Boolean(
      el && selection && selection.rangeCount && el.contains(selection.anchorNode),
    );
    const next: ActiveState = inside
      ? {
          bold: document.queryCommandState("bold"),
          italic: document.queryCommandState("italic"),
          underline: document.queryCommandState("underline"),
          bulleted: document.queryCommandState("insertUnorderedList"),
          numbered: document.queryCommandState("insertOrderedList"),
        }
      : NO_ACTIVE;
    setActive((prev) =>
      prev.bold === next.bold &&
      prev.italic === next.italic &&
      prev.underline === next.underline &&
      prev.bulleted === next.bulleted &&
      prev.numbered === next.numbered
        ? prev
        : next,
    );
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshActive);
    return () => document.removeEventListener("selectionchange", refreshActive);
  }, [refreshActive]);

  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const next = commitRichContent(el);
    if (next !== value) onChange(next);
  };

  // The editor is non-empty if it has any text OR a structural element such as a
  // list — so inserting an empty bullet hides the placeholder instead of letting
  // it overlap the marker.
  const isEmpty = (el: HTMLElement | null) =>
    !el || (!el.textContent?.trim() && !el.querySelector("li"));

  const exec = (command: string) => {
    ref.current?.focus();
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(command);
    setShowPlaceholder(isEmpty(ref.current));
    refreshActive();
  };

  const controls = [
    { key: "bold", label: "Bold", icon: Bold, onClick: () => exec("bold"), active: active.bold },
    {
      key: "italic",
      label: "Italic",
      icon: Italic,
      onClick: () => exec("italic"),
      active: active.italic,
    },
    {
      key: "underline",
      label: "Underline",
      icon: Underline,
      onClick: () => exec("underline"),
      active: active.underline,
    },
    { key: "sep", label: "", icon: Bold, onClick: () => {}, active: false },
    {
      key: "bulleted",
      label: "Bulleted list",
      icon: List,
      onClick: () => exec("insertUnorderedList"),
      active: active.bulleted,
    },
    {
      key: "numbered",
      label: "Numbered list",
      icon: ListOrdered,
      onClick: () => exec("insertOrderedList"),
      active: active.numbered,
    },
  ] as const;

  return (
    <div className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      <div className="flex items-center justify-between gap-2">
        <label id={id ? `${id}-label` : undefined} htmlFor={id}>
          {label}
        </label>
        {aiAssist ? (
          <Button
            unstyled
            title={
              stripRichMarks(value).trim()
                ? "Edit this text with local AI"
                : "Add text before using local AI"
            }
            onPress={aiAssist.onClick}
            isDisabled={!stripRichMarks(value).trim()}
            aria-expanded={aiAssist.expanded}
            aria-label="Open local AI text editor"
            aria-describedby={id ? `${id}-label` : undefined}
            data-ai-edit-for={id}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md border text-violet-600 transition-colors hover:bg-violet-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 dark:text-violet-300 dark:hover:bg-violet-950/40",
              aiAssist.expanded &&
                "bg-violet-50 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:ring-violet-500/40",
            )}
          >
            <Sparkles className="size-3.5" />
          </Button>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-md border border-input bg-background shadow-xs transition-colors focus-within:ring-2 focus-within:ring-ring">
        <div
          className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-1 py-1"
          role="toolbar"
          aria-label={`${label} formatting`}
        >
          {controls.map(({ key, label: buttonLabel, icon: Icon, onClick, active: isActive }) =>
            key === "sep" ? (
              <span key={key} className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
            ) : (
              <ToggleButton
                key={key}
                title={buttonLabel}
                aria-label={buttonLabel}
                isSelected={isActive}
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-sm transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-foreground text-background hover:bg-foreground/90"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                // Keep the caret/selection in the contentEditable so execCommand
                // formats the current selection instead of the button stealing focus.
                onMouseDown={(event) => event.preventDefault()}
                onChange={onClick}
              >
                <Icon className="size-3.5" />
              </ToggleButton>
            ),
          )}
        </div>
        <div className="relative">
          <div
            id={id}
            ref={ref}
            role="textbox"
            aria-multiline="true"
            aria-label={label}
            contentEditable
            suppressContentEditableWarning
            spellCheck={spellCheck}
            data-rich-text-editor=""
            className="rte-editable min-h-[76px] px-3 py-2 text-sm font-normal text-foreground focus-visible:outline-hidden"
            onFocus={() => {
              focusedRef.current = true;
              refreshActive();
            }}
            onKeyUp={refreshActive}
            onMouseUp={refreshActive}
            onInput={(event) => {
              setShowPlaceholder(isEmpty(event.currentTarget));
              refreshActive();
            }}
            onBlur={() => {
              focusedRef.current = false;
              commit();
              setActive(NO_ACTIVE);
            }}
          />
          {showPlaceholder && placeholder ? (
            <span className="pointer-events-none absolute left-3 top-2 text-sm font-normal text-muted-foreground/60">
              {placeholder}
            </span>
          ) : null}
        </div>
      </div>
      {aiAssist?.expanded ? aiAssist.content : null}
    </div>
  );
}
