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
- Make risky actions reversible so users can experiment without fear.
- Show lightweight readiness feedback before export so users can fix obvious
  resume issues without leaving the page.
- Keep the final export moment calm by surfacing unresolved checks without
  trapping confident users.
- Make post-export confidence visible by showing whether the current resume has
  changed since the last PDF export attempt.
- Show a compact field-level summary of what changed since the last export so
  users can recheck edits quickly.
- Make post-export changes easier to audit with concise before/after context
  before the next PDF export, including a full expandable audit trail for dense
  tailoring sessions.
- Let users keep named, annotated browser-only version history so job-specific
  tailoring feels reversible without accounts or cloud storage.
- Let users compare a saved checkpoint with the current resume before restoring
  or exporting a tailored draft.
- Make checkpoint comparisons name the exact edited fields so users can audit
  job-specific tailoring without rereading every section.
- Let users compare two saved checkpoints directly when deciding which tailored
  draft to revive.
- Show what changed immediately after restoring a checkpoint so reverting a
  tailored draft still feels reviewable, even when many areas changed.
- Improve mobile and narrow-window editing without compromising the print layout.

## Core Features

- Keep refining Resume Check guidance with more specific recommendations for
  crowded sections and low-evidence resumes.
- Improve the export checkpoint with role-aware recommendations and more
  granular changed-field detail for dense edit sessions.
- Multiple clean text-only templates with consistent ATS-friendly structure.
- Role-specific sample resumes that users can adapt quickly.
- Keep improving PDF import review with clearer confidence signals and a better
  before/after correction flow.
- Improve local version history with clearer checkpoint labels, lineage cues,
  and lightweight guidance for choosing which saved draft to restore.
- Make saved checkpoints glanceable enough to choose quickly before opening a
  comparison or restoring an older draft.
- Keep improving restored checkpoint summaries with clearer scan hierarchy for
  large edits.

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
- Theme controls limited to typography and spacing, not decorative templates.

## Future Ideas

- Job-description comparison that runs locally where possible.
- Guided bullet rewrites that keep user data private.
- Recruiter-readability checks based on structure rather than opaque scores.
