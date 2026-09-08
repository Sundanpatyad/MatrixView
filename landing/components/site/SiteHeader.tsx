"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InquiryButton } from "@/components/inquiry/InquiryForm";
import { DownloadDesktopNavLink } from "@/components/landing/DownloadDesktop";
import { APP_LOGIN_URL } from "@/lib/site";

const NAV_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#dashboard", label: "Dashboard" },
  { href: "/#download", label: "Download" },
  { href: "/#play", label: "Try it" },
  { href: "/#faq", label: "FAQ" },
] as const;

function Logo() {
  return (
    <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2" data-cursor="grow">
      <img
        src="/logo.png"
        alt=""
        width={36}
        height={36}
        className="h-8 w-8 shrink-0 rounded-[22%] object-cover sm:h-9 sm:w-9"
      />
      <span className="font-landing text-[15px] font-semibold tracking-tight whitespace-nowrap text-ink-50">
        DockX
      </span>
    </Link>
  );
}

export function SiteHeader({
  elevated = true,
}: {
  elevated?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
          elevated || open
            ? "border-ink-600 bg-ink-900/90 backdrop-blur-md"
            : "border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-16 sm:px-8">
          <Logo />

          <nav className="hidden flex-1 items-center justify-center gap-6 text-[13px] font-medium text-ink-300 lg:flex">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="transition hover:text-ink-50"
                data-cursor="grow"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ThemeToggle className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
            <div className="hidden items-center gap-2 lg:flex">
              <InquiryButton variant="nav" className="h-8 px-3 py-0 text-[12px]" />
              <DownloadDesktopNavLink className="h-8" />
              <a
                href={APP_LOGIN_URL}
                className="inline-flex h-8 items-center rounded-full bg-brand-500 px-4 text-[13px] font-semibold whitespace-nowrap text-on-brand hover:bg-brand-600"
              >
                Log in
              </a>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink-600 bg-ink-800 text-ink-100 lg:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="flex w-3.5 flex-col gap-1" aria-hidden>
                <span
                  className={`h-px w-full bg-current transition ${open ? "translate-y-[5px] rotate-45" : ""}`}
                />
                <span className={`h-px w-full bg-current transition ${open ? "opacity-0" : ""}`} />
                <span
                  className={`h-px w-full bg-current transition ${open ? "-translate-y-[5px] -rotate-45" : ""}`}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      {open ? (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-[2px]"
            onClick={close}
          />
          <aside
            className="fixed inset-y-0 right-0 z-[75] flex w-[min(20rem,88vw)] flex-col border-l border-ink-600 bg-ink-900 shadow-2xl motion-safe:animate-[dockx-drawer-in_0.28s_ease-out]"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <div className="flex h-14 items-center justify-between border-b border-ink-600 px-4 sm:h-16">
              <span className="font-landing text-sm font-semibold text-ink-50">Menu</span>
              <button
                type="button"
                onClick={close}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ink-600 text-ink-100"
                aria-label="Close menu"
              >
                <span className="relative block h-3.5 w-3.5" aria-hidden>
                  <span className="absolute inset-x-0 top-1/2 h-px -rotate-45 bg-current" />
                  <span className="absolute inset-x-0 top-1/2 h-px rotate-45 bg-current" />
                </span>
              </button>
            </div>
            <nav className="flex min-h-0 flex-1 flex-col px-3 py-4">
              <div className="flex flex-col gap-1">
                {NAV_LINKS.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="rounded-xl px-3 py-2.5 text-sm font-medium text-ink-100 hover:bg-ink-800"
                    onClick={close}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
              <div className="mt-auto flex flex-col gap-2 border-t border-ink-600 pt-4">
                <InquiryButton
                  variant="nav"
                  className="w-full justify-center py-2.5"
                  onClick={close}
                />
                <DownloadDesktopNavLink className="w-full justify-center py-2.5" />
                <a
                  href={APP_LOGIN_URL}
                  className="inline-flex items-center justify-center rounded-full bg-brand-500 px-4 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-600"
                >
                  Log in
                </a>
              </div>
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
