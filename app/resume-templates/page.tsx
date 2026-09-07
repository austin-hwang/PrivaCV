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
      "The templates use single-column, text-based layouts with conventional sections to reduce common parsing problems. No template guarantees a particular employer's ATS result. Check the exported text and follow the posting's file requirements.",
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
          heading: "Match the template to your content",
          paragraphs: [
            "Start with Minimal for an airy sans-serif layout, or Classic for traditional serif type and ruled sections. Modern adds a centered header and navy accents. These choices change the presentation; they do not add qualifications or improve keyword relevance on their own.",
            "Technical uses a tighter layout with scannable sections for project-heavy content. Compact gives longer resumes denser spacing, but shorten repetitive bullets before squeezing the type. Executive offers a centered serif header and restrained rules for a more traditional presentation.",
            "For a first role, use the space for relevant education, projects, and experience rather than filling every section. For a longer career, prioritize recent work that supports the target role. Choose the page count that keeps the relevant evidence readable.",
          ],
        },
        {
          heading: "One resume, two file formats",
          paragraphs: [
            "The same resume content can be exported to PDF and editable Word. PDF preserves the exported page layout, while Word lets you continue editing in a word processor. Word font substitutions and later edits can change wrapping; inspect the actual file you will submit.",
            "For example, if an employer requests DOCX, export Word and check the contact line, dates, bullets, and page breaks there. If PDF is requested, open the PDF and confirm the text is selectable. A good-looking browser preview is only one part of the final check.",
          ],
        },
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
        { href: "/guides/ats-friendly-resume", label: "Resume formatting checklist" },
        { href: "/pdf-to-docx-resume", label: "Convert an existing PDF resume" },
        { href: "/ats-resume-checker", label: "ATS resume checker" },
        { href: "/free-resume-builder", label: "Free resume builder" },
        { href: "/about", label: "About PrivaCV" },
      ]}
    />
  );
}
