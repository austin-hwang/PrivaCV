# Public resume import fixtures

These opt-in integration fixtures are downloaded directly from public GitHub sources and are not committed to the repository. Some contain real, publicly posted contact information, so `downloads/` is gitignored and the manifest checks only whether those contact fields were recovered—not their raw values.

Run `pnpm test:public-resumes` to download the exact files in `manifest.json`, verify their SHA-256 hashes, and import them through the real browser UI. Every source must declare a repository license in the manifest; the current corpus contains three MIT-licensed PDF layouts.

The assertions intentionally verify structural facts visible in the source documents (contact fields, entry titles, counts, and section preservation) rather than full parser snapshots. This keeps the checks useful when a general heuristic improves details without coupling the importer to one template.

Before adding a source, confirm that its repository permits reuse, record a stable source URL and SHA-256 digest, and prefer synthetic fixtures whenever they exercise the same parser behavior. Never commit downloaded resumes or copy personal contact values into this manifest.
