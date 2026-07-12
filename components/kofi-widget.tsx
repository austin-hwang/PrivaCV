"use client";

import Script from "next/script";

declare global {
  interface Window {
    kofiWidgetOverlay?: {
      draw: (
        username: string,
        config: Record<string, string>,
      ) => void;
    };
  }
}

// Ko-fi's official floating "Support" button. The script and its assets are
// served from storage.ko-fi.com / ko-fi.com (allowed in the CSP); it renders a
// small overlay button that links to ko-fi.com/privacv. Resume content stays
// local — this only surfaces a donation link.
export function KofiWidget() {
  return (
    <Script
      src="https://storage.ko-fi.com/cdn/scripts/overlay-widget.js"
      strategy="afterInteractive"
      onLoad={() => {
        window.kofiWidgetOverlay?.draw("privacv", {
          type: "floating-chat",
          "floating-chat.donateButton.text": "Support PrivaCV",
          "floating-chat.donateButton.background-color": "#28303d",
          "floating-chat.donateButton.text-color": "#ffffff",
        });
      }}
    />
  );
}
