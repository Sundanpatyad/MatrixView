"use client";

import { useState, type FormEvent } from "react";
import { useInquiry } from "./InquiryContext";
import { INQUIRY_TO_EMAIL } from "@/lib/site";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-ink-600 bg-ink-900/80 px-3 py-2.5 text-sm text-ink-50 outline-none transition placeholder:text-ink-500 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30";

export function InquiryForm({ onSent }: { onSent?: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (honeypot.trim()) {
        setDone(true);
        onSent?.();
        return;
      }
      const res = await fetch(
        `https://formsubmit.co/ajax/${encodeURIComponent(INQUIRY_TO_EMAIL)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            organization: organization.trim() || "(not provided)",
            message: message.trim(),
            _subject: `DockX inquiry from ${name.trim()}`,
            _template: "table",
            _captcha: "false",
            _replyto: email.trim(),
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        success?: boolean | string;
      };
      const failed =
        !res.ok ||
        data.success === false ||
        data.success === "false";
      if (failed) {
        throw new Error(data.error || data.message || "Could not send your inquiry.");
      }
      setDone(true);
      onSent?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your inquiry.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-ink-600 bg-ink-800/70 px-5 py-8 text-center">
        <p className="font-landing text-lg font-semibold text-ink-50">Inquiry sent</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">
          Thanks. We will reply to {email || "your email"} as soon as we can.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <label className="absolute left-[-9999px]" htmlFor="inquiry-website">
        Website
      </label>
      <input
        id="inquiry-website"
        tabIndex={-1}
        autoComplete="off"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <div>
        <label htmlFor="inquiry-name" className="block text-[12px] font-semibold text-ink-200">
          Name
        </label>
        <input
          id="inquiry-name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={fieldClass}
          autoComplete="name"
        />
      </div>
      <div>
        <label htmlFor="inquiry-email" className="block text-[12px] font-semibold text-ink-200">
          Work email
        </label>
        <input
          id="inquiry-email"
          type="email"
          required
          maxLength={120}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldClass}
          autoComplete="email"
        />
      </div>
      <div>
        <label htmlFor="inquiry-org" className="block text-[12px] font-semibold text-ink-200">
          Organization{" "}
          <span className="font-normal text-ink-500">optional</span>
        </label>
        <input
          id="inquiry-org"
          maxLength={120}
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
          className={fieldClass}
          autoComplete="organization"
        />
      </div>
      <div>
        <label htmlFor="inquiry-message" className="block text-[12px] font-semibold text-ink-200">
          Message
        </label>
        <textarea
          id="inquiry-message"
          required
          minLength={10}
          maxLength={4000}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`${fieldClass} resize-y`}
        />
        <p className="mt-1 text-[11px] text-ink-500">At least 10 characters.</p>
      </div>
      {error ? (
        <p className="text-[12px] font-medium text-status-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-10 w-full items-center justify-center rounded-full bg-brand-500 px-5 text-sm font-semibold text-on-brand transition hover:bg-brand-600 active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send inquiry"}
      </button>
    </form>
  );
}

export function InquiryDialog() {
  const { open, closeInquiry } = useInquiry();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inquiry-title"
      onClick={closeInquiry}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-ink-600 bg-ink-900 p-5 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="inquiry-title" className="font-landing text-lg font-semibold text-ink-50">
              Inquiry
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-300">
              Tell us about your team. We will reply by email.
            </p>
          </div>
          <button
            type="button"
            onClick={closeInquiry}
            className="rounded-lg px-2 py-1 text-[12px] font-semibold text-ink-400 hover:text-ink-50"
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <div className="mt-5">
          <InquiryForm />
        </div>
      </div>
    </div>
  );
}

export function InquiryButton({
  className = "",
  variant = "ghost",
  onClick,
}: {
  className?: string;
  variant?: "ghost" | "primary" | "nav";
  onClick?: () => void;
}) {
  const { openInquiry } = useInquiry();
  const styles = {
    ghost:
      "border border-ink-600 bg-ink-800/70 text-ink-100 hover:border-brand-400/40 hover:text-ink-50",
    primary: "bg-brand-500 text-on-brand hover:bg-brand-600",
    nav: "border border-ink-600 bg-ink-800/60 text-ink-100 hover:border-brand-400/50 hover:text-ink-50",
  } as const;

  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        openInquiry();
      }}
      className={`inline-flex items-center rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition active:scale-[0.98] ${styles[variant]} ${className}`}
    >
      Inquiry
    </button>
  );
}
