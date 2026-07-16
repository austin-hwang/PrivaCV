import type { Metadata } from "next";
import { SeoLanding, type FaqItem } from "@/components/seo-landing";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

const title = "ATS Resume Checker";
const description =
  "See how an applicant tracking system will read your resume, right in your browser. PrivaCV shows the exact plain text a parser pulls out and flags gaps in your contact details, structure, and evidence. No upload, no account.";

const faqItems: FaqItem[] = [
  {
    question: "How does PrivaCV check my resume for ATS compatibility?",
    answer:
      "It shows you the plain text an applicant tracking system reads, then flags issues with your contact info, section structure, density, and evidence. You review all of it in the browser, and nothing gets uploaded.",
  },
  {
    question: "Can any tool guarantee my resume passes an ATS?",
    answer:
      "No, and be wary of any that claims it can. Every applicant tracking system is a little different. What you can control is keeping the resume as clean text and checking that text yourself, which is where most parsing problems get caught.",
  },
  {
    question: "Do I need an account to check my resume?",
    answer: "No. The review runs in your browser. There's no account, no subscription, and no upload.",
  },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: SITE_URL ? { canonical: "/ats-resume-checker" } : undefined,
  openGraph: { title: `${title} | ${SITE_NAME}`, description, url: absoluteUrl("/ats-resume-checker") },
};

export default function AtsResumeCheckerPage() {
  return (
    <SeoLanding
      h1="ATS resume checker that runs in your browser"
      lede={description}
      ctaLabel="Check your resume in the editor"
      breadcrumb={{ name: title, path: "/ats-resume-checker" }}
      cards={[
        {
          title: "See the plain text",
          body: "Read the exact text an ATS pulls from your resume, so any parsing surprises show up now instead of after you apply.",
        },
        {
          title: "Contact and structure",
          body: "Make sure your name, email, phone, and section titles are all there and labeled in a way a parser can follow.",
        },
        {
          title: "Density and evidence",
          body: "Spot sections that are too crowded and bullets with no real numbers behind them, so every line earns its spot.",
        },
      ]}
      prose={[
        {
          heading: "What makes a resume ATS-friendly",
          paragraphs: [
            "Applicant tracking systems read text, not design. Columns, tables, images, and unusual fonts tend to scramble how your experience gets parsed. PrivaCV keeps your resume as clean text and lets you read what the parser actually extracts, so you can fix a vague section title or a missing phone number before an employer's software ever sees it.",
          ],
        },
      ]}
      faqItems={faqItems}
      related={[
        { href: "/guides/ats-friendly-resume", label: "Guide: ATS-friendly resume" },
        { href: "/resume-templates", label: "Resume templates" },
        { href: "/plain-text-resume", label: "Plain-text resume" },
        { href: "/about", label: "About PrivaCV" },
      ]}
    />
  );
}
