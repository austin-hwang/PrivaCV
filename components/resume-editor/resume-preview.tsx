import { forwardRef, type ClipboardEvent, type CSSProperties, type FocusEvent, type KeyboardEvent } from "react";
import {
  bulletsFrom,
  contactHref,
  entryHasContent,
  getSectionEntries,
  getSectionFormat,
  getSectionTagGroups,
  getSectionText,
  getSectionTitle,
  hasAnyContent,
  normalizeAccent,
  visibleSectionOrder,
  resolveFontStack,
  type ResumeState,
  type TagGroup,
} from "@/lib/resume";
import { cn } from "@/lib/utils";

type InlineEditHandlers = {
  /** When true, resume text is edited in place on the sheet. */
  editable?: boolean;
  onEditField?: (field: string, value: string) => void;
  onEditSectionTitle?: (section: string, value: string) => void;
  onEditEntry?: (section: string, index: number, key: "title" | "subtitle" | "meta" | "details", value: string) => void;
  onEditTagGroup?: (section: string, groupId: string, patch: Pick<TagGroup, "label" | "tags">) => void;
};

type ResumePreviewProps = {
  state: ResumeState;
  pageCount?: number;
  pageGuides?: Array<{ page: number; label?: string }>;
  printBreaks?: Array<{ targetId: string; spacer: number }>;
  activeTarget?: string | null;
  onTargetSelect?: (targetId: string) => void;
} & InlineEditHandlers;

/**
 * A rich-text paste can leave markup, line breaks, and unexpected sizing in a
 * one-line field until it blurs. These compact canvas fields are intended for
 * a name, title, heading, or date, so insert only the clipboard's plain text
 * and fold its whitespace into one readable line.
 */
function pastePlainTextIntoSingleLineField(event: ClipboardEvent<HTMLElement>) {
  event.preventDefault();
  const text = event.clipboardData.getData("text/plain").replace(/\s+/g, " ");
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;

  const range = selection.getRangeAt(0);
  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * A single run of inline-editable text. While editing it is uncontrolled — the
 * DOM text is set through a ref only when the element is not focused — so React
 * re-renders never fight the caret. Changes commit on blur (and on Enter for
 * single-line fields).
 */
function InlineText({
  as = "span",
  editable,
  value,
  placeholder,
  multiline = false,
  spellCheck = true,
  className,
  onCommit,
  ...rest
}: {
  as?: "span" | "div" | "h1" | "h2" | "p";
  editable?: boolean;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  /** Let the browser catch ordinary writing mistakes using its configured spellcheck behavior. */
  spellCheck?: boolean;
  className?: string;
  onCommit: (value: string) => void;
} & Record<string, unknown>) {
  const Tag = as as React.ElementType;
  if (!editable) {
    return (
      <Tag className={className} {...rest}>
        {value}
      </Tag>
    );
  }
  return (
    <Tag
      className={cn("resume-editable", !value && "resume-editable-empty", className)}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      spellCheck={spellCheck}
      onBlur={(event: FocusEvent<HTMLElement>) => onCommit((event.currentTarget.textContent ?? "").trim())}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        if (!multiline && event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          event.currentTarget.textContent = value;
          event.currentTarget.blur();
        }
      }}
      onPaste={multiline ? undefined : pastePlainTextIntoSingleLineField}
      {...rest}
    >
      {value}
    </Tag>
  );
}

/**
 * A multi-line inline-editable list (bullets or skill lines). The rows are
 * React-rendered so the sheet measures at its true height, but while editing no
 * state changes (commit is on blur) so React never rewrites the text and the
 * browser's own Enter/Backspace list handling is left alone. A content-keyed
 * remount after each commit keeps reconciliation clean.
 */
function EditableList({
  editable,
  items,
  onCommit,
  spellCheck = true,
  className,
  containerTag = "ul",
  itemTag = "li",
  itemClassName,
  renderItem,
}: {
  editable?: boolean;
  items: string[];
  onCommit: (items: string[]) => void;
  /** Bullets and skill lines benefit from the browser's native local spellcheck. */
  spellCheck?: boolean;
  className?: string;
  containerTag?: "ul" | "div";
  itemTag?: "li" | "div";
  itemClassName?: string;
  renderItem?: (item: string) => React.ReactNode;
}) {
  const Container = containerTag as React.ElementType;
  const ItemTag = itemTag as React.ElementType;
  if (!editable) {
    return (
      <Container className={className}>
        {items.map((item, index) => (
          <ItemTag key={`${item}-${index}`} className={itemClassName}>
            {renderItem ? renderItem(item) : item}
          </ItemTag>
        ))}
      </Container>
    );
  }
  const display = items.length ? items : [""];
  return (
    <Container
      key={items.join("")}
      className={cn("resume-editable", className)}
      contentEditable
      suppressContentEditableWarning
      spellCheck={spellCheck}
      onBlur={(event: FocusEvent<HTMLElement>) => {
        const next = Array.from(event.currentTarget.children)
          .map((child) => (child.textContent ?? "").trim())
          .filter(Boolean);
        onCommit(next);
      }}
    >
      {display.map((text, index) => (
        <ItemTag key={index} className={itemClassName}>
          {text}
        </ItemTag>
      ))}
    </Container>
  );
}

function printBreakStyle(targetId: string, printBreaks: ResumePreviewProps["printBreaks"]) {
  const spacer = printBreaks?.find((item) => item.targetId === targetId)?.spacer;
  return spacer ? { "--resume-print-break-space": `${spacer}px` } as CSSProperties : undefined;
}

function hasPrintBreak(targetId: string, printBreaks: ResumePreviewProps["printBreaks"]) {
  return Boolean(printBreaks?.some((item) => item.targetId === targetId));
}

function previewTargetProps(targetId: string, onTargetSelect?: (targetId: string) => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: () => onTargetSelect?.(targetId),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onTargetSelect?.(targetId);
    },
  };
}

export const ResumePreview = forwardRef<HTMLDivElement, ResumePreviewProps>(function ResumePreview(
  { state, pageCount = 1, pageGuides = [], printBreaks = [], activeTarget, onTargetSelect, editable, onEditField, onEditSectionTitle, onEditEntry, onEditTagGroup },
  ref,
) {
  const edit: InlineEditHandlers = { editable, onEditField, onEditSectionTitle, onEditEntry };
  const hasContent = hasAnyContent(state);
  const pageBreaks: Array<{ page: number; label?: string }> = pageGuides.length
    ? pageGuides
    : Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => ({ page: index + 2 }));

  // Screen-only gutter between stacked page sheets. The content itself is never
  // shifted (so the measurement/pagination model is untouched); each page is a
  // white frame painted behind the content, and the grey preview pane shows
  // through the gutter, so the preview reads as separate pages like the export.
  const pages = Math.max(1, pageCount);

  return (
    <div
      ref={ref}
      className={cn("resume-sheet", `resume-template-${state.template}`, !hasContent && "resume-empty")}
      style={{
        "--resume-scale": state.textScale,
        "--resume-font-family": resolveFontStack(state.theme.font),
        "--resume-accent": normalizeAccent(state.theme.accent),
        "--resume-page-count": pages,
      } as CSSProperties}
      data-heading={state.theme.headingStyle}
      data-header-align={state.theme.headerAlign}
      data-divider={state.theme.headerDivider ? "on" : "off"}
      data-density={state.theme.density}
      data-bullet={state.theme.bulletStyle}
    >
      {Array.from({ length: pages }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="resume-page-frame"
          data-first={index === 0 ? "" : undefined}
          data-last={index === pages - 1 ? "" : undefined}
          style={{ top: `${index * 11}in` }}
        />
      ))}
      {!hasContent ? <EmptyResumePreview /> : <FilledResumePreview state={state} printBreaks={printBreaks} activeTarget={activeTarget} onTargetSelect={onTargetSelect} onEditTagGroup={onEditTagGroup} {...edit} />}
      {pageBreaks.map(({ page, label }) => (
        <div
          key={page}
          aria-hidden="true"
          className="resume-page-guide"
          style={{ top: `${(page - 1) * 11}in` }}
        >
          <span>
            Page {page} begins{label ? ` · Next: ${label}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
});

function EmptyResumePreview() {
  return (
    <div aria-label="Empty resume preview">
      <p className="mb-2 font-sans text-[0.78em] font-bold uppercase tracking-[1px] text-[#666]">Clean one-page structure</p>
      <h1 className="resume-name">Your Name</h1>
      <div className="resume-contact">
        <span>email@example.com</span>
        <span>(555) 123-4567</span>
        <span>City, ST</span>
        <span>linkedin.com/in/you</span>
      </div>
      <div className="resume-empty-line resume-empty-line-wide" />
      <div className="resume-empty-line" />
      <section className="resume-section">
        <h2 className="resume-section-title">Experience</h2>
        <div className="resume-empty-role" />
        <ul className="resume-bullets">
          <li>Lead with measurable impact, scope, and outcomes.</li>
          <li>Keep bullets concise and scannable.</li>
        </ul>
      </section>
      <section className="resume-section">
        <h2 className="resume-section-title">Skills</h2>
        <div className="resume-empty-line resume-empty-line-short" />
      </section>
    </div>
  );
}

function FilledResumePreview({ state, printBreaks, activeTarget, onTargetSelect, editable, onEditField, onEditSectionTitle, onEditEntry, onEditTagGroup }: ResumePreviewProps) {
  const contactParts = [
    ["email", state.email],
    ["phone", state.phone],
    ["location", state.location],
    ["website", state.website],
  ] as const;
  const showContact = contactParts.some(([, value]) => Boolean(value));

  return (
    <>
      <InlineText
        as="h1"
        editable={editable}
        value={state.name || (editable ? "" : "Your Name")}
        placeholder="Your Name"
        onCommit={(value) => onEditField?.("name", value)}
        className={cn("resume-name resume-preview-target", activeTarget === "field-name" && "resume-preview-active")}
        {...(editable ? {} : previewTargetProps("field-name", onTargetSelect))}
      />
      {state.title ? (
        <InlineText
          as="div"
          editable={editable}
          value={state.title}
          placeholder="Title / role"
          onCommit={(value) => onEditField?.("title", value)}
          className={cn("resume-title resume-preview-target", activeTarget === "field-title" && "resume-preview-active")}
          {...(editable ? {} : previewTargetProps("field-title", onTargetSelect))}
        />
      ) : null}
      {showContact ? (
        <div className="resume-contact">
          {contactParts.map(([field, value]) => (
            <ContactPart
              key={field}
              field={field}
              value={value}
              active={activeTarget === `field-${field}`}
              onTargetSelect={onTargetSelect}
              editable={editable}
              onEditField={onEditField}
            />
          ))}
        </div>
      ) : null}
      {state.summary ? (
        <InlineText
          as="p"
          editable={editable}
          value={state.summary}
          placeholder="Professional summary"
          multiline
          onCommit={(value) => onEditField?.("summary", value)}
          data-resume-guide-label="Summary"
          className={cn("resume-lead resume-preview-target", activeTarget === "field-summary" && "resume-preview-active")}
          {...(editable ? {} : previewTargetProps("field-summary", onTargetSelect))}
        />
      ) : null}
      {visibleSectionOrder(state).map((section) => (
        <ResumeSection key={section} state={state} section={section} printBreaks={printBreaks} activeTarget={activeTarget} onTargetSelect={onTargetSelect} editable={editable} onEditField={onEditField} onEditSectionTitle={onEditSectionTitle} onEditEntry={onEditEntry} onEditTagGroup={onEditTagGroup} />
      ))}
    </>
  );
}

const CONTACT_PLACEHOLDERS = {
  email: "email@example.com",
  phone: "(555) 123-4567",
  location: "City, ST",
  website: "linkedin.com/in/you",
} as const;

function ContactPart({
  field,
  value,
  active,
  onTargetSelect,
  editable,
  onEditField,
}: {
  field: "email" | "phone" | "location" | "website";
  value: string;
  active: boolean;
  onTargetSelect?: (targetId: string) => void;
  editable?: boolean;
  onEditField?: (field: string, value: string) => void;
}) {
  if (!value) return null;

  const targetId = `field-${field}`;
  const className = cn("resume-preview-target", active && "resume-preview-active");
  const href = field === "location" ? undefined : contactHref(field, value);

  // While editing, an existing contact detail is a plain editable span (a link
  // would swallow the click). Adding a missing detail happens in the form.
  if (editable) {
    return (
      <InlineText
        as="span"
        editable
        value={value}
        placeholder={CONTACT_PLACEHOLDERS[field]}
        spellCheck={false}
        className={className}
        onCommit={(next) => onEditField?.(field, next)}
      />
    );
  }

  if (!href) {
    return <span className={className} {...previewTargetProps(targetId, onTargetSelect)}>{value}</span>;
  }

  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noreferrer"
      title={`Open ${field === "website" ? "website" : field} in a new tab`}
    >
      {value}
    </a>
  );
}

function ResumeSection({ state, section, printBreaks, activeTarget, onTargetSelect, editable, onEditField, onEditSectionTitle, onEditEntry, onEditTagGroup }: ResumePreviewProps & { section: string }) {
  const sectionActive =
    activeTarget === `section-title-${section}` ||
    activeTarget === `field-${section}` ||
    activeTarget?.startsWith(`field-${section}-`);
  const title = getSectionTitle(state, section).trim();
  const editableHeading = title && section !== "skills" ? (
    <InlineText
      as="h2"
      editable={editable}
      value={title}
      placeholder="Section heading"
      onCommit={(value) => onEditSectionTitle?.(section, value)}
      data-resume-guide-label={title}
      className={cn("resume-section-title resume-preview-target", activeTarget === `section-title-${section}` && "resume-preview-active")}
      {...(editable ? {} : previewTargetProps(`section-title-${section}`, onTargetSelect))}
    />
  ) : null;
  const sectionFormat = getSectionFormat(state, section);
  if (sectionFormat === "tag-groups") {
    const printBreakTarget = `section:${section}`;
    const groups = getSectionTagGroups(state, section).filter((group) => group.label || group.tags.length);
    if (!groups.length) return null;
    return (
      <section
        className={cn("resume-section resume-section-atomic", sectionActive && "resume-preview-section-active", hasPrintBreak(printBreakTarget, printBreaks) && "resume-print-break-before")}
        data-resume-guide-label={title || "Tag groups"}
        data-resume-print-section={section}
        style={printBreakStyle(printBreakTarget, printBreaks)}
      >
        {title ? (
          <InlineText
            as="h2"
            editable={editable}
            value={title}
            placeholder="Skills"
            onCommit={(value) => onEditSectionTitle?.(section, value)}
            className={cn("resume-section-title resume-preview-target", activeTarget === `section-title-${section}` && "resume-preview-active")}
            {...(editable ? {} : previewTargetProps(`section-title-${section}`, onTargetSelect))}
          />
        ) : null}
        <div>
          {groups.map((group) => {
            const targetId = `field-${section}-group-${group.id}`;
            return (
              <div
                key={group.id}
                data-preview-tag-group={group.id}
                className={cn("resume-skill-line resume-preview-target", activeTarget === targetId && "resume-preview-active")}
                aria-label={`Edit ${group.label.trim() || "untitled"} group in ${title || "section"}`}
                {...(editable ? {} : previewTargetProps(targetId, onTargetSelect))}
              >
                {editable ? (
                  <>
                    <InlineText
                      editable
                      value={group.label}
                      placeholder="Category"
                      onCommit={(label) => onEditTagGroup?.(section, group.id, { label, tags: group.tags })}
                      className="resume-skill-cat"
                      data-preview-tag-group-label=""
                    />
                    {group.label ? <span className="resume-skill-cat">:</span> : null}{" "}
                    <InlineText
                      editable
                      value={group.tags.join(" · ")}
                      placeholder="Add skills"
                      onCommit={(value) => onEditTagGroup?.(section, group.id, {
                        label: group.label,
                        tags: value.split(/[·,]/).map((tag) => tag.trim()).filter(Boolean),
                      })}
                      data-preview-tag-group-tags=""
                    />
                  </>
                ) : (
                  <>{group.label ? <span className="resume-skill-cat">{group.label}:</span> : null} {group.tags.join(" · ")}</>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  if (sectionFormat === "bullets" || sectionFormat === "paragraphs" || sectionFormat === "labeled-rows") {
    const printBreakTarget = `section:${section}`;
    const text = getSectionText(state, section).trim();
    if (!text) return null;
    const targetId = `field-${section}-content`;
    return (
      <section
        className={cn("resume-section resume-preview-target", sectionActive && "resume-preview-active", hasPrintBreak(printBreakTarget, printBreaks) && "resume-print-break-before")}
        data-resume-print-section={section}
        data-resume-section-has-heading={title ? "true" : "false"}
        style={printBreakStyle(printBreakTarget, printBreaks)}
        {...(editable ? {} : previewTargetProps(targetId, onTargetSelect))}
      >
        {editableHeading}
        {sectionFormat === "bullets" ? (
          <ul className="resume-bullets">
            {bulletsFrom(text).map((line, index) => <li key={`${section}-${index}`}>{line}</li>)}
          </ul>
        ) : (
          <div className="grid gap-1.5 text-[0.9em] leading-relaxed">
            {text.split(sectionFormat === "paragraphs" ? /\n\s*\n/ : "\n").map((line, index) => line.trim() ? <p key={`${section}-${index}`}>{line.trim()}</p> : null)}
          </div>
        )}
      </section>
    );
  }

  const entries = getSectionEntries(state, section)
    .map((entry, originalIndex) => ({ entry, originalIndex }))
    .filter(({ entry }) => entryHasContent(entry));
  if (!entries.length) return null;

  const printBreakTarget = `section:${section}`;

  return (
    <section
      className={cn("resume-section", sectionActive && "resume-preview-section-active", hasPrintBreak(printBreakTarget, printBreaks) && "resume-print-break-before")}
      data-resume-print-section={section}
      data-resume-section-has-heading={title ? "true" : "false"}
      style={printBreakStyle(printBreakTarget, printBreaks)}
    >
      {editableHeading}
      {entries.map(({ entry, originalIndex }) => (
        <div
          className={cn("resume-entry resume-preview-target", activeTarget?.startsWith(`field-${section}-${originalIndex}-`) && "resume-preview-active", hasPrintBreak(`entry:${section}:${originalIndex}`, printBreaks) && "resume-print-break-before")}
          key={`${section}-${originalIndex}`}
          data-resume-entry-section={section}
          data-resume-entry-index={originalIndex}
          data-resume-print-entry={`${section}:${originalIndex}`}
          data-resume-guide-label={[title, entry.title || entry.subtitle || `Entry ${originalIndex + 1}`].filter(Boolean).join(" · ")}
          style={printBreakStyle(`entry:${section}:${originalIndex}`, printBreaks)}
          {...(editable ? {} : previewTargetProps(`field-${section}-${originalIndex}-title`, onTargetSelect))}
        >
          <div className="resume-entry-head">
            <div>
              {entry.title ? (
                <InlineText
                  as="span"
                  editable={editable}
                  value={entry.title}
                  placeholder="Role / title"
                  className="resume-entry-role"
                  onCommit={(value) => onEditEntry?.(section, originalIndex, "title", value)}
                />
              ) : null}
            </div>
            {entry.meta ? (
              <InlineText
                as="div"
                editable={editable}
                value={entry.meta}
                placeholder="Dates / details"
                className="resume-entry-meta"
                onCommit={(value) => onEditEntry?.(section, originalIndex, "meta", value)}
              />
            ) : null}
          </div>
          {entry.subtitle ? (
            <InlineText
              as="div"
              editable={editable}
              value={entry.subtitle}
              placeholder="Organization / context"
              className="resume-entry-sub"
              onCommit={(value) => onEditEntry?.(section, originalIndex, "subtitle", value)}
            />
          ) : null}
          {(() => {
            const bullets = bulletsFrom(entry.details);
            if (!bullets.length) return null;
            return (
              <EditableList
                editable={editable}
                items={bullets}
                className="resume-bullets"
                onCommit={(items) => onEditEntry?.(section, originalIndex, "details", items.join("\n"))}
              />
            );
          })()}
        </div>
      ))}
    </section>
  );
}
