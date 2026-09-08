"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export const COOKIE_KEY = "dockx.cookie-consent";
export type CookieChoice = "all" | "necessary";

export function readCookieChoice(): CookieChoice | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(COOKIE_KEY);
  if (raw === "all" || raw === "necessary") return raw;
  return null;
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sync = () => setVisible(!readCookieChoice());
    sync();
    window.addEventListener("dockx:cookie-settings", sync);
    return () => window.removeEventListener("dockx:cookie-settings", sync);
  }, []);

  function choose(choice: CookieChoice) {
    localStorage.setItem(COOKIE_KEY, choice);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] p-3 sm:p-4">
      <div className="mx-auto max-w-3xl rounded-2xl border border-ink-600 bg-ink-800/95 p-4 shadow-xl backdrop-blur-md sm:p-5">
        <p className="text-sm font-semibold text-ink-50">Cookies</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-300">
          We use necessary cookies to remember your theme and this choice. We do
          not run ads. Read the{" "}
          <Link href="/cookies" className="font-semibold text-brand-300 hover:text-brand-200">
            Cookie Policy
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => choose("all")}
            className="inline-flex h-9 items-center rounded-full bg-brand-500 px-4 text-[13px] font-semibold text-on-brand hover:bg-brand-600 active:scale-[0.98]"
          >
            Accept cookies
          </button>
          <button
            type="button"
            onClick={() => choose("necessary")}
            className="inline-flex h-9 items-center rounded-full border border-ink-600 px-4 text-[13px] font-semibold text-ink-100 hover:border-brand-400/40"
          >
            Necessary only
          </button>
        </div>
      </div>
    </div>
  );
}

export function CookieSettingsButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        localStorage.removeItem(COOKIE_KEY);
        window.dispatchEvent(new Event("dockx:cookie-settings"));
      }}
    >
      Cookie settings
    </button>
  );
}
