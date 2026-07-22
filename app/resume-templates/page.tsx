import type { Metadata } from "next";
import { SeoLanding, type FaqItem } from "@/components/seo-landing";
import { RESUME_TEMPLATES } from "@/lib/resume";
import { createPageMetadata } from "@/lib/seo";

const title = "Free ATS-Friendly Resume Templates | PDF & Word";
const description =
  "Choose six clean, single-column resume templates. Customize fonts, spacing, headings, and color, then export free to PDF or Word—no account or watermark.";

const faqItems: FaqItem[] = [
  {
    question: "Are these resume templates ATS-friendly?",
    answer:
      "Yes. They're all single-column and text-based, with no images or tables, which is the layout applicant tracking systems handle most reliably.",
  },
  {
    question: "Can I customize a template?",
    answer:
      "You can change the font, spacing, heading style, and accent color, tailor every section, and then export to PDF or an editable Word file.",
  },
  {
    question: "Do the templates cost anything?",
    answer:
      "No. Every template is free, with no account, no subscription, and no watermark on your resume.",
  },
];

export const metadata: Metadata = createPageMetadata({
  title,
  description,
  path: "/resume-templates",
  socialImage: "resume-templates",
});

export default function ResumeTemplatesPage() {
  return (
    <SeoLanding
      context="Resume templates"
      h1="Clean, ATS-friendly resume templates"
      lede={description}
      ctaLabel="Start with a template"
      breadcrumb={{ name: title, path: "/resume-templates" }}
      cards={RESUME_TEMPLATES.map((template) => ({
        title: template.label,
        body: template.description,
        image: {
          src: `/resume-template-preview/${template.id}.png`,
          alt: `${template.label} ATS-friendly resume template preview`,
        },
      }))}
      cardLayout="gallery"
      prose={[
        {
          heading: "How to choose a resume template",
          paragraphs: [
            "Pick one that stays out of the way of your writing. Single-column, text-based layouts like these are the safest bet for applicant tracking systems, and they're still easy for a person to skim. Set the type, spacing, and accent color to suit your field, then check the printed PDF and the plain text before you apply.",
          ],
        },
      ]}
      faqHeading="Choosing and using a template"
      faqItems={faqItems}
      related={[
        { href: "/ats-resume-checker", label: "ATS resume checker" },
        { href: "/free-resume-builder", label: "Free resume builder" },
        { href: "/about", label: "About PrivaCV" },
      ]}
    />
  );
}
