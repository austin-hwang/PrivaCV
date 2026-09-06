export const EXPORT_METRIC_PATH = "/api/metrics/export";
export const EXPORT_FORMATS = ["pdf", "docx", "txt", "copy", "json", "md"] as const;

export type ResumeExportFormat = (typeof EXPORT_FORMATS)[number];

/**
 * Record the format and a random, persistent browser-profile visitor ID.
 * No resume content or document identifier is sent.
 * Metrics must never block or surface an error in the export flow.
 */
export function trackResumeExport(format: ResumeExportFormat) {
  void trackIdentifiedMetric(EXPORT_METRIC_PATH, { format });
}
import { trackIdentifiedMetric } from "./visitor-metrics";
