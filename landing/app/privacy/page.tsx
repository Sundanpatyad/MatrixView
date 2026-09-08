import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalShell";
import { PRIVACY_SECTIONS } from "@/lib/legal";
import { LEGAL_EFFECTIVE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How DockX collects, uses, and shares personal data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="How we handle account, workplace, and website data."
      effective={LEGAL_EFFECTIVE}
    >
      {PRIVACY_SECTIONS.map((section) => (
        <section key={section.heading}>
          <h2 className="font-landing text-lg font-semibold text-ink-50">{section.heading}</h2>
          <div className="mt-3 space-y-3">
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 40)} className="text-[15px] leading-relaxed text-ink-300">
                {p}
              </p>
            ))}
          </div>
        </section>
      ))}
    </LegalPage>
  );
}
