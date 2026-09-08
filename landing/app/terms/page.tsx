import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalShell";
import { TERMS_SECTIONS } from "@/lib/legal";
import { LEGAL_EFFECTIVE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms of Use for the DockX desktop agent and related services.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      description="The rules for downloading and using DockX in your organization."
      effective={LEGAL_EFFECTIVE}
    >
      {TERMS_SECTIONS.map((section) => (
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
