# Agent Log

## 2026-07-09 14:29 PDT

- User problem addressed: a checkpoint backup larger than the browser&apos;s
  five-version history was silently truncated before the import review could
  show which tailored drafts would remain only in the backup.
- Implementation: preserved every valid backup checkpoint through parsing,
  then let the existing merge sort, deduplicate, retain the newest local
  drafts, and name all overflow drafts; constrained the incoming-draft list so
  a large backup remains scannable. Added an explicit App Router not-found
  page after production verification exposed the missing fallback route.
- UI components or patterns used: existing shadcn/ui-style Dialog, Alert,
  Badge, and Button patterns with History and AlertCircle icons; a simple
  responsive fallback surface for invalid links.
- Why it matters: job seekers can move or recover a larger archive without
  falsely believing older role-specific drafts disappeared; they can also
  return safely to their locally saved work from an invalid URL.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, `CI=true pnpm build`, and
  `git diff --check`. Added Playwright coverage for a seven-checkpoint backup
  merged with an existing local draft.
- Future opportunities: let people selectively choose which overflow drafts to
  keep locally when importing a large archive.

## 2026-07-09 13:29 PDT

- User problem addressed: importing a backup containing a draft already saved
  in the browser looked like it would add a new checkpoint, making a safe merge
  needlessly ambiguous.
- Implementation: made the merge helper identify incoming fingerprints already
  saved locally, preserved those local versions, added a dedicated overlap
  review with draft names, and made both the readiness count and completion
  toast report only genuinely new checkpoints.
- UI components or patterns used: existing shadcn/ui-style Dialog, Alert,
  Badge, and Button patterns with the existing History and Check icons.
- Why it matters: job seekers can import a backup confidently, knowing exactly
  which tailored drafts are already protected without consuming another one of
  the five local slots.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, `CI=true pnpm build`, and
  `git diff --check`. Added Playwright coverage for an all-matching backup.
- Future opportunities: distinguish imported overflow from an existing local
  draft pushed outside the five-checkpoint capacity during a large merge.

## 2026-07-09 12:29 PDT

- User problem addressed: importing a checkpoint backup into a browser that
  already held local drafts reported only the final count, leaving people unsure
  which older tailored versions would not fit in the five-checkpoint history.
- Implementation: changed backup-merge results to retain both browser-kept and
  overflow checkpoints, then added an amber import-review callout that names
  every older draft which remains only in the backup file.
- UI components or patterns used: existing shadcn/ui-style Dialog, Alert,
  Badge, and Button patterns with the existing History and AlertCircle icons.
- Why it matters: job seekers can confirm a merge without accidentally
  assuming every tailored draft has moved into the new browser, while keeping
  the current resume untouched.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
  Added Playwright coverage for the explicit overflow-draft list.
- Future opportunities: make overlapping checkpoint backups easier to audit by
  calling out deduplicated drafts before a merge.

## 2026-07-09 11:29 PDT

- User problem addressed: tailored checkpoint history lived only in one browser,
  so clearing browser data or moving devices could erase multiple role-specific
  drafts even when the current resume had been saved as JSON.
- Implementation: added portable checkpoint-history JSON backups, a safe import
  review that merges unique checkpoints while keeping the current resume open,
  first-run access to restore a backup, and corrected full-history guidance to
  point users to the new backup action.
- UI components or patterns used: shadcn/ui-style Card, Alert, Badge, Dialog,
  and Button patterns with existing lucide Download, Upload, and History icons.
- Why it matters: job seekers can archive or move named local tailoring drafts
  without creating an account or uploading resume data, while still seeing the
  five-checkpoint browser limit before importing.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
  Added browser coverage for importing a checkpoint backup into a clean local
  workspace without replacing the current resume.
- Future opportunities: explain exactly which older checkpoints fall outside
  the five-slot browser limit when a large backup is merged.

## 2026-07-09 10:31 PDT

- User problem addressed: the five-checkpoint local version history silently
  replaced the oldest unique draft when saving a sixth checkpoint, which could
  surprise users tailoring resumes across several applications.
- Implementation: added a reusable replacement-candidate helper, surfaced
  version-history capacity in the saved checkpoint card, warned in the save
  dialog before a full history replaces the oldest draft, clarified matching
  checkpoint refreshes, and changed the save toast to name replaced drafts.
- UI components or patterns used: shadcn/ui-style Card, Alert, Badge, and Button
  patterns with lucide Save, History, and AlertCircle icons.
- Why it matters: job seekers can keep experimenting locally without mistaking
  a fixed browser-only history limit for unlimited storage.
- Verification: ran `node_modules/.bin/tsc --noEmit`,
  `node_modules/.bin/next lint`, `node_modules/.bin/vitest run`,
  `CI=true node_modules/.bin/playwright test`, and
  `node_modules/.bin/next build`. Plain `pnpm` script execution was blocked by
  the current minimum-release-age policy for existing lockfile entries, so the
  project binaries were used after a frozen local install with that policy
  disabled for installation only.
- Future opportunities: add a one-click JSON bundle export for all saved local
  checkpoints before users clean up a full version history.

## 2026-07-09 09:29 PDT

- User problem addressed: deleting a browser-only saved checkpoint was a
  permanent one-click action, which is risky when a tailored resume draft may
  not exist anywhere else.
- Implementation: added a transient deleted-checkpoint notice inside version
  history, preserved the removed version in memory, and wired Undo delete plus
  Dismiss actions without changing the localStorage schema.
- UI components or patterns used: shadcn/ui-style Card, Badge, and Button
  patterns with the existing lucide Undo2 icon in the version history surface.
- Why it matters: job seekers can clean up local tailoring drafts without fear
  of losing the wrong checkpoint during a high-pressure application session.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm build`, and `CI=true pnpm test:e2e`.
- Future opportunities: add clearer capacity cues before saving a sixth
  checkpoint replaces the oldest local version.

## 2026-07-09 08:28 PDT

- User problem addressed: version history could show lineage and changed-area
  counts, but users with several tailored drafts still had to decide manually
  which saved checkpoint to compare first.
- Implementation: added a suggested checkpoint panel that identifies the
  closest saved draft with nonzero differences from the current resume, reuses
  existing export-change summaries, and opens the saved-vs-current comparison
  from a prominent Review differences action.
- UI components or patterns used: shadcn/ui-style Card, Badge, and Button
  patterns with the existing lucide Eye icon inside the version history surface.
- Why it matters: job seekers can get to the most relevant local draft faster
  when auditing job-specific tailoring, without reading every checkpoint card.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
  The first Playwright run caught an ambiguous changed-area locator after the
  suggested badge duplicated the existing count; the assertion was scoped and
  the suite passed.
- Future opportunities: use checkpoint lineage as an additional ranking signal
  when the closest changed-area count ties across several saved drafts.

## 2026-07-09 07:28 PDT

- User problem addressed: saved checkpoints showed contents and differences, but
  tailored drafts still lacked a clear cue for which baseline or prior draft they
  came from.
- Implementation: added optional derived-from metadata to local version history,
  tracked the active saved checkpoint while users tailor or restore drafts, and
  rendered a compact lineage row in saved checkpoint cards.
- UI components or patterns used: shadcn/ui-style Card, Badge, and Button
  patterns with the lucide GitBranch icon inside the existing version history
  surface.
- Why it matters: job seekers can keep several role-specific drafts and quickly
  understand which ones branch from a strong baseline without opening every
  comparison dialog.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
- Future opportunities: suggest the most relevant saved checkpoint to compare
  against when several tailored drafts are present.

## 2026-07-09 06:29 PDT

- User problem addressed: saved checkpoints could be named and compared, but
  the history list still made users open actions before they could understand
  what each draft contained or whether it differed from the current resume.
- Implementation: added checkpoint headline text, content-count badges for
  roles, education, projects, and skill lines, plus a current/different-area
  status badge computed from the existing export change summary.
- UI components or patterns used: shadcn/ui-style Card, Badge, and Button
  patterns with the existing lucide History, Eye, Undo2, and Trash2 actions.
- Why it matters: job seekers can scan local tailoring drafts faster and choose
  the right checkpoint to compare or restore without rereading every note.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
  The first Playwright run exposed an ambiguous test locator, and the first
  parallel build collided with the dev server's generated `.next` output; both
  checks passed after fixing the locator and rerunning the build in isolation.
- Future opportunities: suggest the most relevant saved checkpoint to compare
  against when several tailored drafts are present.

## 2026-07-09 05:27 PDT

- User problem addressed: dense tailoring sessions could produce more than four
  changed resume areas, but the last-export and restored-checkpoint panels only
  showed the first four.
- Implementation: added a reusable expandable change-summary grid that keeps
  the compact four-item preview, shows how many changes are hidden, and expands
  to the full audit trail for export and restore summaries.
- UI components or patterns used: shadcn/ui-style Card, Button, Alert, and
  Badge patterns with lucide History, ArrowRight, ChevronDown, and ChevronUp
  icons.
- Why it matters: job seekers can make broader role-specific edits and still
  verify every changed section before exporting or after restoring a saved
  checkpoint.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
  The first Playwright run caught an incorrect expected diff count in the new
  regression test; the assertion was corrected and the suite passed.
- Future opportunities: improve scan hierarchy for large diffs with grouped
  section headings or severity cues.

## 2026-07-09 04:28 PDT

- User problem addressed: restoring a saved resume checkpoint changed the live
  draft immediately, but users did not get a visible summary of what changed
  after the restore.
- Implementation: added a transient restored-checkpoint audit panel that appears
  after restoring a saved version, reuses the existing export comparison rows,
  labels snippets as Before/Restored, jumps back to affected fields, and clears
  itself when another high-risk load replaces the resume.
- UI components or patterns used: shadcn/ui-style Card, Button, Alert, Badge
  through reused comparison rows, plus lucide Undo2, History, ArrowRight, and
  Check icons.
- Why it matters: job seekers can revive an older tailored draft and immediately
  verify the practical differences without reopening the compare dialog or
  manually rereading the whole resume.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
- Future opportunities: expand the restored-checkpoint panel into a full
  scrollable diff when more than four areas changed.

## 2026-07-09 03:30 PDT

- User problem addressed: users could compare a saved checkpoint with the
  current draft, but not inspect how two saved job-specific drafts differed
  before deciding which one to restore.
- Implementation: added a compact saved-checkpoint comparison picker to the
  version history card, introduced saved-vs-saved dialog copy and labels, and
  preserved field-jump behavior only for saved-vs-current comparisons where the
  current editor can be focused.
- UI components or patterns used: shadcn/ui-style Card, Button, Dialog, Badge,
  and native select controls styled with the local input treatment, plus lucide
  History, Eye, Undo2, and ArrowRight icons.
- Why it matters: job seekers can keep several local tailoring drafts and audit
  their differences without changing the live resume or guessing from notes.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
- Future opportunities: make version history feel more like lightweight
  branching by surfacing recommended restore choices and clearer draft lineage.

## 2026-07-09 02:30 PDT

- User problem addressed: checkpoint comparison showed changed resume areas, but
  users still had to infer which exact fields changed inside dense sections.
- Implementation: added field-level labels to export and version comparison
  summaries, including contact fields and repeatable experience, education, and
  project entry fields; rendered the labels as compact shadcn/ui-style badges
  in the last-export and saved-checkpoint comparison cards.
- UI components or patterns used: shadcn/ui-style Badge chips inside existing
  Card/Dialog comparison rows, with lucide History and ArrowRight actions
  preserved.
- Why it matters: job seekers tailoring a resume for a role can audit precise
  edits faster before exporting or restoring a saved draft.
- Verification: ran `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm test:e2e`, and `pnpm build`. Initial test runs exposed a target
  selection bug and ambiguous Playwright locators; both were fixed and the full
  suite passed.
- Future opportunities: compare two saved checkpoints directly without using
  the current resume as one side.

## 2026-07-09 01:28 PDT

- User problem addressed: saved resume checkpoints could be restored, but users
  still had to guess what would change before going back to an older draft.
- Implementation: added a Compare action to local version history, opened a
  saved-vs-current comparison dialog with changed areas and saved/current
  snippets, wired changed rows to jump back to the relevant editor field, and
  preserved a direct restore path from the dialog.
- UI components or patterns used: shadcn/ui-style Dialog, Card, Alert, and
  Button primitives with lucide History, Eye, ArrowRight, and Undo2 icons.
- Why it matters: job seekers can tailor a resume for a role, inspect exactly
  how it diverges from a saved baseline, and restore with confidence if the
  current draft is worse.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
- Future opportunities: add exact changed field names inside repeatable entries
  and compare two saved checkpoints without using the current resume as one
  side.

## 2026-07-09 00:27 PDT

- User problem addressed: saved resume versions were useful, but generic labels
  made it hard to remember which checkpoint belonged to a job or tailoring
  moment.
- Implementation: changed Save version into a naming dialog with an editable
  checkpoint name and optional note, persisted notes in localStorage while
  preserving older saved versions, and rendered notes inside the version
  history list.
- UI components or patterns used: shadcn/ui-style Dialog, Input, Textarea,
  Button, and Card patterns with lucide Save, History, Undo2, and Trash2 icons.
- Why it matters: job seekers can keep several local drafts and restore the
  right one later without guessing from timestamps alone.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
- Future opportunities: add a compact compare view between saved checkpoints and
  the current resume.

## 2026-07-08 23:28 PDT

- User problem addressed: job seekers tailoring a resume for different roles
  needed more than a one-step undo when experimenting with edits.
- Implementation: added a browser-only version history that saves up to five
  resume checkpoints, persists them in localStorage, restores a selected
  checkpoint, and lets users delete old checkpoints.
- UI components or patterns used: shadcn/ui-style Card and Button primitives
  with lucide Save, History, Undo2, and Trash2 icons in a compact action list.
- Why it matters: users can adapt a strong draft for a specific application and
  still return to the original without accounts, cloud sync, or manual JSON
  files.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
- Future opportunities: add user-editable checkpoint names, notes, and a compact
  compare view between saved versions.

## 2026-07-08 22:27 PDT

- User problem addressed: after seeing that a resume changed since the last PDF
  export, users still had to hunt through edited sections to remember what
  actually changed.
- Implementation: expanded export change summaries with compact before/after
  snippets for header, summary, repeatable sections, and skills, then rendered
  those snippets in the last-export status cards.
- UI components or patterns used: shadcn/ui-style Card and bordered action rows
  with lucide History and ArrowRight icons, keeping the jump-to-field behavior.
- Why it matters: job seekers can quickly audit targeted edits before exporting
  the next PDF, which makes last-minute application tailoring feel safer.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
  Two initial Playwright runs exposed ambiguous assertions in the new browser
  coverage; the locators were scoped to the summary change card and the suite
  passed.
- Future opportunities: surface exact changed field names inside edited
  repeatable sections and add a compact full diff dialog for larger revisions.

## 2026-07-08 21:28 PDT

- User problem addressed: after editing a resume post-export, users could see
  that the resume changed but not which areas needed a final recheck.
- Implementation: stored a normalized export snapshot with each print attempt,
  added a resume helper that summarizes changed header, summary, section,
  skills, section-order, and text-size areas, and rendered jumpable change cards
  in the last-export status panel.
- UI components or patterns used: shadcn/ui-style Card, Button-like bordered
  action rows, focusable section-order controls, and lucide History and
  ArrowRight icons.
- Why it matters: job seekers can make targeted edits for a role and quickly
  verify the exact areas that changed before exporting the next PDF.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
- Future opportunities: expand the diff into exact field names and before/after
  snippets for dense edit sessions.

## 2026-07-08 20:30 PDT

- User problem addressed: after opening the print dialog, users had no local
  signal showing whether later edits still matched the PDF they last exported.
- Implementation: added a deterministic resume export fingerprint, stored a
  local last-export checkpoint when printing starts, and rendered a compact
  status card that shows whether the current resume matches or has changed
  since that export attempt.
- UI components or patterns used: shadcn/ui-style Card, Button, and
  CardDescription patterns with lucide FileCheck2, History, and Printer icons.
- Why it matters: job seekers can return to the editor, make targeted tweaks,
  and immediately know whether they need to export an updated PDF before
  applying.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
  An initial parallel build/e2e attempt hit the known `.next` collision; the
  isolated production build and isolated Playwright run passed.
- Future opportunities: show a concise field-level diff for what changed since
  the last export, starting with summary, contact, text size, and section order.

## 2026-07-08 18:27 PDT

- User problem addressed: users could open the print dialog while resume checks
  or PDF-import review items were still unresolved, making the final export feel
  too easy to do accidentally.
- Implementation: added an export checkpoint dialog that appears before printing
  when checks fail or a PDF import still needs review, lists the exact issues,
  jumps back to the relevant field, allows marking PDF import review complete,
  and preserves an explicit Export Anyway path.
- UI components or patterns used: shadcn/ui-style Dialog, Button, Badge, and
  Alert primitives with lucide Printer, Eye, Check, and ArrowRight icons.
- Why it matters: job seekers get one last local confidence pass before
  creating a PDF, without blocking people who already reviewed their resume.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`. An
  initial e2e run failed because the test locator matched both the editor and
  dialog guidance; the assertion was scoped to the dialog and the suite passed.
- Future opportunities: add a compact post-export state marker so future runs
  can show what changed since the last successful PDF export.

## 2026-07-08 17:28 PDT

- User problem addressed: high-risk actions such as importing a PDF, opening
  JSON, loading the sample, or clearing the editor could replace a resume with
  no in-app recovery path.
- Implementation: added a session-local restore point that captures the
  previous resume and import-review state before those actions, shows a compact
  recovery card, and restores the prior version in one click.
- UI components or patterns used: shadcn/ui-style Card and Button primitives
  with a lucide Undo2 icon and concise recovery copy.
- Why it matters: job seekers can experiment with imports and reset flows
  without worrying that a mistake will wipe work they were actively editing.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
- Future opportunities: turn the one-step recovery point into named local-only
  version history once users need deeper save states.

## 2026-07-08 16:30 PDT

- User problem addressed: PDF import still felt risky because the app replaced
  the resume immediately and only used a toast to ask users to review the
  parsed result.
- Implementation: added a dismissible PDF Import Review panel after successful
  imports, summarized the detected sections, provided jump buttons for fields
  that PDF parsing commonly guesses, and visually highlighted those editor
  fields until the review is marked done or another source is loaded.
- UI components or patterns used: shadcn/ui-style Card, Button, Badge, Input,
  and Textarea primitives with lucide Eye, ArrowRight, and Check icons.
- Why it matters: job seekers can keep the fast PDF-start workflow while getting
  a clearer, field-level safety pass before exporting or copying content.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
- Future opportunities: add parser confidence levels and a side-by-side raw text
  review for imported PDFs.

## 2026-07-08 15:28 PDT

- User problem addressed: resume warnings could jump users to a field, but they
  still did not explain why a fix mattered or whether the resume had enough
  substance.
- Implementation: added guidance text to every Resume Check, introduced a local
  density check for sparse or crowded resumes, and rendered failed checks as
  compact coaching cards before the existing jump action.
- UI components or patterns used: shadcn/ui-style Button actions and the
  existing Resume Check card grid, with concise inline guidance and lucide
  ArrowRight actions.
- Why it matters: job seekers get a clearer next step and a short rationale
  without leaving the editor or sending private resume data anywhere.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
  The first build was run concurrently with Playwright and hit the known
  `.next` collision; the isolated production build passed.
- Future opportunities: add visual highlighting for the exact imported fields
  that need review after PDF parsing.

## 2026-07-08 14:29 PDT

- User problem addressed: resume warnings told users what was wrong but left
  them to hunt through the editor for the field that fixes each issue.
- Implementation: added target metadata to each Resume Check, wired failed
  checks to compact action buttons, assigned stable IDs to editor controls, and
  focused the relevant field or control from each warning.
- UI components or patterns used: shadcn/ui-style Button actions inside the
  existing Resume Check card, lucide ArrowRight icons, and accessible focus on
  native inputs and textareas.
- Why it matters: export-readiness feedback now turns into an immediate next
  step, reducing friction for job seekers polishing a resume under time
  pressure.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
  An initial concurrent build/e2e run failed because both commands touched
  `.next`; the isolated production build passed.
- Future opportunities: add short inline guidance explaining why each warning
  matters and expand checks for dense sections.

## 2026-07-08 13:37 PDT

- User problem addressed: the project needed to move from a handcrafted static
  app to the required modern consumer web stack without losing the existing
  resume editing workflow.
- Implementation: migrated the app to Next.js App Router, TypeScript, React,
  Tailwind CSS, pnpm, zod normalization, lucide icons, Radix-backed dialog
  primitives, and local shadcn/ui-style components; ported autosave, JSON
  import/export, PDF import, resume checks, text review, and print export into
  typed React code; removed obsolete static entry files.
- UI components or patterns used: shadcn/ui-style Button, Input, Textarea, Card,
  Badge, Alert, and Dialog primitives with Tailwind utility styling.
- Why it matters: the product now has a maintainable, type-safe foundation that
  can grow into a polished consumer app while staying local-first and inexpensive
  to run.
- Verification: ran `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm test:e2e`, `pnpm build`, started
  `pnpm dev --hostname 127.0.0.1 --port 3000`, and confirmed the local app
  returns HTTP 200.
- Future opportunities: expand Playwright coverage and improve Resume Check
  warnings with field-specific jump targets.

## 2026-07-08 10:29 PDT

- User problem addressed: first-time users need immediate confidence that the editor is private, free to export from, and useful before entering lots of data.
- Implementation: added a first-run start panel with PDF import, sample, and JSON-open actions; replaced the blank preview with a realistic resume blueprint; added responsive layout rules for narrower screens; created the product roadmap.
- Why it matters: job seekers are especially sensitive to surprise paywalls, unclear exports, and wasted data entry. The first screen now answers those concerns and gives three fast starting paths.
- Verification: ran `node --check app.js`, `node --check pdf-import.js`,
  `python3 -m py_compile server.py`, and a local Chrome/Playwright flow for the
  empty start panel, sample loading path, and mobile viewport width.
- Future opportunities: add fit guidance for page count, missing contact details, and long bullets.

## 2026-07-08 11:29 PDT

- User problem addressed: resume builders often leave users unsure whether their resume is export-ready until after they open the print dialog or review the PDF manually.
- Implementation: added a live Resume Check panel that scores length, core contact details, bullet length, and summary focus; wired it to the measured preview page count so the length signal matches the exported PDF; added responsive styling and updated the README/roadmap.
- Why it matters: job seekers get immediate, local feedback about obvious issues before exporting, reducing second-guessing and rework.
- Verification: ran `node --check app.js`, `node --check pdf-import.js`, `python3 -m py_compile server.py`, and a local Chrome/Playwright flow covering the empty state, sample resume `4/4` score, long-summary warning, and 390px mobile layout.
- Future opportunities: add dense-section warnings, field-specific jump targets from each check, and a review mode for uncertain PDF-imported fields.

## 2026-07-08 12:58 PDT

- User problem addressed: job seekers often need a plain-text version of the same resume for ATS sanity checks, recruiter portals, and application forms after polishing the PDF.
- Implementation: added a top-bar Copy Text action and a deterministic plain-text renderer that follows the current section order, includes standard headings, preserves contact details, and converts bullets to simple hyphen lines.
- Why it matters: users can reuse their resume content without retyping or trusting hidden parser behavior, reinforcing the product's privacy-first, no-paywall export promise.
- Verification: ran `node --check app.js`, `node --check pdf-import.js`, `python3 -m py_compile server.py`, and a bundled Playwright flow covering empty start state, sample loading, `4/4` resume check, Copy Text clipboard contents, section order, and 390px mobile app-bar fit.
- Future opportunities: add a plain-text review drawer so users can inspect the exact copied text before sending it.

## 2026-07-08 13:24 PDT

- User problem addressed: job seekers should not have to trust an invisible clipboard action before pasting resume text into applicant tracking systems or recruiter portals.
- Implementation: replaced the top-bar blind copy action with a reviewable plain-text dialog that shows the exact export text, word/line counts, and a focused copy action while reusing the existing plain-text renderer.
- Why it matters: users can spot formatting issues before sending applications, making the privacy-first export workflow feel more transparent and trustworthy.
- Verification: ran `node --check app.js`, `node --check pdf-import.js`, `python3 -m py_compile server.py`, and a temporary Playwright/Chrome flow covering sample loading, the Review Text dialog, copy parity with the reviewed text, dialog closing, and 390px mobile dialog bounds.
- Future opportunities: add field-specific jump targets from Resume Check warnings and a review mode for uncertain PDF-imported fields.
