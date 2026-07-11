import type { Metadata, Viewport } from "next";
import { Inter, Merriweather } from "next/font/google";
import "./globals.css";

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
    default: "Resume Editor — private, ATS-friendly PDFs",
    template: "%s | Resume Editor",
  },
  description:
    "Build, tailor, and export a clean resume locally in your browser. No account, subscription, watermark, or uploaded resume required.",
  applicationName: "Resume Editor",
  category: "Productivity",
  keywords: ["resume editor", "resume builder", "ATS-friendly resume", "private resume editor", "PDF resume"],
  openGraph: {
    type: "website",
    siteName: "Resume Editor",
    title: "Resume Editor — private, ATS-friendly PDFs",
    description:
      "Build, tailor, and export a clean resume locally in your browser. No account, subscription, watermark, or uploaded resume required.",
  },
  twitter: {
    card: "summary",
    title: "Resume Editor — private, ATS-friendly PDFs",
    description:
      "Build, tailor, and export a clean resume locally in your browser. No account, subscription, watermark, or uploaded resume required.",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#28303d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${merriweather.variable}`}>{children}</body>
    </html>
  );
}
