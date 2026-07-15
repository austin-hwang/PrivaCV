<p align="center">
  <img src="app/icon.svg" width="92" alt="PrivaCV logo">
</p>

<h1 align="center">PrivaCV</h1>

<p align="center">A private, ATS-friendly resume editor that works in your browser.</p>

<p align="center">
  No account · No subscription · No watermark · No resume upload
</p>

PrivaCV helps job seekers create, tailor, review, and export clean, text-based resumes. Your resume library, per-resume edit history, imports, and exported files stay on your device.

## Why PrivaCV

- **Private by default.** Edit a resume without creating an account or sending it to a hosted resume database.
- **Built for readable applications.** Use clean templates, preview the printed layout, and review the exact plain text before applying.
- **Flexible import and export.** Start from scratch or import PDF, DOCX, pasted text, JSON, or a saved backup. Export PDF, editable DOCX, plain text, and JSON.
- **Tailor with confidence.** Review checks, manage browser-only versions, and omit lower-relevance bullets without deleting the source material.

## Highlights

- Four clean, printable resume templates with type, spacing, heading, and accent controls
- PDF and DOCX import with a deliberate field-by-field review flow
- Local PDF, editable DOCX, plain-text, and JSON export
- ATS-friendly plain-text review and resume checks for contact details, structure, density, and measurable evidence
- Local browser autosave, named checkpoints, backups, restore points, and undo
- Responsive editor and print layout with page-boundary guidance
- Optional local AI assistance that runs in the browser after a person explicitly prepares a model

## Privacy

PrivaCV is local-first. Resume information is processed and stored in the browser, not in an application database. If a user explicitly enables local AI, model files are downloaded to the browser; resume text is not sent to an AI API. Exports and inline-AI request/acceptance actions record anonymous aggregate events without resume content, prompts, generated text, or identity or device identifiers.

See the in-app [privacy page](app/privacy/page.tsx) for the product’s plain-language explanation.

## Run locally

Prerequisite: Node.js and [pnpm](https://pnpm.io/).

```sh
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

## Deploying

The project is configured for Cloudflare via OpenNext.

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
| `components/` | Editor, brand, and UI components |
| `hooks/` | Client-side editor state and persistence |
| `lib/` | Resume model, imports, exports, checks, and workspace logic |
| `tests/` | Playwright browser coverage |

## Technology

Next.js · React · TypeScript · Tailwind CSS · Radix UI · Zod · Vitest · Playwright · Cloudflare/OpenNext
