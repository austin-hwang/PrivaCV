# PrivaCV

PrivaCV is a privacy-first resume editor for clean, text-only resumes. It helps job
seekers edit a structured resume, preview a Letter-sized PDF, review an
ATS-friendly plain-text version, and save everything locally without accounts,
subscriptions, watermarks, or backend storage.

## Features

- Next.js App Router app built with TypeScript, React, Tailwind CSS, and local
  shadcn/ui-style components.
- Live two-pane editor with a true Letter-size printable resume preview;
  screen-only page-boundary guides identify the content that comes next on
  each additional PDF page before export. When browser print keeps a role
  intact and moves it to a fresh page, the preview reserves that same space so
  its page count matches the exported PDF; print rules also keep headings and
  individual bullets together when space allows.
- Valid email, phone, and website details remain clickable in the preview and browser-produced PDF, while malformed values stay as plain text for correction.
- Focused mobile editor and preview views that keep the printed Letter layout
  intact while scaling it to the screen, plus an on-demand Review tools strip
  for import checklists, checks, role focus, and versions; imported resumes keep
  a compact next-field prompt above the form so editing stays within reach on a
  narrow screen.
- First-run start panel with fast paths for Word and PDF import, pasted resume text,
  saved JSON, or a sample resume. Imported fields retain source context for
  correction, and an accurate import can be deliberately confirmed all at once
  from the import-review banner
  instead of requiring repetitive per-field clicks. Common qualification-style
  headings and visually decorated PDF headings (for example, `— EXPERIENCE —`)
  are recognized locally before that review. If a newer imported draft is
  deliberately accepted from another browser tab, its matching unfinished
  review follows it, so the export reminder is never silently lost.
- Public-facing browser metadata, a web-app manifest, custom app icons, and
  graceful route-error recovery; titles and copy accurately describe the
  local-first data model without inventing a hosted domain.
- Sections for Header, Summary, Experience, Education, Projects, and Skills.
- Four clean, printable templates (Classic, Minimal, Modern, and Compact) that keep the same ATS-readable structure.
- Professional design controls for template, font, restrained accent color,
  heading treatment, density, alignment, divider, and text scale; loading a
  sample preserves the active design so it can be evaluated in that layout.
- Add, remove, and reorder repeatable entries, including with drag-and-drop or
  accessible move controls.
- Rename—or intentionally omit—section headings, remove and restore default
  sections without leaving their content in the export, add local custom
  sections for content such as Publications or Certifications, start missing
  default or common sections with one click (Certifications, Volunteer
  Experience, Publications, Awards, Languages, or Training), and reorder every
  section in a clear top-to-bottom list while keeping the preview and plain-text
  export in sync.
- Click a preview heading or entry to return directly to its editor field; the
  active field is lightly highlighted in the preview while editing.
- Resume Check panel for page count, usable contact details (including obvious
  malformed email, phone, and link mistakes), concise bullets,
  oversized single entries that would continue without their heading on a later
  printed page, measurable experience/project evidence, optional summary
  guidance, and overall density.
  A two-page resume is a relevance prompt—not an export failure—while three or
  more pages receive trimming guidance. Each check has an action that jumps to
  the field that needs attention; each
  experience and project entry also identifies bullets that could use more
  truthful scope or outcome evidence, plus a few clearly generic openings that
  could more directly name the work done.
- Local-only Role Focus review that compares a pasted job description with the
  current resume's wording, surfaces terms from explicit qualifications-style
  sections before repeated general wording, clearly separates terms already
  present from terms to consider, shows whether matched terms are grounded in
  an experience, project, or custom-section detail versus only mentioned in a
  title, heading, summary, or skills, jumps directly to that wording, suggests
  a small set of direct exact phrases to review, includes an opt-in exact
  phrase check for multi-word concepts, and avoids opaque ATS scoring.
- Role Focus offers a direct local "Save base draft" checkpoint once a job
  description is pasted, so the original resume and its private role context
  are easy to restore after tailoring.
- Export checkpoint that catches unresolved resume checks or PDF-import review
  items before opening the browser print dialog, including when the familiar
  Cmd/Ctrl+P shortcut is used. An unfinished import review survives a browser
  refresh, so a reload cannot silently turn an imported draft into a
  review-free export.
- Local, editable `.docx` export for portals that explicitly request a Word
  document. It keeps the current resume in a simple single-column structure
  with normal text, headings, bullets, and usable contact links; it is designed
  for compatibility rather than pixel-matching the PDF template.
- Local last-export status that shows whether the current resume still matches
  the most recent PDF export attempt.
- Field-level change summary after edits so users can recheck exactly what
  changed since their last PDF export attempt—including visual layout, font,
  color, and spacing choices—with compact before/after snippets and an
  expandable full audit trail for edited resume areas. The same comparison
  appears before choosing between conflicting drafts in two browser tabs.
- Local version history for naming, annotating, comparing, and restoring a few
  browser-only checkpoints while tailoring a resume for different applications.
  When that short local history is full, the recommended save path downloads a
  complete checkpoint backup before replacing its oldest draft.
- Role-aware checkpoints with optional private labels, so job-specific wording
  context stays attached to the right local draft; intentional PDF, Word,
  plain-text, and JSON exports include that label in their filename to prevent
  application mix-ups, while the label never appears in resume content or on a
  PDF page.
- Glanceable version summaries, suggested comparisons, reversible deletion, and
  post-restore change review for safer tailoring decisions.
- Text size slider that scales the resume preview and printed PDF. When a
  preview runs beyond one page, a reversible helper can try compact spacing
  first, then reduce text size in small 2% steps without changing any content.
- Review Text dialog for the exact ATS-friendly copy before copying or downloading
  a portable `.txt` file for application portals.
- Application Copy dialog for portals that split a resume into separate fields:
  copy an individual contact detail, summary, role, employer, dates, achievement
  list, education entry, project, skills section, or custom-section entry without
  retyping. It mirrors the current resume and stays entirely in the browser.
- Best-effort Word import for editable `.docx` resumes and PDF import for text-based resumes through a locally bundled,
  on-demand pdf.js parser, plus a local pasted-text path for documents,
  LinkedIn, and scanned PDFs. The
  importer recognizes common alternate section headings such as Career Profile,
  Qualifications Summary, Relevant Experience, Education & Training, Academic
  Projects, Skills & Tools, Technology Stack, and Technical Proficiencies. It preserves specialty sections such
  as Research Experience, Leadership, Publications, Presentations, and
  Coursework as separate editable sections, and cautiously keeps unfamiliar
  short ALL-CAPS headings separate rather than folding them into experience;
  it also keeps text fragments with tiny baseline offsets on one readable line,
  a common artifact of positioned-PDF exports;
  it also recognizes adjacent entries whose dates are on their own lines: roles
  remain separate when bulleted details make the boundary clear, and compact
  degree-and-school histories remain separate without bullets. Employer-first
  two-line headers retain a recognizable dated role, even when adjacent roles
  have no blank line. Compact inline headings such as `Professional Summary:
  ...`, `Skills: ...`, and `Experience: ...` retain the content after the
  colon.
- Post-import review panel that guides users through each imported contact,
  summary, experience, education, project, and skills entry, keeps explicit
  confirmation and a matching source excerpt beside the editable value, keeps
  the extracted source text available for local fact-checking, shows a
  source-aware coverage snapshot that identifies recognizable core and familiar
  specialty source headings the parser did not populate and keeps a short source excerpt beside each
  recognized section, and keeps the export reminder visible until the review
  is finished. Experience entries include a one-click title/company swap for
  company-first source layouts. The reload-safe checklist retains its small
  local excerpts and coverage prompts, not the complete extracted source text.
- One-click restore point after high-risk actions like PDF import, JSON open,
  sample load, and clearing the resume.
- A five-second Undo for accidentally removed entries or custom sections, so
  routine cleanup does not turn into retyping.
- Local autosave in browser storage now makes its brief saving state and
  successful completion visible in the workspace header; user-managed JSON
  files remain available for manual save, open, and checkpoint export/import
  when needed. If the same editor is open in two tabs, a different draft saved
  in the other tab pauses autosave here and asks which draft to keep rather
  than silently overwriting either version.
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
3. The save dialog will suggest a recognizable filename based on the name in
   your resume, such as `Jane_Doe_Resume.pdf`; you can still rename it there.
4. Leave margins at the browser default. The app supplies its own Letter-page
   resume margins and hides the editor chrome while printing.

## Downloading a Word document

Open **More actions** and choose **Download Word (.docx)**, or open **Review
Text** and choose **Download .docx**. The editable Word file is generated in
your browser and does not upload your resume. Its deliberately simple layout is
best for application portals that ask for a Word document; use PDF when you
need the selected visual template preserved exactly.

## Copying into application forms

Open **More actions** and choose **Copy for applications**. The dialog keeps
the resume in its current order and exposes small, copy-ready fields for the
common application-form prompts. Use **Review Text** when a portal accepts one
complete plain-text resume instead.

## Importing a PDF

Click **Import PDF** and choose a text-based resume PDF. The app extracts text
with pdf.js and uses heuristics to fill the editor fields.

Notes:

- PDF parsing is approximate because PDFs store positioned glyphs, not semantic
  resume structure.
- Always review imported fields before exporting.
- Scanned/image-only PDFs do not contain extractable text.
- To keep the browser responsive, PDFs over 10 MiB or 30 pages are stopped
  before full text extraction; copy and paste the resume text instead.
- PDF import loads its parser and worker from this app on demand. Your selected
  PDF and its extracted text stay in the browser; importing does not send the
  document to a third party.

## Importing a Word document

Click **Import a Word file** and choose an editable `.docx` resume. The app
reads ordinary paragraph text locally (including text in simple table cells,
referenced document headers, and explicit contact details in referenced
footers) and recovers safe external contact-link
destinations—including standard Word hyperlink fields—when Word displays only
a label such as “LinkedIn.” It then uses
the same conservative parser and
required review used for pasted text and PDFs. Page numbers, template branding,
visual layout, table structure, comments, and tracked changes are not
reconstructed; use this route for the
resume text you want to edit, not as a pixel-perfect Word converter. To keep
this browser-only path responsive, unusually large or highly compressed Word
archives are rejected before decompression; copy and paste the resume text if
that happens.

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
