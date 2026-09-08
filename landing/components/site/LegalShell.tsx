"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InquiryButton } from "@/components/inquiry/InquiryForm";
import { CookieSettingsButton } from "@/components/consent/CookieBanner";
import { APP_LOGIN_URL } from "@/lib/site";
import type { ReactNode } from "react";

export function SiteHeader() {
  return (
    <header className="border-b border-ink-600 bg-ink-900/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-16 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="DockX"
            width={36}
            height={36}
            className="h-9 w-9 rounded-[22%] object-cover"
          />
          <span className="font-landing text-[15px] font-semibold tracking-tight text-ink-50">
            DockX
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <InquiryButton variant="nav" className="hidden sm:inline-flex px-3 py-1.5 text-[12px]" />
          <a
            href={APP_LOGIN_URL}
            className="inline-flex rounded-full bg-brand-500 px-4 py-2 text-[13px] font-semibold text-on-brand hover:bg-brand-600"
          >
            Log in
          </a>
        </div>
      </div>
    </header>
  );
}

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
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:px-8 sm:py-16">
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
