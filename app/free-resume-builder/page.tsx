import type { Metadata } from "next";
import { SeoLanding, type FaqItem } from "@/components/seo-landing";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

const title = "Free Resume Builder";
const description =
  "Build a professional resume free in your browser. No account, no subscription, and no watermark. Write it, tailor it, and export a clean PDF or editable Word file, with everything kept on your own device.";

const faqItems: FaqItem[] = [
  {
    question: "Is PrivaCV completely free?",
    answer:
      "Yes. No account, no subscription, no trial, and no watermark. PDF, Word, plain-text, and JSON export are all included.",
  },
  {
    question: "Do I have to sign up or give an email?",
    answer: "No. You can open the editor and start building right away without signing up for anything.",
  },
  {
    question: "Can I download my resume as a PDF or Word file?",
    answer:
      "Yes. You can export a print-ready PDF or an editable Word file straight from the browser, plus plain text or a JSON backup.",
  },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: SITE_URL ? { canonical: "/free-resume-builder" } : undefined,
  openGraph: { title: `${title} | ${SITE_NAME}`, description, url: absoluteUrl("/free-resume-builder") },
};

export default function FreeResumeBuilderPage() {
  return (
    <SeoLanding
      h1="A free resume builder that works in your browser"
      lede={description}
      ctaLabel="Build your resume free"
      breadcrumb={{ name: title, path: "/free-resume-builder" }}
      cards={[
        {
          title: "No account, no watermark",
          body: "Skip the sign-up wall and the paywalled download. Open the editor and export a clean resume with nothing stamped on it.",
        },
        {
          title: "Private by default",
          body: "Your resume, saved versions, and edit history stay in your browser. They're never sent to a resume database.",
        },
        {
          title: "Import and export freely",
          body: "Start blank or bring in a PDF, Word file, text, or JSON. Export a PDF, editable Word doc, plain text, or a backup.",
        },
        {
          title: "Built to read cleanly",
          body: "Plain, text-based templates and a plain-text preview help your resume come through correctly in an applicant tracking system.",
        },
      ]}
      prose={[
        {
          heading: "Why a free, private resume builder",
          paragraphs: [
            "Most resume builders make you create an account, hand over your work history, and then pay to drop a watermark or download a usable file. PrivaCV works the other way around. The editor is free, there's no account, and your resume stays on your own device.",
            "Write from scratch or import a resume you already have and tailor it. Check the exact plain text an employer's software reads. Then export a polished PDF or an editable Word file. You never pay and you never sign in.",
          ],
        },
      ]}
      faqItems={faqItems}
      related={[
        { href: "/resume-templates", label: "Resume templates" },
        { href: "/ats-resume-checker", label: "ATS resume checker" },
        { href: "/pdf-to-docx-resume", label: "PDF to DOCX resume" },
      ]}
    />
  );
}
