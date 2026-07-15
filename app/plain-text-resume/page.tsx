import type { Metadata } from "next";
import { SeoLanding, type FaqItem } from "@/components/seo-landing";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

const title = "Plain-Text Resume";
const description =
  "Make a clean plain-text resume for online applications and paste-into forms. Preview the exact text an ATS reads, then copy it or download a .txt file. Free, in your browser, with no account.";

const faqItems: FaqItem[] = [
  {
    question: "What is a plain-text resume?",
    answer:
      "It's your resume with the visual formatting stripped away, leaving just readable text. That's the safest thing to paste into an online application field or feed to a system that can't handle styled documents.",
  },
  {
    question: "When do I need a plain-text version?",
    answer:
      "Whenever a job board or company portal asks you to paste your resume into a text box, or when you want to confirm exactly how an applicant tracking system reads your content.",
  },
  {
    question: "Is exporting plain text free and private?",
    answer: "Yes. The plain-text preview and export both run in your browser, at no cost, with no account and no upload.",
  },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: SITE_URL ? { canonical: "/plain-text-resume" } : undefined,
  openGraph: { title: `${title} | ${SITE_NAME}`, description, url: absoluteUrl("/plain-text-resume") },
};

export default function PlainTextResumePage() {
  return (
    <SeoLanding
      h1="Create a clean plain-text resume"
      lede={description}
      ctaLabel="Build a plain-text resume"
      breadcrumb={{ name: title, path: "/plain-text-resume" }}
      cards={[
        {
          title: "See the exact text",
          body: "Preview the precise text an applicant tracking system or paste-into form receives, with no hidden formatting.",
        },
        {
          title: "Copy or download .txt",
          body: "Paste the text straight into an application field, or save a .txt file to keep next to your PDF.",
        },
        {
          title: "No formatting surprises",
          body: "It comes straight from your structured resume, so the text stays clean, ordered, and easy to read.",
        },
      ]}
      prose={[
        {
          heading: "When to use a plain-text resume",
          paragraphs: [
            "Plenty of job boards and company portals ask you to paste your resume into a text box instead of uploading a file. Styled documents fall apart in that box, so a clean plain-text version keeps your experience readable and in the right order.",
            "PrivaCV builds the plain text from your structured resume, so you can review it, make sure nothing important dropped out, and copy or download it whenever an application wants text rather than a document.",
          ],
        },
      ]}
      faqItems={faqItems}
      related={[
        { href: "/ats-resume-checker", label: "ATS resume checker" },
        { href: "/pdf-to-docx-resume", label: "PDF to DOCX resume" },
        { href: "/resume-templates", label: "Resume templates" },
      ]}
    />
  );
}
