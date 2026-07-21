import type { PropsWithChildren, ReactNode } from "react";

/**
 * Server-side stand-in for React PDF.
 *
 * `next.config.ts` aliases this module to `@react-pdf/renderer` in browser
 * bundles. The components only need to remain type-safe while Next compiles
 * the Client Component graph for SSR; PDF generation itself must stay local to
 * the browser.
 */
type PdfElementProps = PropsWithChildren<Record<string, unknown>>;

function PdfElement({ children }: PdfElementProps): ReactNode {
  return children;
}

export const Document = PdfElement;
export const Link = PdfElement;
export const Page = PdfElement;
export const Text = PdfElement;
export const View = PdfElement;

export const Font = {
  register(_font: unknown) {},
  registerHyphenationCallback(_callback: (word: string) => string[]) {},
};

export function pdf(_document: ReactNode): { toBlob(): Promise<Blob> } {
  throw new Error("PDF generation is only available in the browser.");
}
