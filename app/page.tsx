import { ResumeEditor } from "@/components/resume-editor";
import Link from "next/link";
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from "@/lib/site";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: SITE_NAME,
      url: absoluteUrl(),
    },
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Resume editor",
      operatingSystem: "Web",
      url: absoluteUrl(),
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "Local browser-based resume editing",
        "PDF and DOCX export",
        "PDF, DOCX, and pasted-text resume import",
        "ATS-friendly plain-text review",
        "Browser-only autosave and version history",
      ],
    },
  ],
};

export default function Home() {
  return (
    <>
      <ResumeEditor />
      <footer className="public-explainer app-chrome border-t px-4 py-6 text-center text-sm text-muted-foreground lg:px-6">
        <Link className="hover:text-foreground" href="/about">About PrivaCV</Link><span aria-hidden="true"> · </span><Link className="hover:text-foreground" href="/privacy">Privacy</Link>
      </footer>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </>
  );
}
