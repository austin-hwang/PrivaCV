# Public resume import fixtures

These opt-in integration fixtures are downloaded directly from public GitHub sources and are not committed to the repository. Some contain real, publicly posted contact information, so `downloads/` is gitignored.

Run `pnpm test:public-resumes` to download the exact files in `manifest.json`, verify their SHA-256 hashes, and import them through the real browser UI. The manifest covers two Word layouts, six distinct one-page/single-column PDFs, a multi-page single-column PDF, and a multi-page academic PDF.

The assertions intentionally verify structural facts visible in the source documents (contact fields, entry titles, counts, and section preservation) rather than full parser snapshots. This keeps the checks useful when a general heuristic improves details without coupling the importer to one template.
