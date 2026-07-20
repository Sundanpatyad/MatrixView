import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Download,
  LogIn,
  Check,
  Clock,
  Activity,
  LayoutDashboard,
  Kanban,
  MessageSquare,
  WifiOff,
  UserCircle2,
  Building2,
  ChevronDown,
  Play,
  Pause,
  Search,
  Plus,
  Paperclip,
  Send,
  Bell,
  Layers,
  ShieldCheck,
  Zap,
  Users,
  Briefcase,
  Landmark,
  Code2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "../components/ThemeToggle";

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
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <button className={`btn-primary group ${className}`}>
      <span className="relative z-10">{children}</span>
      {Icon ? (
        <Icon className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
      ) : null}
    </button>
  );
}

function SecondaryButton({
  children,
  icon: Icon,
  className = "",
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <button className={`btn-secondary group ${className}`}>
      {Icon ? (
        <Icon className="h-4 w-4 text-ink-300 transition-colors group-hover:text-brand-400" />
      ) : null}
      {children}
    </button>
  );
}

function TertiaryLink({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button className="group inline-flex items-center gap-1.5 px-3 py-3 text-sm font-semibold text-ink-200 transition hover:text-brand-400">
      {Icon ? <Icon className="h-4 w-4" /> : null}
      <span className="relative">
        {children}
        <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-brand-500/100 transition-all duration-300 group-hover:w-full" />
      </span>
    </button>
  );
}

function EyebrowChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-ink-800/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300 shadow-sm backdrop-blur">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500/100" />
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

/* ============ Nav ============ */

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
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
          {["Features", "Pricing", "Download", "Docs"].map((l, i) => (
            <a
              key={l}
              href={`#${l.toLowerCase()}`}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                i === 0
                  ? "bg-brand-500/100 text-white shadow-sm"
                  : "text-ink-200 hover:bg-ink-600 hover:text-ink-50"
              }`}
            >
              {l}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button className="hidden text-[13px] font-semibold text-ink-200 hover:text-brand-400 sm:inline-flex">
            Log in
          </button>
          <PrimaryButton icon={ArrowRight} className="!py-2 !px-4 !text-[13px]">
            Start free
          </PrimaryButton>
        </div>
      </header>
    </div>
  );
}

/* ============ Desktop App Mockup (hero) ============ */

function DesktopMockup() {
  return (
    <div className="relative">
      {/* window chrome */}
      <div className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.25)] ring-1 ring-black/[0.03]">
        {/* titlebar */}
        <div className="flex items-center gap-3 border-b border-ink-600 bg-ink-900/80 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400/80" />
            <span className="h-3 w-3 rounded-full bg-[#f0b232]/80" />
            <span className="h-3 w-3 rounded-full bg-[#23a559]/80" />
          </div>
          <div className="flex flex-1 items-center justify-center gap-2 text-[11px] font-medium text-ink-300">
            <Wordmark className="scale-75" /> · Dashboard
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <StatusPill state="in" />
            <div className="tabular rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-[13px] font-semibold text-ink-100">
              06:42:18
            </div>
            <button className="rounded-md border border-[#f0b232]/30 bg-[#f0b232]/15 px-2.5 py-1 text-[12px] font-semibold text-[#9a6700] dark:text-[#fee75c]">
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
                ["Timeline", Layers, false],
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
                06:42:18
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-300">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#23a559]" />
                In since 09:04 · Break 00:22
              </div>
            </div>
          </aside>

          {/* main */}
          <main className="col-span-12 p-4 lg:col-span-9">
            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Open tasks", "42"],
                ["Done %", "78%"],
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
                  <div className="tabular mt-1 font-display text-2xl font-semibold text-ink-50">
                    {v}
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
                  <LegendDot color="#23A559" label="Done · 34" />
                  <LegendDot color="#F0B232" label="In Progress · 12" />
                  <LegendDot color="#00A8FC" label="In Review · 5" />
                  <LegendDot color="#80848E" label="To Do · 8" />
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
                  ["FAL-214", "Onboarding empty state", "In Progress", "#F0B232", "High"],
                  ["ATL-98", "Rate limit token refresh", "In Review", "#00A8FC", "Highest"],
                  ["DS-31", "Radius tokens audit", "To Do", "#80848E", "Medium"],
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
          <span className="pulse-dot h-2 w-2 rounded-full bg-[#23a559]" />
          Checked in · Focus mode
        </div>
        <div className="tabular mt-1 font-display text-lg font-bold text-ink-50">
          06:42:18
        </div>
      </div>

      {/* floating sync bubble */}
      <div className="absolute -right-3 bottom-8 hidden rotate-[3deg] rounded-xl border border-ink-600 bg-ink-800 p-3 shadow-xl md:block">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-ink-200">
          <span className="h-2 w-2 rounded-full bg-[#00a8fc]" />
          Syncing… 3 pending
        </div>
        <div className="mt-1 text-[11px] text-ink-300">Local DB · Offline-first</div>
      </div>
    </div>
  );
}

function StatusPill({ state }: { state: "in" | "out" | "break" }) {
  const map = {
    in: { label: "In", color: "bg-[#23a559]", text: "text-[#18783f] dark:text-[#57f287]", bg: "bg-[#23a559]/15 border-[#23a559]/30" },
    out: { label: "Out", color: "bg-ink-300", text: "text-ink-200", bg: "bg-ink-900 border-ink-600" },
    break: { label: "Break", color: "bg-[#f0b232]", text: "text-[#9a6700] dark:text-[#fee75c]", bg: "bg-[#f0b232]/15 border-[#f0b232]/30" },
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
  // conic-gradient donut
  const style = {
    background:
      "conic-gradient(#23A559 0 57%, #F0B232 57% 78%, #00A8FC 78% 86%, #80848E 86% 100%)",
  };
  return (
    <div className="relative h-28 w-28 rounded-full" style={style}>
      <div className="absolute inset-3 grid place-items-center rounded-full bg-ink-800">
        <div className="text-center">
          <div className="tabular font-display text-xl font-semibold text-ink-50">
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
          <div className="lg:col-span-5">
            <EyebrowChip>Desktop Agent · Enterprise Work OS</EyebrowChip>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink-50 sm:text-6xl lg:text-[64px]">
              Capture work at the desk.{" "}
              <span className="text-brand-400">Decide from the dashboard.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-200">
              One backend of record for time, tasks, and teams. Replace Jira,
              Slack, and Hubstaff with one lightweight desktop workspace —
              Desktop for employees, Web for managers.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PrimaryButton icon={ArrowRight}>Start free</PrimaryButton>
              <SecondaryButton icon={Download}>
                Download for Mac / Windows
              </SecondaryButton>
              <TertiaryLink icon={LogIn}>Log in to portal</TertiaryLink>
            </div>
            <div className="mt-8 flex items-center gap-3 text-sm text-ink-300">
              <div className="flex -space-x-2">
                {["#5865F2", "#0369A1", "#B45309", "#BE123C"].map((c) => (
                  <span
                    key={c}
                    className="h-7 w-7 rounded-full border-2 border-ink-700"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <span>
                Built for software teams, agencies, and distributed orgs
                (10–500+ people)
              </span>
            </div>
          </div>

          <div className="lg:col-span-7">
            <DesktopMockup />
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
      title: "Work scattered across Jira, Slack & time trackers",
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
      body: "Every app switch is a tax on focus — and a hole in your compliance record.",
    },
  ];
  return (
    <section className="border-y border-ink-600 bg-ink-800">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="The tool sprawl problem"
          title="Three tools pretending to be a workspace."
          sub="DockX Desktop is the always-on employee workspace — check in once, track time automatically, manage tasks, and chat without switching apps."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {pains.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-ink-600 bg-ink-800/50 p-6 transition hover:border-brand-500/40 hover:bg-brand-500/10"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-ink-800 text-brand-400 ring-1 ring-ink-600">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-ink-50">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ Feature block ============ */

function FeatureBlock({
  eyebrow,
  title,
  body,
  bullets,
  visual,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div
        className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${
          reverse ? "lg:[&>div:first-child]:order-2" : ""
        }`}
      >
        <div>
          <EyebrowChip>{eyebrow}</EyebrowChip>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-300">{body}</p>
          <ul className="mt-6 space-y-3">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-[15px] text-ink-200">
                <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/10 text-brand-400 ring-1 ring-brand-200">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>{visual}</div>
      </div>
    </section>
  );
}

/* ============ Visuals for each feature ============ */

function AttendanceVisual() {
  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 p-1 shadow-xl ring-1 ring-black/[0.03]">
      <div className="rounded-t-xl border-b border-ink-600 bg-ink-800/70 px-4 py-3">
        <div className="flex items-center gap-3">
          <Wordmark className="scale-90" />
          <div className="ml-auto flex items-center gap-2">
            <StatusPill state="in" />
            <div className="tabular rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-[13px] font-semibold text-ink-100">
              06:42:18
            </div>
            <button className="inline-flex items-center gap-1 rounded-md border border-[#f0b232]/30 bg-[#f0b232]/15 px-2.5 py-1 text-[12px] font-semibold text-[#9a6700] dark:text-[#fee75c]">
              <Pause className="h-3 w-3" /> Break
            </button>
            <button className="inline-flex items-center gap-1 rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-[12px] font-semibold text-ink-200">
              Check Out
            </button>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Check In", "09:04", "In", "emerald"],
            ["Break", "12:20", "Break", "amber"],
            ["Resumed", "12:42", "In", "emerald"],
          ].map(([l, t, s, c]) => (
            <div
              key={l as string}
              className="rounded-xl border border-ink-600 bg-ink-800/50 p-3"
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
                {l as string}
              </div>
              <div className="tabular mt-1 font-display text-xl font-semibold text-ink-50">
                {t as string}
              </div>
              <div
                className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  c === "emerald"
                    ? "bg-[#23a559]/15 text-[#18783f] dark:text-[#57f287]"
                    : "bg-[#f0b232]/15 text-[#9a6700] dark:text-[#fee75c]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    c === "emerald" ? "bg-[#23a559]" : "bg-[#f0b232]"
                  }`}
                />
                {s as string}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-ink-600 bg-gradient-to-br from-brand-500/10 to-ink-800 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-300">
                Live session
              </div>
              <div className="tabular mt-1 font-display text-4xl font-bold text-ink-50">
                06:42:18
              </div>
              <div className="mt-1 text-xs text-ink-300">
                Excludes 00:22 break · Persists across restarts
              </div>
            </div>
            <button className="grid h-14 w-14 place-items-center rounded-full bg-brand-500/100 text-white shadow-lg ring-4 ring-brand-500/25 transition hover:bg-brand-600">
              <Play className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityVisual() {
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-ink-600 bg-ink-800 p-5 shadow-lg">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
            Employee view
          </div>
          <div className="tabular mt-3 font-display text-3xl font-bold text-ink-50">
            06:42:18
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-ink-300">
            <span className="pulse-dot h-2 w-2 rounded-full bg-[#23a559]" />
            Tracking in background
          </div>
          <div className="mt-5 space-y-2 text-[12px]">
            {[
              ["VS Code", "2h 14m"],
              ["Chrome · github.com", "1h 02m"],
              ["Figma", "38m"],
              ["Slack", "22m"],
            ].map(([a, t]) => (
              <div key={a} className="flex items-center justify-between">
                <span className="text-ink-200">{a}</span>
                <span className="tabular text-ink-300">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="lg:col-span-3">
        <div className="rounded-2xl border border-ink-600 bg-ink-800 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
                Admin activity · Mon, Mar 4
              </div>
              <div className="mt-1 font-display text-lg font-semibold text-ink-50">
                Org-wide breakdown
              </div>
            </div>
            <div className="rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[11px] font-semibold text-ink-200">
              12 members
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {[
              ["Ada L.", 92, "#5865F2"],
              ["Marcus T.", 78, "#4752C4"],
              ["Sana K.", 66, "#8891F2"],
              ["Ivan P.", 54, "#5EEAD4"],
              ["Priya D.", 38, "#A5ADF8"],
            ].map(([n, w, c]) => (
              <div key={n as string}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-medium text-ink-200">{n as string}</span>
                  <span className="tabular text-ink-300">
                    {Math.round(((w as number) / 100) * 8 * 60) / 60}h active
                  </span>
                </div>
                <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-ink-600">
                  <div style={{ width: `${(w as number) * 0.7}%`, background: c as string }} />
                  <div style={{ width: `${(w as number) * 0.2}%`, background: "#F0B232" }} />
                  <div style={{ width: `${(w as number) * 0.1}%`, background: "#80848E" }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-4 text-[11px] text-ink-300">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-600" /> Focus apps
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#f0b232]" /> Comms
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-ink-300" /> Away
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardVisual() {
  const [tab, setTab] = useState("Overview");
  const tabs = ["Overview", "Tasks", "Users", "Timeline", "Activity"];
  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 p-1 shadow-xl">
      <div className="rounded-t-xl border-b border-ink-600 bg-ink-800/70 px-4 py-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${
                tab === t
                  ? "bg-ink-800 text-ink-50 shadow-sm ring-1 ring-ink-600"
                  : "text-ink-300 hover:text-ink-100"
              }`}
            >
              {t}
              {t === "Timeline" ? (
                <span className="ml-1.5 rounded-full bg-brand-500/100 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  4
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-4 gap-3">
          {[
            ["Open", "42"],
            ["Done", "78%"],
            ["Due soon", "6"],
            ["Overdue", "2"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="rounded-lg border border-ink-600 bg-ink-800/40 p-3"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-300">
                {k}
              </div>
              <div className="tabular mt-1 font-display text-xl font-semibold text-ink-50">
                {v}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-5 gap-3">
          <div className="col-span-2 rounded-lg border border-ink-600 bg-ink-800 p-3">
            <div className="text-[11px] font-semibold text-ink-200">Status</div>
            <div className="mt-3 flex justify-center">
              <Donut />
            </div>
          </div>
          <div className="col-span-3 rounded-lg border border-ink-600 bg-ink-800 p-3">
            <div className="text-[11px] font-semibold text-ink-200">
              Priority distribution
            </div>
            <div className="mt-5 flex h-32 items-end gap-2">
              {[
                [70, "#DC2626"],
                [45, "#EA580C"],
                [88, "#D97706"],
                [56, "#059669"],
                [22, "#94A3B8"],
              ].map(([h, c], i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t"
                    style={{ height: `${h as number}%`, background: c as string }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-medium text-ink-300">
              <span>Highest</span>
              <span>High</span>
              <span>Med</span>
              <span>Low</span>
              <span>Lowest</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BoardVisual() {
  const columns = [
    {
      name: "To Do",
      color: "#80848E",
      cards: [
        { k: "FAL-221", t: "Empty state illustrations", p: "Medium", pc: "#D97706" },
        { k: "ATL-104", t: "Add pagination to /users", p: "Low", pc: "#059669" },
      ],
    },
    {
      name: "In Progress",
      color: "#F0B232",
      cards: [
        { k: "FAL-214", t: "Onboarding empty state", p: "High", pc: "#EA580C", drag: true },
        { k: "DS-31", t: "Radius tokens audit", p: "Medium", pc: "#D97706" },
      ],
    },
    {
      name: "In Review",
      color: "#00A8FC",
      cards: [{ k: "ATL-98", t: "Rate limit token refresh", p: "Highest", pc: "#DC2626" }],
    },
    {
      name: "Done",
      color: "#23A559",
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
          <button className="inline-flex items-center gap-1 rounded-md bg-brand-500/100 px-2.5 py-1 text-[11px] font-semibold text-white">
            <Plus className="h-3 w-3" /> Task
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-4">
        {columns.map((col) => (
          <div
            key={col.name}
            className="rounded-lg border border-ink-600 bg-ink-800/40 p-2"
          >
            <div className="flex items-center justify-between px-1 py-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-200">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: col.color }}
                />
                {col.name}
              </div>
              <span className="tabular text-[10px] font-medium text-ink-300">
                {col.cards.length}
              </span>
            </div>
            <div className="mt-1 space-y-2">
              {col.cards.map((c) => (
                <div
                  key={c.k}
                  className={`rounded-md border bg-ink-800 p-2.5 shadow-sm ${
                    c.drag
                      ? "border-brand-300 ring-2 ring-brand-500/25 rotate-[-1.5deg]"
                      : "border-ink-600"
                  }`}
                >
                  <div className="tabular text-[10px] font-semibold text-ink-300">
                    {c.k}
                  </div>
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
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatVisual() {
  return (
    <div className="grid gap-3 sm:grid-cols-5">
      <div className="hidden rounded-2xl border border-ink-600 bg-ink-800 p-3 shadow-lg sm:col-span-2 sm:block">
        <div className="flex items-center gap-2 rounded-md border border-ink-600 bg-ink-800/60 px-2 py-1.5 text-[11px] text-ink-300">
          <Search className="h-3 w-3" /> Search conversations
        </div>
        <ul className="mt-3 space-y-1 text-[12px]">
          {[
            { n: "Design guild", p: "Sana: ship it 🎯", a: true, u: 2 },
            { n: "Ada Lovelace", p: "Pushed the fix — CI green", a: false, u: 0 },
            { n: "#atlas-api", p: "Marcus: rate limits patched", a: false, u: 0 },
            { n: "Ivan P.", p: "typing…", a: false, u: 0, typing: true },
          ].map((c) => (
            <li
              key={c.n}
              className={`flex items-center gap-2 rounded-md p-2 ${
                c.a ? "bg-brand-500/10 ring-1 ring-brand-500/25" : "hover:bg-ink-900"
              }`}
            >
              <span className="relative">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-500/100 text-[11px] font-bold text-white">
                  {c.n[0]}
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#23a559] ring-2 ring-ink-800" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-ink-100">{c.n}</div>
                <div className="truncate text-[11px] text-ink-300">
                  {c.typing ? (
                    <span className="text-brand-400">typing…</span>
                  ) : (
                    c.p
                  )}
                </div>
              </div>
              {c.u ? (
                <span className="rounded-full bg-brand-500/100 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {c.u}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-ink-600 bg-ink-800 shadow-lg sm:col-span-3">
        <div className="flex items-center gap-2 border-b border-ink-600 px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-500/100 text-[11px] font-bold text-white">
            D
          </span>
          <div>
            <div className="text-[13px] font-semibold text-ink-50">Design guild</div>
            <div className="text-[11px] text-ink-300">4 members · 3 online</div>
          </div>
          <div className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-[#18783f] dark:text-[#57f287]">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#23a559]" />
            Live
          </div>
        </div>

        <div className="space-y-3 p-4">
          <ChatBubble from="Sana" color="#B45309" body="Pushed the new radius tokens — review when you can." time="10:41" />
          <ChatBubble
            me
            body="Loving the sharper corners on cards. Merging."
            time="10:42"
            receipts="✓✓"
          />
          <ChatBubble from="Marcus" color="#0369A1" body="Attaching the audit sheet 📎" time="10:43" attach="tokens-audit.pdf" />
          <div className="flex items-center gap-2 text-[11px] text-ink-300">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-ink-700 text-[10px] font-bold text-ink-200">
              I
            </span>
            <span className="rounded-full bg-ink-600 px-2 py-1">
              <span className="tabular">typing</span>
              <span className="ml-1 inline-flex gap-0.5">
                <span className="h-1 w-1 rounded-full bg-ink-400 pulse-dot" />
                <span className="h-1 w-1 rounded-full bg-ink-400 pulse-dot" />
                <span className="h-1 w-1 rounded-full bg-ink-400 pulse-dot" />
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-ink-600 p-3">
          <button className="grid h-8 w-8 place-items-center rounded-md text-ink-300 hover:bg-ink-600">
            <Paperclip className="h-4 w-4" />
          </button>
          <div className="flex-1 rounded-md border border-ink-600 bg-ink-800/50 px-3 py-2 text-[12px] text-ink-300">
            Message #design-guild
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-md bg-brand-500/100 text-white">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  from,
  color,
  body,
  time,
  me,
  receipts,
  attach,
}: {
  from?: string;
  color?: string;
  body: string;
  time: string;
  me?: boolean;
  receipts?: string;
  attach?: string;
}) {
  return (
    <div className={`flex gap-2 ${me ? "flex-row-reverse" : ""}`}>
      {!me ? (
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
          style={{ background: color }}
        >
          {from?.[0]}
        </span>
      ) : null}
      <div className={`max-w-[75%] ${me ? "items-end" : "items-start"} flex flex-col`}>
        {!me ? (
          <div className="text-[10px] font-semibold text-ink-200">{from}</div>
        ) : null}
        <div
          className={`mt-0.5 rounded-2xl px-3 py-2 text-[12px] leading-relaxed ${
            me
              ? "rounded-tr-sm bg-brand-500/100 text-white"
              : "rounded-tl-sm bg-ink-600 text-ink-100"
          }`}
        >
          {body}
          {attach ? (
            <div className="mt-2 flex items-center gap-2 rounded-md bg-ink-800/60 px-2 py-1 text-[11px] font-semibold text-ink-200">
              <Paperclip className="h-3 w-3" /> {attach}
            </div>
          ) : null}
        </div>
        <div
          className={`tabular mt-1 text-[10px] ${me ? "text-ink-400" : "text-ink-400"}`}
        >
          {time}
          {receipts ? (
            <span className="ml-1 text-brand-600 font-semibold">{receipts}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OfflineVisual() {
  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 p-6 shadow-xl">
      <div className="flex items-center gap-2 rounded-md border border-[#f0b232]/30 bg-[#f0b232]/15 px-3 py-2 text-[12px] font-semibold text-[#9a6700] dark:text-[#fee75c]">
        <WifiOff className="h-4 w-4" /> Offline · 3 pending · Local DB
      </div>
      <div className="mt-5 space-y-3">
        {[
          { l: "Activity session #a4c9", s: "Queued", c: "amber" },
          { l: "Message to Ada Lovelace", s: "Queued", c: "amber" },
          { l: "Task FAL-214 comment", s: "Queued", c: "amber" },
        ].map((r) => (
          <div
            key={r.l}
            className="flex items-center justify-between rounded-lg border border-ink-600 bg-ink-800/40 px-3 py-2"
          >
            <span className="text-[12px] text-ink-200">{r.l}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0b232]/15 px-2 py-0.5 text-[10px] font-semibold text-[#9a6700] dark:text-[#fee75c]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f0b232]" />
              {r.s}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-[#00a8fc]/30 bg-[#00a8fc]/10 px-3 py-2 text-[12px] text-[#006fae] dark:text-[#00a8fc]">
        <div className="flex items-center gap-2 font-semibold">
          <span className="pulse-dot h-2 w-2 rounded-full bg-[#00a8fc]" />
          Syncing… reconnected 2s ago
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#00a8fc]/20">
          <div className="h-full w-2/3 rounded-full bg-[#00a8fc]" />
        </div>
      </div>
    </div>
  );
}

function LoginVisual() {
  return (
    <div className="atmosphere rounded-2xl p-6 shadow-xl ring-1 ring-ink-600">
      <div className="mx-auto max-w-sm rounded-2xl border border-ink-600 bg-ink-800 p-6 shadow-lg">
        <Wordmark />
        <h3 className="mt-6 font-display text-2xl font-semibold text-ink-50">
          Welcome back
        </h3>
        <p className="mt-1 text-sm text-ink-300">
          Sign in to your DockX workspace
        </p>
        <div className="mt-5 space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-ink-200">Email</label>
            <div className="mt-1 rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-[13px] text-ink-100">
              ada@lovelace.co
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-ink-200">Password</label>
            <div className="mt-1 rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-[13px] tracking-widest text-ink-300">
              ••••••••••
            </div>
          </div>
          <button className="mt-2 w-full rounded-md bg-brand-500/100 py-2 text-[13px] font-semibold text-white hover:bg-brand-600">
            Sign in
          </button>
          <div className="text-center text-[11px] text-ink-300">
            New? <span className="font-semibold text-brand-400">Create workspace</span> ·{" "}
            <span className="font-semibold text-brand-400">Use invite link</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ Architecture ============ */

function Architecture() {
  return (
    <section className="border-y border-ink-600 bg-ink-800">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="Architecture"
          title="Two clients. One source of truth."
          sub="Data is captured once at the desktop and consumed everywhere — no double-entry, no drift."
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
                  <span
                    key={c}
                    className="h-2 w-2 rounded-full"
                    style={{ background: c }}
                  />
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
      <div className="mt-4 font-display text-xl font-semibold text-ink-50">
        {title}
      </div>
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
      size: "10–500 devs",
      body: "Replace Jira + Slack + Hubstaff with one integrated surface engineers actually keep open.",
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
      body: "Immutable attendance and activity logs — audit trails you can hand to legal.",
    },
    {
      icon: Landmark,
      title: "Enterprises",
      size: "500+ seats",
      body: "Tool consolidation with role-based access, org bootstrap, and SSO-ready roadmap.",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionTitle
        eyebrow="Who it's for"
        title="Purpose-built for teams that ship."
        center
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ icon: Icon, title, size, body }) => (
          <div
            key={title}
            className="group rounded-2xl border border-ink-600 bg-ink-800 p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg"
          >
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/25">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-4 font-display text-lg font-semibold text-ink-50">
              {title}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
              {size}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-300">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============ Stats ============ */

function Stats() {
  const stats = [
    ["3+", "Tools replaced with 1"],
    ["<20s", "Check-in to activity sync"],
    ["100%", "Offline-first with local SQLite"],
    ["✓✓", "Realtime chat with read receipts"],
  ];
  return (
    <section className="bg-ink-900">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
        {stats.map(([n, l]) => (
          <div key={l} className="text-center">
            <div className="tabular font-display text-4xl font-semibold text-brand-300 sm:text-5xl">
              {n}
            </div>
            <div className="mt-2 text-[13px] font-medium text-ink-300">{l}</div>
          </div>
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
      a: "DockX Desktop runs on macOS and Windows via Tauri — a lightweight Rust runtime that keeps the app small, fast, and battery-friendly.",
    },
    {
      q: "Does it track me when I'm checked out?",
      a: "No. Activity monitoring only runs while you're checked in, and it pauses automatically when you go on break. DockX itself is always excluded from recorded time.",
    },
    {
      q: "Can I use it offline?",
      a: "Yes. Chat drafts, activity sessions, and task edits queue to a local SQLite outbox and sync automatically when you reconnect — usually within 8 seconds.",
    },
    {
      q: "What's the difference between the Desktop app and the Web portal?",
      a: "Desktop is the employee workspace — tasks, timers, chat, activity. Web is the manager console — org setup, reports, monitoring, and configuration. Same backend, different surface.",
    },
    {
      q: "Is there a free plan?",
      a: "Yes — start free and invite your team. Paid plans unlock advanced admin controls, longer activity history, and enterprise features like SSO.",
    },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionTitle eyebrow="FAQ" title="Answers, before you ask." center />
      <div className="mt-12 divide-y divide-ink-200 rounded-2xl border border-ink-600 bg-ink-800">
        {faqs.map((f, i) => (
          <div key={f.q}>
            <button
              onClick={() => setOpen(open === i ? -1 : i)}
              className="flex w-full items-center justify-between gap-6 px-5 py-4 text-left"
            >
              <span className="font-display text-base font-semibold text-ink-50">
                {f.q}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-ink-300 transition ${
                  open === i ? "rotate-180 text-brand-400" : ""
                }`}
              />
            </button>
            {open === i ? (
              <div className="px-5 pb-5 text-sm leading-relaxed text-ink-200">
                {f.a}
              </div>
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
          One backend of record for time, tasks, and teams — free to try, ready
          for your whole org.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <PrimaryButton icon={ArrowRight}>Start free</PrimaryButton>
          <SecondaryButton icon={Download}>Download desktop</SecondaryButton>
          <TertiaryLink icon={LogIn}>Log in to portal</TertiaryLink>
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
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-ink-600 pt-6 text-xs text-ink-300 sm:flex-row sm:items-center">
          <div>© {new Date().getFullYear()} DockX, Inc. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#23a559]" /> All
              systems operational
            </span>
            <span>v1.4.0</span>
          </div>
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

      <FeatureBlock
        eyebrow="Attendance & time"
        title="Check in once. Time tracks itself."
        body="A single tap sets your workday in motion. Live session timers surface everywhere you work — and never lose a minute across restarts."
        bullets={[
          "One-click Check In · Check Out · Break · End Break",
          "Live HH:MM:SS timer excludes break time automatically",
          "Status indicators: Out (grey) · In (green) · Break (amber)",
          "Session persists across app restarts — never lose your day",
          "Works from Dashboard, Board toolbar, and global header",
        ]}
        visual={<AttendanceVisual />}
      />

      <FeatureBlock
        eyebrow="Activity monitoring"
        title="Know where work actually happens."
        body="Native desktop capture (Tauri + Rust) polls the foreground app every 5 seconds while you're checked in — including browser URL detection and away-period intelligence."
        bullets={[
          "Captures app name, process, and window title every 5s",
          "Browser URL/host detection for Chrome, Safari, Firefox",
          "Detects screen lock, screensaver, and sleep as away time",
          "DockX excludes itself from recorded time",
          "Admin-only org-wide view with per-member drill-down",
        ]}
        visual={<ActivityVisual />}
        reverse
      />

      <div className="bg-ink-800">
        <FeatureBlock
          eyebrow="Dashboard"
          title="Your command center for the workday."
          body="Overview, Tasks, Users, Timeline, and Activity — a single hub for employees and admins with KPIs, filters, and drill-down that actually work."
          bullets={[
            "KPI strip: open tasks · done % · due soon · projects",
            "Donut, bar, and workload charts filterable by teammate",
            "Admin Users tab: add members, assign to projects, roles",
            "Timeline backlog with attachments and one-click assign",
            "Activity tab (admin) for org-wide monitoring",
          ]}
          visual={<DashboardVisual />}
        />
      </div>

      <FeatureBlock
        eyebrow="Kanban board"
        title="Jira-style boards. Zero context switching."
        body="Projects, columns, drag-and-drop, full task modals — everything you left Jira for, without leaving the app your team already lives in."
        bullets={[
          "Custom columns: add · rename · reorder · delete",
          "Drag-and-drop between statuses, multi-member combined boards",
          "Task types: Task · Bug · Story · Time — with estimates & hours logged",
          "Comments, attachments (2MB), labels, reporter metadata",
          "Invite by email or shareable invite link with project role",
        ]}
        visual={<BoardVisual />}
        reverse
      />

      <div className="bg-ink-800">
        <FeatureBlock
          eyebrow="Real-time chat"
          title="Slack-level chat. Built into your workday."
          body="DMs, group chats, presence, typing indicators, and read receipts — with optimistic UI that never leaves you wondering if a message got through."
          bullets={[
            "Direct messages and named group chats with avatars",
            "Presence with online + checked-in status dots",
            "Reply, edit, delete, forward — with confirmations",
            "Read receipts (✓ / ✓✓) and delivery states",
            "File attachments with optimistic sending states",
          ]}
          visual={<ChatVisual />}
        />
      </div>

      <FeatureBlock
        eyebrow="Offline-first"
        title="Works when Wi-Fi doesn't."
        body="A local SQLite cache means the app opens instantly, keeps chatting, and keeps tracking — then reconciles cleanly the moment you reconnect."
        bullets={[
          "Local SQLite cache for activity + chat (Tauri)",
          "Instant launch from local DB — no spinner",
          "Outbox queue for messages sent offline",
          "Auto-sync every ~8s on reconnect",
          "Header shows: Offline · Syncing… · N pending · Local DB",
        ]}
        visual={<OfflineVisual />}
        reverse
      />

      <div className="bg-ink-800">
        <FeatureBlock
          eyebrow="Profile & onboarding"
          title="Get started in minutes."
          body="Bootstrap your org, invite the team, and let them auto-restore sessions on every launch. Roles map cleanly from org to project."
          bullets={[
            "Email/password login with persistent session",
            "Org bootstrap: create workspace + Admin in one flow",
            "Invite-based registration via /register?invite=…",
            "Profile page with photo upload and read-only org role",
            "Roles: Admin, Manager, Member — plus project admin/member",
          ]}
          visual={<LoginVisual />}
        />
      </div>

      <Architecture />
      <Audiences />
      <Stats />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
