import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ThemeToggle } from "../ThemeToggle";
import { HeroScene } from "./HeroScene";
import { CursorGlow, MagneticLink, SplitBrand } from "./InteractiveBits";
import { DashboardMock } from "./DashboardMock";
import {
  AudienceSwitcher,
  DeskStatusToggle,
  FaqAccordion,
  LiveBoardPlayground,
  ModuleExplorer,
} from "./Playgrounds";

gsap.registerPlugin(ScrollTrigger);

const APP_LOGIN_URL = "https://matrix-view.vercel.app/";

const FEATURES = [
  {
    n: "01",
    title: "Desk capture",
    body: "Check in once. Time, focus, and activity stay with the work — not five other tabs.",
  },
  {
    n: "02",
    title: "Live boards",
    body: "Move a task and every teammate sees it. Status, assignee, and columns stay in sync.",
  },
  {
    n: "03",
    title: "Manager clarity",
    body: "One dashboard for priority, progress, and presence. Decide without chasing updates.",
  },
] as const;

const METRICS = [
  { value: "<20s", label: "Check-in to focus" },
  { value: "Live", label: "Board sync" },
  { value: "1", label: "Agent for the desk" },
  { value: "0", label: "Tab tax" },
] as const;

function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        gsap.set(el, { scaleX: self.progress });
      },
    });
    return () => st.kill();
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className="fixed top-0 left-0 z-[60] h-[3px] w-full origin-left scale-x-0 bg-gradient-to-r from-brand-500 via-status-sync to-brand-300"
    />
  );
}

export function LandingExperience() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [navSolid, setNavSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduce) {
        gsap.set("[data-reveal], [data-hero], [data-line], [data-metric]", {
          clearProps: "all",
        });
        return;
      }

      const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
      heroTl
        .from("[data-hero='brand']", { y: 28, opacity: 0, duration: 0.75 }, 0)
        .from("[data-hero='line']", { y: 28, opacity: 0, duration: 0.7 }, "-=0.35")
        .from("[data-hero='sub']", { y: 22, opacity: 0, duration: 0.6 }, "-=0.35")
        .from("[data-hero='cta']", { y: 18, opacity: 0, duration: 0.55 }, "-=0.3")
        .from("[data-hero='meta']", { opacity: 0, duration: 0.45 }, "-=0.25");

      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el, {
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            toggleActions: "play none none none",
          },
          y: 56,
          opacity: 0,
          rotateX: 12,
          transformOrigin: "top center",
          duration: 1,
          ease: "power3.out",
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-line]").forEach((el) => {
        gsap.from(el, {
          scrollTrigger: { trigger: el, start: "top 90%" },
          scaleX: 0,
          transformOrigin: "left center",
          duration: 1.2,
          ease: "power2.out",
        });
      });

      gsap.from("[data-metric]", {
        scrollTrigger: {
          trigger: "[data-metrics]",
          start: "top 85%",
        },
        y: 40,
        opacity: 0,
        scale: 0.85,
        stagger: 0.1,
        duration: 0.85,
        ease: "back.out(1.5)",
      });

      gsap.to("[data-marquee]", {
        xPercent: -50,
        ease: "none",
        duration: 22,
        repeat: -1,
      });

      gsap.to("[data-marquee-rev]", {
        xPercent: -50,
        ease: "none",
        duration: 28,
        repeat: -1,
      });

      // Floating orbs
      gsap.to("[data-orb]", {
        y: "+=28",
        x: "+=12",
        duration: 3.5,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
        stagger: { each: 0.4, from: "random" },
      });

      // Feature rows — slide + color flash
      gsap.utils.toArray<HTMLElement>("[data-feature-row]").forEach((el) => {
        gsap.from(el, {
          scrollTrigger: { trigger: el, start: "top 90%" },
          x: -40,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
        });
      });

      const pin = root.querySelector("[data-pin-product]");
      const pinEnd = root.querySelector("[data-pin-end]");
      if (pin && pinEnd && window.innerWidth >= 900) {
        ScrollTrigger.create({
          trigger: pin,
          start: "top 96px",
          endTrigger: pinEnd,
          end: "bottom 70%",
          pin: true,
          pinSpacing: false,
        });
      }

      gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
        const speed = Number(el.dataset.parallax) || 40;
        gsap.to(el, {
          y: speed,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      });

      // CTA pulse glow
      gsap.to("[data-cta-glow]", {
        opacity: 0.55,
        scale: 1.15,
        duration: 2.2,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      className="landing-root atmosphere relative min-h-screen overflow-x-hidden bg-ink-900 text-ink-100"
    >
      <CursorGlow />
      <ScrollProgress />

      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
          navSolid
            ? "border-ink-600 bg-ink-900/85 backdrop-blur-md"
            : "border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-16 sm:px-8">
          <a href="/" className="flex items-center gap-2.5" data-cursor="grow">
            <img
              src="/logo.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 rounded-md object-cover"
            />
            <span className="font-landing text-[15px] font-semibold tracking-tight text-ink-50">
              DockX
            </span>
          </a>
          <nav className="hidden items-center gap-6 text-[13px] font-medium text-ink-300 md:flex">
            {[
              ["#product", "Product"],
              ["#dashboard", "Dashboard"],
              ["#play", "Try it"],
              ["#modules", "Modules"],
              ["#faq", "FAQ"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="transition hover:text-ink-50"
                data-cursor="grow"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <MagneticLink
              href={APP_LOGIN_URL}
              className="rounded-full bg-brand-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-600"
            >
              Log in
            </MagneticLink>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex min-h-[100dvh] items-center overflow-x-hidden pb-16 pt-28 sm:pb-20 sm:pt-32">
        <HeroScene />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-ink-900 via-ink-900/75 to-ink-900/15 lg:via-ink-900/50 lg:to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-28 bg-gradient-to-t from-ink-900 to-transparent"
        />

        <div
          aria-hidden
          data-orb
          className="pointer-events-none absolute top-[22%] left-[12%] z-[1] h-40 w-40 rounded-full bg-brand-500/20 blur-3xl"
        />
        <div
          aria-hidden
          data-orb
          className="pointer-events-none absolute top-[40%] right-[18%] z-[1] h-52 w-52 rounded-full bg-status-sync/15 blur-3xl"
        />

        <div className="relative z-[2] mx-auto grid w-full max-w-6xl gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
          <div className="max-w-xl">
            <h1
              data-hero="brand"
              className="font-landing text-[clamp(3.25rem,12vw,6.5rem)] leading-[0.9] font-semibold tracking-[-0.04em] text-ink-50"
            >
              <SplitBrand text="DockX" />
            </h1>
            <p
              data-hero="line"
              className="mt-5 font-landing text-xl leading-snug font-medium tracking-tight text-ink-100 sm:text-2xl md:text-[1.75rem]"
            >
              Capture work at the desk.
              <br />
              Decide from the dashboard.
            </p>
            <p
              data-hero="sub"
              className="mt-4 max-w-md text-base leading-relaxed text-ink-300"
            >
              One workspace for time, tasks, and teams — live for everyone on
              the board.
            </p>
            <div data-hero="cta" className="mt-8 flex flex-wrap items-center gap-3">
              <MagneticLink
                href={APP_LOGIN_URL}
                className="items-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Log in to DockX
                <span aria-hidden className="text-lg leading-none">
                  →
                </span>
              </MagneticLink>
              <a
                href="#dashboard"
                data-cursor="grow"
                className="inline-flex items-center rounded-full border border-ink-600 bg-ink-800/70 px-6 py-3 text-sm font-semibold text-ink-100 transition hover:border-brand-400/40 hover:text-ink-50"
              >
                See the dashboard
              </a>
            </div>
            <p
              data-hero="meta"
              className="mt-8 text-[11px] font-medium tracking-[0.2em] text-ink-400 uppercase"
            >
              Desktop agent · Live boards · Org dashboard
            </p>
          </div>

          <div
            aria-hidden
            className="pointer-events-none hidden min-h-[380px] lg:block lg:min-h-[480px]"
          />
        </div>
      </section>

      {/* Marquee */}
      <div className="overflow-hidden border-y border-ink-600 py-4">
        <div
          data-marquee
          className="flex w-max gap-10 whitespace-nowrap font-landing text-sm font-medium tracking-[0.08em] text-ink-400 uppercase"
        >
          {[0, 1].map((copy) => (
            <div key={copy} className="flex gap-10">
              {[
                "Attendance",
                "Kanban",
                "Realtime sync",
                "Chat",
                "Activity",
                "Offline-first",
                "Teams",
              ].map((t) => (
                <span key={`${copy}-${t}`} className="flex items-center gap-10">
                  {t}
                  <span className="text-brand-400/60">◆</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <section data-metrics className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid grid-cols-2 gap-8 border-y border-ink-600 py-10 md:grid-cols-4">
          {METRICS.map((m) => (
            <div
              key={m.label}
              data-metric
              data-cursor="grow"
              className="group transition hover:-translate-y-1"
            >
              <div className="font-landing text-3xl font-semibold tracking-tight text-ink-50 transition group-hover:text-brand-300 sm:text-4xl">
                {m.value}
              </div>
              <div className="mt-2 text-[12px] font-medium tracking-wider text-ink-400 uppercase">
                {m.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Product */}
      <section id="product" className="mx-auto max-w-6xl px-5 pb-24 sm:px-8 sm:pb-32">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
          <div data-pin-product className="lg:pt-2">
            <div data-reveal className="max-w-md">
              <p className="text-[11px] font-semibold tracking-[0.22em] text-brand-300 uppercase">
                Product
              </p>
              <h2 className="mt-4 font-landing text-4xl leading-[1.05] font-semibold tracking-tight text-ink-50 sm:text-5xl">
                Refined for how teams actually work.
              </h2>
              <div data-line className="mt-8 h-px w-24 bg-brand-500" />
              <p className="mt-6 text-sm leading-relaxed text-ink-300">
                Scroll the system. Hover the letters. Click the board.
              </p>
            </div>
          </div>

          <div data-pin-end className="border-t border-ink-600">
            {FEATURES.map((f) => (
              <div
                key={f.n}
                data-reveal
                data-feature-row
                data-cursor="grow"
                className="group border-b border-ink-600 py-10 transition hover:bg-brand-500/[0.04] sm:py-12"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:gap-8">
                  <span className="font-landing text-sm font-medium text-brand-300">
                    {f.n}
                  </span>
                  <div>
                    <h3 className="font-landing text-2xl font-semibold tracking-tight text-ink-50 transition group-hover:text-brand-300 sm:text-3xl">
                      {f.title}
                    </h3>
                    <p className="mt-3 max-w-md text-base leading-relaxed text-ink-300">
                      {f.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard mock */}
      <section
        id="dashboard"
        className="border-t border-ink-600 bg-ink-950/40 py-24 sm:py-32"
      >
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div data-reveal className="mb-12 max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-brand-300 uppercase">
              Dashboard
            </p>
            <h2 className="mt-4 font-landing text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl">
              The view managers
              <br />
              actually use.
            </h2>
            <p className="mt-5 max-w-lg text-base text-ink-300">
              Hover the bars, select a task, scan the team rail — a live mock of
              DockX overview.
            </p>
          </div>
          <div data-reveal>
            <DashboardMock />
          </div>
        </div>
      </section>

      {/* Playgrounds */}
      <section id="play" className="relative border-t border-ink-600 py-24 sm:py-32">
        <div
          aria-hidden
          data-parallax="80"
          className="pointer-events-none absolute -left-20 top-20 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
          <div data-reveal className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-brand-300 uppercase">
              Try it
            </p>
            <h2 className="mt-4 font-landing text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl">
              Touch the product
              <br />
              before you log in.
            </h2>
            <p className="mt-5 max-w-lg text-base text-ink-300">
              Desk status and a mini kanban — click around.
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            <div data-reveal>
              <DeskStatusToggle />
            </div>
            <div data-reveal>
              <LiveBoardPlayground />
            </div>
          </div>
        </div>
      </section>

      <div className="overflow-hidden border-y border-ink-600 py-3">
        <div
          data-marquee-rev
          className="flex w-max gap-10 whitespace-nowrap font-landing text-sm font-medium tracking-[0.12em] text-ink-400/70 uppercase"
        >
          {[0, 1].map((copy) => (
            <div key={copy} className="flex gap-10">
              {[
                "Check in",
                "Move a card",
                "See it live",
                "Talk in context",
                "Close the day",
              ].map((t) => (
                <span key={`${copy}-${t}`} className="flex items-center gap-10">
                  {t}
                  <span className="text-brand-400/50">→</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Modules */}
      <section id="modules" className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <div data-reveal className="mb-12 max-w-xl">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-brand-300 uppercase">
            Modules
          </p>
          <h2 className="mt-4 font-landing text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl">
            Pick a layer.
            <br />
            See what it unlocks.
          </h2>
        </div>
        <div data-reveal>
          <ModuleExplorer />
        </div>
      </section>

      {/* Who */}
      <section id="who" className="border-t border-ink-600 bg-ink-950/40 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div data-reveal className="mb-12">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-brand-300 uppercase">
              Built for
            </p>
            <h2 className="mt-4 font-landing text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl">
              Different seats.
              <br />
              Same workspace.
            </h2>
          </div>
          <div data-reveal>
            <AudienceSwitcher />
          </div>
        </div>
      </section>

      {/* Flow */}
      <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-28">
        <div data-reveal className="mb-12 max-w-lg">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-brand-300 uppercase">
            Flow
          </p>
          <h2 className="mt-4 font-landing text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl">
            From open → done.
          </h2>
        </div>
        <ol className="grid gap-0 border-t border-ink-600 md:grid-cols-4">
          {[
            { n: "01", t: "Open DockX", d: "Agent on the desk" },
            { n: "02", t: "Check in", d: "Status goes live" },
            { n: "03", t: "Move work", d: "Board updates for all" },
            { n: "04", t: "Close the day", d: "Activity stays true" },
          ].map((step, i) => (
            <li
              key={step.n}
              data-reveal
              data-cursor="grow"
              className="group border-b border-ink-600 py-8 md:border-r md:border-b-0 md:px-5 md:py-10 md:last:border-r-0"
            >
              <span className="font-landing text-xs font-medium text-brand-300">
                {step.n}
              </span>
              <h3 className="mt-3 font-landing text-xl font-semibold text-ink-50 transition group-hover:text-brand-300">
                {step.t}
              </h3>
              <p className="mt-2 text-sm text-ink-300">{step.d}</p>
              {i < 3 && (
                <span aria-hidden className="mt-6 hidden text-brand-400/40 md:block">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-ink-600 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <div data-reveal className="mb-10">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-brand-300 uppercase">
              FAQ
            </p>
            <h2 className="mt-4 font-landing text-4xl font-semibold tracking-tight text-ink-50">
              Straight answers.
            </h2>
          </div>
          <div data-reveal>
            <FaqAccordion />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="start" className="relative overflow-hidden py-28 sm:py-36">
        <div
          aria-hidden
          data-cta-glow
          className="pointer-events-none absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,var(--atmosphere-glow),transparent_55%)]"
        />
        <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
          <h2
            data-reveal
            className="font-landing text-4xl font-semibold tracking-tight text-ink-50 sm:text-6xl"
          >
            Ready when
            <br />
            your team is.
          </h2>
          <p data-reveal className="mx-auto mt-5 max-w-md text-base text-ink-300">
            Open DockX, check in, and keep work moving — live for every member
            on the board.
          </p>
          <div data-reveal className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <MagneticLink
              href={APP_LOGIN_URL}
              className="items-center gap-2 rounded-full bg-brand-500 px-8 py-3.5 text-sm font-semibold text-white hover:bg-brand-600"
            >
              Log in to DockX
              <span aria-hidden>→</span>
            </MagneticLink>
            <a
              href="#dashboard"
              data-cursor="grow"
              className="inline-flex rounded-full border border-ink-600 bg-ink-800/70 px-6 py-3.5 text-sm font-semibold text-ink-200 transition hover:border-brand-400/40 hover:text-ink-50"
            >
              Explore dashboard
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-600 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-xs text-ink-400 sm:flex-row sm:px-8">
          <span>© {new Date().getFullYear()} DockX</span>
          <div className="flex items-center gap-6">
            <a href="#product" className="transition hover:text-brand-300">
              Product
            </a>
            <a href="#dashboard" className="transition hover:text-brand-300">
              Dashboard
            </a>
            <a
              href={APP_LOGIN_URL}
              className="font-medium text-ink-300 transition hover:text-brand-300"
            >
              matrix-view.vercel.app
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
