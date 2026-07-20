import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Download,
  Check,
  Clock,
  Activity,
  LayoutDashboard,
  Kanban,
  MessageSquare,
  WifiOff,
  ChevronDown,
  Play,
  Search,
  Plus,
  Send,
  Layers,
  ShieldCheck,
  Zap,
  Users,
  Briefcase,
  Landmark,
  Code2,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  AnimatePresence,
  animate,
  useReducedMotion,
  useMotionValue,
  useTransform,
  useSpring,
} from "motion/react";
import { ThemeToggle } from "../components/ThemeToggle";

/** Ticks up once a second from a seed value; purely presentational, resets on remount. */
function useLiveTimer(seedSeconds: number) {
  const [seconds, setSeconds] = useState(seedSeconds);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Counts a "<20s" / "78%" / "42"-style label up from zero once it enters the viewport. */
function CountUp({ value, className }: { value: string; className?: string }) {
  const reduce = useReducedMotion();
  const match = value.match(/^(\D*)(\d+)(.*)$/);
  const started = useRef(false);
  const [display, setDisplay] = useState(value);

  if (!match) {
    return <span className={className}>{value}</span>;
  }
  const [, prefix, digits, suffix] = match;
  const target = parseInt(digits, 10);

  return (
    <motion.span
      className={className}
      viewport={{ once: true, amount: 0.6 }}
      onViewportEnter={() => {
        if (started.current) return;
        started.current = true;
        if (reduce) {
          setDisplay(value);
          return;
        }
        animate(0, target, {
          duration: 1.1,
          ease: [0.16, 1, 0.3, 1],
          onUpdate: (v) => setDisplay(`${prefix}${Math.round(v)}${suffix}`),
        });
      }}
    >
      {display}
    </motion.span>
  );
}

/** Mouse-tracked 3D tilt for the hero product shot; inert on touch and under reduced motion. */
function TiltCard({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), {
    stiffness: 150,
    damping: 22,
  });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), {
    stiffness: 150,
    damping: 22,
  });

  if (reduce) return <>{children}</>;

  return (
    <motion.div
      style={{ rotateX, rotateY, transformPerspective: 1400 }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - rect.left) / rect.width - 0.5);
        y.set((e.clientY - rect.top) / rect.height - 0.5);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      className="will-change-transform"
    >
      {children}
    </motion.div>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        property: "og:image",
        content: "/og-image.png",
      },
    ],
  }),
  component: LandingPage,
});

/* ============ Primitives ============ */

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/logo.png"
        alt="DockX"
        width={36}
        height={36}
        className="h-9 w-9 rounded-[10px] object-cover shadow-sm shadow-brand-500/20"
      />
      <div className="flex flex-col leading-none">
        <span className="font-display text-[20px] font-semibold tracking-tight text-ink-50">
          DockX
        </span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-brand-400/80">
          Work OS
        </span>
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  icon: Icon,
  className = "",
  href,
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="relative z-10">{children}</span>
      {Icon ? (
        <Icon className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
      ) : null}
    </>
  );
  if (href) {
    return (
      <a href={href} className={`btn-primary group ${className}`}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" className={`btn-primary group ${className}`}>
      {content}
    </button>
  );
}

function SecondaryButton({
  children,
  icon: Icon,
  className = "",
  href,
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  href?: string;
}) {
  const content = (
    <>
      {Icon ? (
        <Icon className="h-4 w-4 text-ink-300 transition-colors group-hover:text-brand-400" />
      ) : null}
      {children}
    </>
  );
  if (href) {
    return (
      <a href={href} className={`btn-secondary group ${className}`}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" className={`btn-secondary group ${className}`}>
      {content}
    </button>
  );
}

function EyebrowChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-ink-800/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300 shadow-sm backdrop-blur">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
      </span>
      {children}
    </span>
  );
}

function SectionTitle({
  eyebrow,
  title,
  sub,
  center = false,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  center?: boolean;
}) {
  return (
    <div className={`max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      {eyebrow ? (
        <div className={center ? "flex justify-center" : ""}>
          <EyebrowChip>{eyebrow}</EyebrowChip>
        </div>
      ) : null}
      <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink-50 sm:text-[40px] sm:leading-[1.1]">
        {title}
      </h2>
      {sub ? (
        <p className="mt-4 text-lg leading-relaxed text-ink-300">{sub}</p>
      ) : null}
    </div>
  );
}

/** Scroll-triggered fade+rise, used for feature tiles, audience cards, and stat numbers. */
function Reveal({
  children,
  i = 0,
  className = "",
}: {
  children: ReactNode;
  i?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ============ Nav ============ */

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const links: [string, string][] = [
    ["Features", "#features"],
    ["Board", "#board"],
    ["FAQ", "#faq"],
  ];

  return (
    <>
      <div ref={sentinelRef} className="h-px w-full" aria-hidden />
      <div className="sticky top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
        <header
          className={`mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl border pl-3 pr-2 transition-all duration-300 sm:h-16 sm:pl-5 sm:pr-3 ${
            scrolled
              ? "border-ink-600/80 bg-ink-800/85 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.15)] backdrop-blur-xl"
              : "border-ink-600/60 bg-ink-800/60 shadow-[0_6px_24px_-12px_rgba(0,0,0,0.35)] backdrop-blur-lg"
          }`}
        >
          <Wordmark />
          <nav className="hidden items-center gap-1 rounded-full border border-ink-600/60 bg-ink-800/70 p-1 md:flex">
            {links.map(([label, href], i) => (
              <a
                key={label}
                href={href}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                  i === 0
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-ink-200 hover:bg-ink-600 hover:text-ink-50"
                }`}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a
              href="/login"
              className="hidden text-[13px] font-semibold text-ink-200 transition hover:text-brand-400 sm:inline-flex"
            >
              Log in
            </a>
            <PrimaryButton href="/signup" icon={ArrowRight} className="!py-2 !px-4 !text-[13px]">
              Start free
            </PrimaryButton>
          </div>
        </header>
      </div>
    </>
  );
}

/* ============ Desktop App Mockup (hero) ============ */

function DesktopMockup() {
  const timer = useLiveTimer(24138);
  return (
    <div className="relative">
      {/* window chrome */}
      <div className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.25)] ring-1 ring-black/[0.03]">
        {/* titlebar */}
        <div className="flex items-center gap-3 border-b border-ink-600 bg-ink-900/80 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-status-error/80" />
            <span className="h-3 w-3 rounded-full bg-status-break/80" />
            <span className="h-3 w-3 rounded-full bg-status-in/80" />
          </div>
          <div className="flex flex-1 items-center justify-center gap-2 text-[11px] font-medium text-ink-300">
            <Wordmark className="scale-75" /> · Dashboard
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <StatusPill state="in" />
            <div className="tabular rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-[13px] font-semibold text-ink-100">
              {timer}
            </div>
            <button className="rounded-md border border-status-break/30 bg-status-break/15 px-2.5 py-1 text-[12px] font-semibold text-status-break">
              Break
            </button>
          </div>
        </div>

        {/* body */}
        <div className="grid grid-cols-12 gap-0">
          {/* sidebar */}
          <aside className="col-span-3 hidden border-r border-ink-600 bg-ink-800/60 p-3 lg:block">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
              Workspace
            </div>
            <ul className="mt-2 space-y-0.5 text-[13px] font-medium text-ink-200">
              {[
                ["Overview", LayoutDashboard, true],
                ["Tasks", Kanban, false],
                ["Users", Users, false],
                ["Activity", Activity, false],
                ["Chat", MessageSquare, false],
              ].map(([label, Icon, active]) => {
                const I = Icon as React.ComponentType<{ className?: string }>;
                return (
                  <li key={label as string}>
                    <div
                      className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 ${
                        active
                          ? "bg-brand-500/10 text-brand-300 ring-1 ring-brand-500/25"
                          : "hover:bg-ink-800"
                      }`}
                    >
                      <I className="h-4 w-4" />
                      <span>{label as string}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 rounded-lg border border-ink-600 bg-ink-800 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
                Session
              </div>
              <div className="tabular mt-1 text-[18px] font-bold text-ink-50">
                {timer}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-300">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-status-in" />
                In since 09:04
              </div>
            </div>
          </aside>

          {/* main */}
          <main className="col-span-12 p-4 lg:col-span-9">
            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Open tasks", "42"],
                ["Done", "78%"],
                ["Due soon", "6"],
                ["Projects", "9"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-lg border border-ink-600 bg-ink-800 p-3"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
                    {k}
                  </div>
                  <div className="tabular mt-1 text-2xl font-semibold text-ink-50">
                    <CountUp value={v} />
                  </div>
                </div>
              ))}
            </div>

            {/* charts */}
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-ink-600 bg-ink-800 p-4 md:col-span-1">
                <div className="text-xs font-semibold text-ink-200">
                  Status mix
                </div>
                <div className="mt-3 flex items-center justify-center">
                  <Donut />
                </div>
                <ul className="mt-3 space-y-1 text-[11px] text-ink-200">
                  <LegendDot color="var(--color-status-in)" label="Done · 34" />
                  <LegendDot color="var(--color-status-break)" label="In Progress · 12" />
                  <LegendDot color="var(--color-status-sync)" label="In Review · 5" />
                  <LegendDot color="var(--color-status-out)" label="To Do · 8" />
                </ul>
              </div>

              <div className="rounded-lg border border-ink-600 bg-ink-800 p-4 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-ink-200">
                    Workload by project
                  </div>
                  <div className="text-[11px] text-ink-400">This week</div>
                </div>
                <div className="mt-4 space-y-2.5">
                  {[
                    ["Falcon web app", 82, "#5865F2"],
                    ["Atlas API", 64, "#4752C4"],
                    ["Design system", 41, "#8891F2"],
                    ["Ops portal", 28, "#A5ADF8"],
                  ].map(([n, w, c]) => (
                    <div key={n as string}>
                      <div className="flex items-center justify-between text-[11px] text-ink-200">
                        <span className="font-medium">{n as string}</span>
                        <span className="tabular text-ink-300">{w as number}h</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-600">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${w as number}%`,
                            background: c as string,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* task table */}
            <div className="mt-4 overflow-hidden rounded-lg border border-ink-600 bg-ink-800">
              <div className="flex items-center justify-between border-b border-ink-600 px-3 py-2">
                <div className="text-xs font-semibold text-ink-200">Recent tasks</div>
                <div className="flex items-center gap-1 text-[11px] text-ink-300">
                  <span className="rounded-md bg-brand-500/10 px-1.5 py-0.5 font-semibold text-brand-300">
                    All
                  </span>
                  <span>Open</span>
                  <span>Done</span>
                </div>
              </div>
              <ul className="divide-y divide-ink-600 text-[12px]">
                {[
                  ["FAL-214", "Onboarding empty state", "In Progress", "var(--color-status-break)", "High"],
                  ["ATL-98", "Rate limit token refresh", "In Review", "var(--color-status-sync)", "Highest"],
                  ["DS-31", "Radius tokens audit", "To Do", "var(--color-status-out)", "Medium"],
                ].map(([k, t, s, c, p]) => (
                  <li key={k as string} className="flex items-center gap-3 px-3 py-2">
                    <span className="tabular w-14 text-[11px] font-semibold text-ink-300">
                      {k as string}
                    </span>
                    <span className="flex-1 text-ink-100">{t as string}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                      style={{ background: c as string }}
                    >
                      {s as string}
                    </span>
                    <span className="hidden text-[11px] font-medium text-ink-300 sm:inline">
                      {p as string}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </main>
        </div>
      </div>

      {/* floating status bubble */}
      <div className="absolute -left-4 top-24 hidden rotate-[-4deg] rounded-xl border border-ink-600 bg-ink-800 p-3 shadow-xl md:block">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-ink-200">
          <span className="pulse-dot h-2 w-2 rounded-full bg-status-in" />
          Checked in · Focus mode
        </div>
        <div className="tabular mt-1 text-lg font-bold text-ink-50">
          {timer}
        </div>
      </div>

      {/* floating sync bubble */}
      <div className="absolute -right-3 bottom-8 hidden rotate-[3deg] rounded-xl border border-ink-600 bg-ink-800 p-3 shadow-xl md:block">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-ink-200">
          <span className="h-2 w-2 rounded-full bg-status-sync" />
          Syncing… 3 pending
        </div>
        <div className="mt-1 text-[11px] text-ink-300">Local DB, offline-first</div>
      </div>
    </div>
  );
}

function StatusPill({ state }: { state: "in" | "out" | "break" }) {
  const map = {
    in: { label: "In", color: "bg-status-in", text: "text-status-in", bg: "bg-status-in/15 border-status-in/30" },
    out: { label: "Out", color: "bg-status-out", text: "text-ink-200", bg: "bg-ink-900 border-ink-600" },
    break: { label: "Break", color: "bg-status-break", text: "text-status-break", bg: "bg-status-break/15 border-status-break/30" },
  }[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${map.bg} ${map.text}`}>
      <span className={`pulse-dot h-1.5 w-1.5 rounded-full ${map.color}`} />
      {map.label}
    </span>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </li>
  );
}

function Donut() {
  const style = {
    background:
      "conic-gradient(var(--color-status-in) 0 57%, var(--color-status-break) 57% 78%, var(--color-status-sync) 78% 86%, var(--color-status-out) 86% 100%)",
  };
  return (
    <div className="relative h-28 w-28 rounded-full" style={style}>
      <div className="absolute inset-3 grid place-items-center rounded-full bg-ink-800">
        <div className="text-center">
          <div className="tabular text-xl font-semibold text-ink-50">
            78%
          </div>
          <div className="text-[10px] font-medium text-ink-300">Done</div>
        </div>
      </div>
    </div>
  );
}

/* ============ Hero ============ */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="atmosphere absolute inset-0 -z-10" />
      <div className="grid-overlay absolute inset-0 -z-10 opacity-60" />
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pt-24">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-6">
            <EyebrowChip>Desktop Agent · Enterprise Work OS</EyebrowChip>
            <h1 className="mt-5 font-display text-3xl font-semibold leading-[1.15] tracking-tight text-ink-50 sm:text-4xl">
              Capture work at the desk.
              <br />
              <span className="text-brand-400">Decide from the dashboard.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-200">
              One backend of record for time, tasks, and teams. Replace Jira,
              Slack, and Hubstaff with a single lightweight workspace.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PrimaryButton href="/signup" icon={ArrowRight}>
                Start free
              </PrimaryButton>
              <SecondaryButton icon={Download}>Download desktop</SecondaryButton>
            </div>
          </div>

          <div className="lg:col-span-6">
            <TiltCard>
              <DesktopMockup />
            </TiltCard>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ Problem / Solution ============ */

function ProblemSolution() {
  const pains = [
    {
      icon: Layers,
      title: "Work scattered across Jira, Slack, and time trackers",
      body: "Five tabs to log an hour. Context lives everywhere except where the work happens.",
    },
    {
      icon: Activity,
      title: "Managers can't see what actually happened at the desk",
      body: "Timesheets are best-effort fiction. Real activity data lives in siloed dashboards.",
    },
    {
      icon: Zap,
      title: "Employees juggle too many tools just to do their job",
      body: "Every app switch is a tax on focus, and a hole in your compliance record.",
    },
  ];
  return (
    <section className="border-y border-ink-600 bg-ink-800">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink-50 sm:text-[40px] sm:leading-[1.1]">
              Three tools pretending to be a workspace.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-300">
              DockX Desktop is the always-on employee workspace. Check in
              once, then track time, manage tasks, and chat, without
              switching apps.
            </p>
          </div>
          <div className="divide-y divide-ink-600 border-y border-ink-600 lg:border-y-0">
            {pains.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} i={i} className="flex gap-4 py-6 first:pt-0 lg:first:pt-0">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink-900 text-brand-400 ring-1 ring-ink-600">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink-50">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ Feature grid (bento) ============ */

type BentoTile = {
  span: string;
  tint: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  content: ReactNode;
};

/** Loops a message, a typing indicator, then a reply, to show chat happening live. */
function AnimatedChat() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<0 | 1 | 2>(reduce ? 2 : 0);

  useEffect(() => {
    if (reduce) return;
    const order: (0 | 1 | 2)[] = [0, 1, 2];
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % order.length;
      setStep(order[i]);
    }, 2200);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div className="mt-5 flex min-h-[112px] flex-col justify-end gap-2">
      <AnimatePresence initial={false}>
        <motion.div
          key="m1"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="max-w-[85%] rounded-2xl rounded-tl-sm bg-ink-600 px-3 py-2 text-[12px] text-ink-100"
        >
          Pushed the new radius tokens, review when you can.
        </motion.div>
        {step === 1 ? (
          <motion.div
            key="typing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="ml-auto flex items-center gap-1 rounded-2xl rounded-tr-sm bg-ink-700 px-3 py-2.5"
          >
            {[0, 1, 2].map((d) => (
              <motion.span
                key={d}
                className="h-1.5 w-1.5 rounded-full bg-ink-300"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: d * 0.15 }}
              />
            ))}
          </motion.div>
        ) : null}
        {step === 2 ? (
          <motion.div
            key="m2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-500 px-3 py-2 text-[12px] text-white"
          >
            Merging now.
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="flex items-center gap-2 rounded-full border border-ink-600 bg-ink-900/30 px-3 py-1.5 text-[12px] text-ink-400">
        <span className="flex-1">Message #design-guild</span>
        <Send className="h-3.5 w-3.5 text-brand-400" />
      </div>
    </div>
  );
}

function FeatureGrid() {
  const attendanceTimer = useLiveTimer(24138);
  const tiles: BentoTile[] = [
    {
      span: "lg:col-span-2",
      tint: "bg-gradient-to-br from-brand-500/10 to-ink-800",
      icon: Clock,
      title: "Check in once. Time tracks itself.",
      body: "Live session timers persist across restarts and exclude break time automatically.",
      content: (
        <div className="mt-5 flex items-center justify-between rounded-xl border border-ink-600 bg-ink-900/30 p-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
              Live session
            </div>
            <div className="tabular mt-1 text-3xl font-semibold text-ink-50">
              {attendanceTimer}
            </div>
          </div>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-500 text-white shadow-lg ring-4 ring-brand-500/20">
            <Play className="h-5 w-5" />
          </span>
        </div>
      ),
    },
    {
      span: "",
      tint: "bg-ink-800",
      icon: Activity,
      title: "Know where work happens.",
      body: "Foreground app and browser URL captured every 5 seconds while checked in.",
      content: (
        <ul className="mt-5 space-y-2 text-[12px]">
          {[
            ["VS Code", "2h 14m"],
            ["Chrome", "1h 02m"],
            ["Figma", "38m"],
          ].map(([a, t]) => (
            <li key={a} className="flex items-center justify-between">
              <span className="text-ink-200">{a}</span>
              <span className="tabular text-ink-400">{t}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      span: "",
      tint: "bg-ink-800",
      icon: MessageSquare,
      title: "Chat without switching apps.",
      body: "DMs, group chats, and read receipts, built into the workday.",
      content: <AnimatedChat />,
    },
    {
      span: "lg:col-span-2",
      tint: "bg-gradient-to-br from-status-sync/10 to-ink-800",
      icon: WifiOff,
      title: "Works when Wi-Fi doesn't.",
      body: "A local SQLite cache queues activity and chat, then syncs the moment you reconnect.",
      content: (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-status-sync/30 bg-status-sync/10 px-3 py-1.5 text-[12px] font-semibold text-status-sync sm:col-span-2">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-status-sync" />
            Syncing… 2 pending
          </div>
          <div className="flex items-center justify-between rounded-lg border border-ink-600 bg-ink-900/30 px-3 py-2 text-[12px] text-ink-200">
            <span>Task FAL-214 comment</span>
            <span className="text-ink-400">Queued</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-ink-600 bg-ink-900/30 px-3 py-2 text-[12px] text-ink-200">
            <span>Message to Ada Lovelace</span>
            <span className="text-ink-400">Queued</span>
          </div>
        </div>
      ),
    },
    {
      span: "lg:col-span-2",
      tint: "bg-ink-800",
      icon: LayoutDashboard,
      title: "One command center, KPIs included.",
      body: "Open tasks, done rate, due-soon count, and workload, filterable by teammate.",
      content: (
        <div className="mt-5 grid grid-cols-4 gap-3">
          {[
            ["Open", "42"],
            ["Done", "78%"],
            ["Due soon", "6"],
            ["Projects", "9"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-ink-600 bg-ink-900/30 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                {k}
              </div>
              <div className="tabular mt-1 text-xl font-semibold text-ink-50">
                <CountUp value={v} />
              </div>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <section id="features" className="scroll-mt-24 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionTitle
        title="Everything your team needs, built in."
        sub="From check-in to shipped code, one native app covers the whole workday."
        center
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile, i) => (
          <Reveal
            key={tile.title}
            i={i}
            className={`rounded-2xl border border-ink-600 p-6 ${tile.tint} ${tile.span}`}
          >
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-ink-900/60 text-brand-400 ring-1 ring-ink-600">
              <tile.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-ink-50">
              {tile.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{tile.body}</p>
            {tile.content}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ============ Kanban spotlight ============ */

/** A plain card, or (for the one card mid-drag) a card that floats in a slow loop to suggest live drag-and-drop. */
function DragCard({ dragging, children }: { dragging?: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();

  if (!dragging) {
    return (
      <div className="rounded-md border border-ink-600 bg-ink-800 p-2.5 shadow-sm">{children}</div>
    );
  }
  if (reduce) {
    return (
      <div className="rotate-[-1.5deg] rounded-md border border-brand-300 bg-ink-800 p-2.5 shadow-sm ring-2 ring-brand-500/25">
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className="rounded-md border border-brand-300 bg-ink-800 p-2.5 shadow-lg shadow-brand-500/20 ring-2 ring-brand-500/25 will-change-transform"
      animate={{ y: [0, -7, 0], rotate: [-1.5, -3.5, -1.5] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

function BoardVisual() {
  const columns = [
    {
      name: "To Do",
      color: "var(--color-status-out)",
      cards: [
        { k: "FAL-221", t: "Empty state illustrations", p: "Medium", pc: "#D97706" },
        { k: "ATL-104", t: "Add pagination to /users", p: "Low", pc: "#059669" },
      ],
    },
    {
      name: "In Progress",
      color: "var(--color-status-break)",
      cards: [
        { k: "FAL-214", t: "Onboarding empty state", p: "High", pc: "#EA580C", drag: true },
        { k: "DS-31", t: "Radius tokens audit", p: "Medium", pc: "#D97706" },
      ],
    },
    {
      name: "In Review",
      color: "var(--color-status-sync)",
      cards: [{ k: "ATL-98", t: "Rate limit token refresh", p: "Highest", pc: "#DC2626" }],
    },
    {
      name: "Done",
      color: "var(--color-status-in)",
      cards: [
        { k: "FAL-201", t: "Dark logo variant", p: "Low", pc: "#059669" },
        { k: "OPS-12", t: "SSO SAML metadata", p: "High", pc: "#EA580C" },
      ],
    },
  ];
  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 p-1 shadow-xl">
      <div className="flex items-center gap-3 border-b border-ink-600 bg-ink-800/70 px-4 py-3">
        <div className="flex items-center gap-1 rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[12px] font-semibold text-ink-100">
          <Kanban className="h-3.5 w-3.5 text-brand-400" />
          Falcon web app
          <ChevronDown className="h-3 w-3 text-ink-400" />
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <div className="flex items-center gap-1 rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[11px] text-ink-300">
            <Search className="h-3 w-3" /> Search FAL…
          </div>
          <span className="rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[11px] font-medium text-ink-200">
            Type: All
          </span>
          <span className="rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[11px] font-medium text-ink-200">
            Priority: All
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {["#5865F2", "#0369A1", "#B45309"].map((c) => (
              <span
                key={c}
                className="h-6 w-6 rounded-full border-2 border-ink-700"
                style={{ background: c }}
              />
            ))}
          </div>
          <button className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-2.5 py-1 text-[11px] font-semibold text-white">
            <Plus className="h-3 w-3" /> Task
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-4">
        {columns.map((col) => (
          <div key={col.name} className="rounded-lg border border-ink-600 bg-ink-800/40 p-2">
            <div className="flex items-center justify-between px-1 py-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-200">
                <span className="h-2 w-2 rounded-full" style={{ background: col.color }} />
                {col.name}
              </div>
              <span className="tabular text-[10px] font-medium text-ink-300">
                {col.cards.length}
              </span>
            </div>
            <div className="mt-1 space-y-2">
              {col.cards.map((c) => (
                <DragCard key={c.k} dragging={c.drag}>
                  <div className="tabular text-[10px] font-semibold text-ink-300">{c.k}</div>
                  <div className="mt-0.5 text-[12px] font-medium leading-snug text-ink-100">
                    {c.t}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-semibold text-white"
                      style={{ background: c.pc }}
                    >
                      {c.p}
                    </span>
                    <span
                      className="h-4 w-4 rounded-full ring-2 ring-ink-800"
                      style={{ background: "#5865F2" }}
                    />
                  </div>
                </DragCard>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KanbanSpotlight() {
  const bullets = [
    "Custom columns: add, rename, reorder, delete",
    "Drag-and-drop between statuses, multi-member combined boards",
    "Task types: Task, Bug, Story, Time, with estimates and hours logged",
    "Comments, attachments, labels, and reporter metadata on every card",
  ];
  return (
    <section id="board" className="scroll-mt-24 border-y border-ink-600 bg-ink-800">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-ink-900 text-brand-400 ring-1 ring-ink-600">
              <Kanban className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
              Jira-style boards. Zero context switching.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-300">
              Projects, columns, drag-and-drop, and full task modals:
              everything you left Jira for, without leaving the app your team
              already lives in.
            </p>
            <ul className="mt-6 space-y-3">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-[15px] text-ink-200">
                  <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/25">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal i={1}>
            <BoardVisual />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ============ Architecture ============ */

function Architecture() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionTitle
        eyebrow="Architecture"
        title="Two clients. One source of truth."
        sub="Data is captured once at the desktop and consumed everywhere. No double-entry, no drift."
        center
      />
      <div className="mt-14 grid items-center gap-6 md:grid-cols-3">
        <ArchCard
          icon={Code2}
          title="Desktop Agent"
          role="Employee execution"
          items={["Tasks & Kanban", "Check-in & timer", "Chat", "Auto activity"]}
          highlight
        />
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full border border-brand-200 bg-brand-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-brand-300">
            Shared backend
          </div>
          <div className="w-full rounded-2xl border border-ink-600 bg-ink-800/60 p-5 text-center">
            <div className="font-display text-lg font-semibold text-ink-50">
              Node.js + MongoDB
            </div>
            <div className="mt-1 text-[12px] text-ink-300">
              One record of time, tasks, teams
            </div>
            <div className="mt-3 flex justify-center gap-1.5">
              {["#5865F2", "#4752C4", "#8891F2"].map((c) => (
                <span key={c} className="h-2 w-2 rounded-full" style={{ background: c }} />
              ))}
            </div>
          </div>
        </div>
        <ArchCard
          icon={LayoutDashboard}
          title="Web Portal"
          role="Manager console"
          items={["Org setup", "Reports & audits", "Monitoring", "Configuration"]}
        />
      </div>
    </section>
  );
}

function ArchCard({
  icon: Icon,
  title,
  role,
  items,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  role: string;
  items: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 ${
        highlight
          ? "border-brand-300 bg-gradient-to-br from-brand-500/10 to-ink-800 shadow-lg ring-1 ring-brand-500/25"
          : "border-ink-600 bg-ink-800"
      }`}
    >
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-ink-800 text-brand-400 ring-1 ring-ink-600">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 font-display text-xl font-semibold text-ink-50">{title}</div>
      <div className="text-[12px] font-semibold uppercase tracking-wider text-brand-400">
        {role}
      </div>
      <ul className="mt-4 space-y-2 text-[13px] text-ink-200">
        {items.map((i) => (
          <li key={i} className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-brand-400" strokeWidth={3} />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============ Audiences ============ */

function Audiences() {
  const cards = [
    {
      icon: Code2,
      title: "Software companies",
      size: "10 to 500 devs",
      body: "Replace Jira, Slack, and Hubstaff with one integrated surface engineers actually keep open.",
    },
    {
      icon: Briefcase,
      title: "Agencies & design shops",
      size: "Billable accuracy",
      body: "Automatic activity capture turns real desk time into defensible client invoices.",
    },
    {
      icon: ShieldCheck,
      title: "IT consultancies & BPOs",
      size: "Compliance-grade",
      body: "Immutable attendance and activity logs: audit trails you can hand to legal.",
    },
    {
      icon: Landmark,
      title: "Enterprises",
      size: "500+ seats",
      body: "Tool consolidation with role-based access, org bootstrap, and an SSO-ready roadmap.",
    },
  ];
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle title="Purpose-built for teams that ship." center />
      </div>
      <div className="mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:px-6 lg:mx-auto lg:max-w-7xl lg:justify-center lg:px-8">
        {cards.map(({ icon: Icon, title, size, body }, i) => (
          <Reveal
            key={title}
            i={i}
            className="w-[280px] shrink-0 snap-start rounded-2xl border border-ink-600 bg-ink-800 p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg sm:w-[300px]"
          >
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/25">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-4 font-display text-lg font-semibold text-ink-50">{title}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
              {size}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-300">{body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ============ Stats ============ */

function Stats() {
  const stats: [string, string][] = [
    ["3+", "Tools replaced with one"],
    ["<20s", "Check-in to activity sync"],
    ["100%", "Offline-first, local SQLite"],
    ["5s", "Activity polling interval"],
  ];
  return (
    <section className="bg-ink-900">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
        {stats.map(([n, l], i) => (
          <Reveal key={l} i={i} className="text-center">
            <CountUp
              value={n}
              className="tabular block text-4xl font-semibold text-brand-300 sm:text-5xl"
            />
            <div className="mt-2 text-[13px] font-medium text-ink-300">{l}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ============ FAQ ============ */

function FAQ() {
  const faqs = [
    {
      q: "What platforms does the desktop app support?",
      a: "DockX Desktop runs on macOS and Windows via Tauri, a lightweight Rust runtime that keeps the app small, fast, and battery-friendly.",
    },
    {
      q: "Does it track me when I'm checked out?",
      a: "No. Activity monitoring only runs while you're checked in, and it pauses automatically when you go on break. DockX itself is always excluded from recorded time.",
    },
    {
      q: "Can I use it offline?",
      a: "Yes. Chat drafts, activity sessions, and task edits queue to a local SQLite outbox and sync automatically when you reconnect, usually within 8 seconds.",
    },
    {
      q: "What's the difference between the Desktop app and the Web portal?",
      a: "Desktop is the employee workspace: tasks, timers, chat, activity. Web is the manager console: org setup, reports, monitoring, and configuration. Same backend, different surface.",
    },
    {
      q: "Is there a free plan?",
      a: "Yes. Start free and invite your team. Paid plans unlock advanced admin controls, longer activity history, and enterprise features like SSO.",
    },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="scroll-mt-24 mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionTitle eyebrow="FAQ" title="Answers, before you ask." center />
      <div className="mt-12 divide-y divide-ink-600 rounded-2xl border border-ink-600 bg-ink-800">
        {faqs.map((f, i) => (
          <div key={f.q}>
            <button
              onClick={() => setOpen(open === i ? -1 : i)}
              className="flex w-full items-center justify-between gap-6 px-5 py-4 text-left"
            >
              <span className="font-display text-base font-semibold text-ink-50">{f.q}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-ink-300 transition ${
                  open === i ? "rotate-180 text-brand-400" : ""
                }`}
              />
            </button>
            {open === i ? (
              <div className="px-5 pb-5 text-sm leading-relaxed text-ink-200">{f.a}</div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============ Final CTA & Footer ============ */

function FinalCTA() {
  return (
    <section className="relative overflow-hidden">
      <div className="atmosphere absolute inset-0 -z-10" />
      <div className="grid-overlay absolute inset-0 -z-10 opacity-60" />
      <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <h2 className="font-display text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl">
          Start capturing work where it happens.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink-200">
          One backend of record for time, tasks, and teams: free to try,
          ready for your whole org.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <PrimaryButton href="/signup" icon={ArrowRight}>
            Start free
          </PrimaryButton>
          <SecondaryButton icon={Download}>Download desktop</SecondaryButton>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const cols = [
    ["Product", ["Overview", "Desktop app", "Web portal", "Changelog"]],
    ["Features", ["Attendance", "Activity", "Kanban", "Chat", "Offline"]],
    ["Company", ["Pricing", "Customers", "Docs", "Contact"]],
    ["Legal", ["Privacy", "Terms", "Security", "DPA"]],
  ] as const;
  return (
    <footer className="border-t border-ink-600 bg-ink-800">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-6">
          <div className="md:col-span-2">
            <Wordmark />
            <p className="mt-4 max-w-xs text-sm text-ink-300">
              The Desktop Agent for Enterprise Work OS. Capture at the desk.
              Decide from the dashboard.
            </p>
          </div>
          {cols.map(([title, items]) => (
            <div key={title}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
                {title}
              </div>
              <ul className="mt-3 space-y-2 text-sm text-ink-200">
                {items.map((i) => (
                  <li key={i}>
                    <a href="#" className="hover:text-brand-400">
                      {i}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 border-t border-ink-600 pt-6 text-xs text-ink-300">
          © {new Date().getFullYear()} DockX, Inc. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

/* ============ Page ============ */

function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-900">
      <Nav />
      <Hero />
      <ProblemSolution />
      <FeatureGrid />
      <KanbanSpotlight />
      <Architecture />
      <Audiences />
      <Stats />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
