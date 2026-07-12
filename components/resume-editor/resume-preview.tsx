import { forwardRef, type CSSProperties, type KeyboardEvent } from "react";
import {
  bulletsFrom,
  contactHref,
  entryHasContent,
  getSectionEntries,
  getSectionTitle,
  hasAnyContent,
  normalizeAccent,
  resolveFontStack,
  type ResumeState,
} from "@/lib/resume";
import { cn } from "@/lib/utils";

type ResumePreviewProps = {
  state: ResumeState;
  pageCount?: number;
  activeTarget?: string | null;
  onTargetSelect?: (targetId: string) => void;
};

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
  { state, pageCount = 1, activeTarget, onTargetSelect },
  ref,
) {
  const hasContent = hasAnyContent(state);
  const pageBreaks = Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => index + 2);

  return (
    <div
      ref={ref}
      className={cn("resume-sheet", `resume-template-${state.template}`, !hasContent && "resume-empty")}
      style={{
        "--resume-scale": state.textScale,
        "--resume-font-family": resolveFontStack(state.theme.font),
        "--resume-accent": normalizeAccent(state.theme.accent),
      } as CSSProperties}
      data-heading={state.theme.headingStyle}
      data-header-align={state.theme.headerAlign}
      data-divider={state.theme.headerDivider ? "on" : "off"}
      data-density={state.theme.density}
    >
      {!hasContent ? <EmptyResumePreview /> : <FilledResumePreview state={state} activeTarget={activeTarget} onTargetSelect={onTargetSelect} />}
      {pageBreaks.map((page) => (
        <div
          key={page}
          aria-hidden="true"
          className="resume-page-guide"
          style={{ top: `${(page - 1) * 11}in` }}
        >
          <span>Page {page} begins</span>
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
          <li>Keep each bullet concise enough to scan quickly.</li>
        </ul>
      </section>
      <section className="resume-section">
        <h2 className="resume-section-title">Skills</h2>
        <div className="resume-empty-line resume-empty-line-short" />
      </section>
    </div>
  );
}

function FilledResumePreview({ state, activeTarget, onTargetSelect }: ResumePreviewProps) {
  const contactParts = [
    ["email", state.email],
    ["phone", state.phone],
    ["location", state.location],
    ["website", state.website],
  ] as const;

  return (
    <>
      <h1 className={cn("resume-name resume-preview-target", activeTarget === "field-name" && "resume-preview-active")} {...previewTargetProps("field-name", onTargetSelect)}>{state.name || "Your Name"}</h1>
      {state.title ? <div className={cn("resume-title resume-preview-target", activeTarget === "field-title" && "resume-preview-active")} {...previewTargetProps("field-title", onTargetSelect)}>{state.title}</div> : null}
      {contactParts.some(([, value]) => Boolean(value)) ? (
        <div className="resume-contact">
          {contactParts.map(([field, value]) => (
            <ContactPart
              key={field}
              field={field}
              value={value}
              active={activeTarget === `field-${field}`}
              onTargetSelect={onTargetSelect}
            />
          ))}
        </div>
      ) : null}
      {state.summary ? <p className={cn("resume-lead resume-preview-target", activeTarget === "field-summary" && "resume-preview-active")} {...previewTargetProps("field-summary", onTargetSelect)}>{state.summary}</p> : null}
      {state.sectionOrder.map((section) => (
        <ResumeSection key={section} state={state} section={section} activeTarget={activeTarget} onTargetSelect={onTargetSelect} />
      ))}
    </>
  );
}

function ContactPart({
  field,
  value,
  active,
  onTargetSelect,
}: {
  field: "email" | "phone" | "location" | "website";
  value: string;
  active: boolean;
  onTargetSelect?: (targetId: string) => void;
}) {
  if (!value) return null;

  const targetId = `field-${field}`;
  const className = cn("resume-preview-target", active && "resume-preview-active");
  const href = field === "location" ? undefined : contactHref(field, value);

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

function ResumeSection({ state, section, activeTarget, onTargetSelect }: ResumePreviewProps & { section: string }) {
  const sectionActive =
    activeTarget === `section-title-${section}` ||
    activeTarget === `field-${section}` ||
    activeTarget?.startsWith(`field-${section}-`);
  const title = getSectionTitle(state, section).trim();
  if (section === "skills") {
    const lines = state.skills
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return null;
    return (
      <section className={cn("resume-section resume-preview-target", sectionActive && "resume-preview-active")} {...previewTargetProps("field-skills", onTargetSelect)}>
        {title ? <h2 className="resume-section-title">{title}</h2> : null}
        <div>
          {lines.map((line) => {
            const index = line.indexOf(":");
            return (
              <div className="resume-skill-line" key={line}>
                {index > -1 ? (
                  <>
                    <span className="resume-skill-cat">{line.slice(0, index).trim()}:</span> {line.slice(index + 1).trim()}
                  </>
                ) : (
                  line
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  const entries = getSectionEntries(state, section)
    .map((entry, originalIndex) => ({ entry, originalIndex }))
    .filter(({ entry }) => entryHasContent(entry));
  if (!entries.length) return null;

  return (
    <section className={cn("resume-section", sectionActive && "resume-preview-section-active")}>
      {title ? (
        <h2 className={cn("resume-section-title resume-preview-target", activeTarget === `section-title-${section}` && "resume-preview-active")} {...previewTargetProps(`section-title-${section}`, onTargetSelect)}>{title}</h2>
      ) : null}
      {entries.map(({ entry, originalIndex }) => (
        <div
          className={cn("resume-entry resume-preview-target", activeTarget?.startsWith(`field-${section}-${originalIndex}-`) && "resume-preview-active")}
          key={`${entry.title}-${entry.subtitle}-${originalIndex}`}
          data-resume-entry-section={section}
          data-resume-entry-index={originalIndex}
          {...previewTargetProps(`field-${section}-${originalIndex}-title`, onTargetSelect)}
        >
          <div className="resume-entry-head">
            <div>{entry.title ? <span className="resume-entry-role">{entry.title}</span> : null}</div>
            {entry.meta ? <div className="resume-entry-meta">{entry.meta}</div> : null}
          </div>
          {entry.subtitle ? <div className="resume-entry-sub">{entry.subtitle}</div> : null}
          {bulletsFrom(entry.details).length ? (
            <ul className="resume-bullets">
              {bulletsFrom(entry.details).map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </section>
  );
}
