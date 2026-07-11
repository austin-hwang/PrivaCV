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

- Keep first use obvious: the onboarding now recommends pasted text for copied
  documents, LinkedIn, and OCR while clearly reserving PDF import for
  selectable-text files; reassess whether deeper import correction context or
  mobile editing density is the next first-use friction.
- Prioritize a clear, field-by-field import review before adding more
  role-matching heuristics: imported resumes now guide users through every
  non-empty imported entry, keep confirmation plus nearby matching source
  context beside the editable value, and distinguish a recognizable source
  heading from an area the parser actually populated. This makes a skipped
  Education, Skills, Summary, Experience, or Projects section explicit before
  users confirm their draft. Reassess whether parsing accuracy itself is now
  the remaining trust gap.
- Improve parsing accuracy for common plain-text layouts before expanding
  output formats: alternate headings such as Career Profile, Relevant
  Experience, Education & Training, Academic Projects, and Key Skills now map
  to their expected fields; adjacent roles whose dates appear on separate lines
  stay distinct when their bullets make the entry boundary clear, and compact
  degree-and-school entries without bullets remain separate when each date ends
  its header. Compact inline headings such as `Skills: ...`, `Professional
  Summary: ...`, and `Experience: ...` also retain the content following the
  colon. Continue to favor conservative extraction plus explicit review over
  guesses that could merge or invent experience. Company-first role headings
  remain deliberately reviewable rather than guessed; each experience entry
  now has a reversible one-click title/company swap.
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
- Keep refining mobile and narrow-window editing without compromising the print
  layout. The phone workspace keeps the form first, surfaces a compact next-field
  prompt for imported resumes, and moves the full import checklist, resume checks,
  role focus, and version history into on-demand Review tools; reassess whether
  the remaining import-quality explanation or correction context needs more help.
- Preserve an ATS-safe structure while letting people represent the parts of a
  career that do not fit a fixed template: editable section headings, a small
  number of custom repeatable sections, and reversible section/entry ordering
  now cover publications, certifications, volunteer work, and similar content.
  Familiar one-click presets for Certifications, Volunteer Experience,
  Publications, Awards, Languages, and Training now reduce the blank-state
  decision without constraining custom headings. Reassess whether users need
  role-specific examples before adding decorative templates or broader layout
  controls.

## Core Features

- Keep refining Resume Check guidance with more specific recommendations for
  crowded sections and low-evidence resumes; it now prompts for measurable
  scope or results without requiring every bullet to contain a number, with an
  in-context per-entry cue that identifies the bullets to reconsider. A missing
  summary is now clearly optional rather than an export blocker, so the next
  reassessment should focus on evidence quality and readability over requiring
  conventional filler.
- Keep the editor and live resume preview equally reachable on a phone, while
  preserving the fast desktop split workspace and print layout. Avoid putting
  optional review dashboards ahead of the first editable field on a phone.
- Improve the export checkpoint with role-aware recommendations and more
  granular changed-field detail for dense edit sessions.
- Keep refining the local Role Focus review so its transparent wording cues
  stay useful without pretending to predict ATS or hiring outcomes; it now
  elevates terms from explicit qualifications-style sections, distinguishes
  terms grounded in experience or project details from mentions that appear
  only in a title, heading, summary, or skills, and provides direct field jumps
  for review. Custom-section headings and entries now count as real resume
  evidence too, so a relevant certification or volunteer entry is never
  falsely reported as missing. Reassess phrase ranking only where it stays
  reviewable and local-first.
- Multiple clean text-only templates with consistent ATS-friendly structure.
- Role-specific sample resumes that users can adapt quickly.
- Keep improving PDF and pasted-text import review with clearer confidence
  signals and a better before/after correction flow now that every imported
  entry can be explicitly confirmed, checked against nearby local source
  context, and compared with a source-aware coverage snapshot that identifies
  recognizable headings the parser did not populate. Reassess the remaining
  parsing gaps, particularly uncommon header formats, before expanding output
  formats or tailoring automation.
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
- Keep a deployment-compatible response security baseline for every route: a
  same-origin Content Security Policy, anti-framing, MIME-sniffing, referrer,
  transport, cross-origin isolation, and unused-browser-permission controls
  protect the local workspace without introducing analytics or third-party
  dependencies. The static CSP intentionally retains Next.js-required inline
  script/style support; reassess nonce- or SRI-based tightening only if a
  future server-rendering/performance tradeoff is justified and verified.
- Keep sensitive import paths self-contained: the on-demand PDF parser and its
  worker now ship from the app origin rather than a third-party CDN, so the
  user's selected resume never depends on or contacts an external parser host.
- Continue using zod normalization for imported and saved resume data.
- Keep the dependency graph free of known production advisories. PostCSS is
  explicitly overridden to the patched 8.5.16 release because the currently
  supported Next.js version otherwise pins an affected transitive copy; review
  the override when a compatible Next.js release removes that constraint.
- Introduce react-hook-form when validation becomes field-level and user-facing,
  rather than for simple controlled inputs.
- Expand Playwright coverage beyond the sample and text-review smoke flow to
  include PDF export, JSON import/export, and mobile layout checks.
- Avoid database, auth, and server-side persistence until the product needs
  durable cross-device workflows.

## Growth

- Public demo page with no sign-in and a clear privacy promise.
- Keep browser and sharing presentation trustworthy: the editor now has an
  accurate title, description, Open Graph and social-card metadata, a web-app
  manifest, crawl policy, and custom browser/Apple icons. Reassess a hosted
  marketing page, canonical URL, sitemap, and social image only after a stable
  public domain exists; do not invent production URLs before then.
- Shareable exported JSON examples for common roles.
- Optional static hosting workflow for a hosted version.

## Nice-to-have

- DOCX export.
- Keyboard shortcuts for adding entries and moving sections.
- Theme controls limited to typography and spacing, not decorative templates.

## Future Ideas

- Reassess phrase-level job-description comparison only after import-review
  completion and first-use confidence are demonstrably strong.
- Guided bullet rewrites that keep user data private.
- Recruiter-readability checks based on structure rather than opaque scores.
