import type { Metadata } from "next";
import { SeoLanding, type FaqItem } from "@/components/seo-landing";
import { createPageMetadata, webApplicationJsonLd } from "@/lib/seo";

const title = "Free Job Search Sankey Generator — Export PNG";
const description =
  "Automatically turn tracked job applications into a Sankey diagram of interviews, offers, rejections, and outcomes. Free PNG export with no sign-up.";

const faqItems: FaqItem[] = [
  {
    question: "What is a job search Sankey diagram?",
    answer:
      "It is a flow chart whose bands show how applications progressed into interviews, offers, acceptances, rejections, withdrawals, or no response. Wider bands represent more applications.",
  },
  {
    question: "Do I have to count every stage myself?",
    answer:
      "No. Update application statuses in the PrivaCV tracker and the Sankey view reconstructs the funnel from the recorded timeline.",
  },
  {
    question: "Can I post the chart on Reddit or social media?",
    answer:
      "Yes. The Sankey view downloads a high-resolution PNG with stage counts, percentages, a date, and a clean light background suitable for sharing.",
  },
  {
    question: "Which applications are included?",
    answer:
      "The diagram includes roles that reached Applied or a later stage. Saved and Preparing opportunities are excluded and reported separately so they do not inflate the application funnel.",
  },
  {
    question: "Is my job-search history uploaded to make the image?",
    answer:
      "No. The diagram is calculated from the local application timeline, and the browser renders the PNG on your device.",
  },
];

export const metadata: Metadata = createPageMetadata({
  title,
  description,
  path: "/job-search-sankey",
  socialImage: "job-search-sankey",
});

const structuredData = webApplicationJsonLd({
  name: "PrivaCV Job Search Sankey Generator",
  description,
  path: "/job-search-sankey",
  featureList: [
    "Automatic job application funnel reconstruction",
    "Applications-to-interviews-to-offers Sankey flow",
    "Accepted, rejected, withdrawn, and no-response outcomes",
    "Stage counts and conversion percentages",
    "High-resolution PNG export",
    "Browser-only private rendering",
  ],
});

export default function JobSearchSankeyPage() {
  return (
    <>
      <SeoLanding
        h1="Make a Sankey diagram from your job search"
        lede={description}
        ctaLabel="Create your job search Sankey"
        ctaHref="/applications"
        heroImage={{
          src: "/social/job-search-sankey",
          alt: "Job search Sankey showing applications flowing into interviews, offers, and outcomes",
        }}
        breadcrumb={{ name: title, path: "/job-search-sankey" }}
        cards={[
          {
            title: "Built from real status history",
            body: "The chart uses the stages recorded for each application, so a later rejection still flows through Interviewing or Offer when that is what happened.",
          },
          {
            title: "Counts and conversion rates",
            body: "Each node shows the number and percentage of submitted applications that reached that point in your search.",
          },
          {
            title: "Ready to share",
            body: "Download a high-resolution PNG with a title, date, readable labels, and a clean background for Reddit, a portfolio, or your own records.",
          },
          {
            title: "No spreadsheet formulas",
            body: "Track applications normally on the board. The visualization updates automatically as applications move through the pipeline.",
          },
          {
            title: "Filter the story",
            body: "Search and scope controls let you visualize the applications currently in view when you want to examine a subset of the job search.",
          },
          {
            title: "Rendered privately",
            body: "Application history stays in browser storage. The SVG diagram and PNG are generated locally rather than sent to an image service.",
          },
        ]}
        prose={[
          {
            heading: "How the automatic job-search funnel works",
            paragraphs: [
              "Every application has a current status and a local activity timeline. PrivaCV uses that history to reconstruct the furthest meaningful stages the application reached. An application that interviewed and was later rejected therefore flows from Applications to Interviewing to Not selected, instead of looking like a direct rejection.",
              "Offer and acceptance paths work the same way. Applications still awaiting a first response, currently interviewing, or considering an offer stop at their current stage. Withdrawals and no-response outcomes branch from the stage where the process ended.",
            ],
          },
          {
            heading: "Why job seekers share Sankey charts",
            paragraphs: [
              "A list of applications tells you what happened one company at a time. A Sankey diagram shows the shape of the entire search: the response rate after applying, the share of interviews that became offers, and where most opportunities ended.",
              "The visual is also an understandable way to share a completed search without publishing company names, recruiter contacts, notes, or resume content. PrivaCV's exported image contains aggregate stage counts rather than the private records behind them.",
            ],
          },
        ]}
        faqItems={faqItems}
        related={[
          { href: "/job-application-tracker", label: "Private job application tracker" },
          { href: "/free-resume-builder", label: "Free resume builder" },
          { href: "/guides/ats-friendly-resume", label: "ATS-friendly resume guide" },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
}
