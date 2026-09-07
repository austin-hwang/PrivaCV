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
      "No. PrivaCV extracts text into resume fields and rebuilds the document in a selected template. Review the fields before export: columns, unusual spacing, and font encodings can affect extraction. No converter can guarantee acceptance by every applicant tracking system.",
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
          heading: "From a PDF layout to editable fields",
          paragraphs: [
            "For example, a fictional PDF entry might read: Data Analyst, Example Labs, Mar 2023–Jun 2025, followed by two achievement bullets. After import, check that the role is the title, the company is the subtitle, the dates are correct, and both bullets belong to that experience entry.",
            "If a two-column PDF places a skills list beside the job history, extraction may mix their reading order. Move any misplaced skills back into Skills and check that each employer still has the correct achievements. The exported Word file uses your chosen PrivaCV template; it does not reproduce the original columns.",
          ],
        },
        {
          heading: "Check the conversion before downloading",
          paragraphs: ["Keep your original PDF until you have reviewed the editable copy."],
          steps: [
            "Check that the source PDF contains selectable text. An image-only scan needs text recognition first; do not assume a scanned page will import as editable resume fields.",
            "Compare your name, email, phone number, links, employers, titles, and dates with the original. Look for missing characters and text assigned to the wrong section.",
            "Review the plain-text version for reading order, then choose a template and inspect the resume preview for overflow or awkward page breaks.",
            "Export DOCX and open it in the word processor you will use. Font substitution can change line wrapping, so check page breaks again before submitting.",
          ],
        },
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
