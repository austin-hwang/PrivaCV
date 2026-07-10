# Resume Editor

A privacy-first resume editor for clean, text-only resumes. It helps job
seekers edit a structured resume, preview a Letter-sized PDF, review an
ATS-friendly plain-text version, and save everything locally without accounts,
subscriptions, watermarks, or backend storage.

## Features

- Next.js App Router app built with TypeScript, React, Tailwind CSS, and local
  shadcn/ui-style components.
- Live two-pane editor with a printable resume preview.
- Focused mobile editor and preview views, so a long form never buries the
  live resume preview on a narrow screen.
- First-run start panel with fast paths for PDF import, pasted resume text,
  saved JSON, or a sample resume.
- Sections for Header, Summary, Experience, Education, Projects, and Skills.
- Add, remove, and reorder repeatable entries.
- Reorder resume sections while keeping the preview and plain-text export in sync.
- Resume Check panel for page count, missing contact fields, concise bullets,
  measurable experience/project evidence, summary length, and overall density,
  with guidance and actions that jump to the field that needs attention; each
  experience and project entry also identifies bullets that could use more
  truthful scope or outcome evidence.
- Local-only Role Focus review that compares a pasted job description with the
  current resume's wording, surfaces terms from explicit qualifications-style
  sections before repeated general wording, clearly separates terms already
  present from terms to consider, shows whether matched terms are grounded in
  an experience or project detail versus only mentioned in a title, summary, or
  skills, jumps directly to that wording, suggests a small set of direct exact
  phrases to review, includes an opt-in exact phrase check for multi-word
  concepts, and avoids opaque ATS scoring.
- Export checkpoint that catches unresolved resume checks or PDF-import review
  items before opening the browser print dialog.
- Local last-export status that shows whether the current resume still matches
  the most recent PDF export attempt.
- Field-level change summary after edits so users can recheck exactly what
  changed since their last PDF export attempt, including compact before/after
  snippets and an expandable full audit trail for edited resume areas.
- Local version history for naming, annotating, comparing, and restoring a few
  browser-only checkpoints while tailoring a resume for different applications.
- Role-aware checkpoints with optional private labels, so job-specific wording
  context stays attached to the right local draft without appearing in the
  resume or exported PDF.
- Glanceable version summaries, suggested comparisons, reversible deletion, and
  post-restore change review for safer tailoring decisions.
- Text size slider that scales the resume preview and printed PDF.
- Review Text dialog for the exact ATS-friendly copy before copying.
- Best-effort PDF import for text-based resumes through pdf.js loaded on demand,
  plus a local pasted-text path for documents, LinkedIn, and scanned PDFs.
- Post-import review panel that highlights suggested fields most likely to need
  a human check before export.
- One-click restore point after high-risk actions like PDF import, JSON open,
  sample load, and clearing the resume.
- Local autosave in browser storage plus user-managed JSON files for manual
  save, open, and checkpoint export/import when needed.
- Clean print stylesheet for browser Save as PDF.

## Stack

- Framework: Next.js App Router
- Language: TypeScript with strict checking
- UI: React
- UI system: local editable shadcn/ui-style primitives
- Styling: Tailwind CSS
- Component primitives: Radix UI for dialogs
- Icons: lucide-react
- Package manager: pnpm
- Validation: zod for resume state normalization
- Persistence: local-first browser storage and user-managed JSON files
- Testing: Vitest for resume helper coverage

## Running Locally

```sh
pnpm install
pnpm dev
```

Then open http://127.0.0.1:3000.

## Quality Checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Exporting a Clean PDF

1. Click **Export PDF**.
2. In the browser print dialog, choose **Save as PDF**.
3. Leave margins at the browser default. The app supplies its own Letter-page
   resume margins and hides the editor chrome while printing.

## Importing a PDF

Click **Import PDF** and choose a text-based resume PDF. The app extracts text
with pdf.js and uses heuristics to fill the editor fields.

Notes:

- PDF parsing is approximate because PDFs store positioned glyphs, not semantic
  resume structure.
- Always review imported fields before exporting.
- Scanned/image-only PDFs do not contain extractable text.
- PDF import loads the parser from a CDN on demand, so that action requires an
  internet connection.

## Importing pasted text

Choose **Paste resume text** and paste text copied from a document, LinkedIn,
or an OCR&apos;d scanned PDF. Parsing happens only in the browser and uses the same
review step as PDF import, so confirm the suggested fields before export.

## Files

| File or folder | Purpose |
| --- | --- |
| `app/` | Next.js App Router routes, layout, and global styles |
| `components/resume-editor.tsx` | Page-level editor composition and responsive workspace switching |
| `components/resume-editor/` | Focused form, preview, role-focus, history, comparison, and dialog components |
| `components/ui/` | Local shadcn/ui-style primitives |
| `hooks/use-resume-editor.ts` | Client-side editor orchestration and persistence |
| `lib/resume.ts` | Typed resume state, validation, checks, plain-text export |
| `lib/resume-workspace.ts` | Workspace, versioning, and import-review business rules |
| `lib/pdf-import.ts` | PDF text extraction and parsing |
| `lib/resume.test.ts` | Vitest coverage for resume helpers |
| `ROADMAP.md` | Product vision and priorities |
| `AGENT_LOG.md` | Progress notes from builder runs |
