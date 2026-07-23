# Architecture

PrivaCV is a local-first Next.js application with two workspaces: the resume editor and the applications tracker. The hosted web build also serves public landing pages and crawlable guides. The Electron build packages only the product experience: it omits public-site content and redirects public routes back to a workspace. Private user data never needs a PrivaCV account or hosted application database.

## Runtime shape

```text
Hosted Next.js routes ──────────────► metadata, guides, social images

Resume workspace ──► resume domain ─► IndexedDB: privacv-resume-workspace
       │                    ├────────► PDF, DOCX, text, and JSON exports
       │                    ├────────► optional WebRTC device-data handoff
       │                    └────────► optional in-browser WebLLM model
       │
Applications workspace ─► application domain ─► IndexedDB: privacv-job-pipeline
                                      ├────────► CSV/JSON backups
                                      ├────────► optional WebRTC device-data handoff
                                      └────────► Sankey PNG export

Hosted web event ────────────────────► Cloudflare Analytics Engine

Electron main process ─► loopback-only standalone Next.js server
                      └► sandboxed renderer with a dedicated local profile
```

## Runtime variants

The web and desktop surfaces are built from the same App Router and feature modules. Normal builds retain the public pages, SEO metadata, structured data, and hosted metric endpoints. `desktop/prepare-next.mjs` sets `ELECTRON_BUILD=1` and `PRIVACV_DESKTOP_APP=1`, produces a standalone Next.js server under `.next-electron/`, and copies only the runtime resources Electron needs.

`desktop/main.cjs` starts that server on the fixed loopback origin `http://127.0.0.1:47837`, waits for readiness, and loads it in a sandboxed renderer with Node integration disabled and context isolation enabled. Permission requests and webviews are denied. External HTTP(S) and mail links leave the app through the operating system browser. The server is a local implementation detail; it does not make resume or application records remotely accessible.

Desktop mode has a deliberately smaller information architecture. `/` and `/applications` are the only user-facing pages. Resume-oriented public routes redirect to `/`, tracker landing pages redirect to `/applications`, and the home route does not render its public explainer, structured data, or support widget. The hosted build is unchanged.

## Device data

`lib/resume-db.ts` owns the resume library, active resume, and per-resume checkpoints. It migrates legacy localStorage data into IndexedDB; compatibility mirrors may remain while older clients are supported. `lib/job-application-db.ts` owns applications, lifecycle events, job-description snapshots, and submitted-resume snapshots in a separate IndexedDB database.

Optional local AI runs through WebLLM in the browser engine. Model artifacts use profile-managed caches and are deleted through the product's **Delete all data** control. Imports are parsed locally. Portable exports and backups are only created after an explicit user action. The website and Electron app use separate browser profiles, so data does not automatically move between them; use JSON backups when moving data between installations.

The experimental **Continue on another device** flow transfers a selected active resume, application pipeline, or both between two browsers that the user keeps open. Pipeline transfers include applications, lifecycle events, job-description snapshots, and submitted-resume snapshots, and merge with unrelated records on the receiving device. The sending browser creates an 80-bit secret displayed as a 16-character pairing code. HKDF derives a random-looking room ID and 256-bit AES-GCM key from that secret; the QR fragment carries the same compact code. Only the derived room ID reaches the signaling service, so the pairing secret and encryption key remain off the relay. A Cloudflare Durable Object stores the opaque encrypted offer and answer for at most five minutes. After signaling, the browsers contact Cloudflare's public STUN service to discover a direct route and send the compressed selected data over an ordered WebRTC data channel. The resume and application data never enter the signaling room. Legacy private links and manual compressed offer and answer codes remain available as fallbacks. There is no TURN fallback, so restrictive networks can prevent the devices from connecting. Version 2 transfer payloads accept version 1 resume-only payloads for backward compatibility.

PDF export dynamically loads the browser-only vector renderer in
`features/resume/lib/resume-pdf.tsx`. It embeds the selected open-source resume
font, owns Letter page geometry and margins, and consumes the live preview's
measured break targets so the downloaded file does not depend on browser print
settings or silently repaginate approved content. Font assets and their SIL OFL
licenses live in `public/fonts/resume/`.

Changes to storage schemas must include a forward migration, normalization at the storage boundary, and browser tests that cover existing data. Never read or write these databases directly from components.

## Module responsibilities

- `app/` contains App Router pages, metadata, route handlers, and global CSS.
- `features/resume/` owns the resume workspace coordinator, views, and workflow hooks. Its editor hook composes focused content-action, pagination, history, persistence, library, import, and export hooks; browser I/O stays at those boundaries instead of leaking into rendering components. Workspace chrome such as `resume-workspace-header.tsx` is composed separately from the editor and preview panes.
- `features/applications/` owns the job-pipeline coordinator, application views, and pipeline hooks.
- `features/shared/` contains product-shell UI shared by multiple workspaces, such as the application header. It must not depend on either feature.
- `components/ui/` contains product-agnostic visual primitives.
- `desktop/` owns the Electron lifecycle, local server process, platform packaging preparation, icons, and packaged-app smoke coverage. It may compose the Next.js output but must not duplicate resume or applications domain logic.
- `lib/` contains domain models, pure transformations, import/export code, browser utilities, and storage adapters. `lib/browser-files.ts` is the shared boundary for generated downloads and clipboard fallbacks.
- `tests/` contains Playwright behavior tests grouped by product capability (for example, public-site checks live in `site.spec.ts`); unit tests live beside their `lib/` modules.

The resume domain and application domain do not import UI components. UI may call domain functions and persistence adapters. Cross-feature imports should go through a feature's public `index.ts` entry point; code inside a feature may import its own modules directly. ESLint enforces route, shared-layer, and cross-feature import boundaries. Keep workspace coordinators focused on composition and routing events between focused components and hooks.

Resume browser tests live in capability suites under `tests/resume-editor/` and reuse only interaction helpers from `tests/resume-editor-support.ts`. Add new coverage to the narrowest suite so failures and focused local runs remain easy to understand.

## Network boundary

The editor and tracker do not upload resume or application data. Hosted network activity is limited to ordinary page/assets requests, an explicit optional model download, the explicit WebRTC handoff's encrypted short-lived signaling and STUN connection discovery, external links a user opens, and anonymous aggregate event endpoints. The signaling room processes a random room ID, encrypted offer and answer, expiry time, and ordinary request metadata; STUN processes connection metadata such as IP addresses and ports. Neither receives the resume or application payload. Metrics accept fixed event names and formats only; they must never accept arbitrary resume, application, prompt, generated-text, identity, or device fields.

In Electron, page, asset, API, and export-metric requests resolve against the bundled loopback server. The packaged metric handlers are no-ops, so desktop usage events do not leave the device. Optional model preparation still downloads model files from the allowlisted hosts; device handoff explicitly contacts `privacv.app` for encrypted signaling and the STUN service for its peer connection; and explicit external links still require network access. Core editing, local storage, imports, and exports work without internet access.

Any change to this boundary requires updates to `app/privacy/page.tsx`, `README.md`, relevant tests, and the pull request's privacy section.

## Deployment

The hosted production project uses OpenNext for Cloudflare. `wrangler.jsonc` intentionally describes the live PrivaCV worker, domain, service binding, and Analytics Engine datasets. A fork should change those names and routes before running deployment commands. Local web development only needs Node.js, pnpm, and `NEXT_PUBLIC_SITE_URL` when testing a non-default canonical origin.

Electron Forge packages the current host with `pnpm desktop:make`; `pnpm desktop:smoke` launches the packaged executable and checks storage, route isolation, sample loading, and PDF export. The GitHub desktop-release workflow runs those commands on Apple-silicon macOS and x64 Windows when a `v*` tag matching `package.json` is pushed, then creates a draft GitHub Release. The artifacts remain unsigned until macOS Developer ID/notarization and Windows Authenticode credentials are configured.

CI treats the hash-pinned public-resume import suite as opt-in because it downloads third-party documents. The normal browser suite is self-contained, runs isolated tests in parallel, and must stay green without external fixture downloads. Set `PLAYWRIGHT_WORKERS` to tune concurrency on constrained machines.
