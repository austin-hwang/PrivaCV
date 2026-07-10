# Resume Editor Roadmap

## Vision

Build the fastest privacy-first resume editor for people who want a clean,
ATS-friendly PDF without accounts, subscriptions, watermarks, or layout anxiety.

## MVP

- Local-first Next.js editor that runs without a backend.
- Live Letter-size preview with reliable PDF export.
- Reviewable plain-text copy for ATS checks and application forms.
- Import from text-based PDFs and editable JSON files.
- Repeatable sections for education, experience, projects, and skills.

## User Experience

- Make first use obvious: import from PDF or pasted text, open saved work, or
  start from a strong sample.
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
- Let users keep lightweight browser-only checkpoints so job-specific tailoring
  feels reversible without accounts or cloud storage.
- Make saved drafts quick to scan, compare, restore, or undo when users are
  deciding which tailored version to continue.
- Keep role-focus context attached to the right saved draft without making
  version management dominate the editor.
- Show what changed after restoring a checkpoint so reverting a tailored draft
  still feels reviewable.
- Keep refining mobile and narrow-window editing without compromising the print layout.

## Core Features

- Keep refining Resume Check guidance with more specific recommendations for
  crowded sections and low-evidence resumes; it now prompts for measurable
  scope or results without requiring every bullet to contain a number, with an
  in-context per-entry cue that identifies the bullets to reconsider.
- Keep the editor and live resume preview equally reachable on a phone, while
  preserving the fast desktop split workspace and print layout.
- Improve the export checkpoint with role-aware recommendations and more
  granular changed-field detail for dense edit sessions.
- Keep refining the local Role Focus review so its transparent wording cues
  stay useful without pretending to predict ATS or hiring outcomes; it now
  elevates terms from explicit qualifications-style sections, distinguishes
  terms grounded in experience or project details from mentions that appear
  only in a title, summary, or skills, and provides direct field jumps for
  review. Reassess phrase ranking only where it stays reviewable and local-first.
- Multiple clean text-only templates with consistent ATS-friendly structure.
- Role-specific sample resumes that users can adapt quickly.
- Keep improving PDF and pasted-text import review with clearer confidence
  signals and a better before/after correction flow.
- Improve local version history just enough to support tailoring: clear labels,
  role context, simple comparisons, undo paths, and readable restore summaries.
- Keep manual checkpoint export/import available as a utility, without making
  backup management a central workflow.

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

- Phrase-level job-description comparison that runs locally where possible.
- Guided bullet rewrites that keep user data private.
- Recruiter-readability checks based on structure rather than opaque scores.
