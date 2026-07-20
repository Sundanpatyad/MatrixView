import { useEffect, useState } from "react";
import { MagneticLink } from "./InteractiveBits";

/** Override with VITE_DESKTOP_DOWNLOAD_URL when you have a direct installer CDN. */
export const DESKTOP_DOWNLOAD_URL =
  import.meta.env.VITE_DESKTOP_DOWNLOAD_URL ||
  "https://github.com/Sundanpatyad/MatrixView/releases/latest";

export type DesktopPlatform = "mac" | "windows" | "linux" | "other";

export function detectDesktopPlatform(): DesktopPlatform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac OS|Macintosh/i.test(ua)) return "mac";
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return "other";
}

export function desktopDownloadLabel(platform: DesktopPlatform): string {
  switch (platform) {
    case "mac":
      return "Download for macOS";
    case "windows":
      return "Download for Windows";
    case "linux":
      return "Download for Linux";
    default:
      return "Download desktop app";
  }
}

type Props = {
  className?: string;
  /** Prefer solid brand button vs outline */
  variant?: "primary" | "secondary" | "ghost";
  showIcon?: boolean;
};

function DownloadIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden
    >
      <path
        d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Magnetic download button with OS-aware label. */
export function DownloadDesktopButton({
  className = "",
  variant = "primary",
  showIcon = true,
}: Props) {
  const [platform, setPlatform] = useState<DesktopPlatform>("other");

  useEffect(() => {
    setPlatform(detectDesktopPlatform());
  }, []);

  const label = desktopDownloadLabel(platform);

  const variants = {
    primary:
      "bg-brand-500 text-white hover:bg-brand-600",
    secondary:
      "border border-ink-600 bg-ink-800/70 text-ink-100 hover:border-brand-400/40 hover:text-ink-50",
    ghost:
      "border border-ink-600 text-ink-200 hover:border-brand-400/40 hover:text-ink-50",
  } as const;

  return (
    <MagneticLink
      href={DESKTOP_DOWNLOAD_URL}
      className={`items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${variants[variant]} ${className}`}
    >
      {showIcon && <DownloadIcon className="h-4 w-4" />}
      {label}
    </MagneticLink>
  );
}

/** Compact nav download control. */
export function DownloadDesktopNavLink({ className = "" }: { className?: string }) {
  const [label, setLabel] = useState("Download app");

  useEffect(() => {
    setLabel(desktopDownloadLabel(detectDesktopPlatform()));
  }, []);

  return (
    <a
      href={DESKTOP_DOWNLOAD_URL}
      data-cursor="grow"
      className={`inline-flex items-center gap-1.5 rounded-full border border-ink-600 bg-ink-800/60 px-3 py-1.5 text-[12px] font-semibold text-ink-100 transition hover:border-brand-400/50 hover:text-ink-50 ${className}`}
    >
      <DownloadIcon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">Download</span>
    </a>
  );
}
