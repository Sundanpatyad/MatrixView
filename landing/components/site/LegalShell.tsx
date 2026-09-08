"use client";

import Link from "next/link";
import { InquiryButton } from "@/components/inquiry/InquiryForm";
import { CookieSettingsButton } from "@/components/consent/CookieBanner";
import { SiteHeader } from "@/components/site/SiteHeader";
import type { ReactNode } from "react";

export { SiteHeader } from "@/components/site/SiteHeader";

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-600 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 text-xs text-ink-400 sm:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <span>© {new Date().getFullYear()} DockX</span>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/#download" className="transition hover:text-brand-300">
              Download
            </Link>
            <InquiryButton
              variant="ghost"
              className="h-auto rounded-none border-0 bg-transparent px-0 py-0 text-xs font-medium text-ink-400 hover:bg-transparent hover:text-brand-300"
            />
            <Link href="/terms" className="transition hover:text-brand-300">
              Terms
            </Link>
            <Link href="/privacy" className="transition hover:text-brand-300">
              Privacy
            </Link>
            <Link href="/cookies" className="transition hover:text-brand-300">
              Cookies
            </Link>
            <CookieSettingsButton className="transition hover:text-brand-300" />
          </div>
        </div>
      </div>
    </footer>
  );
}

export function LegalPage({
  title,
  description,
  effective,
  children,
}: {
  title: string;
  description: string;
  effective: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink-900 text-ink-100">
      <SiteHeader elevated />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-20 pb-12 sm:px-8 sm:pt-28 sm:pb-16">
        <p className="text-[12px] font-medium text-ink-400">Effective {effective}</p>
        <h1 className="mt-2 font-landing text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-[65ch] text-[15px] leading-relaxed text-ink-300">
          {description}
        </p>
        <div className="mt-10 space-y-10">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
