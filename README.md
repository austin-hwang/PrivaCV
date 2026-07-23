<p align="center">
  <img src="public/icon.svg" width="92" alt="PrivaCV logo">
</p>

<h1 align="center">PrivaCV</h1>

<p align="center">Private, local-first tools for resumes and job applications.</p>

<p align="center">
  No account · No subscription · No watermark · No resume or application upload
</p>

[Open PrivaCV](https://privacv.app) · [Privacy](https://privacv.app/privacy) · [Architecture](docs/architecture.md) · [Contributing](CONTRIBUTING.md)

PrivaCV helps job seekers create, tailor, review, and export clean, text-based resumes, then track applications through a private lifecycle pipeline. Resume libraries, checkpoints, applications, job descriptions, and exported files stay on the device.

## Why PrivaCV

- **Private by default.** Edit a resume without creating an account or sending it to a hosted resume database.
- **Built for readable applications.** Use clean templates, preview the printed layout, and review the exact plain text before applying.
- **Flexible import and export.** Start from scratch or import PDF, DOCX, pasted text, JSON, or a saved backup. Export PDF, editable DOCX, plain text, and JSON.
- **Tailor with confidence.** Review checks, manage device-local versions, and omit lower-relevance bullets without deleting the source material.
- **Track the whole search.** Move applications through a Linear-inspired pipeline, keep immutable submission snapshots, and export a Sankey diagram for sharing.

## Highlights

- Four clean, printable resume templates with type, spacing, heading, and accent controls
- PDF and DOCX import with a deliberate field-by-field review flow
- Deterministic local vector PDF, editable DOCX, plain-text, and JSON export
- ATS-friendly plain-text review and resume checks for contact details, structure, density, and measurable evidence
- Device-local autosave, named checkpoints, backups, restore points, and undo
- Responsive editor and print layout with page-boundary guidance
- Optional local AI assistance that runs in the browser after a person explicitly prepares a model
- IndexedDB application pipeline with status history, next actions, job snapshots, submitted-resume snapshots, CSV/JSON backup, and restore
- Connected Sankey visualization with downloadable PNG output

## Privacy

PrivaCV is local-first. Resume and job-search information is processed and stored in IndexedDB in the browser profile or Electron app profile, not in a hosted application database. If a user explicitly enables local AI, model files are downloaded to that local profile; resume text is not sent to an AI API. The optional experimental device handoff sends the active resume directly over an encrypted WebRTC data channel after the user scans a private QR link. A short-lived Cloudflare room holds only encrypted connection details for up to five minutes; its decryption key stays in the link fragment, and the resume is never uploaded to the room. Cloudflare's STUN service sees connection metadata but not the resume payload. The hosted web app records anonymous aggregate export, local-AI, and application-creation events without resume content, application data, prompts, generated text, or identity or device identifiers. Packaged desktop builds use local no-op metric endpoints and do not submit those events.

See the live [privacy page](https://privacv.app/privacy) or its [source](app/privacy/page.tsx) for the plain-language explanation. Please read the privacy requirements in [CONTRIBUTING.md](CONTRIBUTING.md) before adding storage, network requests, fixtures, or telemetry.

## Run locally

Prerequisites: Node.js 22 and Corepack. The repository pins its pnpm version in `package.json`.

```sh
corepack enable
pnpm install
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Run as a desktop app

The Electron development command starts Next.js and opens the two product
workspaces in a sandboxed desktop window:

```sh
pnpm desktop:dev
```

Create an offline production application bundle for the current platform:

```sh
pnpm desktop:package
```

Create the platform distributable and run the packaged-app smoke test:

```sh
pnpm desktop:make
pnpm desktop:smoke
```

Bundles and distributable ZIPs are written to `out/`. The packaged app starts a
loopback-only Next.js server and stores resume and application data in its own
Electron profile. The resume and applications workspaces work offline. Local AI
also runs on-device, but each model must be downloaded once before that model can
be used offline.

Desktop builds omit the public-site explainer, structured SEO data, Ko-fi widget,
and public landing pages. Public resume routes redirect to the resume workspace;
tracker landing pages redirect to the applications workspace. The hosted web app
continues to serve those public pages normally.

The current release workflow targets macOS on Apple silicon and Windows x64.
Archives are unsigned until platform credentials are configured, so macOS
Gatekeeper or Windows SmartScreen may warn when opening them.

### Opening an unsigned macOS build

The current macOS archive is unsigned and unnotarized. After downloading it,
macOS may incorrectly report that `PrivaCV` is damaged. If the archive came
from this repository's GitHub Release, extract it, move `PrivaCV.app` to
`/Applications`, and remove the quarantine attribute:

```sh
xattr -dr com.apple.quarantine "/Applications/PrivaCV.app"
open "/Applications/PrivaCV.app"
```

Only bypass Gatekeeper for a build you trust. The current release targets Apple
silicon; `uname -m` should print `arm64`. A locally built production app can be
opened without using the downloaded archive:

```sh
pnpm desktop:package
open "$(pwd)/out/PrivaCV-darwin-arm64/PrivaCV.app"
```

Once releases are signed with an Apple Developer ID and notarized by Apple,
users will no longer need this workaround.

### Desktop releases

Desktop releases are built on GitHub from version tags. Update the version in
`package.json`, commit the change, then push the matching tag:

```sh
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions verifies that the tag matches `package.json`, builds and
smoke-tests Apple-silicon macOS and x64 Windows ZIPs, then attaches them to a
draft GitHub Release. Review the draft before publishing it. The workflow uses
GitHub's repository-scoped token; signing credentials are separate and optional.

## Quality checks

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:e2e
pnpm build
```

Changes to the desktop shell or packaging should also run:

```sh
pnpm desktop:make
pnpm desktop:smoke
```

Install Chromium once before the browser suite:

```sh
pnpm exec playwright install chromium
```

The default suite is self-contained and excludes downloaded third-party resumes. Maintainers can run the optional hash-pinned import corpus with `pnpm test:public-resumes`; see [its fixture policy](tests/fixtures/public-resumes/README.md) first.

## Deploying

The production project is configured for Cloudflare via OpenNext. Forks must change the worker, route, service, and dataset names in `wrangler.jsonc` before deploying; the committed values describe the live PrivaCV deployment.

```sh
pnpm deploy
```

Production builds default to the official `https://privacv.app` origin for canonical URLs, the sitemap, and absolute social-preview URLs. Override `NEXT_PUBLIC_SITE_URL` only when a staging or preview build needs its own canonical origin.

```sh
NEXT_PUBLIC_SITE_URL=https://privacv.app
```

Use [.env.example](.env.example) as the starting point.

### Anonymous product metrics

Production deploys include a Cloudflare Analytics Engine dataset named `privacv_exports`. It records only `resume_export` and the format. To inspect the total and format breakdown through the Analytics Engine SQL API:

```sql
SELECT SUM(_sample_interval) AS exports
FROM privacv_exports
WHERE blob1 = 'resume_export';

SELECT blob2 AS format, SUM(_sample_interval) AS exports
FROM privacv_exports
WHERE blob1 = 'resume_export'
GROUP BY blob2
ORDER BY exports DESC;
```

Inline local-AI milestones use a separate `privacv_inline_ai` dataset. It records only `inline_ai_used` and `inline_ai_accepted`:

```sql
SELECT blob1 AS event, SUM(_sample_interval) AS events
FROM privacv_inline_ai
GROUP BY blob1
ORDER BY events DESC;
```

Successful, manually created application records use `privacv_job_applications`. Imports, edits, status changes, reloads, and migrations do not increment this metric:

```sql
SELECT SUM(_sample_interval) AS applications_tracked
FROM privacv_job_applications
WHERE blob1 = 'job_application_created';
```

## Project structure

| Path          | Purpose                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------- |
| `app/`        | Next.js routes, metadata, public pages, route handlers, and global styles                   |
| `features/`   | Resume and applications workspaces plus shared product-shell composition                    |
| `components/` | Cross-feature components and product-agnostic UI primitives                                 |
| `desktop/`    | Electron main process, development launcher, Next.js packager, assets, and smoke test       |
| `lib/`        | Resume/application domains, IndexedDB adapters, imports, exports, checks, and Sankey layout |
| `tests/`      | Playwright browser coverage and opt-in integration fixture metadata                         |
| `docs/`       | Architecture and maintainer documentation                                                   |

Read [docs/architecture.md](docs/architecture.md) before changing persistence, privacy boundaries, metrics, or cross-feature module ownership.

## Contributing and security

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), use synthetic data in every public artifact, and run the full local check set before opening a pull request. Report vulnerabilities privately by following [SECURITY.md](SECURITY.md); never attach a real resume or application record to a public issue.

## Technology

Next.js · React · TypeScript · Tailwind CSS · Radix UI · Zod · Vitest · Playwright · Electron · Electron Forge · Cloudflare/OpenNext
