# Contributing to PrivaCV

Thanks for helping make private job-search tools easier to use. Small fixes and focused pull requests are welcome. For a large feature or architectural change, open an issue first so the direction can be agreed on before substantial work begins.

## Local setup

PrivaCV uses Node.js 22 and pnpm 11. The pnpm version is pinned in `package.json`.

```sh
corepack enable
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Open <http://127.0.0.1:3000>.

For desktop-shell work, start the Electron development app instead:

```sh
pnpm desktop:dev
```

## Before opening a pull request

Run the same checks as CI:

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

`pnpm test:e2e` uses only committed synthetic fixtures. `pnpm test:public-resumes` is an optional networked integration suite that downloads hash-pinned documents into a gitignored directory.

Changes under `desktop/`, `forge.config.cjs`, the desktop conditionals in
`app/` or `next.config.ts`, or the release workflow should also run on a
supported host:

```sh
pnpm desktop:make
pnpm desktop:smoke
```

## Project boundaries

- `app/` owns routes, metadata, public content, server endpoints, and the web/desktop route split.
- `features/resume/` and `features/applications/` own their workspace coordinators, views, and workflow hooks.
- `features/shared/` owns product-shell UI shared across workspaces and must not depend on either feature.
- `components/` owns cross-feature components and product-agnostic UI primitives.
- `desktop/` owns the Electron lifecycle, standalone-server packaging, desktop assets, and packaged smoke test; it must not duplicate product-domain logic.
- `lib/` contains domain models, pure transformations, persistence adapters, importers, and exporters.
- `tests/` contains browser-level behavior; colocated `*.test.ts(x)` files contain unit tests.

Keep browser storage behind the adapters in `lib/`. Prefer pure functions for resume and application transformations, and cover them with unit tests. Browser tests should exercise user-visible behavior rather than private component implementation.

## Privacy requirements

Privacy is a product invariant, not an optional feature.

- Never commit a real resume, job application, email address, phone number, API key, or downloaded model artifact.
- Use synthetic people and organizations in fixtures and screenshots.
- Do not add telemetry containing resume text, application data, prompts, generated text, account identifiers, or device fingerprints. Resume exports and application-creation metrics may share the documented random browser-profile visitor ID; honor GPC/DNT, reset it with Delete all data, and keep it out of local-AI events and portable document data. Do not collect separate workspace-visit events.
- Any new network request that can occur in the workspace must be documented in the privacy page and called out in the pull request.
- Desktop-only network behavior must remain explicit. Loopback requests are local; model downloads and external links are the only expected remote desktop traffic.
- Public-document parser fixtures must follow `tests/fixtures/public-resumes/README.md` and remain opt-in.

## Pull requests

Keep changes focused, explain the user-visible outcome, and include tests proportional to the risk. Update the README, privacy page, or architecture notes when behavior or data flow changes.
