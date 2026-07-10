import { forwardRef, type CSSProperties } from "react";
import {
  bulletsFrom,
  hasAnyContent,
  SECTION_LABELS,
  type ResumeState,
  type SectionKey,
} from "@/lib/resume";
import { cn } from "@/lib/utils";

export const ResumePreview = forwardRef<HTMLDivElement, { state: ResumeState }>(function ResumePreview({ state }, ref) {
  const hasContent = hasAnyContent(state);

  return (
    <div
      ref={ref}
      className={cn("resume-sheet", !hasContent && "resume-empty")}
      style={{ "--resume-scale": state.textScale } as CSSProperties}
    >
      {!hasContent ? <EmptyResumePreview /> : <FilledResumePreview state={state} />}
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

function FilledResumePreview({ state }: { state: ResumeState }) {
  const contactParts = [state.email, state.phone, state.location, state.website].filter(Boolean);

  return (
    <>
      <h1 className="resume-name">{state.name || "Your Name"}</h1>
      {state.title ? <div className="resume-title">{state.title}</div> : null}
      {contactParts.length ? (
        <div className="resume-contact">
          {contactParts.map((part) => (
            <span key={part}>{part}</span>
          ))}
        </div>
      ) : null}
      {state.summary ? <p className="resume-lead">{state.summary}</p> : null}
      {state.sectionOrder.map((section) => (
        <ResumeSection key={section} state={state} section={section} />
      ))}
    </>
  );
}

function ResumeSection({ state, section }: { state: ResumeState; section: SectionKey }) {
  if (section === "skills") {
    const lines = state.skills
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return null;
    return (
      <section className="resume-section">
        <h2 className="resume-section-title">Skills</h2>
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

  const entries = state[section].filter((entry) => entry.title || entry.subtitle || entry.meta || entry.details);
  if (!entries.length) return null;

  return (
    <section className="resume-section">
      <h2 className="resume-section-title">{SECTION_LABELS[section]}</h2>
      {entries.map((entry, index) => (
        <div className="resume-entry" key={`${entry.title}-${entry.subtitle}-${index}`}>
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
