# Architecture

PrivaCV is a local-first Next.js application with two browser workspaces: the resume editor and the applications tracker. Public routes explain those tools and provide crawlable guides; private user data never needs a PrivaCV account or application database.

## Runtime shape

```text
Public Next.js routes ───────────────► metadata, guides, social images

Resume workspace ──► resume domain ─► IndexedDB: privacv-resume-workspace
       │                    ├────────► PDF, DOCX, text, and JSON exports
       │                    └────────► optional in-browser WebLLM model
       │
Applications workspace ─► application domain ─► IndexedDB: privacv-job-pipeline
                                      ├────────► CSV/JSON backups
                                      └────────► Sankey PNG export

Explicit aggregate event ────────────► Cloudflare Analytics Engine
```

## Browser data

`lib/resume-db.ts` owns the resume library, active resume, and per-resume checkpoints. It migrates legacy localStorage data into IndexedDB; compatibility mirrors may remain while older clients are supported. `lib/job-application-db.ts` owns applications, lifecycle events, job-description snapshots, and submitted-resume snapshots in a separate IndexedDB database.

Optional local AI runs through WebLLM in the browser. Model artifacts use browser-managed caches and are deleted through the product's **Delete all data** control. Imports are parsed locally. Portable exports and backups are only created after an explicit user action.

Changes to storage schemas must include a forward migration, normalization at the storage boundary, and browser tests that cover existing data. Never read or write these databases directly from components.

## Module responsibilities

- `app/` contains App Router pages, metadata, route handlers, and global CSS.
- `components/resume-editor.tsx` and `components/job-pipeline.tsx` are workspace coordinators. They compose feature components, but should not own reusable rendering or browser I/O.
- `components/resume-editor/` and `components/job-pipeline/` contain feature-owned views, dialogs, and controls. New workspace UI should start here instead of expanding the coordinators.
- `components/ui/` contains product-agnostic visual primitives.
- `hooks/` coordinates interactive workflows and persistence adapters. Hooks should delegate pure transformations and browser file operations to `lib/` modules.
- `lib/` contains domain models, pure transformations, import/export code, browser utilities, and storage adapters. `lib/browser-files.ts` is the shared boundary for generated downloads and clipboard fallbacks.
- `tests/` contains Playwright behavior tests grouped by product capability (for example, public-site checks live in `site.spec.ts`); unit tests live beside their `lib/` modules.

The resume domain and application domain should not import UI components. UI may call domain functions and persistence adapters. Shared product navigation belongs in the top-level component layer. Prefer a feature folder once a workspace view has independent props, behavior, or tests; keep the top-level workspace file focused on state composition and routing events between those pieces.

## Network boundary

The editor and tracker do not upload resume or application data. Network activity is limited to ordinary page/assets requests, an explicit optional model download, external links a user opens, and anonymous aggregate event endpoints. Metrics accept fixed event names and formats only; they must never accept arbitrary resume, application, prompt, generated-text, identity, or device fields.

Any change to this boundary requires updates to `app/privacy/page.tsx`, `README.md`, relevant tests, and the pull request's privacy section.

## Deployment

The production project uses OpenNext for Cloudflare. `wrangler.jsonc` intentionally describes the live PrivaCV worker, domain, service binding, and Analytics Engine datasets. A fork should change those names and routes before running deployment commands. Local development only needs Node.js, pnpm, and `NEXT_PUBLIC_SITE_URL` when testing a non-default canonical origin.

CI treats the hash-pinned public-resume import suite as opt-in because it downloads third-party documents. The normal browser suite is self-contained and must stay green without external fixture downloads.
