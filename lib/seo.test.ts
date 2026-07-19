import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { createPageMetadata } from "@/lib/seo";

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

describe("sitemap", () => {
  it("uses durable content dates instead of the request time", () => {
    const first = sitemap();
    const second = sitemap();

    expect(first).toEqual(second);
    expect(new Set(first.map((entry) => new Date(entry.lastModified!).toISOString()))).toEqual(new Set(["2026-07-19T00:00:00.000Z"]));
    expect(first.every((entry) => entry.changeFrequency === undefined && entry.priority === undefined)).toBe(true);
  });
});
