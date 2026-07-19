import type { Metadata } from "next";
import { JobPipeline } from "@/components/job-pipeline";

export const metadata: Metadata = {
  title: "Private Job Application Tracker",
  description: "Track job applications, interviews, follow-ups, and outcomes privately in your browser with PrivaCV.",
  alternates: { canonical: "/applications" },
  robots: { index: false, follow: false },
};

export default function ApplicationsPage() {
  return <JobPipeline />;
}
