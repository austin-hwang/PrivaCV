import type { Metadata } from "next";
import { SeoLanding, type FaqItem } from "@/components/seo-landing";
import { createPageMetadata } from "@/lib/seo";

const title = "Free ATS Resume Checker — Private, No Upload";
const description =
  "See the exact text an ATS reads and catch contact, structure, density, and evidence issues. Free, no account, and your resume never leaves your browser.";

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
    answer:
      "No. The review runs in your browser. There's no account, no subscription, and no upload.",
  },
];

export const metadata: Metadata = createPageMetadata({
  title,
  description,
  path: "/ats-resume-checker",
  socialImage: "ats-resume-checker",
});

export default function AtsResumeCheckerPage() {
  return (
    <SeoLanding
      context="ATS review"
      h1="ATS resume checker that runs in your browser"
      lede={description}
      ctaLabel="Check your resume in the editor"
      heroImage={{
        src: "/social/ats-resume-checker",
        alt: "ATS resume checks for contact details, structure, bullets, and evidence",
      }}
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
      cardLayout="ledger"
      prose={[
        {
          heading: "What makes a resume ATS-friendly",
          paragraphs: [
            "Applicant tracking systems read text, not design. Columns, tables, images, and unusual fonts tend to scramble how your experience gets parsed. PrivaCV keeps your resume as clean text and lets you read what the parser actually extracts, so you can fix a vague section title or a missing phone number before an employer's software ever sees it.",
          ],
        },
      ]}
      faqHeading="What this checker can and cannot promise"
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
