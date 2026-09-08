import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/LegalShell";
import { InquiryForm } from "@/components/inquiry/InquiryForm";

export const metadata: Metadata = {
  title: "Inquiry",
  description: "Contact DockX about the desktop agent for your team.",
  alternates: { canonical: "/inquiry" },
};

export default function InquiryPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink-900 text-ink-100">
      <SiteHeader elevated />
      <main className="mx-auto w-full max-w-lg flex-1 px-5 pt-20 pb-12 sm:px-8 sm:pt-28 sm:pb-16">
        <h1 className="font-landing text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
          Inquiry
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-300">
          Ask about DockX for your organization. We reply by email.
        </p>
        <div className="mt-8 rounded-2xl border border-ink-600 bg-ink-800/50 p-5 sm:p-6">
          <InquiryForm />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
