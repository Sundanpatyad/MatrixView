"use client";
import { useEffect, useState } from "react";
import { MagneticLink } from "./InteractiveBits";
import {
  DESKTOP_DOWNLOAD_URL,
  DESKTOP_DOWNLOADS,
} from "@/lib/site";

export { DESKTOP_DOWNLOAD_URL, DESKTOP_DOWNLOADS };

export type DesktopPlatform = "mac" | "windows" | "linux" | "other";

export function detectDesktopPlatform(): DesktopPlatform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac OS|Macintosh/i.test(ua)) return "mac";
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return "other";
}

/** Prefer Apple Silicon on modern Macs; fall back to Intel DMG when detected. */
export function detectMacArch(): "silicon" | "intel" {
  if (typeof navigator === "undefined") return "silicon";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    if (gl && info) {
      const renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || "");
      if (/Intel/i.test(renderer)) return "intel";
      if (/Apple|M\d|Metal/i.test(renderer)) return "silicon";
    }
  } catch {
    /* ignore */
  }
  return "silicon";
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

export function desktopDownloadHref(platform: DesktopPlatform): string {
  switch (platform) {
    case "mac":
      return detectMacArch() === "intel"
        ? DESKTOP_DOWNLOADS.macIntel
        : DESKTOP_DOWNLOADS.macSilicon;
    case "windows":
      return DESKTOP_DOWNLOADS.windows;
    case "linux":
      return DESKTOP_DOWNLOADS.linuxAppImage;
    default:
      return DESKTOP_DOWNLOAD_URL;
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

const PLATFORM_LINKS = [
  {
    key: "macSilicon",
    title: "macOS · Apple Silicon",
    detail: ".dmg",
    href: DESKTOP_DOWNLOADS.macSilicon,
  },
  {
    key: "macIntel",
    title: "macOS · Intel",
    detail: ".dmg",
    href: DESKTOP_DOWNLOADS.macIntel,
  },
  {
    key: "windows",
    title: "Windows",
    detail: ".exe installer",
    href: DESKTOP_DOWNLOADS.windows,
  },
  {
    key: "windowsMsi",
    title: "Windows · MSI",
    detail: ".msi",
    href: DESKTOP_DOWNLOADS.windowsMsi,
  },
  {
    key: "linuxAppImage",
    title: "Linux · AppImage",
    detail: ".AppImage",
    href: DESKTOP_DOWNLOADS.linuxAppImage,
  },
  {
    key: "linuxDeb",
    title: "Linux · Debian",
    detail: ".deb",
    href: DESKTOP_DOWNLOADS.linuxDeb,
  },
] as const;

/** Magnetic download button with OS-aware label + direct installer link. */
export function DownloadDesktopButton({
  className = "",
  variant = "primary",
  showIcon = true,
}: Props) {
  const [platform, setPlatform] = useState<DesktopPlatform>("other");
  const [href, setHref] = useState(DESKTOP_DOWNLOAD_URL);

  useEffect(() => {
    const p = detectDesktopPlatform();
    setPlatform(p);
    setHref(desktopDownloadHref(p));
  }, []);

  const label = desktopDownloadLabel(platform);

  const variants = {
    primary: "bg-brand-500 text-white hover:bg-brand-600",
    secondary:
      "border border-ink-600 bg-ink-800/70 text-ink-100 hover:border-brand-400/40 hover:text-ink-50",
    ghost:
      "border border-ink-600 text-ink-200 hover:border-brand-400/40 hover:text-ink-50",
  } as const;

  return (
    <MagneticLink
      href={href}
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
  const [href, setHref] = useState(DESKTOP_DOWNLOAD_URL);

  useEffect(() => {
    const p = detectDesktopPlatform();
    setLabel(desktopDownloadLabel(p));
    setHref(desktopDownloadHref(p));
  }, []);

  return (
    <a
      href={href}
      data-cursor="grow"
      className={`inline-flex items-center gap-1.5 rounded-full border border-ink-600 bg-ink-800/60 px-3 py-1.5 text-[12px] font-semibold text-ink-100 transition hover:border-brand-400/50 hover:text-ink-50 ${className}`}
    >
      <DownloadIcon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">Download</span>
    </a>
  );
}

/** All-platform installer grid for the download section. */
export function DownloadDesktopPlatformList({
  className = "",
}: {
  className?: string;
}) {
  return (
    <ul className={`grid gap-2 sm:grid-cols-2 ${className}`}>
      {PLATFORM_LINKS.map((item) => (
        <li key={item.key}>
          <a
            href={item.href}
            data-cursor="grow"
            className="flex items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-900/40 px-4 py-3 transition hover:border-brand-400/40 hover:bg-ink-800/60"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink-100">
                {item.title}
              </span>
              <span className="mt-0.5 block text-[11px] text-ink-400">
                {item.detail}
              </span>
            </span>
            <DownloadIcon className="h-4 w-4 shrink-0 text-brand-300" />
          </a>
        </li>
      ))}
    </ul>
  );
}
