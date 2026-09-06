import type { Metadata } from "next";
import { JobPipeline } from "@/features/applications";
import { VisitorMetrics } from "@/components/visitor-metrics";
import { createPageMetadata } from "@/lib/seo";

const title = "Private Job Application Tracker";
const description =
  "Track job applications, interviews, follow-ups, resumes, outcomes, and your job-search Sankey privately in your browser with PrivaCV.";

export const metadata: Metadata = {
  ...createPageMetadata({
    title,
    description,
    path: "/applications",
    socialImage: "job-application-tracker",
  }),
  robots: { index: false, follow: false },
};

export default function ApplicationsPage() {
  return (
    <>
      <JobPipeline />
      {process.env.PRIVACV_DESKTOP_APP !== "1" && <VisitorMetrics workspace="job_applications" />}
    </>
  );
}
