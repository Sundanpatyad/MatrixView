export const APP_LOGIN_URL =
  process.env.NEXT_PUBLIC_APP_LOGIN_URL || "https://matrix-view.vercel.app/";

/** Releases index (fallback / “all releases”). */
export const DESKTOP_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL ||
  "https://github.com/Sundanpatyad/MatrixView/releases/latest";

const RELEASE_DOWNLOAD_BASE =
  process.env.NEXT_PUBLIC_DESKTOP_RELEASE_BASE ||
  "https://github.com/Sundanpatyad/MatrixView/releases/latest/download";

/**
 * Direct installer links for the latest GitHub Release.
 * Filenames must match assets uploaded by the Desktop Release workflow.
 * Override any URL with NEXT_PUBLIC_DESKTOP_DOWNLOAD_* env vars if needed.
 */
export const DESKTOP_DOWNLOADS = {
  macSilicon:
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_MAC_SILICON ||
    `${RELEASE_DOWNLOAD_BASE}/DockX_0.1.0_aarch64.dmg`,
  macIntel:
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_MAC_INTEL ||
    `${RELEASE_DOWNLOAD_BASE}/DockX_0.1.0_x64.dmg`,
  windows:
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_WINDOWS ||
    `${RELEASE_DOWNLOAD_BASE}/DockX_0.1.0_x64-setup.exe`,
  windowsMsi:
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_WINDOWS_MSI ||
    `${RELEASE_DOWNLOAD_BASE}/DockX_0.1.0_x64_en-US.msi`,
  linuxAppImage:
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_LINUX_APPIMAGE ||
    `${RELEASE_DOWNLOAD_BASE}/DockX_0.1.0_amd64.AppImage`,
  linuxDeb:
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_LINUX_DEB ||
    `${RELEASE_DOWNLOAD_BASE}/DockX_0.1.0_amd64.deb`,
} as const;

export type DesktopDownloadKey = keyof typeof DESKTOP_DOWNLOADS;

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://matrix-view.vercel.app";
