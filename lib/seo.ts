import type { Metadata } from "next";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

type PageMetadataOptions = {
  /** Title without the site-name suffix; the root layout's title template adds it. */
  title: string;
  description: string;
  path: string;
  /** Slug handled by /social/[slug]. */
  socialImage: string;
  type?: "website" | "article";
};

type WebApplicationJsonLdOptions = {
  name: string;
  description: string;
  path: string;
  featureList: string[];
};

/** Schema.org product facts for public feature pages. This deliberately avoids
 * ratings or reviews until PrivaCV has genuine user-review data to publish. */
export function webApplicationJsonLd({
  name,
  description,
  path,
  featureList,
}: WebApplicationJsonLdOptions) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    description,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any device with a modern web browser",
    url: absoluteUrl(path),
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList,
  };
}

/**
 * Route metadata must include the complete Open Graph and Twitter objects.
 * Next.js replaces nested metadata objects rather than deeply merging them,
 * so partial route-level objects can otherwise drop the image and site name.
 */
export function createPageMetadata({
  title,
  description,
  path,
  socialImage,
  type = "website",
}: PageMetadataOptions): Metadata {
  const renderedTitle = `${title} | ${SITE_NAME}`;
  const image = {
    url: absoluteUrl(`/social/${socialImage}`),
    width: 1200,
    height: 630,
    alt: `${title} from ${SITE_NAME}`,
  };

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      siteName: SITE_NAME,
      title: renderedTitle,
      description,
      url: absoluteUrl(path),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: renderedTitle,
      description,
      images: [image.url],
    },
  };
}
