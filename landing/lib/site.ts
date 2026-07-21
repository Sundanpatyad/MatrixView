export const APP_LOGIN_URL =
  process.env.NEXT_PUBLIC_APP_LOGIN_URL || "https://matrix-view.vercel.app/";

export const DESKTOP_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL ||
  "https://github.com/Sundanpatyad/MatrixView/releases/latest";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://matrix-view.vercel.app";
