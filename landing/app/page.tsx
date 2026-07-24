import type { Metadata } from "next";
import { LandingExperience } from "@/components/landing/LandingExperience";
import { JsonLd } from "@/components/seo/JsonLd";
import { DESKTOP_DOWNLOAD_URL, DESKTOP_DOWNLOADS } from "@/lib/site";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://matrix-view.vercel.app";

export const metadata: Metadata = {
  title: "DockX — Desktop Agent for Enterprise Work OS",
  description:
    "Capture work at the desk. Decide from the dashboard. Download the DockX desktop agent for attendance, live boards, and team clarity.",
  alternates: { canonical: "/" },
};

const softwareAppLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "DockX",
  applicationCategory: "BusinessApplication",
  operatingSystem: "macOS, Windows, Linux",
  description:
    "Desktop agent and work OS for attendance, live kanban boards, chat, and manager dashboards.",
  url: SITE_URL,
  downloadUrl: DESKTOP_DOWNLOAD_URL,
  image: `${SITE_URL}/og-image.png`,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  softwareVersion: "0.1.0",
  installUrl: [
    DESKTOP_DOWNLOADS.macSilicon,
    DESKTOP_DOWNLOADS.macIntel,
    DESKTOP_DOWNLOADS.windows,
    DESKTOP_DOWNLOADS.linuxAppImage,
  ],
};

const orgLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "DockX",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
};

const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "DockX",
  url: SITE_URL,
  description:
    "Capture work at the desk. Decide from the dashboard.",
  publisher: {
    "@type": "Organization",
    name: "DockX",
  },
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={[softwareAppLd, orgLd, websiteLd]} />
      <LandingExperience />
    </>
  );
}
