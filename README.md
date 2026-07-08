# Resume Editor

A simple, clean resume editor that produces professional, **text-only** resumes —
no graphics, no background colors, no gimmicks. Just a well-typeset document you
can export to PDF.

## Features

- Live two-pane editor: fill in fields on the left, see the resume update on the right.
- First-run start panel with three fast paths: import a PDF, open saved JSON, or
  load a polished sample resume.
- Sections: Header, Summary, Experience, Education, Projects, Skills.
- Add/remove as many Experience, Education, and Project entries as you like.
- Reorder sections with the ↑/↓ buttons on each section (Education leads by default).
- Reorder individual entries within a section with their ↑/↓ buttons.
- **Resume Check** panel flags page count, missing core contact fields, long
  bullets, and summary length before export.
- **Text size** slider (80%–130%) scales the whole resume proportionally, in both
  the preview and the exported PDF.
- Bullet points: type one per line in the details box.
- **Export to PDF** — opens the browser print dialog; choose "Save as PDF".
- **Copy Text** — copies an ATS-friendly plain-text version for application
  forms, recruiter portals, and quick parsing checks.
- **Import PDF** — load an existing resume PDF and have its text parsed into the
  fields, so you can edit/reformat it. (See note below.)
- Auto-saves to your browser (localStorage) so a refresh restores your work.
- **Save JSON / Open JSON** — download your resume as a `.json` file on disk and
  reopen it later (or on another machine).
- A "Sample" button fills in example content so you can see the format.
- Responsive editor layout for narrow screens while preserving Letter-sized PDF
  output.

## Importing a PDF

Click **Import PDF** and choose a resume. The app extracts the text and makes a
best-effort guess at the name, contact details, summary, experience, education,
projects, and skills, then fills in the editor for you to review and correct.

Notes:
- Parsing is heuristic — PDFs store positioned glyphs, not a structured outline —
  so always check the results. It works best on standard single-column resumes.
- Importing fetches the PDF engine ([pdf.js](https://mozilla.github.io/pdf.js/))
  from a CDN on first use, so it needs an internet connection.
- Scanned/image-only PDFs have no extractable text and can't be imported.

## Running it

It's a static site — no build step. Open `index.html` directly in a browser,
or serve the folder:

```sh
python3 server.py        # serves at http://127.0.0.1:4173
```

Then open http://127.0.0.1:4173 in your browser.

## Exporting a clean PDF

1. Click **Export PDF** (or press Cmd/Ctrl+P).
2. In the print dialog choose **Save as PDF** as the destination.
3. Leave **Margins** set to *Default* (the document supplies its own margins).

The export produces a clean document at its real size:

- It hides the editor and prints only the resume.
- `@page { margin: 0 }` removes the browser's auto-added header/footer
  (page title, date, URL), so the page contains the resume only.
- Content prints at full size and flows across multiple pages if it's long —
  the preview already shows exactly how those pages will break.

## Copying plain text

Click **Copy Text** to put a clean text version on your clipboard. It uses the
same section order as the preview, keeps standard headings, and formats bullets
with simple hyphens so the content is easy to paste into job applications.

## Multi-page preview

The preview shows the resume as discrete **Letter-sized page sheets**, just like
the printed PDF. As you add content, blocks are measured and paginated: long
resumes flow onto page 2, 3, … with the page margins shown on every page.
Entries are kept whole (never split mid-entry) and section headings are never
left stranded at the foot of a page.

## Files

| File         | Purpose                                  |
|--------------|------------------------------------------|
| `index.html`   | Markup: editor form + preview document   |
| `styles.css`   | Theme + the print/PDF stylesheet         |
| `app.js`       | State, live preview, save/load, export   |
| `pdf-import.js`| PDF text extraction + heuristic parsing  |
| `server.py`    | Optional local static server             |
| `ROADMAP.md`   | Product vision and prioritized roadmap   |
| `AGENT_LOG.md` | Progress notes from autonomous builder runs |
