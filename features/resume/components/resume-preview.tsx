import {
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { Button as ButtonPrimitive } from "react-aria-components";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import {
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  CircleDotDashed,
  Component,
  ContactRound,
  GitBranch,
  GitFork,
  Globe2,
  Link as LinkIcon,
  Mail,
  MapPin,
  MessageCircle,
  NotebookPen,
  Phone,
  SquareCode,
  Video,
} from "lucide-react";
import {
  contactHref,
  entryHasContent,
  entryOrgLine,
  formatEntryDates,
  getSectionEntries,
  getSectionFormat,
  getSectionTagGroups,
  getSectionText,
  getSectionTitle,
  hasAnyContent,
  normalizeAccent,
  resolveHeaderLinkIcon,
  resumeHeaderLinks,
  visibleSectionOrder,
  resolveFontStack,
  type ResumeEntry,
  type ResumeState,
  type HeaderLink,
  type HeaderLinkIconId,
  type TagGroup,
} from "@/lib/resume";
import { DateRangeField } from "@/features/resume/components/editor-fields";
import { commitRichContent, renderRichContent, stripRichMarks } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

type InlineEditHandlers = {
  /** When true, resume text is edited in place on the sheet. */
  editable?: boolean;
  onEditField?: (field: string, value: string) => void;
  onEditHeaderLink?: (
    id: string,
    patch: Partial<Pick<HeaderLink, "label" | "url" | "icon">>,
  ) => void;
  onEditSectionTitle?: (section: string, value: string) => void;
  onEditEntry?: (
    section: string,
    index: number,
    key:
      | "title"
      | "subtitle"
      | "meta"
      | "details"
      | "startDate"
      | "endDate"
      | "current"
      | "dateText",
    value: string | boolean,
  ) => void;
  onEditTagGroup?: (
    section: string,
    groupId: string,
    patch: Pick<TagGroup, "label" | "tags">,
  ) => void;
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
      onBlur={(event: FocusEvent<HTMLElement>) =>
        onCommit((event.currentTarget.textContent ?? "").trim())
      }
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
 * Renders a rich "body" field (summary, entry details, free-text section body)
 * on the sheet as canonical block HTML — so a field can mix bulleted, numbered,
 * and plain-paragraph lines. Read-only mode paints the HTML; editable mode is a
 * content-editable region that commits canonical block HTML on blur (native
 * Cmd/Ctrl+B/I/U and Enter/list behavior keep working; the full toolbar lives in
 * the form pane). Uncontrolled while focused and content-keyed so the caret is
 * never fought. `legacyFormat` interprets old newline-based values.
 */
function RichBody({
  editable,
  value,
  legacyFormat,
  onCommit,
  spellCheck = true,
  className,
  guideLabel,
  readOnlyProps,
}: {
  editable?: boolean;
  value: string;
  legacyFormat?: string;
  onCommit?: (value: string) => void;
  spellCheck?: boolean;
  className?: string;
  guideLabel?: string;
  readOnlyProps?: Record<string, unknown>;
}) {
  const html = renderRichContent(value, legacyFormat);
  const guideProps = guideLabel ? { "data-resume-guide-label": guideLabel } : {};
  const editableRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = editableRef.current;
    if (!editable || !element || document.activeElement === element) return;

    const nextHtml = html || "<p><br></p>";
    if (element.innerHTML !== nextHtml) element.innerHTML = nextHtml;
  }, [editable, html, value]);

  if (!editable) {
    if (!html) return null;
    return (
      <div
        className={cn("resume-rich", className)}
        {...guideProps}
        {...readOnlyProps}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div
      key={value}
      ref={editableRef}
      className={cn("resume-rich resume-editable", className)}
      contentEditable
      suppressContentEditableWarning
      spellCheck={spellCheck}
      {...guideProps}
      onBlur={(event: FocusEvent<HTMLElement>) =>
        onCommit?.(commitRichContent(event.currentTarget))
      }
    />
  );
}

type EntryDateChange = (
  key: "startDate" | "endDate" | "current" | "dateText",
  value: string | boolean,
) => void;

/**
 * The inline (editable) date slot on the sheet: a button showing the formatted
 * dates that opens a popover hosting the shared DateRangeField, so dates are
 * edited in place, consistent with the form. Read-only sheets render the dates
 * as plain text via entryMetaLine instead.
 */
function EntryDateControl({
  idPrefix,
  entry,
  onChange,
}: {
  idPrefix: string;
  entry: ResumeEntry;
  onChange: EntryDateChange;
}) {
  const [open, setOpen] = useState(false);
  const label = formatEntryDates(entry);

  return (
    <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
      <ButtonPrimitive
        aria-label="Edit dates"
        className={cn(
          "resume-entry-date-control resume-entry-date-trigger",
          !label && "resume-entry-date-trigger-empty",
        )}
      >
        {label || "Add dates"}
      </ButtonPrimitive>
      <Popover className="w-72 p-3" placement="bottom end" aria-label="Edit dates">
        <DateRangeField idPrefix={idPrefix} entry={entry} onChange={onChange} />
      </Popover>
    </PopoverTrigger>
  );
}

function printBreakStyle(targetId: string, printBreaks: ResumePreviewProps["printBreaks"]) {
  const spacer = printBreaks?.find((item) => item.targetId === targetId)?.spacer;
  return spacer ? ({ "--resume-print-break-space": `${spacer}px` } as CSSProperties) : undefined;
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
  {
    state,
    pageCount = 1,
    pageGuides = [],
    printBreaks = [],
    activeTarget,
    onTargetSelect,
    editable,
    onEditField,
    onEditHeaderLink,
    onEditSectionTitle,
    onEditEntry,
    onEditTagGroup,
  },
  ref,
) {
  const edit: InlineEditHandlers = {
    editable,
    onEditField,
    onEditHeaderLink,
    onEditSectionTitle,
    onEditEntry,
  };
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
      className={cn(
        "resume-sheet",
        `resume-template-${state.template}`,
        !hasContent && "resume-empty",
      )}
      style={
        {
          "--resume-scale": state.textScale,
          "--resume-font-family": resolveFontStack(state.theme.font),
          "--resume-accent": normalizeAccent(state.theme.accent),
          "--resume-page-count": pages,
        } as CSSProperties
      }
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
      {!hasContent ? (
        <EmptyResumePreview />
      ) : (
        <FilledResumePreview
          state={state}
          printBreaks={printBreaks}
          activeTarget={activeTarget}
          onTargetSelect={onTargetSelect}
          onEditTagGroup={onEditTagGroup}
          {...edit}
        />
      )}
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
      <p className="mb-2 font-sans text-[0.78em] font-bold uppercase tracking-[1px] text-[#666]">
        Clean one-page structure
      </p>
      <p className="resume-name" aria-hidden="true">
        Your Name
      </p>
      <div className="resume-contact">
        <span className="resume-contact-item">
          <Mail aria-hidden="true" />
          email@example.com
        </span>
        <span className="resume-contact-item">
          <Phone aria-hidden="true" />
          (555) 123-4567
        </span>
        <span className="resume-contact-item">
          <MapPin aria-hidden="true" />
          City, ST
        </span>
        <span className="resume-contact-item">
          <BriefcaseBusiness aria-hidden="true" />
          linkedin.com/in/you
        </span>
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

function FilledResumePreview({
  state,
  printBreaks,
  activeTarget,
  onTargetSelect,
  editable,
  onEditField,
  onEditHeaderLink,
  onEditSectionTitle,
  onEditEntry,
  onEditTagGroup,
}: ResumePreviewProps) {
  const contactParts = [
    ["email", state.email],
    ["phone", state.phone],
    ["location", state.location],
  ] as const;
  const headerLinks = resumeHeaderLinks(state).filter((link) => Boolean(link.url));
  const showContact = contactParts.some(([, value]) => Boolean(value)) || headerLinks.length > 0;

  return (
    <>
      <InlineText
        as="h1"
        editable={editable}
        value={state.name || (editable ? "" : "Your Name")}
        placeholder="Your Name"
        onCommit={(value) => onEditField?.("name", value)}
        className={cn(
          "resume-name resume-preview-target",
          activeTarget === "field-name" && "resume-preview-active",
        )}
        {...(editable ? {} : previewTargetProps("field-name", onTargetSelect))}
      />
      {state.title ? (
        <InlineText
          as="div"
          editable={editable}
          value={state.title}
          placeholder="Title / role"
          onCommit={(value) => onEditField?.("title", value)}
          className={cn(
            "resume-title resume-preview-target",
            activeTarget === "field-title" && "resume-preview-active",
          )}
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
          {headerLinks.map((link) => (
            <HeaderLinkPart
              key={link.id}
              link={link}
              active={activeTarget === `field-header-link-${link.id}-url`}
              onTargetSelect={onTargetSelect}
              editable={editable}
              onEditHeaderLink={onEditHeaderLink}
            />
          ))}
        </div>
      ) : null}
      {stripRichMarks(state.summary).trim() ? (
        <RichBody
          editable={editable}
          value={state.summary}
          legacyFormat="paragraph"
          onCommit={(value) => onEditField?.("summary", value)}
          guideLabel="Summary"
          className={cn(
            "resume-lead",
            "resume-preview-target",
            activeTarget === "field-summary" && "resume-preview-active",
          )}
          readOnlyProps={previewTargetProps("field-summary", onTargetSelect)}
        />
      ) : null}
      {visibleSectionOrder(state).map((section) => (
        <ResumeSection
          key={section}
          state={state}
          section={section}
          printBreaks={printBreaks}
          activeTarget={activeTarget}
          onTargetSelect={onTargetSelect}
          editable={editable}
          onEditField={onEditField}
          onEditSectionTitle={onEditSectionTitle}
          onEditEntry={onEditEntry}
          onEditTagGroup={onEditTagGroup}
        />
      ))}
    </>
  );
}

const CONTACT_PLACEHOLDERS = {
  email: "email@example.com",
  phone: "(555) 123-4567",
  location: "City, ST",
} as const;

function ContactIcon({ field }: { field: "email" | "phone" | "location" }) {
  const Icon = field === "email" ? Mail : field === "phone" ? Phone : MapPin;
  return <Icon aria-hidden="true" className="resume-contact-icon" />;
}

const HEADER_LINK_ICONS: Record<Exclude<HeaderLinkIconId, "none">, typeof Globe2> = {
  website: Globe2,
  linkedin: ContactRound,
  github: GitBranch,
  gitlab: GitFork,
  twitter: MessageCircle,
  instagram: Camera,
  youtube: Video,
  dribbble: CircleDotDashed,
  figma: Component,
  portfolio: BriefcaseBusiness,
  blog: NotebookPen,
  calendar: CalendarDays,
  code: SquareCode,
  link: LinkIcon,
};

function HeaderLinkIcon({ link }: { link: Pick<HeaderLink, "icon" | "label" | "url"> }) {
  const icon = resolveHeaderLinkIcon(link);
  if (icon === "none") return null;
  const Icon = HEADER_LINK_ICONS[icon] ?? Globe2;
  return <Icon aria-hidden="true" className={cn("resume-contact-icon", `lucide-${icon}`)} />;
}

function ContactPart({
  field,
  value,
  active,
  onTargetSelect,
  editable,
  onEditField,
}: {
  field: "email" | "phone" | "location";
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
      <span className="resume-contact-item">
        <ContactIcon field={field} />
        <InlineText
          as="span"
          editable
          value={value}
          placeholder={CONTACT_PLACEHOLDERS[field]}
          spellCheck={false}
          className={className}
          onCommit={(next) => onEditField?.(field, next)}
        />
      </span>
    );
  }

  if (!href) {
    return (
      <span
        className={cn("resume-contact-item", className)}
        {...previewTargetProps(targetId, onTargetSelect)}
      >
        <ContactIcon field={field} />
        {value}
      </span>
    );
  }

  return (
    <a
      className={cn("resume-contact-item", className)}
      href={href}
      target="_blank"
      rel="noreferrer"
      title={`Open ${field} in a new tab`}
    >
      <ContactIcon field={field} />
      {value}
    </a>
  );
}

function HeaderLinkPart({
  link,
  active,
  onTargetSelect,
  editable,
  onEditHeaderLink,
}: {
  link: HeaderLink;
  active: boolean;
  onTargetSelect?: (targetId: string) => void;
  editable?: boolean;
  onEditHeaderLink?: InlineEditHandlers["onEditHeaderLink"];
}) {
  const targetId = `field-header-link-${link.id}-url`;
  const className = cn("resume-preview-target", active && "resume-preview-active");
  const href = contactHref("website", link.url);

  if (editable) {
    return (
      <span className="resume-contact-item">
        <HeaderLinkIcon link={link} />
        <InlineText
          as="span"
          editable
          value={link.url}
          placeholder="your-site.com"
          spellCheck={false}
          className={className}
          onCommit={(url) => onEditHeaderLink?.(link.id, { url })}
        />
      </span>
    );
  }

  if (!href) {
    return (
      <span
        className={cn("resume-contact-item", className)}
        {...previewTargetProps(targetId, onTargetSelect)}
      >
        <HeaderLinkIcon link={link} />
        {link.url}
      </span>
    );
  }

  return (
    <a
      className={cn("resume-contact-item", className)}
      href={href}
      target="_blank"
      rel="noreferrer"
      title={`Open ${link.label || "website"} in a new tab`}
    >
      <HeaderLinkIcon link={link} />
      {link.url}
    </a>
  );
}

function ResumeSection({
  state,
  section,
  printBreaks,
  activeTarget,
  onTargetSelect,
  editable,
  onEditField,
  onEditSectionTitle,
  onEditEntry,
  onEditTagGroup,
}: ResumePreviewProps & { section: string }) {
  const sectionActive =
    activeTarget === `section-title-${section}` ||
    activeTarget === `field-${section}` ||
    activeTarget?.startsWith(`field-${section}-`);
  const title = getSectionTitle(state, section).trim();
  const editableHeading = title ? (
    <InlineText
      as="h2"
      editable={editable}
      value={title}
      placeholder="Section heading"
      onCommit={(value) => onEditSectionTitle?.(section, value)}
      data-resume-guide-label={title}
      className={cn(
        "resume-section-title resume-preview-target",
        activeTarget === `section-title-${section}` && "resume-preview-active",
      )}
      {...(editable ? {} : previewTargetProps(`section-title-${section}`, onTargetSelect))}
    />
  ) : null;
  const sectionFormat = getSectionFormat(state, section);
  if (sectionFormat === "tag-groups") {
    const printBreakTarget = `section:${section}`;
    const groups = getSectionTagGroups(state, section).filter(
      (group) => group.label || group.tags.length,
    );
    if (!groups.length) return null;
    return (
      <section
        className={cn(
          "resume-section resume-section-atomic",
          sectionActive && "resume-preview-section-active",
          hasPrintBreak(printBreakTarget, printBreaks) && "resume-print-break-before",
        )}
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
            className={cn(
              "resume-section-title resume-preview-target",
              activeTarget === `section-title-${section}` && "resume-preview-active",
            )}
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
                className={cn(
                  "resume-skill-line resume-preview-target",
                  activeTarget === targetId && "resume-preview-active",
                )}
                aria-label={`Edit ${group.label.trim() || "untitled"} group in ${title || "section"}`}
                {...(editable ? {} : previewTargetProps(targetId, onTargetSelect))}
              >
                {editable ? (
                  <>
                    <InlineText
                      editable
                      value={group.label}
                      placeholder="Category"
                      onCommit={(label) =>
                        onEditTagGroup?.(section, group.id, { label, tags: group.tags })
                      }
                      className="resume-skill-cat"
                      data-preview-tag-group-label=""
                    />
                    {group.label ? <span className="resume-skill-cat">:</span> : null}{" "}
                    <InlineText
                      editable
                      value={group.tags.join(" · ")}
                      placeholder="Add skills"
                      onCommit={(value) =>
                        onEditTagGroup?.(section, group.id, {
                          label: group.label,
                          tags: value
                            .split(/[·,]/)
                            .map((tag) => tag.trim())
                            .filter(Boolean),
                        })
                      }
                      data-preview-tag-group-tags=""
                    />
                  </>
                ) : (
                  <>
                    {group.label ? <span className="resume-skill-cat">{group.label}:</span> : null}{" "}
                    {group.tags.join(" · ")}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  if (sectionFormat === "text") {
    const printBreakTarget = `section:${section}`;
    const text = getSectionText(state, section).trim();
    if (!text) return null;
    const targetId = `field-${section}-content`;
    return (
      <section
        className={cn(
          "resume-section resume-preview-target",
          sectionActive && "resume-preview-active",
          hasPrintBreak(printBreakTarget, printBreaks) && "resume-print-break-before",
        )}
        data-resume-print-section={section}
        data-resume-section-has-heading={title ? "true" : "false"}
        style={printBreakStyle(printBreakTarget, printBreaks)}
        {...(editable ? {} : previewTargetProps(targetId, onTargetSelect))}
      >
        {editableHeading}
        <RichBody value={text} legacyFormat="bullets" className="resume-section-body" />
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
      className={cn(
        "resume-section",
        sectionActive && "resume-preview-section-active",
        hasPrintBreak(printBreakTarget, printBreaks) && "resume-print-break-before",
      )}
      data-resume-print-section={section}
      data-resume-section-has-heading={title ? "true" : "false"}
      style={printBreakStyle(printBreakTarget, printBreaks)}
    >
      {editableHeading}
      {entries.map(({ entry, originalIndex }) => (
        <div
          className={cn(
            "resume-entry resume-preview-target",
            activeTarget?.startsWith(`field-${section}-${originalIndex}-`) &&
              "resume-preview-active",
            hasPrintBreak(`entry:${section}:${originalIndex}`, printBreaks) &&
              "resume-print-break-before",
          )}
          key={`${section}-${originalIndex}`}
          data-resume-entry-section={section}
          data-resume-entry-index={originalIndex}
          data-resume-print-entry={`${section}:${originalIndex}`}
          data-resume-guide-label={[
            title,
            entry.title || entry.subtitle || `Entry ${originalIndex + 1}`,
          ]
            .filter(Boolean)
            .join(" · ")}
          style={printBreakStyle(`entry:${section}:${originalIndex}`, printBreaks)}
          {...(editable
            ? {}
            : previewTargetProps(`field-${section}-${originalIndex}-title`, onTargetSelect))}
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
            {editable ? (
              <div className="resume-entry-meta">
                <EntryDateControl
                  idPrefix={`field-${section}-${originalIndex}`}
                  entry={entry}
                  onChange={(key, value) => onEditEntry?.(section, originalIndex, key, value)}
                />
              </div>
            ) : formatEntryDates(entry) ? (
              <div className="resume-entry-meta">{formatEntryDates(entry)}</div>
            ) : null}
          </div>
          {editable ? (
            entry.subtitle || entry.meta.trim() ? (
              <div className="resume-entry-sub">
                {entry.subtitle ? (
                  <InlineText
                    as="span"
                    editable
                    value={entry.subtitle}
                    placeholder="Organization / context"
                    onCommit={(value) => onEditEntry?.(section, originalIndex, "subtitle", value)}
                  />
                ) : null}
                {/* The location/link sits on the org line next to the company,
                    separated by a dot. Only shown when it already has content —
                    it is added and cleared from the editor form. */}
                {entry.meta.trim() ? (
                  <>
                    {entry.subtitle ? <span className="resume-entry-sub-sep"> · </span> : null}
                    <InlineText
                      as="span"
                      editable
                      value={entry.meta}
                      placeholder="Location / link"
                      onCommit={(value) => onEditEntry?.(section, originalIndex, "meta", value)}
                    />
                  </>
                ) : null}
              </div>
            ) : null
          ) : entryOrgLine(entry) ? (
            <div className="resume-entry-sub">{entryOrgLine(entry)}</div>
          ) : null}
          {stripRichMarks(entry.details).trim() ? (
            <RichBody
              editable={editable}
              value={entry.details}
              legacyFormat="bullets"
              className="resume-entry-body"
              onCommit={(value) => onEditEntry?.(section, originalIndex, "details", value)}
            />
          ) : null}
        </div>
      ))}
    </section>
  );
}
