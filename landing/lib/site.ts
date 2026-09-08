export const APP_LOGIN_URL =
  process.env.NEXT_PUBLIC_APP_LOGIN_URL || "https://matrix-view.vercel.app/";

/** Public marketing site. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://dockx.vercel.app";

export const INQUIRY_TO_EMAIL =
  process.env.NEXT_PUBLIC_INQUIRY_TO_EMAIL || "sundansharma600@gmail.com";

export const LEGAL_EFFECTIVE = "8 September 2026";

/** Releases index (fallback / “all releases”). */
export const DESKTOP_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL ||
  "https://github.com/Sundanpatyad/MatrixView/releases/latest";

const RELEASE_DOWNLOAD_BASE =
  process.env.NEXT_PUBLIC_DESKTOP_RELEASE_BASE ||
  "https://github.com/Sundanpatyad/MatrixView/releases/latest/download";

/**
 * Direct installer links for the latest GitHub Release.
 * Filenames must match `assetNamePattern` in .github/workflows/desktop-release.yml
 * (`docx_${arch}[ext]` → docx_silicon.dmg, docx_windows.exe, …).
 * Override any URL with NEXT_PUBLIC_DESKTOP_DOWNLOAD_* env vars if needed.
 */
export const DESKTOP_DOWNLOADS = {
  macSilicon:
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_MAC_SILICON ||
    `${RELEASE_DOWNLOAD_BASE}/docx_silicon.dmg`,
  macIntel:
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_MAC_INTEL ||
    `${RELEASE_DOWNLOAD_BASE}/docx_intel.dmg`,
  windows:
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_WINDOWS ||
    `${RELEASE_DOWNLOAD_BASE}/docx_windows.exe`,
  windowsMsi:
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_WINDOWS_MSI ||
    `${RELEASE_DOWNLOAD_BASE}/docx_windows.msi`,
  linuxAppImage:
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_LINUX_APPIMAGE ||
    `${RELEASE_DOWNLOAD_BASE}/docx_linux.AppImage`,
  linuxDeb:
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_LINUX_DEB ||
    `${RELEASE_DOWNLOAD_BASE}/docx_linux.deb`,
  linuxRpm:
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_LINUX_RPM ||
    `${RELEASE_DOWNLOAD_BASE}/docx_linux.rpm`,
} as const;

export type DesktopDownloadKey = keyof typeof DESKTOP_DOWNLOADS;
