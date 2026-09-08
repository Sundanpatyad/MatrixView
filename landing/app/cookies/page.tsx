import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalShell";
import { COOKIE_SECTIONS } from "@/lib/legal";
import { LEGAL_EFFECTIVE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Cookies used on the DockX website and how to control them.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      description="What we store in your browser on dockx.vercel.app, and how to change it."
      effective={LEGAL_EFFECTIVE}
    >
      {COOKIE_SECTIONS.map((section) => (
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
