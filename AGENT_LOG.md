# Agent Log

## 2026-07-12

- Market and product review: current Rezi and Teal feedback continues to make
  a dependable final artifact central; recent public reports specifically
  describe paging surprises as frustrating even when an editor appears to fit
  the resume. The product already shows true Letter boundaries, but a plain
  “Page 2 begins” line still made a person scan around to discover which
  section or role needed their attention.
- Options considered: refine the PDF parser, add another writing heuristic, or
  make the existing page-boundary cue actionable. Naming the next content won
  because it improves the last-mile review without guessing at a person's
  experience, changing the document, or adding export friction.
- Implementation: live page guides now identify the next section, entry, or
  summary at each additional Letter boundary. Labels derive from the rendered
  local preview and truncate visually when needed; they remain absent from
  printed and exported PDFs.
- Verification: TypeScript, ESLint, all 55 Vitest tests, the complete 65-test
  Chromium Playwright suite, and the optimized production build passed. A new
  browser-generated PDF artifact was not produced in this run, so cross-engine
  pagination remains a separate manual check.
- Provisional next step: reassess actual Chromium PDF pagination for ordinary
  multi-entry and custom-section resumes, then prioritize any remaining
  preview-to-artifact mismatch over additional editor features.

- Finding before build: user feedback about resume imports repeatedly calls out
  missing information that must be re-entered. The import checklist already
  exposed skipped core sections, but its coverage snapshot did not surface a
  recognizable specialty heading—such as Certifications or Publications—when
  the parser could not reconstruct an entry, leaving a high-value omission
  easy to miss.
- Options considered: add more aggressive specialty parsing, introduce an
  opaque import-confidence score, or make the existing review signal complete.
  Specialty coverage won because it makes the omission visible and recoverable
  without guessing at a person's credentials or changing a conservative parser.
- Implementation: import coverage now recognizes familiar specialty headings,
  shows their local source excerpt, reports when no entry was reconstructed,
  and takes the user to the relevant add-section control. Imported specialty
  sections also receive the same detected-entry coverage treatment.
- Verification: ESLint, TypeScript, all 55 Vitest tests, the focused Chromium
  specialty-coverage flow, the complete 65-test Playwright suite, and the
  optimized production build passed. The first complete-suite attempt found a
  stale local server on port 3100 and did not execute; a clean rerun passed.
- Provisional next step: reassess conservative parsing for uncommon or
  multi-column source layouts before expanding tailoring or writing assistance.

- Finding before build: current competitor reviews and job-seeker feedback
  continue to identify incomplete imports and exhausting tailoring workflows as
  costly friction. The editor's source-backed import checklist protects trust,
  but an accurate import still required a separate acknowledgement click for
  every detected field, creating paperwork without adding review quality.
- Options considered: improve parser heuristics, add opaque matching scores, or
  make the existing explicit review easier to finish. A single deliberate
  whole-import confirmation won because it removes repetitive clicks while
  preserving the local source context, individual correction controls, and
  export checkpoint.
- Implementation: the import checklist now offers “Confirm all imported
  fields” beside the next-field guidance. It marks the current suggested items
  reviewed only after a user chooses it; each item can still be reviewed and
  toggled individually before completing the checklist.
- Verification: ESLint, TypeScript, all 55 Vitest tests, the focused Chromium
  flow, the complete 64-test Playwright suite on a fresh isolated server, and
  the optimized production build passed. The first focused browser attempt
  reused an unrelated stale dev server and was not counted; the fresh rerun
  passed.
- Provisional next step: reassess parsing accuracy for uncommon or
  multi-column source layouts before expanding matching or writing assistance.

- Finding before build: current job-seeker feedback continues to identify
  per-application tailoring as a draining repeated task. The editor already
  had local role context and reversible checkpoints, but the safety step lived
  in a separate lower Review section after a user had just pasted a role.
- Options considered: improve term-ranking heuristics, add writing automation,
  or make the existing base-save path immediate. The direct base-save route won
  because it prevents losing a strong master draft without guessing at a
  person's experience, adding a service, or creating new privacy risk.
- Expected experience improvement: people can preserve the original resume at
  the exact point they begin tailoring, then experiment and restore confidently.
- Implementation: Role Focus now exposes a calm, local-only base-draft callout
  after a person pastes a role description. Its action opens the existing named
  checkpoint dialog, where the private role label and description are already
  confirmed for that saved draft; it adds no automated rewriting or new data
  transfer.
- Verification: all 54 Vitest tests, ESLint, the new focused Chromium flow,
  the complete 64-test Playwright suite, and the optimized production build
  passed. Fresh isolated Playwright servers were used because stale local dev
  servers from other sessions otherwise exposed a different workspace build.
- Provisional next step: reassess actual browser PDF pagination for ordinary
  multi-entry and custom-section resumes before adding further tailoring scope.

## 2026-07-11 23:30 PDT

- Market and product review: recent job-seeker research continues to make
  per-application tailoring and a dependable final artifact the highest-value
  workflow; it also reinforces that a clean, truthful export matters more than
  opaque ATS claims. Manual Chromium PDF inspection confirmed the true
  Letter-size preview and its page counter match browser-generated PDFs, and
  that even a deliberately oversized entry is not clipped. However, its
  unavoidable continuation began on a later page without the entry heading,
  which gives a recruiter a poorer scanning experience.
- Finding and decision: warn about that exact oversized entry before export,
  rather than changing sensible print keep-together rules globally or adding a
  generic word-count limit. The check is based on the rendered entry height
  versus the active printable content area, so it works with the chosen density,
  font, and text scale and points directly to the relevant bullet field.
- Implementation: preview entries now expose only local measurement metadata;
  the editor detects the first entry that cannot fit inside one printable page
  body and adds an export-check item with clear split-or-trim guidance. Unit and
  browser coverage verify both the targeted check and its direct focus action.
- Verification: manual Chromium PDF run produced a Letter PDF whose page count
  matched the preview and retained the first and last bullet of a 55-bullet
  entry; TypeScript, ESLint, all 54 Vitest tests, the full 63-test Playwright
  suite, and the optimized production build passed.
- Provisional next step: reassess actual browser-engine PDF rendering for
  ordinary multi-entry resumes and custom sections, especially whether keeping
  whole short entries together leaves any undesirable blank space near a page
  boundary.

## 2026-07-11 21:28 PDT

- Market and product review: current Rezi guidance and recent reviews make the
  editable PDF/DOCX artifact and a trustworthy preview central, while feedback
  still names export speed, formatting flexibility, and UI friction as weak
  points. The current product has strong local review and export safeguards,
  but its CSS declared an 8.5-inch content width and then added horizontal
  padding outside it. The resulting preview page was actually 9.5 inches wide,
  so narrow-screen scaling and browser print fitting could disagree with the
  stated Letter layout.
- Finding and decision: make the document page a true Letter-sized border box,
  then add narrow print-flow protection, rather than add another tailoring
  feature or attempt browser-specific PDF generation. This fixes a core trust
  promise directly, retains native browser PDF accessibility and links, and
  reduces the chance of a heading, entry detail, or one bullet looking broken
  at a page boundary.
- Implementation: the resume sheet now includes its padding inside its 8.5 by
  11 inch dimensions on both screen and print. Print styles also avoid a break
  immediately after entry headers/subtitles and inside individual bullets when
  space permits. Browser coverage asserts the true Letter dimensions under
  both media modes; README and roadmap now state the guarantee.
- Verification: TypeScript, ESLint, all 52 Vitest tests, focused Playwright
  Letter/print regression coverage, and the optimized production build passed.
- Provisional next step: reassess full browser-engine PDF rendering with a
  manually saved multi-page artifact—especially very long single entries—before
  adding more templates or writing assistance.

## 2026-07-11 20:29 PDT

- Market and product review: current Teal/Rezi positioning and recent user
  feedback continue to emphasize quick tailoring plus a dependable final
  artifact. The newly added design controls provide useful restrained choice,
  but loading a sample retained only the template ID and reset the actual
  theme—so the selected template could imply a design the preview no longer
  used.
- Finding and decision: preserve the active design when loading a sample,
  rather than resetting it or adding another confirmation. A sample is content
  a person uses to evaluate their current layout, so resetting their font,
  accent, heading treatment, density, or text scale breaks that direct
  comparison.
- Implementation: sample loading now keeps the current template, full theme,
  and text scale while replacing resume content. Browser coverage verifies
  those choices persist through both reload and sample loading. README and
  roadmap now state the intended behavior.
- Verification: TypeScript, ESLint, all 52 Vitest tests, focused Playwright
  design-flow coverage, and the optimized production build passed.
- Provisional next step: reassess real cross-browser PDF pagination—especially
  long entry and section-heading breaks—before expanding tailoring features.

## 2026-07-11 19:30 PDT

- Market and product review: current Rezi/Teal feedback emphasizes a fast,
  dependable final artifact, while recent recruiter feedback specifically
  warns that applicants lose time fixing or renaming files from resume
  builders. The local editor already made PDF export free and reviewable, but
  browser print dialogs could still offer the generic public page title as a
  filename.
- Finding and decision: give the native Save as PDF dialog a useful default
  name instead of adding another export screen or a speculative ATS score. A
  temporary document title such as `Jane_Doe_Resume` preserves a one-click
  export, leaves the user free to rename it, and restores the public browser
  title when printing ends.
- Implementation: PDF export now derives a safe owner-based title immediately
  before the native print dialog and restores the normal site title on
  `afterprint`. README and roadmap now explain the resulting filename cue, and
  Playwright verifies both the suggested title and restoration behavior.
- Verification: TypeScript, ESLint, 52 Vitest tests, the focused Playwright
  export-name regression, and the optimized production build passed. A full
  59-test Playwright run reported its first 23 flows passing but ended without
  the runner's final summary, so it is not counted as a complete-suite pass.
- Provisional next step: reassess cross-browser/browser-to-PDF pagination,
  especially long-entry breaks, before expanding export features.

## 2026-07-11 18:28 PDT

- Market and product review: current Teal/Rezi feedback values quick tailoring
  and dependable PDF/DOCX output, while recent builder feedback specifically
  calls out a preview that says one page but exports to two as a severe trust
  failure. The existing editor measured page count and guarded export, but its
  continuous preview did not show *where* another printed page began.
- Finding and decision: visible, screen-only Letter page boundaries won over
  adding another score or intrusive pre-export dialog. They keep a clean
  one-click export path while giving users an immediate, concrete cue to review
  the content that moves to page two; the guides are deliberately excluded from
  print.
- Implementation: the preview now renders a subtle "Page N begins" guide at
  each measured Letter boundary, scaled with the same preview sheet. README and
  roadmap document the fidelity aid; the browser regression asserts the guide
  appears for overflowing content and disappears in print media.
- Verification: 52 Vitest tests, ESLint, optimized production build, and the
  focused Playwright print-media regression passed. An accidental first
  Playwright invocation used an extra argument separator and began the full
  suite; its output showed 23 passing flows before the runner exited without a
  final summary, so it is not counted as a complete-suite pass.
- Provisional next step: reassess true cross-browser PDF pagination (especially
  page breaks around long entries) before adding more export formats or writing
  assistance.

## 2026-07-11 15:31 PDT

- Market and product review: Rezi and Teal continue to make existing-resume
  import, editing, and export central, while user feedback calls out basic
  polish such as spelling and reliable finished artifacts. The editor already
  has browser-native writing support, but its final review only checked whether
  essential contact fields were blank. A mistyped email, partial phone, or
  malformed LinkedIn link could therefore reach the PDF unnoticed.
- Finding and decision: a local contact-confidence check won over another ATS
  heuristic or output format because it protects the one detail a recruiter
  needs to respond, with no account, service, or country-specific formatting
  assumption. It catches only obvious malformed email, phone, and optional
  website values; international phone formats and scheme-less LinkedIn URLs
  remain valid.
- Implementation: Resume Check now identifies the first unusable contact field
  and gives precise repair guidance before export. Contact fields expose
  email/tel/url semantics, mobile-friendly input modes, autocomplete hints,
  and explicit writing-support behavior. Unit and browser coverage protect the
  validation and focus path; README and roadmap describe the behavior.
- Verification: ESLint, TypeScript, 50 Vitest tests, production build, and the
  focused Playwright contact-flow test passed. The complete 55-flow Playwright
  rerun was interrupted by an environment-level dev-server connection refusal
  after 23 passing flows; the failure did not report an application assertion.
- Provisional next step: reassess browser-engine PDF fidelity and the remaining
  uncommon PDF import layouts before considering larger export or AI-writing
  features.

## 2026-07-11 14:42 PDT

- Product and interaction audit: the section workflow had four connected
  problems: its two-column arrangement obscured the resulting order, drag only
  represented a tiny handle, blank headings silently reverted, and default
  sections could not be removed. On narrow screens the sticky section navigator
  could also compete with the workspace header, while field jumps could land
  beneath that header.
- Decision: treat section arrangement and section presence as durable resume
  state, rather than merely presentation controls. This won over superficial
  drag styling because a removed section must remain removed after reload and a
  deliberately blank heading must remain absent in both PDF preview and text.
- Implementation: the arrangement surface is now a numbered single-column
  list, supplies a full named drag image, and visibly marks both the source and
  destination. Every default section can be removed with Undo; removal clears
  its content from the export and adds it back as a blank default section only
  when explicitly restored. Empty headings remain empty through autosave,
  preview, and text export. Mobile navigation now stays in flow and jumps leave
  room for the persistent header.

## 2026-07-11 14:26 PDT

- Market and product review: current resume-builder feedback values fast,
  trustworthy exports but repeatedly warns that an attractive preview is not
  enough when the final application artifact is wrong. This editor already
  provides a local export checkpoint and source-backed import confirmation.
- Finding and decision: the familiar Cmd/Ctrl+P route invoked the browser's
  native print dialog directly and could bypass that checkpoint. Routing the
  shortcut through the existing review won over another ATS score or parser
  rule because it closes a common, high-impact trust gap without changing the
  user's habitual export gesture or adding friction for clean drafts.
- Implementation: Cmd/Ctrl+P now opens the same actionable export review when
  checks or import confirmation remain; otherwise it starts the normal local
  print export. The export control exposes the shortcut on wide screens and in
  its tooltip. A browser regression verifies incomplete drafts are reviewed
  instead of being printed immediately.

## 2026-07-11 13:55 PDT

- Market and product review: Teal and other builders make imports and tailored
  variants central, while user feedback still calls out import corrections and
  editing friction as reasons to abandon a builder. This editor already keeps
  imported content reviewable, but a routine Remove action could immediately
  discard a corrected entry and force the same retyping users dislike.
- Finding and decision: reversible removal won over another parser heuristic
  or ATS signal because it protects a frequent, high-cost editing mistake in
  the core workflow. A brief Undo is calmer than a confirmation dialog: it
  preserves momentum while keeping recovery obvious.
- Implementation: removed experience, education, project, custom-entry, and
  custom-section content can now be restored from a five-second accessible
  Undo toast. Custom sections return with their entries and their previous
  place in the document order. The browser regression covers both entry and
  custom-section restoration.

## 2026-07-11 12:29 PDT

- Market and product review: current resume tools differentiate on fast
  tailoring, but their convenience still leaves users to catch parsing mistakes.
  This product's local, source-backed review is most valuable when ordinary
  positioned PDFs preserve a readable first pass rather than forcing retyping.
- Finding and decision: PDF extraction treated each rounded vertical coordinate
  as a separate text row. Small baseline variations between fragments—common in
  generated PDFs—could split one name, heading, or role into several lines
  before the conservative parser had a chance to review it. A narrow baseline
  clustering fix won over multi-column inference because it repairs a routine
  loss mode without inventing reading order or resume facts.
- Implementation: positioned fragments within two source units now reconstruct
  into one x-ordered line, while larger vertical gaps still preserve blank-line
  context. Focused unit coverage protects both the reconstructed source and its
  downstream resume import. README and roadmap document the deliberate limit.

## 2026-07-11 11:29 PDT

- Market and product review: current builders still make import and quick output
  central, while recent user feedback calls broken parsing and a forced retyping
  loop especially frustrating. Reports on ATS extraction also reinforce that a
  readable plain-text representation is a practical fallback, not an opaque
  scoring feature.
- Finding and decision: the product described an ATS-friendly plain-text export
  but only placed it on the clipboard. Adding a direct `.txt` download won over
  another parser heuristic because it completes an existing, high-frequency
  application-portal path with no new data exposure or format conversion risk.
- Implementation: the reviewed exact text can now be downloaded as a UTF-8
  `.txt` file named from the resume owner, alongside Copy Text. The shared
  browser download helper keeps JSON and text downloads consistent. README and
  roadmap describe the completed route, and browser coverage asserts the real
  download filename.
- Verification: 46 Vitest tests, TypeScript, ESLint (with Next.js's existing
  `next lint` deprecation notice), optimized production build, and all 50
  Playwright flows passed.
- Provisional next step: reassess real browser-engine print/PDF fidelity and
  uncommon positioned-PDF extraction layouts before pursuing wider document
  formats or AI writing assistance.

## 2026-07-11 10:30 PDT

- Market and product review: Teal and Rezi continue to center imported master
  resumes, tailored versions, and opaque match scoring. Their guidance still
  expects users to review and personalize the result; current career guidance
  also recognizes that two pages can be appropriate for experienced candidates.
- Finding and decision: Resume Check labeled every two-page document as a
  failure and pushed a one-page rule even when deeper experience made a second
  page reasonable. Contextual length guidance won over a new matching feature
  because it removes misleading friction at the final export decision without
  weakening concise-resume guidance.
- Implementation: one page remains the ideal scan-friendly state; two pages
  now surface a non-blocking relevance advisory that asks users to keep the
  strongest evidence near the top and follow a posting's explicit limit; three
  or more pages still receive an actionable trimming check. Added unit coverage
  for both boundaries and updated README and roadmap wording.
- Verification: 46 Vitest tests, TypeScript, ESLint (with Next.js's existing
  `next lint` deprecation notice), and optimized production build passed. The
  full 50-flow Playwright suite completed successfully.
- Provisional next step: reassess uncommon PDF text-extraction layouts and
  cross-browser print/PDF fidelity before expanding output formats or adding
  AI writing assistance.

## 2026-07-11 09:28 PDT

- Market and product review: current builders make imported source resumes and
  job-specific matching central, but review feedback shows both import loss and
  overwhelming edit volume erode trust. This editor's local source-backed
  confirmation is a better differentiator than adding an opaque match score.
- Finding and decision: common, concise headings such as Professional Overview
  and Skills & Tools were not recognized, so valid summary and skill content
  could be missed before the review checklist even began. Expanding only
  semantically clear aliases won over guessing at ambiguous role/company
  ordering because it preserves more user content without making silent
  structural claims.
- Implementation: the parser now recognizes Professional Overview, Executive
  Summary, Career Summary, Professional History, Education & Credentials,
  Portfolio Projects, Relevant Skills, Skills & Tools, Tools & Technologies,
  Technology/Tech Stack, Technical Toolkit, and Programming Languages. Unit
  and browser coverage confirm a concise overview and skills import lands in
  the editable fields and coverage snapshot. README and roadmap now describe
  the supported headings.
- Verification: 45 Vitest tests, TypeScript, ESLint (aside from Next.js's
  existing deprecation notice), optimized production build, focused Playwright
  coverage, and the full 50-flow Playwright suite passed.
- Provisional next step: reassess parsing accuracy for genuinely uncommon PDF
  extraction layouts and browser-engine print fidelity before adding formats or
  AI writing assistance.

## 2026-07-11 08:28 PDT

- Market and product review: current builders emphasize tailored content and
  real-time checks, while user feedback repeatedly values trustworthy,
  ATS-readable output over opaque scores. The editor's local import review is
  a more differentiated and consequential trust surface than another template
  or AI-writing feature.
- Finding and decision: specialty content such as Certifications and
  Publications was preserved by import but omitted from the checklist that
  users must complete before clearing the import reminder. Extending the
  existing source-backed confirmation to each imported custom entry won because
  credentials and publications can materially affect an application and should
  never be silently outside a claimed complete review.
- Implementation: custom-section entries now appear in import review with a
  field jump, matching source context, and explicit confirmation; browser and
  unit coverage protect the behavior.
- Verification: 44 Vitest tests, TypeScript, ESLint (aside from Next.js's
  existing deprecation notice), the focused browser regression, the complete
  49-flow Playwright suite, and the optimized production build passed.
- Provisional next step: reassess browser-engine PDF fidelity and less common
  text/PDF layouts before considering additional formats or AI writing.

## 2026-07-11 07:31 PDT

- Market and product review: current ATS guidance and builder alternatives keep
  role-specific tailoring and clean, readable structure central. The editor
  already supports private import, review, and export, so an obstructed first
  edit was a higher-value risk than adding another scoring or writing feature.
- Finding and decision: the onboarding offered starting templates, but selecting
  one only updated an empty draft's layout state while keeping the editor
  hidden; it also lacked a direct blank-resume route. Making each route open
  the form immediately won because it removes a first-use dead end without
  changing the product's local-first or ATS-safe posture.
- Implementation: added a visible blank-resume action and made each template
  tile explicitly start a blank draft using that layout. Both paths move focus
  to the Full Name field, while clearing returns a genuinely empty workspace to
  the onboarding state. Added browser coverage for default and selected-layout
  paths.
- Verification: `pnpm typecheck`, `pnpm lint` (only Next.js's existing
  deprecation notice), 44 Vitest tests, the focused regression, the full
  48-flow Playwright suite, and the optimized production build passed. An
  initial concurrent build/browser run interfered with Next's shared build
  cache; rerunning them sequentially passed.
- Provisional next step: reassess real print behavior across browser engines
  and uncommon import layouts before adding formats or AI writing assistance.

## 2026-07-11 12:50 PDT

- Market and product review: current leaders such as Teal prioritize rapid
  role-specific tailoring, while Rezi markets real-time review and export
  checks. Community discussion continues to distinguish readable, plain-text
  documents from untrustworthy ATS theater. This editor's local review and
  print-ready export are therefore more valuable than another opaque score.
- Finding and decision: the export checkpoint correctly warned when imported
  fields had not been confirmed, but also offered a broad "Mark reviewed"
  action that silently removed the entire checklist. That contradicted the
  product's explicit import-review promise and made an easy accidental bypass
  more likely. Replacing it with exact confirmation progress and a single
  next-field route won over more parsing work because it protects the decisive
  import-to-export handoff without blocking an informed user from exporting.
- Implementation: the export dialog now displays confirmed-field progress,
  sends users to the next unconfirmed field, and only exposes a finish action
  after every suggested field is confirmed. "Export Anyway" remains available
  as the deliberate override.
- Verification: `pnpm typecheck`, `pnpm lint` (only Next.js's existing
  deprecation notice), 44 Vitest tests, optimized production build, the focused
  Playwright regression, and the complete 47-flow Playwright suite passed.
- Provisional next step: reassess real print behavior across browser engines
  and uncommon import layouts before adding formats or AI writing assistance.

## 2026-07-11 05:32 PDT

- Market and product review: Teal continues to make a comprehensive source
  resume plus quick tailoring central, while Rezi focuses on feedback and
  finished exports. The existing product already provides those core workflows
  locally, so a trustworthy preview of the final document outweighed another
  template, opaque score, or writing feature.
- Finding and decision: on phone-width screens the preview shrank the Letter
  sheet itself to the viewport. That changed text wrapping and could make the
  displayed page count disagree with the PDF a user saves—a direct confidence
  break at the most important final workflow.
- Implementation: the phone preview now retains the full 8.5 × 11-inch layout
  and scales that exact document within a clipped frame. Print explicitly
  removes the display transform, so the browser receives the unscaled Letter
  sheet. The frame height follows the measured page count, preserving access to
  multi-page previews without horizontal overflow.
- Verification: `pnpm typecheck`, `pnpm lint` (only Next.js's existing
  deprecation notice), 44 Vitest tests, and the optimized production build
  passed. A focused Playwright phone-width test passed and verifies that the
  visible sheet is scaled while its underlying layout remains full Letter size;
  the complete browser suite was also run (46 flows) during the change.
- Provisional next step: reassess PDF-print behavior in more browsers and the
  remaining import correction gaps before adding more output formats or AI
  writing assistance.

## 2026-07-11 04:30 PDT

- Market research and product review: Teal continues to make a comprehensive
  source resume and fast, versioned tailoring central, while Rezi emphasizes
  immediate feedback and finished exports. The existing editor already meets
  those workflow expectations locally; user feedback around polished builders
  reinforces that reliable saving and export behavior matter more than another
  opaque score or AI-writing feature.
- Finding and decision: the editor advertised local autosave but deliberately
  swallowed every browser-storage error. In private browsing, under a quota
  limit, or when storage is blocked, that could leave a user believing a
  sensitive draft would survive a refresh. Clear failure handling and a local
  backup path therefore beat additional parsing heuristics, templates, or
  tailoring features.
- Implementation: the workspace now detects failed storage reads and writes,
  replaces the autosave claim with an accurate unavailable state, and displays
  an accessible persistent warning with a one-click JSON backup. The warning
  makes the session-only limitation explicit without blocking the user from
  continuing or exporting their resume.
- Verification: TypeScript, ESLint (aside from Next.js's existing deprecation
  notice), 44 Vitest tests, optimized production build, and the full 45-flow
  Playwright suite passed. The new browser scenario forces a storage quota
  error, confirms the warning, and confirms a downloadable JSON backup.
- Provisional next step: reassess remaining import correction accuracy and
  practical print/PDF reliability before expanding formats or adding AI-style
  writing assistance.

## 2026-07-11 03:30 PDT

- Market research and reprioritization: Teal now frames its builder around one
  complete source resume plus fast role-specific tailoring, while Rezi continues
  to foreground immediate ATS checks and export-ready documents. The editor
  already supports local import, review, role focus, and checkpoints, but those
  secondary tools were competing with the first task—editing the resume—on
  smaller screens and in the desktop toolbar.
- Finding and decision: retain the existing capabilities but reorganize them
  around the user’s immediate job. A compact header leaves PDF export visible,
  groups less-frequent file actions in an overflow menu, adds a section jump
  rail for long drafts, and moves checks, role focus, export context, and
  version history into a live side drawer. This won over additional scoring or
  templates because it makes high-frequency editing calmer without creating
  new user data or opaque advice.
- Accessibility polish: the new secondary-actions menu now supports keyboard
  opening, arrow and Home/End navigation, Escape-to-close, and focus return;
  the browser suite covers that behavior.
- Verification: TypeScript, ESLint (apart from Next.js’s deprecation notice),
  44 Vitest tests, optimized production build, and all 44 Playwright flows
  passed. A direct production-server smoke test returned the expected title and
  security headers, including the stricter production CSP without `unsafe-eval`.
- Provisional next step: reassess import parsing/correction confidence and
  practical export reliability before adding AI writing, marketing features, or
  more templates.

## 2026-07-11 02:31 PDT

- Market research and reprioritization: current builders such as Teal center
  import, job-specific review, and clean export; user feedback also points to
  responsiveness and transparent, trustworthy workflows as more valuable than
  decorative options or opaque scoring. The editor already covers those core
  workflows, so the next public-use risk was verified directly in the browser.
- Finding and decision: the production CSP was appropriately restrictive, but
  it also blocked Next.js's development client bundle from evaluating, leaving
  the locally run editor rendered but non-interactive. This breaks every
  development and browser-test workflow, so it outranked more import heuristics
  or template work.
- Implementation: allow `unsafe-eval` only when `NODE_ENV` is `development`,
  retain the stricter production CSP, and add a browser regression test that
  loads the sample and confirms the editor state updates under development
  headers. The technical roadmap now records that intentional environment
  difference.
- Why it matters: local contributors and future maintainers can now exercise
  the same fast, private resume workflows users rely on, while deployed users
  do not receive an unnecessary script-evaluation allowance.
- Verification: full Playwright suite passed (43 tests); TypeScript, lint,
  Vitest (44 tests), and optimized production build passed. A production server
  smoke test confirmed that its CSP excludes `unsafe-eval` and that the hydrated
  editor can load a sample. Next.js lint still reports its upstream deprecation
  notice only.
- Provisional next step: reassess parser correction confidence and mobile
  import-review density before adding output formats or AI-style rewriting.

## 2026-07-11 01:31 PDT

- Market research and reprioritization: current resume builders such as Rezi
  and Teal make clean, selectable-text exports and transparent job-specific
  guidance expected, while current user discussion still flags broken PDF
  output, opaque ATS claims, slow interfaces, and hidden paywalls. This
  product's local-first import, review, export, and tailoring paths already
  address much of that practical friction without collecting resume data.
- Public-launch audit: metadata, icons, manifest, error recovery, local parser
  delivery, input validation, and dependency audit were in place, but the
  deployed Next.js configuration did not declare response security headers.
  For a browser workspace holding personal career details, that left avoidable
  gaps around framing, external resource loading, referrer disclosure, MIME
  sniffing, and unused browser capabilities.
- Decision: shipped a response security baseline rather than another editor or
  role-tailoring feature. This is the smallest high-impact production-hardening
  improvement because it protects every public session and preserves the
  product's privacy promise without changing its workflow.
- Implementation: configured same-origin CSP directives compatible with
  Next.js and the local PDF worker, plus anti-framing, HSTS, referrer,
  MIME-sniffing, cross-origin opener/resource, and unused-permission headers.
  Added end-to-end coverage for the actual response headers and corrected the
  existing PDF-upload test selector to match the supported `.pdf` extension.
  Documented the intentional static-CSP tradeoff: Next.js still requires
  inline script/style support, so stronger nonce/SRI policy is a future
  architectural decision rather than an unsupported security claim today.
- Verification: TypeScript, Next.js lint (with its existing deprecation
  notice), all 40 Vitest tests, optimized production build, all 42 Playwright
  tests against the production server, and `pnpm audit --prod --audit-level=high`
  passed. `npm audit` could not run because this pnpm repository has no npm
  lockfile; the equivalent pnpm audit passed.
- Provisional next step: reassess first-use import correction quality, mobile
  edit/review density, evidence/readability guidance, and real deployment
  configuration such as a stable public domain before selecting any follow-up.

## 2026-07-11 00:10 PDT

- Market research and reprioritization: current leaders such as Teal and Rezi
  make import, job-specific keyword review, repeatable versions, and readable
  ATS exports table stakes. The editor already supplies those core flows with
  an intentionally transparent local Role Focus review instead of opaque
  scoring or AI rewriting.
- Public-launch audit: browser metadata, recovery routes, local persistence,
  and dependency advisories were in good shape, but the PDF importer loaded its
  executable parser and worker from a third-party CDN. Although the PDF data
  stayed in-browser, that dependency weakened the local-first privacy claim and
  created an avoidable availability and supply-chain failure point.
- Decision: chose fully local PDF-parser delivery over new templates, parsing
  heuristics, or additional role-match features. It is the smallest high-impact
  production-hardening improvement for a sensitive first-use workflow.
- Implementation: added the pinned `pdfjs-dist` package, dynamically loads its
  parser only when PDF import is selected, and resolves its worker from the
  app's own build output. Updated user-facing documentation to say clearly that
  selected PDFs and extracted text stay in the browser and are not sent to a
  third party.
- Verification: passed type checking, lint (apart from Next.js's migration
  notice), 40 Vitest tests, the full 41-flow Playwright suite including a
  generated-PDF import with no third-party parser requests, optimized production
  build, and production dependency audit with no known vulnerabilities.
- Provisional next step: reassess import review quality, mobile correction
  density, recruiter-readability guidance, and a stable hosted public page;
  do not inherit this choice without fresh market and launch-readiness review.

## 2026-07-10 23:33 PDT

- Market research and reprioritization: credible resume guidance and current
  builder offerings continue to make readable, parsable, privacy-respecting
  exports the baseline. The product already supports that differentiated
  local-first workflow, while the launch audit uncovered a more immediate
  trust risk in its production dependency graph: Next.js resolved PostCSS
  8.4.31, which is affected by CVE-2026-41305 when stringified untrusted CSS is
  embedded in a style element.
- Decision: addressed the dependency advisory rather than expanding a resume
  feature. Import UX, mobile density, readability cues, and a hosted landing
  page were considered, but a known production advisory is a higher-value and
  smaller production-hardening fix.
- Implementation: added a workspace-level PostCSS 8.5.16 override so Next.js
  and all build tooling resolve the patched release; regenerated the lockfile
  with the declared pnpm 10.18.3 toolchain. The override is documented in the
  technical roadmap for future removal once Next.js no longer pins an affected
  version.
- Verification: the production dependency audit reports no known
  vulnerabilities; TypeScript, ESLint, 40 Vitest tests, the optimized Next.js
  build, and 40 Playwright browser tests all pass. The advisory remains a
  build-chain concern rather than evidence of a current runtime exploit path,
  but keeping it patched reduces supply-chain risk.
- Provisional next direction only: reassess import correction context, mobile
  editing density, recruiter-readability guidance, and hosted public experience
  before selecting work on the next run.

## 2026-07-10 22:15 PDT

- Market research and reprioritization: current resume builders such as Teal
  and Enhancv make job-specific tailoring, readable exports, and trustworthy
  feedback table stakes. Recent user discussion also flags generic or
  fabricated AI edits as a failure mode. This editor already has transparent
  local role review, import confirmation, export checks, and browser-only
  checkpoints, but its public launch surface was still generic: no custom
  browser icon, app manifest, robots policy, social metadata, or route-error
  recovery.
- Decision: shipped a focused public-launch foundation instead of another
  tailoring feature. Accurate metadata and visual browser identity improve
  first impressions, while route and global error boundaries prevent a raw
  blank screen and explicitly reassure users that browser-local drafts remain
  local.
- Implementation: added metadata, responsive viewport and theme settings,
  manifest and crawl routes, a compact document/checkmark icon for browser and
  Apple contexts, regular and global error recovery pages, and Playwright
  checks for title, descriptions, Open Graph metadata, manifest, robots, and
  icon delivery. The roadmap documents that canonical URLs, sitemap, and a
  social image must wait for a real public domain rather than use fake URLs.
- Provisional next direction only: next run must reassess import correction
  context, mobile editing density, recruiter-readability guidance, and the
  need for a hosted public landing experience before choosing work.

## 2026-07-10 21:31 PDT

- Market research and reprioritization: Teal and Jobscan make job-description
  tailoring and keyword feedback baseline expectations, while recent job-seeker
  discussions stress that the useful part is verifying one specific role
  truthfully—not blindly chasing a score or accepting a generic rewrite. The
  editor already offers a transparent local wording review, import correction,
  browser-only checkpoints, and flexible custom sections. However, Role Focus
  did not count the custom evidence users had just added, so a certification or
  volunteer entry could be inaccurately reported as absent. New templates,
  parser heuristics, and AI writing would be broader and lower-value than
  fixing this trust break in the existing role-tailoring flow.
- Decision: shipped complete custom-section coverage in Role Focus. Custom
  headings and entry fields now participate in term matching; result chips can
  jump to the matching heading or exact entry, and detail-based matches retain
  the existing “concrete evidence” distinction.
- Implementation: generalized role-evidence lookup, included custom headings
  and entry text in the local comparison corpus, clarified the supporting-copy,
  and added both unit and browser coverage using a Kubernetes certification.
  Updated README and roadmap language.
- Why it matters: job seekers see an honest view of the language already on
  their resume and can immediately inspect the proof behind a match, rather
  than being prompted to duplicate truthful credentials or chase an opaque
  score.
- Verification: `CI=true node_modules/.bin/tsc --noEmit`, `CI=true
  node_modules/.bin/next lint`, `CI=true node_modules/.bin/vitest run` (40
  tests), production `CI=true node_modules/.bin/next build`, and `CI=true
  PLAYWRIGHT_PORT=3201 node_modules/.bin/playwright test --reporter=list` (39
  tests) passed. The initial browser-run output detached before the final
  summary, so the complete rerun used a clean port and its test process exit was
  confirmed.
- Provisional next direction only: next run must reassess recruiter-readability
  guidance, import correction context, mobile editing density, and role-specific
  examples before choosing another improvement.

## 2026-07-10 20:39 PDT

- Market research and reprioritization: current builders commonly offer extra
  sections for certifications, volunteer work, publications, awards, and
  languages, while career guidance consistently says to include those only when
  relevant to the target role. The editor had just gained generic custom
  sections, but asking a user to name every common section still adds an
  avoidable blank-state decision. More parser heuristics, AI rewriting,
  templates, or broad mobile rework would be larger or lower-confidence next
  steps; the existing role focus and import review already cover their core
  friction.
- Decision: shipped common custom-section presets. One click now starts
  Certifications, Volunteer Experience, Publications, Awards, Languages, or
  Training with a familiar, ATS-readable heading, while **Add custom section**
  remains available for every other case. The preview stays intentionally empty
  until the person enters real content, so a preset never creates filler.
- Implementation: added a typed shared preset list, made the section creator
  accept a starting title, rendered a concise responsive preset chooser, and
  added unit and browser coverage for the new flow. Updated README and roadmap.
- Why it matters: people can represent relevant career evidence quickly and
  consistently without putting a certification into Skills, forcing volunteer
  work into Employment, or manually correcting a generic heading.
- Verification: `CI=true node_modules/.bin/tsc --noEmit`, `CI=true
  node_modules/.bin/next lint`, `CI=true node_modules/.bin/vitest run` (39
  tests), a production `node_modules/.bin/next build`, and Playwright (38
  tests) against that production build passed. Direct binaries were used because
  the `pnpm` wrapper remains blocked by the existing `workerd` build-policy
  prompt.
- Provisional next direction only: next run must reassess role-specific example
  content, remaining import correction context, mobile editing density, and
  recruiter-readability guidance before choosing one improvement.

## 2026-07-10 20:28 PDT

- Market research and reprioritization: current builders such as Rezi,
  Resume.io, Teal, and newer mobile-first alternatives make job-description
  tailoring, ATS-friendly exports, and templates expected. Recent job-seeker
  feedback repeatedly warns that tailoring becomes too slow when every role
  requires a rewrite, while competing products emphasize section control and
  multiple resumes. This editor already has a strong transparent local role
  review, import correction flow, readiness guidance, and checkpoints; another
  score, AI rewrite, template, or output format would be lower value than
  letting a real career history fit the document cleanly.
- Decision: shipped flexible, ATS-safe resume organization. Editable standard
  headings, custom repeatable sections, drag-and-drop ordering, and direct
  editor/preview navigation let users include publications, certifications,
  volunteer work, or other relevant evidence without forcing it into an
  ill-fitting built-in section. Keyboard users retain explicit move controls;
  drag handles do not masquerade as inaccessible buttons.
- Implementation: extended the normalized local resume schema with safe custom
  section IDs and titles, repaired legacy section order on load, made custom
  content appear in the preview and plain-text copy, and included it in export
  fingerprints. Added section and entry reordering, section removal, focused
  preview highlighting, resilient custom IDs, page-count rounding correction,
  unit coverage for persistence/normalization, and browser coverage for custom
  content, focus linking, and section drag reordering. Updated README and
  roadmap guidance.
- Why it matters: job seekers can keep a single truthful master resume and
  quickly make a role-specific structure without retyping content or choosing
  a layout that risks ATS readability.
- Verification: `CI=true node_modules/.bin/tsc --noEmit`, `CI=true
  node_modules/.bin/next lint`, `CI=true node_modules/.bin/vitest run` (38
  tests), a production `node_modules/.bin/next build`, and the full Playwright
  suite (37 tests) against that production build passed. The `pnpm` wrapper
  remains blocked by the existing `workerd` build-policy prompt, so direct
  local binaries are used.
- Provisional next direction only: next run must reassess whether common
  section presets, deeper import correction context, mobile editing density,
  or readability guidance has the highest user value.

## 2026-07-10 19:32 PDT

- Market research and reprioritization: current Teal, Jobscan, and other
  tailoring tools make job-description matching and ATS-style checklists
  familiar expectations, but recent reviews and job-seeker discussions still
  describe score-driven edits as overwhelming and generic rewriting as
  untrustworthy. The editor already offers a local, transparent role review;
  another score or rewrite would amplify that fatigue. More import heuristics
  would also be lower confidence after the recent company-first correction,
  while DOCX export is a materially larger output-format project.
- Decision: made summary guidance optional rather than export-blocking. A
  missing summary previously appeared as a failure even when a resume already
  led with concrete experience, encouraging filler merely to clear the
  checklist. The new neutral advisory remains actionable for career pivots,
  specialties, and direction-setting, while real readability and completeness
  checks still require attention.
- Implementation: extended the readiness-check model with a non-blocking
  advisory state, presented it with distinct visual treatment, and updated the
  summary copy and action. The README and roadmap now record that resume
  guidance should avoid conventional filler. Added unit and browser coverage.
- Why it matters: job seekers get a calmer, more honest export signal and can
  spend their time strengthening truthful evidence instead of adding a generic
  opening paragraph simply to satisfy a tool.
- Verification: `CI=true node_modules/.bin/vitest run` (36 tests), `CI=true
  node_modules/.bin/tsc --noEmit`, `CI=true node_modules/.bin/next lint`, a
  production `next build`, `git diff --check`, and the full Playwright suite
  (35 tests) passed against the production server on port 3138. The existing
  user-owned `pnpm-workspace.yaml` remains unmodified because its `workerd`
  build-policy choice is still unresolved.
- Provisional next direction only: next run must reassess evidence/readability
  cues, remaining import correction friction, and mobile edit density before
  choosing a single improvement.

## 2026-07-10 18:31 PDT

- Market research and reprioritization: Teal continues to frame a comprehensive
  master resume plus fast per-job tailoring as the core workflow, while Jobscan
  makes match reporting and keyword gaps expected. Fresh job-seeker discussion
  still emphasizes the repetitive labor of tailoring and the frustration of
  correcting imported content. The existing local Role Focus review already
  offers transparent wording comparison, while automatic rewriting, opaque
  scoring, templates, and DOCX export would not remove an immediate correction
  step from the first-use import flow.
- Decision: shipped a reversible title/company swap for experience entries.
  Company-first source lines are common, but automatically guessing which side
  is the employer is unreliable. A clear in-place action lets people correct a
  reversed imported entry without retyping or hiding the importer's uncertainty.
- Implementation: added an accessible Swap action only to experience entries,
  connected it to a focused state helper, documented the behavior and parser
  boundary, and added browser coverage for a company-first imported role. The
  action's accessible name intentionally avoids colliding with the Job Title
  input label.
- Why it matters: a job seeker can correct a frequent source-layout mismatch in
  one click while reviewing their imported master resume, keeping the rest of
  the role details and local review context intact.
- Verification: `CI=true node_modules/.bin/vitest run` (35 tests), `CI=true
  node_modules/.bin/tsc --noEmit`, `CI=true node_modules/.bin/next lint`, a
  production `next build`, full Playwright coverage (34 tests), and `git diff
  --check` passed. The standard Playwright web server could not use `pnpm dev`
  because the existing user-owned `pnpm-workspace.yaml` still leaves `workerd`
  build approval unresolved; the suite passed against an equivalent directly
  started local Next dev server. That file remains untouched.
- Provisional next direction only: next run must reassess whether remaining
  import-layout correction friction, stronger recruiter-readability guidance,
  or mobile edit density now offers the largest user value.

## 2026-07-10 17:29 PDT

- Market research and reprioritization: current Teal-style builders make
  job-description matching, templates, and AI rewriting expected, but recent
  reviews and job-seeker discussions still report matching fatigue, generic or
  inaccurate wording, and lost information during import. The existing local,
  transparent role review already covers the safer tailoring layer, so another
  score, rewrite, template, or DOCX export was lower value than closing a
  concrete import-loss gap.
- Decision: shipped conservative inline-heading import preservation. Resumes
  that use compact lines such as `Professional Summary: ...`, `Skills: ...`,
  or `Experience: ...` could have their recognized heading retained while the
  content after its colon was silently dropped.
- Implementation: the parser now retains colon-delimited content after a known
  heading, while preserving blank-line entry boundaries and the existing
  explicit import-review flow. Added unit and browser coverage for summary,
  skills, and experience on inline headings, and documented the supported
  layout in the README and roadmap.
- Why it matters: people can import common compact resumes without rebuilding
  content that was visibly present in their source before tailoring or export.
- Verification: `CI=true node_modules/.bin/vitest run` (35 tests), `CI=true
  node_modules/.bin/tsc --noEmit`, `CI=true node_modules/.bin/next lint`, a
  production `next build`, focused inline-heading Playwright coverage, the full
  Playwright suite (33 tests), and `git diff --check` passed. `pnpm` commands
  remain blocked by the pre-existing user edit to `pnpm-workspace.yaml` that
  requests a build-policy choice for `workerd`; this change leaves that file
  untouched.
- Provisional next direction only: reassess remaining import-layout gaps and
  role-tailoring clarity against a lightweight ATS-text validation aid before
  choosing another feature.

## 2026-07-10 16:30 PDT

- Market research and reprioritization: Teal, Rezi, Jobscan, and newer
  tailoring products make job-description matching, scoring, templates, and
  AI rewriting crowded expectations. Fresh job-seeker discussion instead keeps
  surfacing broken imports, formatting anxiety, and a need to preserve a clean
  editable master resume. The existing transparent local role review already
  covers the useful non-generative tailoring layer, so a score, rewrite,
  template, or DOCX export was lower value than reducing import loss.
- Decision: shipped conservative alternate-heading recognition for imported
  resumes. Career Profile, Relevant/Selected Experience, Education & Training,
  Academic/Relevant Projects, Key Skills, and similar common headings were
  previously treated as ordinary text and could leave whole sections missing.
- Implementation: expanded the importer’s heading map, added unit coverage for
  individual headings and full imported content, added a browser import flow,
  and aligned README and roadmap documentation. The parser still requires
  explicit review before export and makes no claims about ambiguous layouts.
- Why it matters: job seekers retain their summary, work history, education,
  projects, and skills when importing common resume variants instead of
  rebuilding silently skipped sections before tailoring or exporting.
- Verification: `CI=true pnpm test` (34 tests), `CI=true pnpm typecheck`,
  `CI=true pnpm lint`, full Playwright coverage (32 tests; passed against the
  existing local server after the CI-managed server ended early), `CI=true
  node_modules/.bin/next build`, and `git diff --check` passed.
- Provisional next direction only: reassess remaining import layout gaps and
  export confidence against a lightweight ATS-text validation aid before
  choosing another feature.

## 2026-07-10 15:29 PDT

- Market research and reprioritization: current Teal, Kickresume, and
  Jobscan-style tools make job-specific matching, scoring, templates, and AI
  rewriting crowded expectations. Fresh job-seeker discussion still describes
  per-application tailoring as slow and warns that generic or invented wording
  is harmful. The editor already provides a transparent local wording review,
  so factual import preservation remains a higher-value prerequisite than a
  new score, rewrite, template, or DOCX export.
- Decision: shipped a conservative compact-education parser correction instead
  of expanding role matching or output formats. Date-line resumes frequently
  use degree, school, and date without bullets; the importer could merge that
  history into one entry even though the standalone dates clearly delimit it.
- Implementation: adjacent standalone-date entries now split when either the
  existing bulleted-boundary signal is present or the next short header follows
  immediately. Added unit and browser coverage for a two-degree, no-bullets
  paste-import flow, and updated the product documentation.
- Why it matters: people keep distinct education records during import and can
  verify the resulting fields instead of reconstructing a merged history
  before tailoring or exporting.
- Verification: `CI=true pnpm test` (32 tests), `CI=true pnpm typecheck`,
  `CI=true pnpm lint`, focused Playwright coverage (2 tests), full Playwright
  coverage on an isolated port (31 tests), `CI=true node_modules/.bin/next
  build`, and `git diff --check` passed.
- Provisional next direction only: reassess remaining uncommon import-header
  layouts against an ATS-safe DOCX export and a more role-aware export review
  before choosing another feature.

## 2026-07-10 14:32 PDT

- Market research and reprioritization: current Teal, Rezi, and Jobscan-style
  alternatives make job-description matching, AI rewrites, and scorecards
  crowded expectations. Recent job-seeker discussions still describe tailoring
  as time-consuming and warn that literal keyword insertion can sound forced.
  This product already offers transparent local wording review, so import
  correctness remains a higher-value trust prerequisite than another score,
  automatic rewrite, DOCX export, or template.
- Decision: shipped a focused parser correction for compact role histories
  instead of a broader parser rewrite, new output format, or deeper
  role-tailoring logic. Common exports put role and company lines above a
  standalone date range with no blank line between jobs; the prior fallback
  could merge the next role into the preceding entry.
- Implementation: the importer now recognizes multiple standalone date lines
  when explicit bullets make the following role header boundary unambiguous,
  keeping adjacent entries separate while leaving ambiguous layouts to the
  existing conservative review flow. Added unit and browser coverage, and
  documented the supported layout.
- Why it matters: people can correct and confirm each imported role instead of
  reconstructing silently merged experience before tailoring or exporting.
- Verification: `CI=true pnpm typecheck`, `CI=true pnpm lint`, `CI=true pnpm
  test` (31 tests), `CI=true node_modules/.bin/next build`, and `git diff
  --check` passed. Playwright passed all 30 browser flows on an isolated local
  server at port 3137 (the full run's first 22 completed successfully, and the
  remaining 8 checkpoint/role-focus flows were rerun together successfully).
- Provisional next direction only: reassess conservative parsing improvements
  for other common layouts against an ATS-safe DOCX export and role-tailoring
  refinements before selecting another feature.

## 2026-07-10 13:27 PDT

- Market research and reprioritization: current Teal and Jobscan alternatives
  make job-description matching and fast tailoring expected, while recent user
  discussion still reports incomplete imports and distrust of opaque match
  scores. This product already provides local, transparent role review and
  field-level source excerpts, so another scorer, AI rewrite, or template was
  lower value than making an import loss unmistakable.
- Decision: shipped source-aware import coverage instead of a broader parser
  rewrite, ATS-safe DOCX export, or new role-matching heuristic. A plain
  “not detected” state made it unclear whether a section was absent from the
  source or silently skipped by the parser.
- Implementation: coverage now examines recognizable local source headings and
  differentiates a source section from a populated draft section. When a
  Summary, Experience, Education, Projects, or Skills heading exists but no
  content is placed, the review card names that mismatch and sends the user to
  the correct field or add control. Older saved reviews safely retain their
  existing snapshot while computed fallbacks use the stored source text.
- Why it matters: people can catch and repair a partially imported resume
  before confirming or exporting, without uploads, opaque confidence scores,
  or hunting through the raw extraction.
- Verification: `CI=true pnpm typecheck`, `CI=true pnpm lint`, and `CI=true
  pnpm test` (30 tests) passed. The full browser suite passed all 29 flows
  against an isolated local server on port 3101, including the source-section
  correction flow. `CI=true node_modules/.bin/next build` and `git diff --check`
  passed. The `pnpm test:e2e` and `pnpm build` wrappers could not run because
  port 3100 was already occupied and the wrapper requested a build policy choice
  for the locked `workerd` dependency, respectively.
- Provisional next direction only: reassess targeted parser accuracy for common
  source layouts against ATS-safe DOCX export and further role-tailoring work.

## 2026-07-10 12:31 PDT

- Market research and reprioritization: current alternatives make
  job-description matching, scoring, templates, and application tracking
  expected. Fresh reviews and job-seeker discussion still warn that keyword
  optimization can be overwhelming, generic rewrites can be untrustworthy, and
  import verification remains a real first-use burden. The product already
  offers transparent local role review, coverage reporting, and full source
  text, so another score, template, or automatic rewrite was lower value.
- Decision: shipped field-level source context instead of a new matcher, DOCX
  export, or parser rewrite. Users could see all extracted text but had to
  manually find the evidence for each suggested value; that split attention
  made factual import review slower than it needed to be.
- Implementation: each imported review item now stores a short line-preserving
  excerpt from matching local source text. The excerpt appears beside the
  editable field and its explicit confirmation control, while the complete
  source text remains available in the import checklist. Selection favors a
  distinctive matching value and gracefully omits context when none is found;
  it does not claim the parser is correct.
- Why it matters: people can fact-check a suggested name, summary, experience,
  education, project, or skills value where they correct it, with less scrolling
  and no upload of their resume data.
- Verification: `CI=true pnpm typecheck`, `CI=true pnpm lint`, and `CI=true
  pnpm test` (29 tests) passed. `node_modules/.bin/playwright test` passed all
  29 browser flows against the existing local server; `CI=true
  node_modules/.bin/next build` and `git diff --check` passed. The `pnpm
  test:e2e` wrapper could not run because its policy check requested a build
  permission for the already locked `workerd` dependency, so the installed
  Playwright binary was used instead.
- Provisional next direction only: reassess parser accuracy for common layouts
  against ATS-safe DOCX export and focused role-tailoring improvements.

## 2026-07-10 11:35 PDT

- Market research and reprioritization: current alternatives make job-specific
  tailoring, ATS-aware feedback, saved versions, and flexible export table
  stakes. Recent job-seeker discussions still put import reliability and quick
  mobile correction ahead of opaque scoring or generic AI rewrites. Users need
  to understand what an importer did not capture before they can trust a draft.
- Decision: shipped an import-coverage explainer instead of DOCX export,
  another role-matching heuristic, or a template. The product already required
  explicit review, but only showed fields it recognized; a skipped education,
  skills, or experience section could be invisible. This small change improves
  first-use confidence for every pasted-text or PDF import.
- Implementation: import review now shows a local detected/not-detected
  coverage snapshot for the header, summary, experience, education, projects,
  and skills. Each item opens the relevant editable field or add control, and
  the copy explicitly distinguishes parser coverage from what the source may
  contain. The snapshot is stored with the review while older local reviews use
  a safe computed fallback.
- Why it matters: people can catch a section the parser skipped before they
  confirm or export, without giving sensitive resume data to a service or
  assuming an absent item was intentionally omitted.
- Verification: `CI=true pnpm typecheck`, `CI=true pnpm lint`, and `CI=true
  pnpm test` (28 tests) passed. Browser coverage passed in two Playwright runs:
  23 core flows and 6 version/backup flows (29 total); the strengthened import
  coverage and direct-correction flow also passed again after its final test
  assertion. `CI=true pnpm build` and `git diff --check` passed.
- Provisional next direction only: reassess whether actual parsing accuracy for
  common resume layouts or a tighter source-to-field correction path outweighs
  ATS-safe DOCX export and deeper role-tailoring assistance.

## 2026-07-10 10:31 PDT

- Market research and reprioritization: current Teal and Jobscan alternatives
  make role matching, keyword feedback, and job tracking expected, while recent
  job-seeker discussion repeatedly calls tailoring slow and cluttered. The
  product already offers transparent local role comparison, so a trustworthy
  import correction path is a higher-value prerequisite than another opaque
  matcher, rewrite, or template.
- Decision: prioritized a focused mobile import review. A full checklist ahead
  of the form made correction laborious on a phone; a DOCX export and deeper
  tailoring automation were lower value because they do not fix that first-use
  trust bottleneck.
- Implementation: added a compact mobile import prompt with progress and a
  direct next-field action; moved the full checklist and extracted-source review
  into the existing on-demand mobile Review tools, while preserving the complete
  desktop review and explicit field confirmations.
- Why it matters: people can correct an imported resume one field at a time on
  a narrow screen without losing access to the full local audit when they need it.
- Verification: `CI=true pnpm typecheck`, `CI=true pnpm lint`, and `CI=true
  pnpm test` (27 tests) passed. Focused browser coverage and the full Playwright
  suite (29 tests) passed against an isolated local server; `CI=true
  node_modules/.bin/next build` and `git diff --check` passed.
- Provisional next direction only: reassess whether an import-quality
  explanation or clearer correction context is a higher-value first-use
  improvement than more role-tailoring automation.

## 2026-07-10 09:27 PDT

- Market research and reprioritization: current Teal and Jobscan alternatives
  make role matching, keyword feedback, and job tracking expected, while recent
  job-seeker feedback repeatedly calls tailoring slow, cluttered, and difficult
  to trust when tools obscure the user's actual experience. Competitor reviews
  also flag formatting friction and generic AI content. The product already
  provides transparent local role review and import verification, so another
  matcher, automatic rewrite, or template was lower value than removing a
  visible workflow bottleneck.
- Decision: prioritized mobile information hierarchy. On a 390px viewport the
  prior layout placed version history, role focus, and six resume checks before
  the first editable field. The new Review tools strip keeps those capabilities
  one tap away while making editing the immediate default; desktop remains fully
  expanded. This won over DOCX export and deeper import parsing because it is a
  small change on every mobile editing session with no compromise to privacy or
  factual control.
- Implementation: added a reusable mobile review-tools control, moved mobile
  version history, role focus, and resume checks behind its accessible toggles,
  and close those panels before direct field-jump actions. Added mobile browser
  coverage and aligned the README and roadmap.
- Why it matters: job seekers can start editing immediately instead of scrolling
  through a dashboard, yet retain quick access to guidance, tailored wording,
  and safe checkpoints when they need them.
- Verification: `CI=true node_modules/.bin/tsc --noEmit`, `CI=true
  node_modules/.bin/next lint`, and `CI=true node_modules/.bin/vitest run`
  (27 tests) passed. `node_modules/.bin/playwright test` passed all 28 browser
  tests using the repository's existing local server; `CI=true` could not start
  a duplicate server because port 3100 was already in use. `CI=true
  node_modules/.bin/next build` and `git diff --check` passed.
- Provisional next direction only: reassess whether the now-expanded mobile
  import review still puts too much source context ahead of correction, versus
  an ATS-safe output format such as DOCX, before choosing another feature.

## 2026-07-10 08:33 PDT

- Market research and reprioritization: recent job-seeker discussion continues
  to treat job-specific tailoring, keyword gaps, and exports as baseline
  expectations, but repeatedly calls out slow tailoring, unreliable parsing,
  and distrust of opaque or untruthful optimization. Competitors such as Teal,
  Jobscan, and newer tailor tools compete heavily on match scores and rewrites;
  this product's local, reviewable approach is more differentiated when its
  import path is easier to verify.
- Decision: shipped an import-source reference instead of an ATS score,
  template, DOCX export, or another matching heuristic. Source verification
  won because deterministic parsing is the highest-risk step in the existing
  first-use workflow, and it is a small improvement users notice immediately.
- Implementation: PDF and pasted-text imports now retain the normalized text
  used by the parser with the local import-review state. A collapsed, readable
  reference lets people compare extracted text with editable fields before
  confirming them; completion still clears the export reminder. The
  parser's established state-returning APIs remain compatible, with new
  source-aware wrappers used by the editor.
- Why it matters: people can catch a missing or misplaced fact without
  switching back to their original document or trusting the importer blindly,
  while keeping sensitive resume data in the browser.
- Verification: `CI=true pnpm typecheck`, `CI=true pnpm lint`, `CI=true pnpm
  test` (27 tests), `node_modules/.bin/playwright test` (27 tests; direct Next
  binary used because the `pnpm dev` wrapper is blocked by the existing
  `workerd` build-script policy), `CI=true node_modules/.bin/next build`, and
  `git diff --check` passed.
- Provisional next direction only: reassess mobile correction density,
  import-quality explanation, and ATS-safe template choice against fresh
  market evidence before selecting the next improvement.

## 2026-07-10 06:45 PDT

- Market research and reprioritization: current resume-tailoring products make
  job-description matching and keyword feedback commonplace, while user feedback
  warns against generic suggestions and opaque automation. That made trustworthy
  import review higher value than another match heuristic or template this run.
- User problem addressed: the editor promised review of every imported field but
  only created a review item for the first experience, education, and project,
  leaving later imported history easy to miss before export.
- Implementation: import review now creates a distinct, direct field jump and
  explicit confirmation for every non-empty imported repeatable entry. Labels
  identify the exact entry number, so users can navigate and confirm long work
  histories without guessing what was covered.
- Why it matters: users can verify parsing errors anywhere in their resume,
  retain control of factual content, and trust the local import flow before
  tailoring or exporting.
- Verification: `CI=true node_modules/.bin/tsc --noEmit`,
  `CI=true node_modules/.bin/next lint`, `CI=true node_modules/.bin/vitest run`
  (26 tests), `node_modules/.bin/playwright test` (27 tests),
  `CI=true node_modules/.bin/next build`, and `git diff --check` all passed.
  The `pnpm` wrapper could not begin checks because its supply-chain policy
  requires an explicit build-script decision for the already-locked `workerd`
  dependency, so the repository's installed binaries were used instead.
- Provisional next direction only: reassess an import-source comparison view,
  mobile editing density, and ATS-safe template choice against fresh research.

## 2026-07-10 06:28 PDT

- Market reassessment: fresh review of Jobscan, Teal, and Rezi confirms that
  role matching, keyword lists, and AI rewrites are crowded baseline features.
  Current comparison feedback also notes that workflows can feel overwhelming,
  keyword lists can contain filler, and users should not add skills they do not
  have just to improve a score. The product already gives a local, transparent
  wording review and explicit import confirmation, so another matcher,
  template, automatic rewrite, or job tracker was lower-value than getting
  first-time users into the right import path.
- Decision: prioritized the first-run source-selection hierarchy. The
  onboarding now makes pasted text the recommended path for copied resumes,
  LinkedIn, and OCR, scopes PDF import to selectable-text files, and places
  saved-work and sample options in clear secondary positions.
- Why it matters: users can avoid a failed PDF-import attempt and understand
  what will happen before they commit to an import, while retaining a private,
  field-by-field review before PDF export.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test` (25 tests), `CI=true pnpm test:e2e` (26 tests),
  `CI=true pnpm build`, and `git diff --check`.
- Provisional next opportunity: reassess whether richer import correction
  context, mobile editing density, or an ATS-safe template choice now creates
  more first-use value than DOCX export or additional role-matching heuristics.

## 2026-07-10 05:30 PDT

- Market reassessment: current Teal and Resume.io messaging reinforces that
  job-specific tailoring, import, and immediate guidance are baseline
  expectations. Recent job-seeker discussion describes the repeated work of
  tailoring and a distrust of automatic rewriting or paywalled promises; users
  need to stay in control of the final wording. The product already has a
  transparent local Role Focus review and explicit import confirmation, so more
  matching heuristics, templates, automatic rewrites, or application tracking
  were lower-value than reducing friction in the existing correction flow.
- Decision: prioritized in-place import correction. The import review now has a
  clear next-field action, and each highlighted imported field carries its own
  explicit confirm/reopen control beside the editable value. The summary still
  shows every suggested field and export remains gated until review completion.
- Why it matters: people can correct a parsed value and acknowledge it in the
  same place, instead of repeatedly scrolling between an import checklist and
  the editor. This keeps human review obvious without pretending that imported
  content is automatically correct.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`, `CI=true
  pnpm test` (25 tests), `CI=true pnpm test:e2e` (25 tests), `CI=true pnpm
  build`, and `git diff --check`.
- Provisional next opportunity: reassess whether the empty-state action
  hierarchy, richer import correction context, or mobile editing density now
  creates more first-use value than templates, DOCX export, or additional
  role-matching heuristics.

## 2026-07-10 04:31 PDT

- Market reassessment: current Teal and Jobscan positioning continues to make
  job-description matching table stakes, and recent job-seeker discussion
  describes tailoring as time-consuming. But the stronger immediate signal is
  first-use trust: Teal recommends importing a comprehensive foundation before
  tailoring, while current user feedback warns that users still need to review
  AI/imported output rather than accept it blindly. The product already has a
  transparent role review with requirement ranking, phrase checks, and evidence
  locations, so another matching heuristic or template was lower value.
- Decision: prioritized import-review completion. Imported PDF and pasted-text
  resumes now present each suggested field with separate review and explicit
  confirmation actions, a visible completion count, and a Finish review action
  that clears the export reminder only after every suggested field is confirmed.
  This remains an acknowledgement, not a claim that parsing is correct.
- Why it matters: people can confidently correct the fields that deterministic
  parsing is most likely to misread before role tailoring or PDF export, without
  losing the local-only workflow or being forced into a black-box score.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`, `CI=true
  pnpm test` (25 tests), `CI=true pnpm test:e2e` (25 tests), `CI=true pnpm
  build`, and `git diff --check`.
- Provisional next opportunity: reassess whether the first-run action hierarchy
  or a clearer before/after import correction flow now creates more value than
  adding templates, DOCX export, or more role-matching heuristics.

## 2026-07-10 03:32 PDT

- Market reassessment: Jobscan, Teal, and Resume Worded continue to make
  job-description comparison and review standard. Recent job-seeker discussion
  describes manual tailoring as exhausting, while reviews value actionable,
  role-specific feedback and warn against generic or opaque scoring. The
  existing product already has local import, mobile focus, evidence checks,
  and a transparent wording review, so templates, an ATS score, and automatic
  rewrites were lower value this session.
- Decision: made Role Focus requirement-aware. The prior repeated-word ranking
  could bury a one-time must-have; it now recognizes explicit
  qualifications-style headings, brings a bounded set of those terms to the
  front, and labels each as present or worth review. Benefits and other known
  non-requirement sections stop the local parser.
- Why it matters: applicants can check the job's stated requirements first,
  then trace existing wording back to truthful resume evidence, without
  uploading sensitive data or treating a keyword tally as a hiring prediction.
- Verification: ran `CI=true node_modules/.bin/tsc --noEmit`,
  `CI=true node_modules/.bin/next lint`, `CI=true node_modules/.bin/vitest run`
  (24 tests), `CI=true node_modules/.bin/playwright test` (25 tests),
  `CI=true node_modules/.bin/next build`, and `git diff --check`.
- Provisional next opportunity: reassess whether import-review confidence and
  correction guidance now create more first-use value than improving local
  phrase ranking or adding another resume template.

## 2026-07-10 02:29 PDT

- Market reassessment: current Jobscan and Teal positioning makes
  job-description matching a table-stakes expectation. Recent job-seeker
  discussions point to time-consuming tailoring and distrust of generic AI
  rewrites or opaque scores, while reviews value actionable, role-specific
  feedback. This product already has a local phrase and term review, so a new
  template, a numerical score, or automatic rewriting was lower value than
  making existing match signals traceable to real resume evidence.
- Decision: added evidence locations to Role Focus. Matched job-description
  terms now show whether they occur in an experience/project detail or only in
  a title, summary, or skills, and each location jumps directly to the editable
  field. The UI asks users to ground supporting mentions in truthful
  achievements rather than copy missing keywords.
- Why it matters: users can quickly audit whether role language is backed by
  concrete work, then make a focused revision without losing their place or
  trusting a black-box ATS score.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test` (23 tests), `CI=true pnpm test:e2e` (24 tests),
  `CI=true pnpm build`, and `git diff --check`.
- Provisional next opportunity: reassess whether first-run import confidence,
  mobile action density, or a requirement-aware local role review produces the
  largest remaining job-application friction.

## 2026-07-10 01:34 PDT

- Market reassessment: attempted fresh research across Teal, Jobscan, review
  sites, and job-seeker discussion. The available web search did not return and
  the competitor/review pages were blocked by their bot protections, so no
  source claims from those pages were used as evidence. The market category is
  still crowded with keyword-match tooling, while the current product already
  offers a local, transparent wording review. That made more matching or a
  decorative template lower value than making the existing resume-quality
  guidance immediately usable during editing.
- Decision: shipped in-context evidence guidance for experience and project
  entries. Each entry now counts bullets with measurable scope or results and
  identifies the precise bullets to reconsider, while explicitly preserving the
  reminder that not every bullet needs a number.
- Why it matters: a top-level readiness warning now leads to an immediately
  understandable edit in the same field, helping people replace generic
  responsibilities with truthful, concrete proof without a black-box score.
- Provisional next opportunity: reassess import-review confidence and the
  first-use path against newly accessible market feedback before adding more
  role-tailoring features.

## 2026-07-10 00:29 PDT

- Market reassessment: current products such as Teal and Jobscan center
  job-description matching, but recent job-seeker discussion still asks for
  concise, ATS-safe resumes with quantified impact rather than decorative
  templates or opaque scores. The editor already has a privacy-first import
  path and transparent Role Focus, so a new template or additional keyword
  matching was lower-value this session.
- Decision: shipped one Resume Check for measurable evidence. It flags when
  fewer than half of experience and project bullets show a quantified scope or
  result, names the exact coverage, and focuses the first bullet that needs a
  stronger proof point. The guidance explicitly says not every bullet needs a
  number.
- Why it matters: users get a concrete prompt to replace generic
  responsibilities with credible outcomes while keeping the decision and all
  resume data local.
- Provisional next opportunity: reassess whether import-review confidence cues
  or more granular low-evidence guidance creates the largest remaining friction.

## 2026-07-09 23:27 PDT

- Reassessed current alternatives and user discussion: Teal and Jobscan make
  job-specific matching and review standard, while users still emphasize quick
  imports, readable output, and control over automatic tailoring. The existing
  local Role Focus already covers the transparent review need; improving the
  no-account import path remained the larger first-use win.
- Decision: keep the pasted-text importer as this session's only shipped
  improvement, ahead of more role-matching, checkpoint, or template work.
  Pasting from documents, LinkedIn, and OCR&apos;d scans is the smallest way to
  remove a common import dead end without adding a backend or opaque AI edits.
- Polish: made the empty-state route explicit and clarified that scanned PDFs
  need copied OCR text. The browser flow verifies this privacy-first wording,
  structured import, and required field review.
- Provisional next opportunity: reassess whether import-review confidence cues
  or more useful resume-quality guidance now creates the largest user friction.

## 2026-07-09 22:30 PDT

- Market reassessment: Jobscan and Teal lead with job-description matching, but
  user reviews repeatedly cite incomplete imports and clunky workflows. Since
  the editor already has transparent local Role Focus, another tailoring feature
  was lower value than making the first import path work for more source formats.
- Decision: shipped a local pasted-resume-text importer. It reuses the existing
  deterministic parser and mandatory review safeguards, rather than introducing
  OCR, an AI rewrite, or more opaque matching.
- Implementation: added Paste resume text to first-run and main actions, a
  privacy-forward dialog, robust line-ending cleanup, empty-input feedback,
  recovery support, and generalized import-review copy for both PDFs and pasted
  text. Added unit and browser coverage.
- Why it matters: people can move a resume from Word, LinkedIn, or a scanned PDF
  into a structured, editable, ATS-friendly workspace without accounts, uploads,
  or a PDF with extractable text.
- Provisional next opportunity: reassess whether import-review confidence cues
  or the mobile action hierarchy now creates the largest remaining friction.

## 2026-07-09 21:30 PDT

- User problem addressed: on a phone, the editor and preview were one long
  vertical page, so reaching the live resume preview after an edit meant
  scrolling through the entire form; the dense toolbar also consumed valuable
  vertical space.
- Implementation: added an accessible, sticky mobile workspace switcher for
  focused Edit resume and Preview views, converted the mobile action bar to a
  horizontal scroller, and hid the text-size slider only where it would crowd
  the smallest screens. Every field-fix link now automatically returns a user
  from Preview to the editable field. Desktop retains the existing split pane,
  and print explicitly keeps the resume preview visible.
- Why it matters: job seekers can review the actual document after each change
  without losing their place, while still reaching PDF export and all existing
  local-first actions on a narrow screen.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`, `CI=true
  pnpm test` (18 tests), `CI=true pnpm test:e2e` (20 tests), `CI=true pnpm
  build`, and `git diff --check`. Added a Playwright mobile workflow covering
  view switching and an export warning that focuses the relevant editor field.
- Future opportunities: introduce a compact mobile overflow menu if the
  toolbar gains more frequent actions, while keeping Export PDF immediately
  reachable.

## 2026-07-09 20:51 PDT

- User problem addressed: job seekers could not save two applications with the
  exact same resume wording because version history treated the resume content
  alone as a duplicate; long saved job descriptions also made drafts slow to
  scan.
- Implementation: added an optional private role label in Role Focus, persisted
  it locally and with checkpoints/backups/recovery points, and changed local
  checkpoint deduplication to use both resume content and saved role context.
  Comparisons now treat a changed label as role-context change, while cards
  show the compact label ahead of the longer pasted description.
- UI components or patterns used: existing local Role Focus, Version History,
  Alert, Badge, Input, and Dialog patterns with the Target icon.
- Why it matters: users can keep distinct, recognizable drafts for separate
  applications even before tailoring any resume bullet, without putting role
  information into the exported resume or sending it to a service.
- Verification: ran `CI=true node_modules/.bin/tsc --noEmit`,
  `CI=true node_modules/.bin/next lint`, `CI=true node_modules/.bin/vitest run`
  (13 tests), `CI=true node_modules/.bin/playwright test` (19 tests),
  `CI=true node_modules/.bin/next build`, and `git diff --check`. The `pnpm`
  wrapper itself was blocked by its minimum-release-age policy for existing
  `wrangler`/`miniflare` lockfile entries, so the checked-in project binaries
  were used.
- Future opportunities: let users selectively import checkpoint-overflow drafts
  from a backup rather than retaining only the newest five locally.

## 2026-07-09 20:27 PDT

- User problem addressed: two checkpoints could contain the same resume text
  while representing different job applications, and the comparison UI called
  that state "Current" or "No differences found."
- Implementation: added normalized local role-context comparison to checkpoint
  cards and the saved-version dialog. The UI now distinguishes a same-resume
  draft with changed Role Focus, shows concise before/after job-description
  context, and keeps resume-content differences separate.
- UI components or patterns used: existing shadcn/ui-style Alert, Badge,
  Dialog, and Card patterns with the lucide Target icon.
- Why it matters: job seekers can choose or restore the right tailored draft
  without mistaking identical resume wording for identical application context.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test` (13 tests), `CI=true pnpm test:e2e` (18 tests),
  `CI=true pnpm build`, and `git diff --check`.
- Future opportunities: let users optionally add a short private role label so
  saved checkpoints remain scannable even when descriptions are long.

## 2026-07-09 19:27 PDT

- User problem addressed: restoring a general resume checkpoint after tailoring
  for a role could leave the previous job description active, making Role Focus
  review the wrong role against the restored resume.
- Implementation: checkpoint restore now treats a missing saved role
  description (including checkpoints made before role context existed) as an
  intentional blank value; recovery points still restore the prior role
  description exactly. Added browser coverage for that switch-and-undo flow.
- UI components or patterns used: the existing local Role Focus card and
  checkpoint restore/recovery actions; no new visual complexity.
- Why it matters: job seekers can safely switch between a general resume and
  tailored drafts without accidentally reviewing language from a different job.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test` (13 tests), `CI=true pnpm test:e2e` (17 tests),
  `CI=true pnpm build`, and `git diff --check`.
- Future opportunities: make Role Focus easier to audit across saved versions
  by showing whether two compared checkpoints use different role descriptions.

## 2026-07-09 18:30 PDT

- User problem addressed: returning to a saved, job-specific resume draft did
  not recover the pasted role description that had guided its local wording
  review.
- Implementation: saved optional Role Focus descriptions alongside local
  checkpoints, made the save dialog explicit about whether that context will be
  retained, surfaced a compact context cue in each saved draft, and restored the
  description with its checkpoint. Recovery points now preserve the prior role
  description too.
- UI components or patterns used: existing shadcn/ui-style Dialog, Alert,
  Card, Badge, and Button patterns with the lucide Target icon.
- Why it matters: job seekers can resume a tailored application with its
  relevant wording context instead of repasting or accidentally reviewing
  against the wrong role.
- Verification: ran `CI=true pnpm lint`, `CI=true pnpm typecheck`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, and `CI=true pnpm build`.
- Future opportunities: let users optionally add a short, private role label
  separate from the full pasted description for quicker checkpoint scanning.

## 2026-07-09 17:30 PDT

- User problem addressed: even with an exact phrase checker, job seekers still
  had to spot every meaningful multi-word concept in a lengthy role description
  before they could review it.
- Implementation: added up to three local, deterministic two-word phrase
  suggestions derived from adjacent substantive job-description wording. A
  single click places a suggestion in the existing exact-phrase review, which
  clearly states whether it already appears in the resume. Also corrected the
  local tokenizer so terminal punctuation does not create false phrase misses.
- UI components or patterns used: existing shadcn/ui-style Card, Button,
  Input, Badge, and Alert patterns with the existing polite live-result region.
- Why it matters: users can move from role language to an honest, explicit
  wording check with fewer steps, without uploading their resume or receiving a
  black-box ATS score.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, `CI=true pnpm build`, and
  `git diff --check`. Added deterministic unit coverage and a Playwright flow
  for selecting a suggested phrase.
- Future opportunities: improve phrase candidate ranking for longer role
  descriptions while keeping each suggestion directly traceable to the pasted
  text.

## 2026-07-09 16:29 PDT

- User problem addressed: a list of individual role terms could miss an
  important multi-word concept, leaving people to guess whether their precise
  wording already appears in the resume.
- Implementation: added an opt-in Role Focus phrase check that compares a
  user-selected two-or-more-word phrase against the current resume in word
  order while ignoring punctuation and spacing. The UI explicitly reports
  either an existing phrase or a verbatim miss, preserves the local-only
  privacy model, and resets the phrase when the role description is cleared.
- UI components or patterns used: existing shadcn/ui-style Card, Input, Badge,
  and Alert patterns with a polite live-result region.
- Why it matters: job seekers can verify an important role concept without
  relying on opaque scoring or adding a phrase that does not accurately reflect
  their experience.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, `CI=true pnpm build`, and
  `git diff --check`. Added deterministic unit and browser coverage for phrase
  matching and missing phrases.
- Future opportunities: offer a small, explainable set of suggested phrases
  derived from repeated role terminology without weakening the opt-in review.

## 2026-07-09 15:30 PDT

- User problem addressed: tailoring a resume to a real job description required
  manually scanning two documents, while opaque ATS scores often make the
  result feel untrustworthy.
- Implementation: added a browser-only Role Focus card that stores a pasted job
  description locally, extracts its most repeated substantive terms, and shows
  which are already present or not found verbatim in the current resume. Added
  a clear control, an explicit accuracy reminder, and deterministic unit and
  browser coverage. Also updated two stale backup-copy expectations exposed by
  the browser suite.
- UI components or patterns used: existing shadcn/ui-style Card, Textarea,
  Badge, Alert, and Button patterns with the lucide Target icon.
- Why it matters: job seekers can make deliberate, truthful wording adjustments
  for a role without uploading their resume or trusting a black-box score.
- Verification: ran `CI=true pnpm typecheck`, `CI=true pnpm lint`,
  `CI=true pnpm test`, `CI=true pnpm test:e2e`, `CI=true pnpm build`, and
  `git diff --check`.
- Future opportunities: add an opt-in phrase-level review for multi-word role
  concepts while keeping the guidance transparent and local-first.

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
# 2026-07-11 — Actionable contact details in exported resumes

## Product review

- **Finding:** Competitor feedback and ATS guidance emphasize fast, dependable finalization. The editor already validates contact details, but a recruiter reading the preview or browser-produced PDF could not use a valid email, phone number, or portfolio link directly.
- **Options considered:** Add another opaque ATS heuristic, add a new document format, or make the final resume's existing contact information actionable. The contact-link improvement won because it removes immediate recruiter follow-up friction without adding data collection, AI claims, or a dependency.
- **Expected user benefit:** A valid email, phone number, or portfolio now stays usable from the preview and PDF, while malformed or unsafe values remain visible text so Resume Check can guide the correction.

## Changes

- Added shared safe contact-link generation for email, phone, and HTTP(S) websites.
- Rendered valid contact values as semantic links in the preview; browser print can preserve those links in the produced PDF.
- Added unit coverage for safe-link behavior and browser coverage for sample-preview contact links.
- Updated README and roadmap with the export-confidence behavior and browser-engine annotation caveat.

# 2026-07-11 — Local editable Word export

## Product review

- **Finding:** Competitors advertise Word export alongside PDF, and career-center guidance consistently says to follow the application's requested format. Resume Editor could produce an ATS-friendly PDF or plain text, but users had no local way to attach a `.docx` when a portal required it.
- **Options considered:** Add another resume-score heuristic, expand visual templates, or support the missing attachment format. A text-first Word export won because it removes a hard application blocker while preserving the product's privacy-first and conservative ATS posture.
- **Expected user benefit:** Users can download an editable Word version of the resume they just reviewed, without retyping, converting through a third party, or losing their data to a service.

## Changes

- Added a local Office Open XML (`.docx`) generator with conventional single-column text, normal headings, bullets, Letter margins, and safe email/phone/website hyperlinks.
- Added clear download paths in **More actions** and **Review Text**, with copy that distinguishes compatibility-focused Word output from the pixel-matched PDF template.
- Added archive-level unit coverage and browser download coverage, then documented the behavior and tradeoff in README and roadmap.
# 2026-07-11 — Clearer, truthful achievement bullets

## Product review

- **Finding:** Current resume guidance and recurring job-seeker feedback consistently call out action-led, outcome-focused bullets. The editor already showed whether bullets had measurable proof, but a user could still leave generic openings such as "Responsible for" without a small, in-context cue.
- **Options considered:** Add an opaque overall ATS score, add an automatic bullet rewrite, or surface a narrow wording prompt beside the affected entry. The prompt won because it improves a repeated editing task while keeping the user in control of the facts and voice.
- **Expected user benefit:** People can spot a handful of generic openings precisely when editing, make the work easier to scan if appropriate, and retain complete control over whether any wording changes.

## Changes

- Added a local, deterministic review for only a small set of clearly vague bullet openings, including "Responsible for" and "Worked on."
- Showed the affected bullet numbers alongside the existing evidence cue for experience and project entries, with explicit copy that asks users to keep their description truthful.
- Added unit and browser coverage, then documented the intentionally narrow guidance in the README and roadmap.

# 2026-07-12 — Faster recovery from imported resume sections

## Product review

- **Finding:** Competitor research and job-seeker feedback continue to point to incomplete imports as a trust-breaking failure. The editor already made skipped recognized headings explicit, but people still had to search the complete extracted-text view to compare the section content.
- **Options considered:** Add another opaque ATS score, broaden parser guesses, or make import recovery more direct. Compact source excerpts won because they reduce correction effort without inventing content or weakening the explicit field-confirmation safeguard.
- **Expected user benefit:** People can compare a recognized Experience, Education, Projects, Summary, or Skills section against the draft at a glance, then jump directly to the relevant field or add action.

## Changes

- Added local, heading-bounded source excerpts to the import coverage snapshot.
- Rendered each excerpt beside its recognized section, while retaining the existing full-source view and explicit confirmation workflow.
- Added focused Vitest and Playwright assertions and updated README and roadmap guidance.

## Verification

- Passed `CI=true pnpm lint`, `CI=true pnpm typecheck`, `CI=true pnpm test`, `CI=true PLAYWRIGHT_PORT=4217 pnpm test:e2e` (64 tests), and `CI=true pnpm build`.
