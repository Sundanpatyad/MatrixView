import type { Metadata, Viewport } from "next";
import { ThemeScript } from "@/components/ThemeScript";
import "./globals.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://matrix-view.vercel.app";

const TITLE = "DockX — Desktop Agent for Enterprise Work OS";
const DESCRIPTION =
  "Capture work at the desk. Decide from the dashboard. One lightweight desktop workspace for time, tasks, and teams — live boards, attendance, and org clarity.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · DockX",
  },
  description: DESCRIPTION,
  applicationName: "DockX",
  authors: [{ name: "DockX" }],
  creator: "DockX",
  publisher: "DockX",
  keywords: [
    "DockX",
    "desktop agent",
    "work OS",
    "team attendance",
    "kanban",
    "employee time tracking",
    "project management",
    "live boards",
    "enterprise productivity",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "DockX",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DockX — Capture work at the desk. Decide from the dashboard.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/logo.png" }],
  },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#5865F2" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1f22" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-screen bg-ink-900 text-ink-100 antialiased"
        suppressHydrationWarning
      >
        <ThemeScript />
        {children}
      </body>
    </html>
  );
}
