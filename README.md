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
- Resume Check panel for page count, missing contact fields, long bullets, and
  summary length.
- Text size slider that scales the resume preview and printed PDF.
- Review Text dialog for the exact ATS-friendly copy before copying.
- Best-effort PDF import for text-based resumes through pdf.js loaded on demand.
- Local autosave in browser storage plus Save JSON / Open JSON backup files.
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
