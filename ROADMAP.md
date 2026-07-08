# Resume Editor Roadmap

## Vision

Build the fastest privacy-first resume editor for people who want a clean,
ATS-friendly PDF without accounts, subscriptions, watermarks, or layout anxiety.

## MVP

- Local-first Next.js editor that runs without a backend.
- Live Letter-size preview with reliable PDF export.
- Reviewable plain-text copy for ATS checks and application forms.
- Import from text-based PDFs and editable JSON backups.
- Repeatable sections for education, experience, projects, and skills.

## User Experience

- Make first use obvious: import, open saved work, or start from a strong sample.
- Keep the editor dense but calm, with immediate preview feedback.
- Preserve confidence around privacy, autosave, and free export.
- Show lightweight readiness feedback before export so users can fix obvious
  resume issues without leaving the page.
- Improve mobile and narrow-window editing without compromising the print layout.

## Core Features

- Keep refining Resume Check guidance with more specific recommendations for
  crowded sections and low-evidence resumes.
- Multiple clean text-only templates with consistent ATS-friendly structure.
- Role-specific sample resumes that users can adapt quickly.
- Safer PDF import review that highlights uncertain parsed fields.

## UI System

- Preserve the local shadcn/ui-style component foundation in `components/ui`.
- Add new UI primitives through the shadcn/ui model before building custom
  controls from scratch.
- Keep Radix-backed accessible primitives for dialogs and future overlays.
- Use lucide-react icons for toolbar and command buttons.

## Technical Foundation

- Keep the app local-first with browser storage and JSON files until accounts,
  syncing, or collaboration become clearly valuable.
- Continue using zod normalization for imported and saved resume data.
- Introduce react-hook-form when validation becomes field-level and user-facing,
  rather than for simple controlled inputs.
- Expand Playwright coverage beyond the sample and text-review smoke flow to
  include PDF export, JSON import/export, and mobile layout checks.
- Avoid database, auth, and server-side persistence until the product needs
  durable cross-device workflows.

## Growth

- Public demo page with no sign-in and a clear privacy promise.
- Shareable exported JSON examples for common roles.
- Optional static hosting workflow for a hosted version.

## Nice-to-have

- DOCX export.
- Keyboard shortcuts for adding entries and moving sections.
- Local-only version history.
- Theme controls limited to typography and spacing, not decorative templates.

## Future Ideas

- Job-description comparison that runs locally where possible.
- Guided bullet rewrites that keep user data private.
- Recruiter-readability checks based on structure rather than opaque scores.
