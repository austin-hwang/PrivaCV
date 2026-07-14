import type { Metadata, Viewport } from "next";
import { Inter, Merriweather } from "next/font/google";
import "./globals.css";
import { KofiWidget } from "@/components/kofi-widget";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, THEME_STORAGE_KEY } from "@/lib/site";

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
  metadataBase: SITE_URL,
  title: {
    default: "PrivaCV — Private, ATS-Friendly Resume Editor",
    template: "%s | PrivaCV",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "BusinessApplication",
  keywords: ["PrivaCV", "resume editor", "resume builder", "ATS-friendly resume", "private resume editor", "free resume editor", "PDF resume", "DOCX resume"],
  alternates: SITE_URL ? { canonical: "/" } : undefined,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "PrivaCV — Private, ATS-Friendly Resume Editor",
    description: SITE_DESCRIPTION,
    url: SITE_URL?.toString(),
    images: SITE_URL ? [{ url: "/api/og", width: 1200, height: 630, alt: "PrivaCV — private, ATS-friendly resume editor" }] : undefined,
  },
  twitter: {
    card: "summary",
    title: "PrivaCV — Private, ATS-Friendly Resume Editor",
    description: SITE_DESCRIPTION,
    images: SITE_URL ? ["/api/og"] : undefined,
  },
  robots: { index: true, follow: true },
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
