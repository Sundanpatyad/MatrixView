import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

/** Soft glow cursor + particle trail + click ripples. */
export function CursorGlow() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (reduce || !fine) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    const trailHost = trailRef.current;
    if (!dot || !ring || !trailHost) return;

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ringPos = { x: pos.x, y: pos.y };
    let raf = 0;
    let trailTick = 0;

    const onMove = (e: PointerEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      gsap.to(dot, { x: pos.x, y: pos.y, duration: 0.1, ease: "power2.out" });

      trailTick++;
      if (trailTick % 2 === 0) {
        const speck = document.createElement("span");
        speck.className =
          "pointer-events-none absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-400";
        speck.style.left = `${pos.x}px`;
        speck.style.top = `${pos.y}px`;
        trailHost.appendChild(speck);
        gsap.to(speck, {
          opacity: 0,
          scale: 0,
          y: -12 - Math.random() * 18,
          x: (Math.random() - 0.5) * 24,
          duration: 0.55,
          ease: "power2.out",
          onComplete: () => speck.remove(),
        });
      }
    };

    const tick = () => {
      ringPos.x += (pos.x - ringPos.x) * 0.16;
      ringPos.y += (pos.y - ringPos.y) * 0.16;
      gsap.set(ring, { x: ringPos.x, y: ringPos.y });
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onOver = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("a, button, [data-cursor='grow']")) {
        gsap.to(ring, {
          scale: 2.8,
          opacity: 0.7,
          borderColor: "rgba(88,101,242,0.9)",
          duration: 0.25,
        });
        gsap.to(dot, { scale: 0.35, duration: 0.2 });
      }
    };
    const onOut = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("a, button, [data-cursor='grow']")) {
        gsap.to(ring, { scale: 1, opacity: 0.4, duration: 0.25 });
        gsap.to(dot, { scale: 1, duration: 0.2 });
      }
    };

    const onClick = (e: MouseEvent) => {
      const ripple = document.createElement("span");
      ripple.className =
        "pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-400";
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      trailHost.appendChild(ripple);
      gsap.fromTo(
        ripple,
        { scale: 0.4, opacity: 0.9 },
        {
          scale: 6,
          opacity: 0,
          duration: 0.65,
          ease: "power2.out",
          onComplete: () => ripple.remove(),
        },
      );
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("click", onClick);
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.documentElement.classList.add("landing-cursor-hide");

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("click", onClick);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.documentElement.classList.remove("landing-cursor-hide");
    };
  }, []);

  return (
    <>
      <div ref={trailRef} className="pointer-events-none fixed inset-0 z-[99]" aria-hidden />
      <div
        ref={ringRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-[100] hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-400/70 md:block"
        style={{ opacity: 0.4 }}
      />
      <div
        ref={dotRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-[101] hidden h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-400 shadow-[0_0_12px_rgba(88,101,242,0.8)] md:block"
      />
    </>
  );
}

type MagneticProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

/** Strong magnetic CTA with shimmer. */
export function MagneticLink({ href, children, className = "" }: MagneticProps) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (reduce || !fine) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      gsap.to(el, { x: x * 0.38, y: y * 0.38, duration: 0.3, ease: "power3.out" });
    };
    const onLeave = () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.35)" });
    };
    const onEnter = () => {
      gsap.fromTo(
        el,
        { scale: 1 },
        { scale: 1.05, duration: 0.25, yoyo: true, repeat: 1, ease: "power2.out" },
      );
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerenter", onEnter);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerenter", onEnter);
    };
  }, []);

  return (
    <a
      ref={ref}
      href={href}
      className={`landing-shimmer relative inline-flex will-change-transform ${className}`}
    >
      {children}
    </a>
  );
}

/** Split letters that cascade in + react on hover. */
export function SplitBrand({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const letters = el.querySelectorAll("[data-letter]");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      gsap.set(letters, { clearProps: "all" });
      return;
    }

    gsap.fromTo(
      letters,
      { y: 36, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        stagger: 0.045,
        duration: 0.7,
        ease: "power3.out",
        delay: 0.1,
      },
    );
  }, [text]);

  return (
    <span ref={ref} className="inline-flex">
      {text.split("").map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          data-letter
          className="inline-block origin-bottom transition-transform duration-200 hover:-translate-y-1.5 hover:text-brand-300"
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}
