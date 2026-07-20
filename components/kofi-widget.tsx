import { Coffee } from "lucide-react";

// A small floating link to the PrivaCV Ko-fi page. Rendered locally rather
// than via Ko-fi's official overlay widget: that widget loads a third-party
// script and renders its button inside a fixed-width iframe that clips when
// repositioned. A plain link keeps the app fully local — clicking it just
// opens ko-fi.com/privacv in a new tab — and shows only a floating icon.
export function KofiWidget() {
  return (
    <a
      href="https://ko-fi.com/privacv"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Support PrivaCV on Ko-fi"
      title="Support PrivaCV on Ko-fi"
      className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg ring-1 ring-black/10 transition hover:scale-105 hover:shadow-xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 print:hidden"
    >
      <Coffee className="h-5 w-5" aria-hidden="true" />
    </a>
  );
}
