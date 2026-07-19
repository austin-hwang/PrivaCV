import { describe, expect, it } from "vitest";
import { metadata as applicationsMetadata } from "@/app/applications/page";
import sitemap from "@/app/sitemap";
import { createPageMetadata, webApplicationJsonLd } from "@/lib/seo";

describe("createPageMetadata", () => {
  it("emits a complete, page-specific search and social package", () => {
    const metadata = createPageMetadata({
      title: "Free Resume Builder",
      description: "Build a resume free.",
      path: "/free-resume-builder",
      socialImage: "free-resume-builder",
    });

    expect(metadata).toMatchObject({
      title: "Free Resume Builder",
      description: "Build a resume free.",
      alternates: { canonical: "/free-resume-builder" },
      openGraph: {
        type: "website",
        siteName: "PrivaCV",
        title: "Free Resume Builder | PrivaCV",
        description: "Build a resume free.",
        url: "https://privacv.app/free-resume-builder",
        images: [{ url: "https://privacv.app/social/free-resume-builder", width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title: "Free Resume Builder | PrivaCV",
        description: "Build a resume free.",
        images: ["https://privacv.app/social/free-resume-builder"],
      },
    });
  });
});

describe("webApplicationJsonLd", () => {
  it("describes a free browser application without inventing review data", () => {
    const data = webApplicationJsonLd({
      name: "Private Job Tracker",
      description: "Track applications locally.",
      path: "/job-application-tracker",
      featureList: ["Local storage", "CSV export"],
    });

    expect(data).toMatchObject({
      "@type": "WebApplication",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any device with a modern web browser",
      url: "https://privacv.app/job-application-tracker",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: ["Local storage", "CSV export"],
    });
    expect(data).not.toHaveProperty("aggregateRating");
    expect(data).not.toHaveProperty("review");
  });
});

describe("private application metadata", () => {
  it("stays out of search while using tracker-specific sharing metadata", () => {
    expect(applicationsMetadata).toMatchObject({
      robots: { index: false, follow: false },
      alternates: { canonical: "/applications" },
      openGraph: {
        title: "Private Job Application Tracker | PrivaCV",
        url: "https://privacv.app/applications",
        images: [{ url: "https://privacv.app/social/job-application-tracker" }],
      },
    });
  });
});

describe("sitemap", () => {
  it("uses durable content dates instead of the request time", () => {
    const first = sitemap();
    const second = sitemap();

    expect(first).toEqual(second);
    expect(new Set(first.map((entry) => new Date(entry.lastModified!).toISOString()))).toEqual(new Set(["2026-07-19T00:00:00.000Z"]));
    expect(first.every((entry) => entry.changeFrequency === undefined && entry.priority === undefined)).toBe(true);
    expect(first.map((entry) => entry.url)).toEqual(expect.arrayContaining([
      "https://privacv.app/job-application-tracker",
      "https://privacv.app/job-search-sankey",
    ]));
    expect(first.map((entry) => entry.url)).not.toContain("https://privacv.app/applications");
  });
});
