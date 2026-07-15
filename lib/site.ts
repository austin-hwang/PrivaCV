/** App-wide metadata that isn't part of a person's resume state. */

/** Development stage, surfaced as a badge in the header. */
export const APP_STAGE = "alpha";

export const SITE_NAME = "PrivaCV";
export const SITE_DESCRIPTION =
  "Build, tailor, and export a clean resume locally in your browser with PrivaCV. No account, subscription, watermark, or uploaded resume required.";
const DEFAULT_SITE_URL = "https://privacv.app";

/**
 * The public, canonical origin. PrivaCV now has a stable production domain;
 * NEXT_PUBLIC_SITE_URL remains available for staging and preview deployments.
 */
function readSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return new URL(DEFAULT_SITE_URL);
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

export const SITE_URL = readSiteUrl();

export function absoluteUrl(path = "/") {
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
