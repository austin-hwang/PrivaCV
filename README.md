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
- **Tailor with confidence.** Review checks, manage browser-only versions, and omit lower-relevance bullets without deleting the source material.
- **Track the whole search.** Move applications through a Linear-inspired pipeline, keep immutable submission snapshots, and export a Sankey diagram for sharing.

## Highlights

- Four clean, printable resume templates with type, spacing, heading, and accent controls
- PDF and DOCX import with a deliberate field-by-field review flow
- Local PDF, editable DOCX, plain-text, and JSON export
- ATS-friendly plain-text review and resume checks for contact details, structure, density, and measurable evidence
- Local browser autosave, named checkpoints, backups, restore points, and undo
- Responsive editor and print layout with page-boundary guidance
- Optional local AI assistance that runs in the browser after a person explicitly prepares a model
- IndexedDB application pipeline with status history, next actions, job snapshots, submitted-resume snapshots, CSV/JSON backup, and restore
- Connected Sankey visualization with downloadable PNG output

## Privacy

PrivaCV is local-first. Resume and job-search information is processed and stored in browser IndexedDB databases, not in a hosted application database. If a user explicitly enables local AI, model files are downloaded to the browser; resume text is not sent to an AI API. Exports and inline-AI request/acceptance actions record anonymous aggregate events without resume content, application data, prompts, generated text, or identity or device identifiers.

See the live [privacy page](https://privacv.app/privacy) or its [source](app/privacy/page.tsx) for the plain-language explanation. Please read the privacy requirements in [CONTRIBUTING.md](CONTRIBUTING.md) before adding storage, network requests, fixtures, or telemetry.

## Run locally

Prerequisites: Node.js 22 and Corepack. The repository pins its pnpm version in `package.json`.

```sh
corepack enable
pnpm install
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Quality checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
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
SELECT COUNT(*) AS exports
FROM privacv_exports
WHERE blob1 = 'resume_export';

SELECT blob2 AS format, COUNT(*) AS exports
FROM privacv_exports
WHERE blob1 = 'resume_export'
GROUP BY blob2
ORDER BY exports DESC;
```

Inline local-AI milestones use a separate `privacv_inline_ai` dataset. It records only `inline_ai_used` and `inline_ai_accepted`:

```sql
SELECT blob1 AS event, COUNT(*) AS events
FROM privacv_inline_ai
GROUP BY blob1
ORDER BY events DESC;
```

## Project structure

| Path | Purpose |
| --- | --- |
| `app/` | Next.js routes, metadata, public pages, and global styles |
| `components/` | Resume editor, application pipeline, shared product shell, and UI primitives |
| `hooks/` | Client-side workflow coordination and persistence |
| `lib/` | Resume/application domains, IndexedDB adapters, imports, exports, checks, and Sankey layout |
| `tests/` | Playwright browser coverage and opt-in integration fixture metadata |
| `docs/` | Architecture and maintainer documentation |

Read [docs/architecture.md](docs/architecture.md) before changing persistence, privacy boundaries, metrics, or cross-feature module ownership.

## Contributing and security

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), use synthetic data in every public artifact, and run the full local check set before opening a pull request. Report vulnerabilities privately by following [SECURITY.md](SECURITY.md); never attach a real resume or application record to a public issue.

## Technology

Next.js · React · TypeScript · Tailwind CSS · Radix UI · Zod · Vitest · Playwright · Cloudflare/OpenNext
