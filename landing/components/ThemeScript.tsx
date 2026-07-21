import Script from "next/script";

/** Inline blocking theme boot — prevents light/dark flash (FOUC). */
export function ThemeScript() {
  return (
    <Script id="dockx-theme-boot" strategy="beforeInteractive">{`
(() => {
  try {
    const stored = localStorage.getItem("dockx.theme");
    const dark = stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch {}
})();
    `}</Script>
  );
}
