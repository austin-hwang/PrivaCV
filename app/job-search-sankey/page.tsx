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
        context="Search visualization"
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
        cardLayout="evidence"
        prose={[
          {
            heading: "Create your first job search Sankey",
            paragraphs: [
              "Start with the applications you actually submitted. The chart is built from your tracker records, so you do not need to write flow-chart code or maintain a second set of totals.",
            ],
            steps: [
              "Open the application tracker and add each company and role. Keep opportunities you have not submitted in Saved or Preparing.",
              "Move submitted applications to Applied. Record interviews and later outcomes as they happen so the timeline preserves the journey.",
              "Open the Sankey view. Check the active search and filters before interpreting the totals; the chart represents the applications currently in view.",
              "Download the PNG when you are ready to share. Review the image before posting it, and save a JSON backup separately if you want to preserve the underlying records.",
            ],
          },
          {
            heading: "Worked example: 20 submitted applications",
            paragraphs: [
              "Imagine a fictional search with 20 submissions: 10 are awaiting a response, 6 were rejected before an interview, and 4 reached an interview. Of those 4, 2 were rejected and 2 received offers. One offer was accepted and the other declined.",
              "The initial branches total 20: 10 + 6 + 4. The interview branch splits into 2 rejections and 2 offers, then the offer branch splits into 1 acceptance and 1 decline. The same application appears at successive stages; adding every node together would double-count it.",
              "In this example, 4 / 20 = 20% of applications reached an interview. The interview-to-offer rate is 2 / 4 = 50%, while the application-to-offer rate is 2 / 20 = 10%. Always name the denominator when comparing searches. These are illustrative numbers, not a hiring benchmark or PrivaCV user statistics.",
            ],
          },
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
        faqHeading="How the chart is built"
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
