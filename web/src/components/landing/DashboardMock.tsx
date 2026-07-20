import { useEffect, useState } from "react";

const KPIS = [
  { label: "Checked in", value: "18", hint: "of 24", color: "bg-status-in" },
  { label: "On break", value: "3", hint: "now", color: "bg-status-break" },
  { label: "Tasks done", value: "42", hint: "today", color: "bg-brand-500" },
  { label: "Focus hrs", value: "126", hint: "team", color: "bg-status-sync" },
] as const;

const BARS = [
  { name: "Mon", h: 42 },
  { name: "Tue", h: 68 },
  { name: "Wed", h: 55 },
  { name: "Thu", h: 82 },
  { name: "Fri", h: 70 },
  { name: "Sat", h: 28 },
  { name: "Sun", h: 18 },
] as const;

const TASKS = [
  { title: "Realtime board sync", who: "Asha", status: "Doing", tone: "bg-brand-500" },
  { title: "Invite email polish", who: "Leo", status: "Review", tone: "bg-status-sync" },
  { title: "Attendance offline queue", who: "Mia", status: "Done", tone: "bg-status-in" },
  { title: "Dashboard KPI strip", who: "Jon", status: "Todo", tone: "bg-ink-400" },
] as const;

const TEAM = [
  { name: "Asha R.", status: "in", time: "05:12" },
  { name: "Leo K.", status: "in", time: "04:48" },
  { name: "Mia T.", status: "break", time: "00:22" },
  { name: "Jon P.", status: "in", time: "06:01" },
  { name: "Sam W.", status: "out", time: "—" },
] as const;

const statusDot: Record<string, string> = {
  in: "bg-status-in",
  break: "bg-status-break",
  out: "bg-status-out",
};

/** Interactive dashboard mock — hover bars, click tasks. */
export function DashboardMock() {
  const [activeBar, setActiveBar] = useState(3);
  const [selected, setSelected] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setPulse((p) => !p), 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 shadow-[0_24px_80px_-24px_var(--card-shadow)]">
      {/* Chrome */}
      <div className="flex items-center justify-between border-b border-ink-600 bg-ink-900/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ed4245]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-status-break/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-status-in/80" />
          <span className="ml-3 text-[12px] font-semibold text-ink-100">
            DockX · Overview
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full bg-status-sync ${pulse ? "opacity-100" : "opacity-40"}`}
          />
          <span className="text-[11px] font-medium tracking-wider text-ink-300 uppercase">
            Live
          </span>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_16rem]">
        {/* Main */}
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {KPIS.map((k) => (
              <button
                key={k.label}
                type="button"
                data-cursor="grow"
                className="rounded-xl border border-ink-600 bg-ink-900/40 p-3 text-left transition hover:border-brand-400/40 hover:bg-brand-500/5"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${k.color}`} />
                  <span className="text-[10px] font-semibold tracking-wider text-ink-300 uppercase">
                    {k.label}
                  </span>
                </div>
                <div className="tabular mt-1.5 font-landing text-2xl font-semibold text-ink-50">
                  {k.value}
                </div>
                <div className="text-[11px] text-ink-400">{k.hint}</div>
              </button>
            ))}
          </div>

          {/* Chart + tasks */}
          <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
            <div className="rounded-xl border border-ink-600 bg-ink-900/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-ink-100">
                  Focus this week
                </span>
                <span className="tabular text-[11px] text-ink-300">
                  {BARS[activeBar].name} · {BARS[activeBar].h}h
                </span>
              </div>
              <div className="mt-4 flex h-36 items-end gap-2">
                {BARS.map((b, i) => (
                  <button
                    key={b.name}
                    type="button"
                    data-cursor="grow"
                    onClick={() => setActiveBar(i)}
                    onMouseEnter={() => setActiveBar(i)}
                    className="group flex flex-1 flex-col items-center gap-2"
                  >
                    <div className="relative flex h-28 w-full items-end justify-center">
                      <div
                        className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${
                          activeBar === i
                            ? "bg-brand-500"
                            : "bg-brand-500/25 group-hover:bg-brand-500/50"
                        }`}
                        style={{ height: `${b.h}%` }}
                      />
                    </div>
                    <span
                      className={`text-[10px] font-medium ${
                        activeBar === i ? "text-brand-300" : "text-ink-400"
                      }`}
                    >
                      {b.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-ink-600 bg-ink-900/30 p-4">
              <div className="text-[12px] font-semibold text-ink-100">
                Recent tasks
              </div>
              <ul className="mt-3 space-y-1.5">
                {TASKS.map((t, i) => (
                  <li key={t.title}>
                    <button
                      type="button"
                      data-cursor="grow"
                      onClick={() => setSelected(i)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition ${
                        selected === i
                          ? "bg-brand-500/15 ring-1 ring-brand-500/40"
                          : "hover:bg-ink-700/60"
                      }`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${t.tone}`} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-medium text-ink-100">
                          {t.title}
                        </div>
                        <div className="text-[10px] text-ink-400">{t.who}</div>
                      </div>
                      <span className="rounded-md bg-ink-700 px-1.5 py-0.5 text-[10px] font-semibold text-ink-200">
                        {t.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Team rail */}
        <div className="rounded-xl border border-ink-600 bg-ink-900/30 p-4">
          <div className="text-[12px] font-semibold text-ink-100">Team</div>
          <ul className="mt-3 space-y-2">
            {TEAM.map((m) => (
              <li
                key={m.name}
                data-cursor="grow"
                className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition hover:bg-ink-700/50"
              >
                <div className="relative grid h-8 w-8 place-items-center rounded-full bg-brand-500/20 text-[11px] font-bold text-brand-300">
                  {m.name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")}
                  <span
                    className={`absolute right-0 bottom-0 h-2 w-2 rounded-full border-2 border-ink-800 ${statusDot[m.status]}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium text-ink-100">
                    {m.name}
                  </div>
                  <div className="text-[10px] capitalize text-ink-400">
                    {m.status === "in"
                      ? "Checked in"
                      : m.status === "break"
                        ? "On break"
                        : "Out"}
                  </div>
                </div>
                <span className="tabular text-[11px] font-semibold text-ink-300">
                  {m.time}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            data-cursor="grow"
            onClick={() => {
              window.location.href = "https://matrix-view.vercel.app/";
            }}
            className="mt-4 w-full rounded-lg bg-brand-500 py-2 text-[12px] font-semibold text-white transition hover:bg-brand-600"
          >
            Open full dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
