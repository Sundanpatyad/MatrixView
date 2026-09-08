"use client";

import { InquiryProvider } from "@/components/inquiry/InquiryContext";
import { InquiryDialog } from "@/components/inquiry/InquiryForm";
import { CookieBanner } from "@/components/consent/CookieBanner";
import type { ReactNode } from "react";

export function SiteProviders({ children }: { children: ReactNode }) {
  return (
    <InquiryProvider>
      {children}
      <CookieBanner />
      <InquiryDialog />
    </InquiryProvider>
  );
}
