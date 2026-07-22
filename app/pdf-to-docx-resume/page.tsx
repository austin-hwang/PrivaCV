import type { Metadata } from "next";
import { SeoLanding, type FaqItem } from "@/components/seo-landing";
import { createPageMetadata } from "@/lib/seo";

const title = "PDF Resume to Word Converter — Free, No Upload";
const description =
  "Import a PDF resume, review the extracted fields, and export an editable DOCX. Free, no account, and your resume never leaves your browser.";

const faqItems: FaqItem[] = [
  {
    question: "Does the conversion keep my original PDF layout exactly?",
    answer:
      "No, and that's on purpose. PrivaCV pulls your resume's text into a clean, editable structure instead of copying the PDF's visual layout. That's what keeps the result easy to edit and reliable for applicant tracking systems.",
  },
  {
    question: "Is my PDF uploaded to a server?",
    answer:
      "No. The PDF is read in your browser and the converted resume stays on your device. It never goes to a conversion service.",
  },
  {
    question: "Is converting a PDF resume to DOCX free?",
    answer: "Yes. Import and Word export are both free, with no account and no watermark.",
  },
];

export const metadata: Metadata = createPageMetadata({
  title,
  description,
  path: "/pdf-to-docx-resume",
  socialImage: "pdf-to-docx-resume",
});

export default function PdfToDocxResumePage() {
  return (
    <SeoLanding
      context="PDF to editable document"
      h1="Convert a PDF resume to an editable Word file"
      lede={description}
      ctaLabel="Convert your PDF resume"
      heroImage={{
        src: "/social/pdf-to-docx-resume",
        alt: "PDF resume converted into an editable Word document in the browser",
      }}
      breadcrumb={{ name: title, path: "/pdf-to-docx-resume" }}
      cards={[
        {
          title: "Import your PDF",
          body: "Bring in an existing PDF resume. PrivaCV reads the text so you can work with it again.",
        },
        {
          title: "Review each field",
          body: "Go through the imported content field by field and fix anything the PDF didn't carry over cleanly.",
        },
        {
          title: "Export editable Word",
          body: "Download a clean Word document you can keep updating. No locked PDF, no watermark.",
        },
      ]}
      cardLayout="process"
      prose={[
        {
          heading: "Why convert a PDF resume to Word",
          paragraphs: [
            "A PDF is great for sending but painful to change, and some application systems would rather have an editable Word file. If a PDF is the only copy you still have, you need a way to get the text back into a document you can revise.",
            "PrivaCV imports the text from the PDF into a structured resume, lets you review and tailor it, and exports a clean Word file. Because it rebuilds the resume from the text rather than tracing the PDF's pixels, the result stays simple and ATS-friendly instead of carrying over odd spacing and layout.",
          ],
        },
      ]}
      faqHeading="Conversion questions"
      faqItems={faqItems}
      related={[
        { href: "/plain-text-resume", label: "Plain-text resume" },
        { href: "/ats-resume-checker", label: "ATS resume checker" },
        { href: "/free-resume-builder", label: "Free resume builder" },
      ]}
    />
  );
}
