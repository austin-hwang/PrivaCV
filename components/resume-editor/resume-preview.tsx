import { forwardRef, type CSSProperties, type KeyboardEvent } from "react";
import {
  bulletsFrom,
  entryHasContent,
  getSectionEntries,
  getSectionTitle,
  hasAnyContent,
  type ResumeState,
} from "@/lib/resume";
import { cn } from "@/lib/utils";

type ResumePreviewProps = {
  state: ResumeState;
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
  { state, activeTarget, onTargetSelect },
  ref,
) {
  const hasContent = hasAnyContent(state);

  return (
    <div
      ref={ref}
      className={cn("resume-sheet", !hasContent && "resume-empty")}
      style={{ "--resume-scale": state.textScale } as CSSProperties}
    >
      {!hasContent ? <EmptyResumePreview /> : <FilledResumePreview state={state} activeTarget={activeTarget} onTargetSelect={onTargetSelect} />}
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
  ].filter(([, value]) => Boolean(value));

  return (
    <>
      <h1 className={cn("resume-name resume-preview-target", activeTarget === "field-name" && "resume-preview-active")} {...previewTargetProps("field-name", onTargetSelect)}>{state.name || "Your Name"}</h1>
      {state.title ? <div className={cn("resume-title resume-preview-target", activeTarget === "field-title" && "resume-preview-active")} {...previewTargetProps("field-title", onTargetSelect)}>{state.title}</div> : null}
      {contactParts.length ? (
        <div className="resume-contact">
          {contactParts.map(([field, value]) => (
            <span
              className={cn("resume-preview-target", activeTarget === `field-${field}` && "resume-preview-active")}
              key={field}
              {...previewTargetProps(`field-${field}`, onTargetSelect)}
            >{value}</span>
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

function ResumeSection({ state, section, activeTarget, onTargetSelect }: ResumePreviewProps & { section: string }) {
  const sectionActive = activeTarget === `section-title-${section}` || activeTarget?.startsWith(`field-${section}-`);
  if (section === "skills") {
    const lines = state.skills
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return null;
    return (
      <section className={cn("resume-section resume-preview-target", sectionActive && "resume-preview-active")} {...previewTargetProps("field-skills", onTargetSelect)}>
        <h2 className="resume-section-title">{getSectionTitle(state, section)}</h2>
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
      <h2 className={cn("resume-section-title resume-preview-target", activeTarget === `section-title-${section}` && "resume-preview-active")} {...previewTargetProps(`section-title-${section}`, onTargetSelect)}>{getSectionTitle(state, section)}</h2>
      {entries.map(({ entry, originalIndex }) => (
        <div
          className={cn("resume-entry resume-preview-target", activeTarget?.startsWith(`field-${section}-${originalIndex}-`) && "resume-preview-active")}
          key={`${entry.title}-${entry.subtitle}-${originalIndex}`}
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
