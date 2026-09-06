# PrivaCV repository audit — September 5, 2026

The most important problems are data durability and concurrent editing. The primary resume export path performed well in the checks run. The interface already has a coherent shared style; targeted layout and workflow changes offer more value than a wholesale redesign.

The findings below record the original audit. A subsequent implementation pass fixed all five confirmed logic defects and the three concrete visual defects. Regression coverage now checks cross-tab resume duplication, immediate navigation and reload, recovery of an interrupted database write, JSON rejection, concurrent application edits, and mobile notification placement. Verification: 225 unit tests and 136 Chromium browser tests passed; type checking, lint, and the production build passed. Changed files pass formatting checks; the repository-wide formatter still reports pre-existing issues in untouched files. Feature suggestions remain proposals.

## Scope and verification

Reviewed resume creation, duplication, switching, autosave, JSON import, import recovery, checkpoints, preview/export coordination, application creation and editing, resume attachment snapshots, status history, insights, and shared UI. Exercised isolated browser contexts with synthetic data.

- Type checking: passed.
- Lint: passed.
- Unit tests: 218 passed across 23 files.
- Existing focused Chromium coverage: 31 passed, 1 failed across application workflows, resume editing/export, and IndexedDB migration.
- Seven temporary audit probes completed: they reproduced the findings below and captured UI evidence. These probes intentionally observed current defective behavior; they are not regression tests asserting corrected behavior.
- Visual inspection: desktop at 1280 × 720 and phone at 390 × 844, with light and dark theme coverage. Fresh phone contexts confirmed the notification overlap.
- Not exhaustively tested: production build/deployment, packaged Electron, Safari/Firefox, every PDF/DOCX import variant, device handoff, and downloaded AI models.

Audit probe source is preserved as [reproduction.spec.ts.txt](<C:/Users/MSI All Black/.codex/visualizations/2026/09/05/01a0723e-f937-77a0-a06d-8e2f27d9cf6d/repo-audit/reproduction.spec.ts.txt>). Its relative imports assume it is run from the repository's tests directory. The temporary test file was removed from the repo after the audit.

## Confirmed logic findings

### 1. P1 — A stale tab can delete other resumes from the library

**Reproduction:** Open the same saved resume in two tabs. Duplicate it in tab B and confirm two resume records exist in IndexedDB. Edit the original's name in tab A. After autosave, IndexedDB contains only one record: tab B's duplicate is gone.

**Cause:** [saveResumeLibrary](<C:/Users/MSI All Black/Documents/GitHub/PrivaCV/lib/resume-db.ts:274>) clears the entire resumes store and repopulates it from that tab's in-memory array. The [cross-tab listener](<C:/Users/MSI All Black/Documents/GitHub/PrivaCV/features/resume/hooks/use-resume-persistence.ts:204>) watches only the active draft key and compares content fingerprints. Duplicating a resume without changing its content does not trigger the draft-conflict warning, and the library itself is not refreshed.

**Fix:** Save individual records rather than replacing the whole library. Broadcast successful commits with resume IDs and revisions; merge unrelated changes and detect conflicts on the same record. Apply equivalent protections to checkpoint history, which also uses whole-store replacement.

**Acceptance:** Creating, duplicating, renaming, or deleting in one tab cannot be silently undone by another tab saving an unrelated resume.

### 2. P1 — Reloading or leaving during the autosave delay discards the last edit

**Reproduction:** Change Full Name to “Final Edit Before Reload” and immediately reload. The input returns to “John Doe.”

**Cause:** [the persistence effect](<C:/Users/MSI All Black/Documents/GitHub/PrivaCV/features/resume/hooks/use-resume-persistence.ts:235>) defers all persistence by 400 ms, and its cleanup clears the timer. There is no navigation flush, page lifecycle recovery write, or pending-change guard. The shared workspace switcher can unmount the editor during that window.

**Fix:** Keep a current pending draft at a persistence boundary that survives view changes. Flush and await it before internal navigation; provide a synchronous recovery mechanism for page exits and reconcile it on hydration. Do not rely on an asynchronous IndexedDB write started during unload completing successfully.

**Acceptance:** A quick workspace switch, reload, or close/reopen preserves the final edit, or clearly warns when it cannot.

### 3. P2 — Saving an application can silently revert another tab's status change

**Reproduction:** Open the Aster Cloud application in two tabs. Edit Notes in tab A. Change Interviewing to Offer and save in tab B. Save Notes in tab A. The stored status reverts to Interviewing.

**Cause:** [the detail form](<C:/Users/MSI All Black/Documents/GitHub/PrivaCV/features/applications/components/application-components.tsx:833>) deliberately ignores refreshes for an already-open application to protect local edits. However, [saveApplication](<C:/Users/MSI All Black/Documents/GitHub/PrivaCV/features/applications/components/job-pipeline.tsx:181>) submits every form field, including stale untouched fields. The persistence layer accepts the stale status and records another transition.

**Fix:** Track dirty fields and submit only changes. Compare a base revision when saving; merge non-overlapping edits and show conflicts for overlapping fields. Perform database read/merge/write inside one readwrite transaction, since the current [database update](<C:/Users/MSI All Black/Documents/GitHub/PrivaCV/lib/job-application-db.ts:195>) reads and writes in separate transactions.

**Acceptance:** Editing Notes cannot undo a status update made elsewhere, and genuinely competing status edits are surfaced.

### 4. P2 — Any parseable JSON can replace the current resume with a blank one

**Reproduction:** Use Open saved JSON to import settings.json containing `{"unrelated":true}`. The app reports “Loaded JSON” and persists an empty resume in place of the current one.

**Cause:** [openJson](<C:/Users/MSI All Black/Documents/GitHub/PrivaCV/features/resume/hooks/use-resume-import.ts:60>) uses the permissive [normalizer](<C:/Users/MSI All Black/Documents/GitHub/PrivaCV/lib/resume.ts:912>) as its import validator. Missing fields become defaults, so an unrelated object is accepted.

**Fix:** Validate the input as a supported resume or legacy resume shape before normalization and before replacing the current state. Reject unrelated JSON without mutating the draft. Use normalization afterward for compatible missing fields.

Recovery/checkpoint mechanisms reduce the severity, but users should not need recovery after accidentally choosing the wrong JSON file.

### 5. P2 — Offer conversion can exceed 100%

**Reproduction:** Two submitted applications have offers, but only one has a recorded Interviewing stage. Insights computes `2 / 1 = 200%`. This is reachable when users move directly from Applied to Offer for one application.

**Cause:** [buildJobInsights](<C:/Users/MSI All Black/Documents/GitHub/PrivaCV/lib/job-insights.ts:111>) counts all offers in the numerator and only explicitly recorded interviews in the denominator at [the rate calculation](<C:/Users/MSI All Black/Documents/GitHub/PrivaCV/lib/job-insights.ts:135>). These are different populations.

**Fix:** Define the metric precisely. For interview-to-offer conversion, count offers among the interviewed population; keep total offers as a separate count. Alternatively label and calculate an application-to-offer rate. Clamping the number to 100% would hide the underlying problem.

## Visual findings and design improvements

### P2 — Notifications cover mobile navigation and dialog actions

A freshly loaded 390 × 844 context showed the “Loaded 13 sample applications” toast covering the bottom navigation. Opening an application while the toast remains also covers Cancel and Save changes.

Evidence: [mobile navigation overlap](<C:/Users/MSI All Black/.codex/visualizations/2026/09/05/01a0723e-f937-77a0-a06d-8e2f27d9cf6d/repo-audit/audit/fresh-mobile-toast.png>), [mobile action overlap](<C:/Users/MSI All Black/.codex/visualizations/2026/09/05/01a0723e-f937-77a0-a06d-8e2f27d9cf6d/repo-audit/audit/fresh-mobile-detail.png>).

The global [bottom-center toaster](<C:/Users/MSI All Black/Documents/GitHub/PrivaCV/app/layout.tsx:148>) has no offset for the mobile navigation or dialog footer. Reserve a shared bottom action-area height and position notifications above it, including safe-area insets. The Next.js development badge also appears in screenshots; it is not being treated as a production defect.

### P3 — The activity title input is too narrow on desktop

The application detail view reserves 18rem for Activity, then adds sidebar padding, composer padding, and a fixed 7rem type selector. At 1280px, the remaining title field shows only a fragment of its placeholder and very little entered text.

Evidence: [desktop detail layout](<C:/Users/MSI All Black/.codex/visualizations/2026/09/05/01a0723e-f937-77a0-a06d-8e2f27d9cf6d/repo-audit/audit/detail-desktop-light.png>). Relevant code: [sidebar columns](<C:/Users/MSI All Black/Documents/GitHub/PrivaCV/features/applications/components/application-components.tsx:921>) and [composer grid](<C:/Users/MSI All Black/Documents/GitHub/PrivaCV/features/applications/components/application-components.tsx:595>).

Stack the activity type and full-width title at this sidebar width. Use container-based breakpoints so the composer only becomes two columns when it has enough room. Keep the title label visible.

### P3 — Phone summary labels are truncated before users can read them

The horizontal metric strip shows “Interview...” and only part of the next metric at 390px, while the list itself has enough space for complete labels. This is an information-density issue, not page-wide overflow.

Evidence: [phone metrics](<C:/Users/MSI All Black/.codex/visualizations/2026/09/05/01a0723e-f937-77a0-a06d-8e2f27d9cf6d/repo-audit/audit/fresh-mobile-toast.png>). Source: [summary strip](<C:/Users/MSI All Black/Documents/GitHub/PrivaCV/features/applications/components/job-pipeline.tsx:391>).

Prefer a compact two-column summary, or show just Active and Due today with an explicit expandable summary. If retaining the horizontal strip, allow adequate intrinsic label width and make scrolling discoverable.

### Other design priorities

- Make the two workspaces feel like one workflow: expose a clear “Tailor resume” action within an application and show the target company/role while editing.
- Split application details into Overview, Materials, and Activity on phones. Keep Save visible; avoid making users scroll through every optional field to reach their timeline.
- Distinguish “Working resume” from “Submitted copy.” Selecting “No resume attached” currently clears the working link but retains the historical submitted snapshot. Retaining history is useful; the UI should make that distinction explicit.
- Retain the existing shared tokens and primitives. Stable light/dark captures showed consistent surfaces, borders, and controls; the most valuable changes concern density, hierarchy, and action placement.

Stable desktop overview: [light applications board](<C:/Users/MSI All Black/.codex/visualizations/2026/09/05/01a0723e-f937-77a0-a06d-8e2f27d9cf6d/repo-audit/audit/board-desktop-light.png>). Resume workspace: [dark resume editor](<C:/Users/MSI All Black/.codex/visualizations/2026/09/05/01a0723e-f937-77a0-a06d-8e2f27d9cf6d/repo-audit/audit/resume-desktop-dark.png>).

## Test reliability finding

The existing lifecycle test fails at [the fixed calendar date](<C:/Users/MSI All Black/Documents/GitHub/PrivaCV/tests/job-pipeline.spec.ts:239>) because it attempts to click “Saturday, July 25, 2026” without navigating the calendar to July. During this audit the calendar opens in September.

Freeze the browser clock for this test or explicitly navigate to the target month. This failure is test drift, not evidence that creating applications or selecting valid dates is broken.

Add meaningful regressions for the five logic findings and the mobile toast overlap. Existing export checks already give useful coverage of Letter geometry, preview page count, shrink/reflow behavior, clickable PDF contacts, and design-panel exclusion.

## Highest-value feature improvements

| Priority | Improvement                             | Concrete user benefit                                                                                                                                                    | Existing foundation                                                                                 |
| -------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 1        | Tailor a resume from an application     | One action duplicates a chosen base resume, links it to the role, and opens the editor with the saved job description ready for review.                                  | Resume duplication, application resume links, job-description snapshots, local job-match utilities. |
| 2        | Submission review and materials archive | “Mark submitted” lets users verify the exact resume, record the actual submission date, and later preview/download that immutable copy without replacing the live draft. | Existing snapshot data and PDF/DOCX/text exporters.                                                 |
| 3        | One-file whole-workspace backup         | Back up every resume, each resume's checkpoints, applications, events, and snapshots together; preview the restore before merging. Show the last successful backup date. | Separate storage adapters, checkpoint backups, pipeline backup parsing.                             |
| 4        | Faster, safer application capture       | Start with company and role; warn on likely duplicate company/role/URL combinations, and support recording existing applications with their actual submission date.      | Existing create dialog, search fields, status metadata, and insights.                               |

Recommended sequence: address the two resume data-loss cases first, then application conflict handling and JSON validation, then mobile action obstruction and metric correctness. Build the application-to-resume tailoring flow after those foundations are reliable.
