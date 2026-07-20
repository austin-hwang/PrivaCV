export const JOB_APPLICATION_METRIC_PATH = "/api/metrics/job-applications";
export const JOB_APPLICATION_CREATED_EVENT = "job_application_created";

/**
 * Record one anonymous application-creation milestone. This sends no job,
 * resume, account, or device data and must never block the local save flow.
 */
export function trackJobApplicationCreated() {
  void fetch(JOB_APPLICATION_METRIC_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: JOB_APPLICATION_CREATED_EVENT }),
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}
