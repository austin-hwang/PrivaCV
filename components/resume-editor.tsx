"use client";

import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ClipboardCopy,
  Download,
  FileJson,
  FileText,
  Printer,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { importResumePdf } from "@/lib/pdf-import";
import {
  blankEntry,
  buildResumeChecks,
  bulletsFrom,
  clampTextScale,
  emptyState,
  hasAnyContent,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  normalizeResume,
  plainTextStats,
  resumePlainText,
  sampleState,
  SECTION_LABELS,
  type ResumeEntry,
  type ResumeState,
  type SectionKey,
} from "@/lib/resume";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "resume-editor-data-v2";
const REPEATABLE_SECTIONS = ["experience", "education", "projects"] as const;

const ENTRY_SCHEMA: Record<(typeof REPEATABLE_SECTIONS)[number], { title: string; subtitle: string; meta: string; details: string }> = {
  experience: {
    title: "Job Title",
    subtitle: "Company",
    meta: "Dates (e.g. Jan 2020 - Present)",
    details: "Responsibilities / achievements (one bullet per line)",
  },
  education: {
    title: "Degree",
    subtitle: "School",
    meta: "Dates / Location",
    details: "Details (one bullet per line, optional)",
  },
  projects: {
    title: "Project Name",
    subtitle: "Technologies / Role",
    meta: "Dates / Link",
    details: "Description (one bullet per line)",
  },
};

type ToastState = {
  id: number;
  message: string;
};

export function ResumeEditor() {
  const [state, setState] = useState<ResumeState>(() => emptyState());
  const [loaded, setLoaded] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [textReviewOpen, setTextReviewOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLDivElement>(null);

  const hasContent = hasAnyContent(state);
  const checks = useMemo(() => buildResumeChecks(state, pageCount), [state, pageCount]);
  const passedChecks = checks.filter((check) => check.ok).length;
  const plainText = useMemo(() => resumePlainText(state), [state]);

  const flash = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

  useEffect(() => {
    try {
      const legacy = localStorage.getItem("resume-editor-data-v1");
      const saved = localStorage.getItem(STORAGE_KEY) ?? legacy;
      if (saved) setState(normalizeResume(JSON.parse(saved)));
    } catch {
      // localStorage may be unavailable.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Ignore storage failures; the user can still export JSON.
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [loaded, state]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const measure = () => {
      const sheet = resumeRef.current;
      if (!sheet) return;
      const pageHeightPx = 11 * 96 - 16;
      setPageCount(Math.max(1, Math.ceil(sheet.scrollHeight / pageHeightPx)));
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => undefined);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [state]);

  const updateField = <K extends keyof ResumeState>(key: K, value: ResumeState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  const updateEntry = (
    section: (typeof REPEATABLE_SECTIONS)[number],
    index: number,
    key: keyof ResumeEntry,
    value: string,
  ) => {
    setState((current) => ({
      ...current,
      [section]: current[section].map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [key]: value } : entry,
      ),
    }));
  };

  const addEntry = (section: (typeof REPEATABLE_SECTIONS)[number]) => {
    setState((current) => ({ ...current, [section]: [...current[section], blankEntry()] }));
  };

  const removeEntry = (section: (typeof REPEATABLE_SECTIONS)[number], index: number) => {
    setState((current) => ({
      ...current,
      [section]: current[section].filter((_, entryIndex) => entryIndex !== index),
    }));
  };

  const moveEntry = (section: (typeof REPEATABLE_SECTIONS)[number], index: number, direction: -1 | 1) => {
    setState((current) => {
      const next = [...current[section]];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, [section]: next };
    });
  };

  const moveSection = (section: SectionKey, direction: -1 | 1) => {
    setState((current) => {
      const next = [...current.sectionOrder];
      const index = next.indexOf(section);
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, sectionOrder: next };
    });
  };

  const saveJson = () => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const safeName = (state.name || "resume").trim().replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "");
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeName || "resume"}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    flash("Saved JSON to downloads");
  };

  const openJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      setState(normalizeResume(JSON.parse(text)));
      flash("Loaded JSON");
    } catch {
      flash("That file is not valid resume JSON");
    }
  };

  const openPdf = async (file: File | undefined) => {
    if (!file) return;
    setIsImporting(true);
    try {
      setState(await importResumePdf(file));
      flash("Imported PDF - please review");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not import this PDF");
    } finally {
      setIsImporting(false);
    }
  };

  const copyPlainText = async () => {
    if (!plainText) {
      flash("Add resume details first");
      return;
    }
    try {
      await navigator.clipboard.writeText(plainText);
      flash("Copied plain text");
    } catch {
      flash("Could not copy text");
    }
  };

  const focusCheckTarget = (targetId: string) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    window.setTimeout(() => target.focus({ preventScroll: true }), 220);
  };

  return (
    <>
      <header className="app-chrome sticky top-0 z-40 border-b bg-card">
        <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Private workspace</p>
            <h1 className="text-lg font-semibold tracking-normal">Resume Editor</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-64 flex-1 items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground lg:flex-none">
              <span className="whitespace-nowrap">Text size</span>
              <input
                id="resume-text-scale"
                className="min-w-24 flex-1 accent-foreground"
                type="range"
                min={MIN_TEXT_SCALE}
                max={MAX_TEXT_SCALE}
                step="0.02"
                value={state.textScale}
                onChange={(event) => updateField("textScale", clampTextScale(Number(event.target.value)))}
                aria-label="Resume text size"
              />
              <output className="w-10 text-right tabular-nums">{Math.round(state.textScale * 100)}%</output>
            </label>
            <Button type="button" onClick={() => window.print()}>
              <Printer /> Export PDF
            </Button>
            <Button type="button" variant="outline" onClick={() => setTextReviewOpen(true)}>
              <ClipboardCopy /> Review Text
            </Button>
            <Button type="button" variant="outline" onClick={() => pdfInputRef.current?.click()} disabled={isImporting}>
              <Upload /> {isImporting ? "Importing" : "Import PDF"}
            </Button>
            <Button type="button" variant="outline" onClick={saveJson}>
              <Download /> Save JSON
            </Button>
            <Button type="button" variant="outline" onClick={() => jsonInputRef.current?.click()}>
              <FileJson /> Open JSON
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setState(sampleState());
                flash("Sample loaded");
              }}
            >
              <FileText /> Sample
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (window.confirm("Clear all fields? This cannot be undone.")) {
                  setState(emptyState());
                  flash("Cleared");
                }
              }}
            >
              <RotateCcw /> Clear
            </Button>
          </div>
        </div>
      </header>

      <main className="app-shell grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-[minmax(390px,1fr)_minmax(440px,1fr)]">
        <section className="editor-pane overflow-y-auto border-b p-4 pb-16 lg:max-h-[calc(100vh-73px)] lg:border-b-0 lg:border-r lg:p-6">
          {!hasContent ? (
            <Card className="mb-6">
              <CardHeader>
                <CardDescription className="font-semibold uppercase tracking-[0.16em]">Private resume workspace</CardDescription>
                <CardTitle className="text-2xl">Start from the resume you already have.</CardTitle>
                <CardDescription>
                  Import a PDF, open a saved JSON file, or load a polished sample to see the final structure instantly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => pdfInputRef.current?.click()} disabled={isImporting}>
                    <Upload /> Import PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setState(sampleState());
                      flash("Sample loaded");
                    }}
                  >
                    <FileText /> Use Sample
                  </Button>
                  <Button type="button" variant="outline" onClick={() => jsonInputRef.current?.click()}>
                    <FileJson /> Open JSON
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["No account", "Local autosave", "Free PDF export"].map((label) => (
                    <Badge key={label} variant="secondary">
                      {label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {hasContent ? (
            <Card className="mb-6">
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardDescription className="font-semibold uppercase tracking-[0.16em]">Resume Check</CardDescription>
                  <CardTitle>{passedChecks === checks.length ? "Ready to export" : "Needs attention"}</CardTitle>
                </div>
                <Badge variant="outline" className="tabular-nums">
                  {passedChecks}/{checks.length}
                </Badge>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {checks.map((check) => (
                  <div key={check.id} className="flex min-h-14 gap-2 rounded-md border bg-muted/30 p-2.5">
                    <span
                      className={cn(
                        "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                        check.ok ? "bg-emerald-700" : "bg-amber-700",
                      )}
                    >
                      {check.ok ? <Check className="size-3" /> : "!"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{check.label}</p>
                      <p className="text-xs leading-snug text-muted-foreground">{check.detail}</p>
                      {!check.ok ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2 h-7 px-2"
                          onClick={() => focusCheckTarget(check.targetId)}
                        >
                          <ArrowRight /> {check.actionLabel}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-6">
            <FieldGroup title="Header">
              <TextField id="field-name" label="Full Name" value={state.name} placeholder="Jane Doe" onChange={(value) => updateField("name", value)} />
              <TextField
                id="field-title"
                label="Title / Role"
                value={state.title}
                placeholder="Senior Software Engineer"
                onChange={(value) => updateField("title", value)}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField id="field-email" label="Email" value={state.email} placeholder="jane@example.com" onChange={(value) => updateField("email", value)} />
                <TextField id="field-phone" label="Phone" value={state.phone} placeholder="(555) 123-4567" onChange={(value) => updateField("phone", value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField id="field-location" label="Location" value={state.location} placeholder="San Francisco, CA" onChange={(value) => updateField("location", value)} />
                <TextField
                  id="field-website"
                  label="Website / LinkedIn"
                  value={state.website}
                  placeholder="linkedin.com/in/janedoe"
                  onChange={(value) => updateField("website", value)}
                />
              </div>
            </FieldGroup>

            <FieldGroup title="Summary">
              <TextAreaField
                id="field-summary"
                label="Professional Summary"
                value={state.summary}
                placeholder="Brief overview of your experience and strengths."
                onChange={(value) => updateField("summary", value)}
              />
            </FieldGroup>

            {state.sectionOrder.map((section, sectionIndex) => (
              <FieldGroup
                key={section}
                title={SECTION_LABELS[section]}
                actions={
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Move ${SECTION_LABELS[section]} up`}
                      disabled={sectionIndex === 0}
                      onClick={() => moveSection(section, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Move ${SECTION_LABELS[section]} down`}
                      disabled={sectionIndex === state.sectionOrder.length - 1}
                      onClick={() => moveSection(section, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    {section !== "skills" ? (
                      <Button id={`add-${section}-entry`} type="button" variant="outline" size="sm" onClick={() => addEntry(section)}>
                        Add
                      </Button>
                    ) : null}
                  </div>
                }
              >
                {section === "skills" ? (
                  <TextAreaField
                    id="field-skills"
                    label={'Skills (one group per line, e.g. "Languages: Python, Go")'}
                    value={state.skills}
                    placeholder={"Languages: Python, JavaScript, Go\nTools: Docker, Kubernetes, AWS"}
                    onChange={(value) => updateField("skills", value)}
                  />
                ) : (
                  <EntryList
                    section={section}
                    entries={state[section]}
                    onUpdate={updateEntry}
                    onMove={moveEntry}
                    onRemove={removeEntry}
                  />
                )}
              </FieldGroup>
            ))}
          </div>
        </section>

        <section className="preview-pane overflow-y-auto bg-muted/70 p-4 lg:max-h-[calc(100vh-73px)] lg:p-7" aria-label="Resume preview">
          <div className="mx-auto flex flex-col items-center gap-3">
            <ResumePreview state={state} ref={resumeRef} />
            <p className="app-chrome text-xs text-muted-foreground">
              {pageCount} {pageCount === 1 ? "page" : "pages"} in preview
            </p>
          </div>
        </section>
      </main>

      <Dialog open={textReviewOpen} onOpenChange={setTextReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogDescription className="font-semibold uppercase tracking-[0.16em]">Plain-text export</DialogDescription>
            <DialogTitle>Review before copying</DialogTitle>
            <DialogDescription>
              This is the exact ATS-friendly text that will be copied for job applications and recruiter portals.
            </DialogDescription>
          </DialogHeader>
          {plainText ? (
            <Textarea value={plainText} readOnly className="min-h-[360px] resize-y whitespace-pre font-mono text-xs leading-relaxed" />
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Add resume details first</AlertTitle>
              <AlertDescription>The plain-text review will appear once your resume has content.</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">{plainText ? plainTextStats(plainText) : "0 words"}</span>
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={copyPlainText} disabled={!plainText}>
                <ClipboardCopy /> Copy Text
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => {
          void openPdf(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={jsonInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          void openJson(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {toast ? (
        <div
          key={toast.id}
          className="app-chrome fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg"
          role="status"
        >
          {toast.message}
        </div>
      ) : null}
    </>
  );
}

function FieldGroup({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
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

function TextField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <Input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextAreaField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <Textarea id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function EntryList({
  section,
  entries,
  onUpdate,
  onMove,
  onRemove,
}: {
  section: (typeof REPEATABLE_SECTIONS)[number];
  entries: ResumeEntry[];
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
            <TextField id={`field-${section}-${index}-title`} label={schema.title} value={entry.title} onChange={(value) => onUpdate(section, index, "title", value)} />
            <TextField id={`field-${section}-${index}-subtitle`} label={schema.subtitle} value={entry.subtitle} onChange={(value) => onUpdate(section, index, "subtitle", value)} />
            <TextField id={`field-${section}-${index}-meta`} label={schema.meta} value={entry.meta} onChange={(value) => onUpdate(section, index, "meta", value)} />
            <TextAreaField id={`field-${section}-${index}-details`} label={schema.details} value={entry.details} onChange={(value) => onUpdate(section, index, "details", value)} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const ResumePreview = forwardRef<HTMLDivElement, { state: ResumeState }>(function ResumePreview({ state }, ref) {
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
