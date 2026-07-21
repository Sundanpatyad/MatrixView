"use client";
import { useEffect, useState } from "react";

type Card = { id: string; title: string; tag: string; col: "todo" | "doing" | "done" };

const INITIAL: Card[] = [
  { id: "1", title: "Ship attendance sync", tag: "P0", col: "doing" },
  { id: "2", title: "Board realtime QA", tag: "Eng", col: "todo" },
  { id: "3", title: "Manager dashboard polish", tag: "Design", col: "todo" },
  { id: "4", title: "Invite flow copy", tag: "Ops", col: "done" },
];

const COLS = [
  { key: "todo" as const, label: "To do", tint: "border-ink-600" },
  { key: "doing" as const, label: "In progress", tint: "border-brand-400/40" },
  { key: "done" as const, label: "Done", tint: "border-ink-600" },
];

/** Click a card to cycle columns — live board feel. */
export function LiveBoardPlayground() {
  const [cards, setCards] = useState(INITIAL);
  const [pulse, setPulse] = useState<string | null>(null);

  const cycle = (id: string) => {
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next =
          c.col === "todo" ? "doing" : c.col === "doing" ? "done" : "todo";
        return { ...c, col: next };
      }),
    );
    setPulse(id);
    window.setTimeout(() => setPulse(null), 450);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800">
      <div className="flex items-center justify-between border-b border-ink-600 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand-400" />
          <span className="text-[12px] font-medium text-ink-200">
            Live board · click a card to move it
          </span>
        </div>
        <span className="text-[11px] tracking-wider text-ink-400 uppercase">
          Interactive
        </span>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-3">
        {COLS.map((col) => (
          <div
            key={col.key}
            className={`min-h-[220px] rounded-xl border ${col.tint} bg-ink-900/40 p-3`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-ink-300 uppercase">
                {col.label}
              </span>
              <span className="tabular text-[11px] text-ink-400">
                {cards.filter((c) => c.col === col.key).length}
              </span>
            </div>
            <div className="space-y-2">
              {cards
                .filter((c) => c.col === col.key)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    data-cursor="grow"
                    onClick={() => cycle(c.id)}
                    className={`w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-left transition hover:border-brand-400/50 hover:bg-brand-500/5 ${
                      pulse === c.id ? "ring-1 ring-brand-400/60" : ""
                    }`}
                  >
                    <div className="text-[13px] font-medium text-ink-50">
                      {c.title}
                    </div>
                    <div className="mt-1.5 text-[10px] font-semibold tracking-wider text-brand-300 uppercase">
                      {c.tag}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUSES = [
  { key: "in", label: "Checked in", color: "#23a559", hint: "Focusing on desk work" },
  { key: "break", label: "On break", color: "#f0b232", hint: "Paused · timer still running" },
  { key: "out", label: "Checked out", color: "#80848e", hint: "Day complete" },
] as const;

/** Toggle desk status — attendance interaction. */
export function DeskStatusToggle() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]["key"]>("in");
  const [seconds, setSeconds] = useState(2 * 3600 + 14 * 60 + 33);
  const active = STATUSES.find((s) => s.key === status)!;

  useEffect(() => {
    if (status === "out") return;
    const id = window.setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const time = [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");

  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-400 uppercase">
            Desk status
          </p>
          <p className="mt-2 font-landing text-2xl font-semibold text-ink-50">
            {active.label}
          </p>
          <p className="mt-1 text-sm text-ink-300">{active.hint}</p>
        </div>
        <div
          className="tabular font-landing text-3xl font-semibold tracking-tight"
          style={{ color: active.color }}
        >
          {time}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            type="button"
            data-cursor="grow"
            onClick={() => setStatus(s.key)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${
              status === s.key
                ? "bg-brand-500 text-white"
                : "border border-ink-600 bg-ink-900/40 text-ink-200 hover:border-brand-400/40 hover:text-ink-50"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const MODULES = [
  {
    id: "attendance",
    title: "Attendance",
    body: "Check in, break, checkout — with offline capture that syncs when you're back.",
    points: ["One-tap desk status", "Break timers", "Manager presence view"],
  },
  {
    id: "boards",
    title: "Boards",
    body: "Kanban that updates for everyone instantly. Columns, assignees, and priorities stay shared.",
    points: ["Realtime moves", "Filters that stick", "Compact card density"],
  },
  {
    id: "chat",
    title: "Chat & calls",
    body: "Talk next to the work — DMs, project rooms, and quick calls without leaving the agent.",
    points: ["Project threads", "Presence-aware", "File drop-in"],
  },
  {
    id: "activity",
    title: "Activity",
    body: "Desk truth for leads: focus windows, status flips, and who is actually shipping.",
    points: ["Live feed", "Per-person focus", "Export-ready days"],
  },
] as const;

/** Tabbed module explorer. */
export function ModuleExplorer() {
  const [active, setActive] = useState<(typeof MODULES)[number]["id"]>("boards");
  const mod = MODULES.find((m) => m.id === active)!;

  return (
    <div className="grid gap-8 lg:grid-cols-[14rem_1fr]">
      <div className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {MODULES.map((m) => (
          <button
            key={m.id}
            type="button"
            data-cursor="grow"
            onClick={() => setActive(m.id)}
            className={`shrink-0 rounded-xl px-4 py-3 text-left text-sm font-semibold transition lg:w-full ${
              active === m.id
                ? "bg-brand-500 text-white"
                : "border border-ink-600 bg-ink-800 text-ink-200 hover:border-brand-400/40 hover:text-ink-50"
            }`}
          >
            {m.title}
          </button>
        ))}
      </div>
      <div
        key={mod.id}
        className="rounded-2xl border border-ink-600 bg-gradient-to-br from-brand-500/10 to-transparent p-8 sm:p-10"
      >
        <h3 className="font-landing text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
          {mod.title}
        </h3>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-300">
          {mod.body}
        </p>
        <ul className="mt-8 space-y-3">
          {mod.points.map((p) => (
            <li key={p} className="flex items-center gap-3 text-sm text-ink-200">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const FAQS = [
  {
    q: "Is DockX a desktop app?",
    a: "Yes — the agent lives on the desk for check-in and focus. Boards, chat, and dashboards stay in sync with the team.",
  },
  {
    q: "Does the board update live?",
    a: "Moves, assignees, and column changes broadcast to everyone in the project — no refresh required.",
  },
  {
    q: "What if I go offline?",
    a: "Attendance and local work capture queue offline, then sync when the connection returns.",
  },
  {
    q: "Who is it for?",
    a: "Teams that want one place for time, tasks, and talk — ICs at the desk, managers on the dashboard.",
  },
] as const;

export function FaqAccordion() {
  const [open, setOpen] = useState(0);

  return (
    <div className="divide-y divide-ink-600 border-y border-ink-600">
      {FAQS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              type="button"
              data-cursor="grow"
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="flex w-full items-center justify-between gap-6 py-6 text-left"
            >
              <span className="font-landing text-lg font-semibold text-ink-50 sm:text-xl">
                {item.q}
              </span>
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink-600 text-lg text-ink-300 transition ${
                  isOpen
                    ? "rotate-45 border-brand-500 bg-brand-500 text-white"
                    : ""
                }`}
              >
                +
              </span>
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                isOpen ? "grid-rows-[1fr] pb-6" : "grid-rows-[0fr]"
              }`}
            >
              <p className="overflow-hidden text-sm leading-relaxed text-ink-300 sm:text-base">
                {item.a}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Horizontal audience switcher. */
export function AudienceSwitcher() {
  const audiences = [
    {
      id: "ic",
      label: "ICs",
      title: "Stay in flow at the desk",
      body: "Check in once. Move tasks without leaving the agent. Chat when you need context — not a dozen tabs.",
    },
    {
      id: "lead",
      label: "Leads",
      title: "See the board breathe",
      body: "Realtime columns, assignee clarity, and presence that matches what's actually happening.",
    },
    {
      id: "ops",
      label: "Ops",
      title: "Desk truth, not guesswork",
      body: "Attendance, activity, and day summaries for the people who keep capacity honest.",
    },
  ] as const;
  const [active, setActive] = useState<(typeof audiences)[number]["id"]>("ic");
  const a = audiences.find((x) => x.id === active)!;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {audiences.map((x) => (
          <button
            key={x.id}
            type="button"
            data-cursor="grow"
            onClick={() => setActive(x.id)}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              active === x.id
                ? "bg-brand-500 text-white"
                : "border border-ink-600 text-ink-200 hover:border-brand-400/40 hover:text-ink-50"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div key={a.id} className="mt-10 max-w-2xl">
        <h3 className="font-landing text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
          {a.title}
        </h3>
        <p className="mt-4 text-base leading-relaxed text-ink-300 sm:text-lg">
          {a.body}
        </p>
      </div>
    </div>
  );
}
