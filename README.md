# Resume Editor

A privacy-first resume editor for clean, text-only resumes. It helps job
seekers edit a structured resume, preview a Letter-sized PDF, review an
ATS-friendly plain-text version, and save everything locally without accounts,
subscriptions, watermarks, or backend storage.

## Features

- Next.js App Router app built with TypeScript, React, Tailwind CSS, and local
  shadcn/ui-style components.
- Live two-pane editor with a printable resume preview.
- First-run start panel with fast paths for PDF import, saved JSON, or a sample
  resume.
- Sections for Header, Summary, Experience, Education, Projects, and Skills.
- Add, remove, and reorder repeatable entries.
- Reorder resume sections while keeping the preview and plain-text export in sync.
- Resume Check panel for page count, missing contact fields, long bullets,
  summary length, and overall density, with guidance and actions that jump to
  the field that needs attention.
- Local-only Role Focus review that compares a pasted job description with the
  current resume's wording, clearly separates terms already present from terms
  to consider, suggests a small set of direct exact phrases to review, includes
  an opt-in exact phrase check for multi-word concepts, and avoids opaque ATS
  scoring.
- Export checkpoint that catches unresolved resume checks or PDF-import review
  items before opening the browser print dialog.
- Local last-export status that shows whether the current resume still matches
  the most recent PDF export attempt.
- Field-level change summary after edits so users can recheck exactly what
  changed since their last PDF export attempt, including compact before/after
  snippets and an expandable full audit trail for edited resume areas.
- Local version history for naming, annotating, saving, and restoring
  browser-only checkpoints while tailoring a resume for different applications.
- Role-aware checkpoints that retain an optional pasted job description, so
  restoring a tailored draft also restores its local wording-review context.
- Reversible checkpoint deletion so an accidental cleanup does not permanently
  remove a local draft before the user can recover it.
- Version-history capacity guidance that shows the five-checkpoint limit, names
  the oldest saved draft, and warns before a new unique checkpoint replaces it.
- Portable checkpoint-history backups that let users archive or move their
  browser-only tailored drafts without uploading resume data anywhere.
- Clear backup-import capacity review that considers every valid checkpoint in
  a backup and names older drafts that will remain only in the backup when the
  browser&apos;s five-draft limit is reached.
- Explicit backup-overlap review that identifies drafts already saved in the
  browser before a merge, so matching checkpoints do not look like new work.
- Glanceable checkpoint summaries that show saved draft contents, current-match
  status, and changed-area counts before comparing or restoring.
- Checkpoint lineage cues that show which saved draft a tailored version was
  derived from.
- Suggested checkpoint comparison that highlights the closest saved draft to
  review first when several tailored versions exist.
- Saved-version comparison that shows changed areas with saved/current snippets
  and exact edited field labels before restoring or continuing a tailored draft.
- Saved-to-saved comparison for auditing how two local checkpoints differ
  without replacing the current resume.
- Post-restore audit panel that shows what changed when a saved checkpoint is
  restored, with expandable change details and jump actions back to the
  affected fields.
- Text size slider that scales the resume preview and printed PDF.
- Review Text dialog for the exact ATS-friendly copy before copying.
- Best-effort PDF import for text-based resumes through pdf.js loaded on demand.
- Post-import review panel that highlights parsed fields most likely to need a
  human check before export.
- One-click restore point after high-risk actions like PDF import, JSON open,
  sample load, and clearing the resume.
- Local autosave in browser storage plus Save JSON / Open JSON backup files.
- Save or open a checkpoint-history JSON backup to preserve up to five named
  tailored drafts outside a single browser.
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

## Files

| File or folder | Purpose |
| --- | --- |
| `app/` | Next.js App Router routes, layout, and global styles |
| `components/resume-editor.tsx` | Main client-side resume editor experience |
| `components/ui/` | Local shadcn/ui-style primitives |
| `lib/resume.ts` | Typed resume state, validation, checks, plain-text export |
| `lib/pdf-import.ts` | PDF text extraction and parsing |
| `lib/resume.test.ts` | Vitest coverage for resume helpers |
| `ROADMAP.md` | Product vision and priorities |
| `AGENT_LOG.md` | Progress notes from builder runs |
