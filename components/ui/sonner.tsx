"use client";

import * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";

// This app manages theme with a `.dark` class on <html> (not next-themes), so
// mirror that onto Sonner instead of pulling in another theme provider.
function useDocumentTheme(): "light" | "dark" {
  const [theme, setTheme] = React.useState<"light" | "dark">("dark");
  React.useEffect(() => {
    const root = document.documentElement;
    const update = () => setTheme(root.classList.contains("dark") ? "dark" : "light");
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

/** Leave room for the visible navigation or modal actions, including safe-area padding. */
function useBottomActionOffset() {
  const [offset, setOffset] = React.useState(16);
  React.useEffect(() => {
    let frame = 0;
    const observed = new Set<Element>();
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bars = document.querySelectorAll(".mobile-workspace-nav, [data-mobile-action-bar]");
        observed.forEach((element) => {
          if (!element.isConnected) {
            resize.unobserve(element);
            observed.delete(element);
          }
        });
        let height = 0;
        bars.forEach((bar) => {
          if (!observed.has(bar)) {
            observed.add(bar);
            resize.observe(bar);
          }
          const rect = bar.getBoundingClientRect();
          if (
            rect.height &&
            rect.bottom >= window.innerHeight - 2 &&
            rect.top < window.innerHeight
          ) {
            height = Math.max(height, window.innerHeight - rect.top);
          }
        });
        setOffset(height + 16);
      });
    };
    const resize = new ResizeObserver(measure);
    const mutation = new MutationObserver(measure);
    mutation.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", measure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return offset;
}

function Toaster({ ...props }: ToasterProps) {
  const theme = useDocumentTheme();
  const bottomOffset = useBottomActionOffset();
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      mobileOffset={{ bottom: bottomOffset }}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          // Tokens are HSL triplets in this project, so wrap in hsl().
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
          "--border-radius": "var(--radius)",
          "--workspace-toast-bottom": `${bottomOffset}px`,
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
