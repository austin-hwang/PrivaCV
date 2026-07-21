/**
 * Server-side stand-in for pdf.js.
 *
 * `next.config.ts` aliases this module to `pdfjs-dist` in browser bundles. If
 * browser-only PDF parsing is ever called while rendering on the server, fail
 * explicitly instead of silently pulling the parser into the Worker.
 */
export const GlobalWorkerOptions = { workerSrc: "" };

export function getDocument(): never {
  throw new Error("PDF parsing is only available in the browser.");
}
