export const EXPORT_METRIC_PATH = "/api/metrics/export";
export const EXPORT_FORMATS = ["pdf", "docx", "txt", "copy", "json", "md"] as const;

export type ResumeExportFormat = (typeof EXPORT_FORMATS)[number];

/**
 * Record one anonymous export action. This deliberately sends only the format:
 * no resume content, draft identifier, account, or device identifier.
 * Metrics must never block or surface an error in the export flow.
 */
export function trackResumeExport(format: ResumeExportFormat) {
  void fetch(EXPORT_METRIC_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format }),
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}
