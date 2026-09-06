export const JOB_APPLICATION_METRIC_PATH = "/api/metrics/job-applications";
export const JOB_APPLICATION_CREATED_EVENT = "job_application_created";

/**
 * Record application creation with a random browser-profile visitor ID.
 * No application content or record ID is sent; never block the local save flow.
 */
export function trackJobApplicationCreated() {
  void trackIdentifiedMetric(JOB_APPLICATION_METRIC_PATH, { event: JOB_APPLICATION_CREATED_EVENT });
}
import { trackIdentifiedMetric } from "./visitor-metrics";
