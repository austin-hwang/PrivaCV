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
  selectable-text files. Starting from scratch is now an equally direct route:
  a blank resume opens the form with keyboard focus on the name field, and each
  layout choice opens that same clean blank draft with the selected template
  active. Reassess whether deeper import correction context or mobile editing
  density is the next first-use friction.
- Prioritize a clear, field-by-field import review before adding more
  role-matching heuristics: imported resumes now guide users through every
  non-empty imported entry—including specialty sections such as certifications
  and publications—keep confirmation plus nearby matching source
  context beside the editable value, and distinguish a recognizable source
  heading from an area the parser actually populated; the coverage snapshot
  now also keeps a compact local source excerpt beside each recognized core or
  familiar specialty section (such as Certifications or Publications), so an
  omitted credential is explicit before a person assumes it was imported.
  This makes a skipped Education, Skills, Summary, Experience, or Projects
  section explicit and quicker to recover before users confirm their draft.
  Reassess whether parsing accuracy itself is now the remaining trust gap.
- Keep import review deliberately trustworthy without making a clean import
  feel like paperwork: people can still correct and confirm individual fields,
  while a clear source-backed checklist now offers one explicit confirmation
  for an import they have reviewed as a whole, alongside the field-by-field
  walkthrough. An unfinished checklist now
  survives a refresh with its compact local excerpts and coverage prompts, so
  accidental reloads cannot bypass the review; the complete extracted source
  is intentionally not copied into browser storage. Reassess whether uncommon
  source layouts, rather than confirmation effort, are the next import gap.
- Improve parsing accuracy for common plain-text layouts before expanding
  output formats: alternate headings such as Career Profile, Relevant
  Experience, Education & Training, Academic Projects, and Key Skills now map
  to their expected fields; common concise variants such as Professional
  Overview, Professional History, Education & Credentials, Skills & Tools,
  Technology Stack, and Technical Toolkit now do too. Adjacent roles whose
  dates appear on separate lines stay distinct when their bullets make the
  entry boundary clear, and compact degree-and-school entries without bullets
  remain separate when each date ends its header. Compact inline headings such
  as `Skills: ...`, `Professional Summary: ...`, and `Experience: ...` also
  retain the content following the colon. Employer-first two-line headers now
  retain a recognizable dated role instead of dropping it, including adjacent
  roles with no blank line. Continue to favor conservative extraction plus
  explicit review over guesses that could merge or invent experience.
  Company-first role headings remain deliberately reviewable rather than
  guessed; each experience entry now has a reversible one-click title/company
  swap.
- Make it easier to reuse an editable resume before asking anyone to retype it:
  `.docx` import now reads ordinary Word paragraphs—including simple table-cell
  text, referenced document headers, and explicit contact lines in referenced
  footers—entirely in the browser, preserves safe
  external contact-link targets—including standard Word hyperlink fields—when
  Word displays only a label, and feeds the same conservative parser and
  explicit review used by pasted text and PDFs. It intentionally does not claim
  to recreate Word layout, footer body text, table structure, comments, or tracked changes;
  reassess uncommon Word structures only after real import review shows a gap.
- Keep the editor dense but calm, with immediate preview feedback.
- Keep the primary on-sheet editor as safe as the form: browser-native spell
  checking now remains active for prose, titles, and bullets directly on the
  resume canvas, while email, phone, URLs, and locations are deliberately
  excluded. This catches ordinary writing mistakes without presenting
  automated writing as fact; spellcheck privacy behavior follows the person's
  browser settings.
- Keep page-fit decisions intentional and reversible: when a preview crosses a
  page boundary, a small local helper can try compact spacing and then modest
  2% text reductions without touching the person’s content; reassess whether
  stronger content-trimming guidance is needed only after this direct layout
  path proves insufficient.
- Treat loading a sample as a content change, not a design reset: the selected
  template, typeface, accent, heading treatment, density, and text scale stay
  active so people can evaluate the example in the layout they chose.
- Preserve confidence around privacy, autosave, and free export.
- Make local persistence visible without interrupting editing: the workspace
  header now quietly distinguishes a brief in-progress save from a completed
  browser-only save, while the existing warning and JSON backup path take over
  if storage is unavailable. When another browser tab saves a different resume,
  this tab pauses autosave and lets the person deliberately choose its draft or
  the newer saved one, preventing silent same-browser overwrites; a matching
  unfinished import-review checklist now travels with an accepted imported
  draft, while stale review metadata is discarded conservatively. Reassess
  cross-device backup only if it can keep the same privacy posture.
- Make risky actions reversible so users can experiment without fear. Removing
  an entry or custom section now offers a short Undo window, so routine cleanup
  never requires a disruptive confirmation dialog or accidental retyping.
- Show lightweight readiness feedback before export so users can fix obvious
  resume issues without leaving the page.
- Keep the final export moment calm by surfacing unresolved checks without
  trapping confident users. Import-review progress now remains explicit in
  that checkpoint: users can jump to the next unconfirmed field or knowingly
  export anyway, but cannot accidentally discard the checklist as "reviewed."
- Make the finished PDF easy to recognize outside the browser: PDF export now
  temporarily supplies a resume-owner filename suggestion to the native print
  dialog, then restores the normal page title after printing. Reassess custom
  naming only if users need application-specific file names often enough to
  justify another decision during export.
- Keep standard print behavior aligned with that export checkpoint: Cmd/Ctrl+P
  now opens the same local review when attention is needed instead of bypassing
  imported-field confirmation or resume checks. Reassess real browser-engine
  PDF fidelity separately from this pre-export safeguard.
- Keep a portable plain-text route alongside PDF export: the reviewed
  ATS-friendly text can now be copied or downloaded as a `.txt` file for
  application portals that accept text uploads. Reassess actual browser-print
  fidelity and import structure before adding new document formats.
- Reduce the repetitive work imposed by application portals that split a
  resume into separate inputs: a local Application Copy view now exposes the
  current profile, summary, role, employer, dates, achievement list, education,
  projects, skills, and custom-section entries as individually copyable values.
  Long values expand in place before copying, so the compact view never leaves
  a person uncertain about which achievement text will go to a portal. It
  mirrors the resume rather than creating a second profile, and keeps the
  existing full-text route for portals that accept one complete paste. Reassess
  whether per-portal persistence is valuable only after this lighter workflow
  no longer covers the repeated-entry friction.
- Meet application portals that explicitly require a Word attachment without
  compromising the local-first promise: a simple editable `.docx` now exports
  the current content, headings, bullets, and safe contact links entirely in
  the browser. It intentionally prioritizes conventional single-column text
  over a pixel-perfect replica of the selected PDF template; reassess richer
  Word styling only if users need it without weakening compatibility.
- Make post-export confidence visible by showing whether the current resume has
  changed since the last PDF export attempt.
- Show a compact field-level summary of what changed since the last export so
  users can recheck edits quickly.
- Make post-export changes easier to audit with concise before/after context
  before the next PDF export, including a full expandable audit trail for dense
  tailoring sessions. Visual output changes—layout, font, color, header, and
  density choices—now appear beside content edits, and the same comparison
  explains conflicting same-browser drafts before a person chooses one.
- Let users keep lightweight browser-only checkpoints so job-specific tailoring
  feels reversible without accounts or cloud storage. When the deliberately
  small local timeline is full, the recommended save route now downloads the
  complete current history before replacing its oldest checkpoint, so a base
  draft is not lost merely because the browser-only convenience limit is met.
- Make saved drafts quick to scan, compare, restore, or undo when users are
  deciding which tailored version to continue.
- Make the master-resume approach practical without turning it into a second
  product: experience and project bullets can now be included or omitted per
  tailored draft without deleting the retained wording. The selected copy is
  used consistently in preview, PDF print, Word, plain text, application copy,
  and checks; editing the full Highlights field intentionally
  restores every bullet. Reassess whether people next need reusable bullet
  variants or whether lightweight checkpoints already cover that workflow.
- Show what changed after restoring a checkpoint so reverting a tailored draft
  still feels reviewable.
- Keep refining mobile and narrow-window editing without compromising the print
  layout. The phone preview now scales the same true Letter-sized page box used
  for PDF export instead of reflowing it to the device width, so line wraps and
  page count remain trustworthy; when browser pagination moves an intact role
  to a fresh page, the live preview now reserves the same whitespace before
  counting pages; screen-only page-boundary guides make the start of each
  additional printed page visible and name the next section or entry before
  export, while print styles keep headings and individual bullets together when
  space allows; the
  phone workspace keeps the form first,
  surfaces a compact next-field
  prompt for imported resumes, and moves the full import checklist, resume checks,
  and version history into on-demand Review tools; reassess whether
  the remaining import-quality explanation or correction context needs more help.
- Preserve an ATS-safe structure while letting people represent the parts of a
  career that do not fit a fixed template: editable section headings, a small
  number of custom repeatable sections, and reversible section/entry ordering
  now cover publications, certifications, volunteer work, and similar content.
  Familiar one-click presets for Certifications, Volunteer Experience,
  Publications, Awards, Languages, and Training now reduce the blank-state
  decision without constraining custom headings. Default sections can now be
  removed with a short Undo window and restored from the same relevant-section
  control; blank titles remain intentionally blank in the preview and text
  export. Reordering uses a single numbered top-to-bottom list with a visible
  drag image and destination state, so the resulting document order is clear.
  Reassess whether users need role-specific examples before adding decorative
  templates or broader layout controls.

## Core Features

- Keep final contact details useful after export: validated email, phone, and website values now remain clickable in the preview and browser-produced PDF, while malformed values stay visibly editable rather than becoming unsafe or misleading links. Reassess PDF annotation fidelity across browser engines separately from the app's semantic link markup.
- Keep final contact details trustworthy: Resume Check now catches obvious
  malformed email, too-short phone, and malformed optional website entries
  locally, while the editor uses browser-friendly contact input types and
  autocomplete hints. Reassess international name/address support only if a
  user need arises; avoid enforcing a country-specific resume format.
- Keep refining Resume Check guidance with more specific recommendations for
  crowded sections and low-evidence resumes; it now prompts for measurable
  scope or results without requiring every bullet to contain a number, with an
  in-context per-entry cue that identifies the bullets to reconsider, and
  gently points out a few generic openings (such as "Responsible for") so users
  can make their own contribution clearer without an AI rewrite. A missing
  summary is now clearly optional rather than an export blocker, and a two-page
  resume is a contextual advisory rather than a failure for experienced
  candidates. It also detects the rare single entry that is taller than one
  printable content area and jumps directly to it before browser printing,
  avoiding a continuation that starts without its role heading. The next
  reassessment should focus on evidence quality and readability over requiring
  conventional filler or arbitrary compression.
- Keep the editor and live resume preview equally reachable on a phone, while
  preserving the fast desktop split workspace and print layout. Avoid putting
  optional review dashboards ahead of the first editable field on a phone.
- Keep high-frequency application-form copying dependable across browser privacy
  settings: explicit copy actions now fall back to the browser's user-gesture
  copy path if modern clipboard permission is unavailable, while all resume
  text remains local. Reassess richer portal-specific workflows only if users
  need more than reliable field-level copying.
- Improve the export checkpoint with more contextual recommendations and
  granular changed-field detail for dense edit sessions.
- Multiple clean text-only templates with consistent ATS-friendly structure.
- Role-specific sample resumes that users can adapt quickly.
- Keep improving PDF and pasted-text import review with clearer confidence
  signals and a better before/after correction flow now that every imported
  entry can be explicitly confirmed, checked against nearby local source
  context, and compared with a source-aware coverage snapshot that identifies
  recognizable core and familiar specialty headings the parser did not populate
  and shows a compact source excerpt for detected sections. Reassess the remaining parsing gaps,
  particularly uncommon header formats, before expanding output formats or
  tailoring automation.
- Make conservative import more forgiving of common visual export styles:
  qualification-style aliases and decorative heading edges (such as em dashes,
  bullets, or rules around a heading) now resolve before parsing, so ordinary
  PDF styling does not turn a whole section into unstructured text. Keep the
  explicit field-by-field review as the safety net; do not infer multi-column
  reading order or arbitrary title-case headings.
- Improve local version history just enough to support tailoring: clear labels,
  simple comparisons, undo paths, and readable restore summaries.
- Keep PDF reconstruction conservative but resilient: tiny baseline differences
  between positioned text fragments now stay on one source line before parsing,
  preventing routine name, heading, and role fragments from being split. Do not
  infer multi-column reading order; retain explicit field-by-field review for
  visually complex source documents.
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
- Make the local-first promise honest when browser storage is blocked or full:
  autosave failures now surface a persistent, actionable warning and a direct
  JSON backup path instead of silently risking a draft on refresh. Reassess
  durable cross-device backup only if it can retain the same privacy posture.
- Keep a deployment-compatible response security baseline for every route: a
  same-origin Content Security Policy, anti-framing, MIME-sniffing, referrer,
  transport, cross-origin isolation, and unused-browser-permission controls
  protect the local workspace without introducing analytics or third-party
  dependencies. The static CSP intentionally retains Next.js-required inline
  script/style support; development alone also permits `unsafe-eval` because
  Next.js needs it to hydrate its development client bundle, while production
  excludes it. Reassess nonce- or SRI-based tightening only if a future
  server-rendering/performance tradeoff is justified and verified.
- Keep sensitive import paths self-contained: the on-demand PDF parser and its
  worker now ship from the app origin rather than a third-party CDN, so the
  user's selected resume never depends on or contacts an external parser host.
- Keep browser-only PDF import forgiving under unusual files: a resume-sized
  10 MiB / 30-page boundary now fails before a large parse with the existing
  paste-text path as recovery. Reassess these limits against real long-form CV
  feedback before changing them.
- Keep local Word import safe to open: the importer now validates a standard
  single-disk `.docx` archive's declared expanded size before decompression,
  avoiding a browser freeze from a highly compressed or unusually complex file.
  It offers copied text as the recovery route rather than attempting ZIP64 or
  multi-disk document reconstruction.
- Continue using zod normalization for imported and saved resume data.
- Keep the dependency graph free of known production advisories. PostCSS is
  explicitly overridden to the patched 8.5.16 release because the currently
  supported Next.js version otherwise pins an affected transitive copy; review
  the override when a compatible Next.js release removes that constraint.
- Keep the release-quality commands dependable: ESLint 9 now loads the
  repository's Next.js rules through a flat-config bridge, and `pnpm lint`
  calls ESLint directly rather than the deprecated Next.js wrapper. The local
  Cloudflare preview runtime is explicitly approved only for its needed
  development postinstall step.
- Introduce react-hook-form when validation becomes field-level and user-facing,
  rather than for simple controlled inputs.
- Continue Playwright coverage for browser-generated PDF pagination, JSON
  import/export, and mobile layout checks.
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
- Reassess additional keyboard shortcuts only where they save a repeated action
  without conflicting with ordinary text entry or browser shortcuts. Focused
  editor shortcuts now add an entry and move an entry or section, while the
  visible controls remain the primary path for touch and discoverability.
- Theme controls limited to typography and spacing, not decorative templates.

## Future Ideas

- Reassess phrase-level job-description comparison only after import-review
  completion and first-use confidence are demonstrably strong.
- Guided bullet rewrites that keep user data private.
- Recruiter-readability checks based on structure rather than opaque scores.
