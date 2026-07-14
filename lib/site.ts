/** App-wide metadata that isn't part of a person's resume state. */

/** Development stage, surfaced as a badge in the header. */
export const APP_STAGE = "alpha";

export const SITE_NAME = "PrivaCV";
export const SITE_DESCRIPTION =
  "Build, tailor, and export a clean resume locally in your browser with PrivaCV. No account, subscription, watermark, or uploaded resume required.";

/**
 * The public, canonical origin. This intentionally has no fallback: publishing
 * a canonical URL, sitemap, or social-card URL for a guessed domain creates
 * duplicate-content and sharing problems. Set NEXT_PUBLIC_SITE_URL (for
 * example, https://example.com) in the production build once the domain is
 * stable.
 */
function readSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!value) return undefined;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return undefined;
  }
}

export const SITE_URL = readSiteUrl();

export function absoluteUrl(path = "/") {
  if (!SITE_URL) return undefined;
  return new URL(path, SITE_URL).toString();
}

/**
 * Public feedback / feature-voting board (Canny, Featurebase, Fider, …). The
 * Tools drawer "Feedback" link opens it in a new tab so people can submit and
 * upvote ideas without email. Set to "" to hide the button entirely.
 */
export const FEEDBACK_URL = "https://privacv.canny.io/";

/** localStorage key for the chosen colour theme. */
export const THEME_STORAGE_KEY = "privacv-theme";
