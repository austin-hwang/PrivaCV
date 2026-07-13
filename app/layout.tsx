import type { Metadata, Viewport } from "next";
import { Inter, Merriweather } from "next/font/google";
import "./globals.css";
import { KofiWidget } from "@/components/kofi-widget";
import { THEME_STORAGE_KEY } from "@/lib/site";

// Applied before first paint so there's no flash: default to night mode, and
// only fall back to light when the person has explicitly chosen it.
const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"){document.documentElement.classList.remove("dark");}else{document.documentElement.classList.add("dark");}}catch(e){document.documentElement.classList.add("dark");}})();`;

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: {
    default: "PrivaCV — private, ATS-friendly resumes",
    template: "%s | PrivaCV",
  },
  description:
    "Build, tailor, and export a clean resume locally in your browser with PrivaCV. No account, subscription, watermark, or uploaded resume required.",
  applicationName: "PrivaCV",
  category: "Productivity",
  keywords: ["PrivaCV", "resume editor", "resume builder", "ATS-friendly resume", "private resume editor", "PDF resume"],
  openGraph: {
    type: "website",
    siteName: "PrivaCV",
    title: "PrivaCV — private, ATS-friendly resumes",
    description:
      "Build, tailor, and export a clean resume locally in your browser with PrivaCV. No account, subscription, watermark, or uploaded resume required.",
  },
  twitter: {
    card: "summary",
    title: "PrivaCV — private, ATS-friendly resumes",
    description:
      "Build, tailor, and export a clean resume locally in your browser with PrivaCV. No account, subscription, watermark, or uploaded resume required.",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: "#16181d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} ${merriweather.variable}`}>
        {children}
        <KofiWidget />
      </body>
    </html>
  );
}
