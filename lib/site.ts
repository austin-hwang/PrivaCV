/** App-wide metadata that isn't part of a person's resume state. */

/** Development stage, surfaced as a badge in the header. */
export const APP_STAGE = "alpha";

/**
 * Public feedback / feature-voting board (Canny, Featurebase, Fider, …). The
 * header "Feedback" button opens it in a new tab so people can submit and
 * upvote ideas without email. Set to "" to hide the button entirely.
 */
export const FEEDBACK_URL = "https://privacv.canny.io/";

/** localStorage key for the chosen colour theme. */
export const THEME_STORAGE_KEY = "privacv-theme";
