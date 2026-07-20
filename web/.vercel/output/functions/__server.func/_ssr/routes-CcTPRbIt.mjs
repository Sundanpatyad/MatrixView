import { r as __toESM } from "../_runtime.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { C as Activity, S as ArrowRight, _ as Download, a as Send, b as Check, c as Play, d as MessageSquare, f as LogIn, g as Kanban, h as Landmark, i as ShieldCheck, l as Pause, m as Layers, n as WifiOff, o as Search, p as LayoutDashboard, r as Users, s as Plus, t as Zap, u as Paperclip, v as CodeXml, x as Briefcase, y as ChevronDown } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CcTPRbIt.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ThemeToggle({ className = "" }) {
	function toggleTheme() {
		const root = document.documentElement;
		const nextIsDark = !root.classList.contains("dark");
		root.classList.toggle("dark", nextIsDark);
		root.style.colorScheme = nextIsDark ? "dark" : "light";
		window.localStorage.setItem("dockx.theme", nextIsDark ? "dark" : "light");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: toggleTheme,
		className: `inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-600 bg-ink-800 text-ink-200 transition-colors hover:bg-ink-700 hover:text-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${className}`,
		title: "Toggle light and dark mode",
		"aria-label": "Toggle light and dark mode",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
			viewBox: "0 0 24 24",
			className: "h-4 w-4 dark:hidden",
			fill: "none",
			"aria-hidden": true,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M20 15.2A8 8 0 0 1 8.8 4a8 8 0 1 0 11.2 11.2Z",
				stroke: "currentColor",
				strokeWidth: "1.8",
				strokeLinejoin: "round"
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
			viewBox: "0 0 24 24",
			className: "hidden h-4 w-4 dark:block",
			fill: "none",
			"aria-hidden": true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "3.5",
				stroke: "currentColor",
				strokeWidth: "1.8"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4",
				stroke: "currentColor",
				strokeWidth: "1.8",
				strokeLinecap: "round"
			})]
		})]
	});
}
function Wordmark({ className = "" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `flex items-center gap-2.5 ${className}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src: "/logo.png",
			alt: "DockX",
			width: 36,
			height: 36,
			className: "h-9 w-9 rounded-[10px] object-cover shadow-sm shadow-brand-500/20"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col leading-none",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-display text-[20px] font-semibold tracking-tight text-ink-50",
				children: "DockX"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-brand-400/80",
				children: "Work OS"
			})]
		})]
	});
}
function PrimaryButton({ children, icon: Icon, className = "" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		className: `btn-primary group ${className}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "relative z-10",
			children
		}), Icon ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" }) : null]
	});
}
function SecondaryButton({ children, icon: Icon, className = "" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		className: `btn-secondary group ${className}`,
		children: [Icon ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-4 w-4 text-ink-300 transition-colors group-hover:text-brand-400" }) : null, children]
	});
}
function TertiaryLink({ children, icon: Icon }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		className: "group inline-flex items-center gap-1.5 px-3 py-3 text-sm font-semibold text-ink-200 transition hover:text-brand-400",
		children: [Icon ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-4 w-4" }) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "relative",
			children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute -bottom-0.5 left-0 h-px w-0 bg-brand-500/100 transition-all duration-300 group-hover:w-full" })]
		})]
	});
}
function EyebrowChip({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-ink-800/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300 shadow-sm backdrop-blur",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "relative flex h-1.5 w-1.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500/100" })]
		}), children]
	});
}
function SectionTitle({ eyebrow, title, sub, center = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `max-w-2xl ${center ? "mx-auto text-center" : ""}`,
		children: [
			eyebrow ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: center ? "flex justify-center" : "",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyebrowChip, { children: eyebrow })
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mt-5 font-display text-3xl font-semibold tracking-tight text-ink-50 sm:text-[40px] sm:leading-[1.1]",
				children: title
			}),
			sub ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-lg leading-relaxed text-ink-300",
				children: sub
			}) : null
		]
	});
}
function Nav() {
	const [scrolled, setScrolled] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const onScroll = () => setScrolled(window.scrollY > 12);
		window.addEventListener("scroll", onScroll, { passive: true });
		onScroll();
		return () => window.removeEventListener("scroll", onScroll);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "sticky top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: `mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl border pl-3 pr-2 transition-all duration-300 sm:h-16 sm:pl-5 sm:pr-3 ${scrolled ? "border-ink-600/80 bg-ink-800/85 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.15)] backdrop-blur-xl" : "border-ink-600/60 bg-ink-800/60 shadow-[0_6px_24px_-12px_rgba(0,0,0,0.35)] backdrop-blur-lg"}`,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "hidden items-center gap-1 rounded-full border border-ink-600/60 bg-ink-800/70 p-1 md:flex",
					children: [
						"Features",
						"Pricing",
						"Download",
						"Docs"
					].map((l, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: `#${l.toLowerCase()}`,
						className: `rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${i === 0 ? "bg-brand-500/100 text-white shadow-sm" : "text-ink-200 hover:bg-ink-600 hover:text-ink-50"}`,
						children: l
					}, l))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeToggle, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "hidden text-[13px] font-semibold text-ink-200 hover:text-brand-400 sm:inline-flex",
							children: "Log in"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrimaryButton, {
							icon: ArrowRight,
							className: "!py-2 !px-4 !text-[13px]",
							children: "Start free"
						})
					]
				})
			]
		})
	});
}
function DesktopMockup() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.25)] ring-1 ring-black/[0.03]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3 border-b border-ink-600 bg-ink-900/80 px-4 py-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex gap-1.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-3 w-3 rounded-full bg-red-400/80" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-3 w-3 rounded-full bg-[#f0b232]/80" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-3 w-3 rounded-full bg-[#23a559]/80" })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-1 items-center justify-center gap-2 text-[11px] font-medium text-ink-300",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, { className: "scale-75" }), " · Dashboard"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "hidden items-center gap-2 sm:flex",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { state: "in" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "tabular rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-[13px] font-semibold text-ink-100",
									children: "06:42:18"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: "rounded-md border border-[#f0b232]/30 bg-[#f0b232]/15 px-2.5 py-1 text-[12px] font-semibold text-[#9a6700] dark:text-[#fee75c]",
									children: "Break"
								})
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-12 gap-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
						className: "col-span-3 hidden border-r border-ink-600 bg-ink-800/60 p-3 lg:block",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[11px] font-semibold uppercase tracking-wider text-ink-300",
								children: "Workspace"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "mt-2 space-y-0.5 text-[13px] font-medium text-ink-200",
								children: [
									[
										"Overview",
										LayoutDashboard,
										true
									],
									[
										"Tasks",
										Kanban,
										false
									],
									[
										"Users",
										Users,
										false
									],
									[
										"Timeline",
										Layers,
										false
									],
									[
										"Activity",
										Activity,
										false
									],
									[
										"Chat",
										MessageSquare,
										false
									]
								].map(([label, Icon, active]) => {
									return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `flex items-center gap-2 rounded-md px-2.5 py-1.5 ${active ? "bg-brand-500/10 text-brand-300 ring-1 ring-brand-500/25" : "hover:bg-ink-800"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-4 w-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label })]
									}) }, label);
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-6 rounded-lg border border-ink-600 bg-ink-800 p-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[11px] font-semibold uppercase tracking-wider text-ink-300",
										children: "Session"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "tabular mt-1 text-[18px] font-bold text-ink-50",
										children: "06:42:18"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-2 flex items-center gap-1.5 text-[11px] text-ink-300",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pulse-dot h-1.5 w-1.5 rounded-full bg-[#23a559]" }), "In since 09:04 · Break 00:22"]
									})
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
						className: "col-span-12 p-4 lg:col-span-9",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-2 gap-3 sm:grid-cols-4",
								children: [
									["Open tasks", "42"],
									["Done %", "78%"],
									["Due soon", "6"],
									["Projects", "9"]
								].map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-lg border border-ink-600 bg-ink-800 p-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[11px] font-semibold uppercase tracking-wider text-ink-300",
										children: k
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "tabular mt-1 font-display text-2xl font-semibold text-ink-50",
										children: v
									})]
								}, k))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 grid grid-cols-1 gap-3 md:grid-cols-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-lg border border-ink-600 bg-ink-800 p-4 md:col-span-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs font-semibold text-ink-200",
											children: "Status mix"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "mt-3 flex items-center justify-center",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Donut, {})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
											className: "mt-3 space-y-1 text-[11px] text-ink-200",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegendDot, {
													color: "#23A559",
													label: "Done · 34"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegendDot, {
													color: "#F0B232",
													label: "In Progress · 12"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegendDot, {
													color: "#00A8FC",
													label: "In Review · 5"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegendDot, {
													color: "#80848E",
													label: "To Do · 8"
												})
											]
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-lg border border-ink-600 bg-ink-800 p-4 md:col-span-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs font-semibold text-ink-200",
											children: "Workload by project"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[11px] text-ink-400",
											children: "This week"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-4 space-y-2.5",
										children: [
											[
												"Falcon web app",
												82,
												"#5865F2"
											],
											[
												"Atlas API",
												64,
												"#4752C4"
											],
											[
												"Design system",
												41,
												"#8891F2"
											],
											[
												"Ops portal",
												28,
												"#A5ADF8"
											]
										].map(([n, w, c]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between text-[11px] text-ink-200",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-medium",
												children: n
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "tabular text-ink-300",
												children: [w, "h"]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "mt-1 h-2 overflow-hidden rounded-full bg-ink-600",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "h-full rounded-full",
												style: {
													width: `${w}%`,
													background: c
												}
											})
										})] }, n))
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 overflow-hidden rounded-lg border border-ink-600 bg-ink-800",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between border-b border-ink-600 px-3 py-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xs font-semibold text-ink-200",
										children: "Recent tasks"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1 text-[11px] text-ink-300",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "rounded-md bg-brand-500/10 px-1.5 py-0.5 font-semibold text-brand-300",
												children: "All"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Open" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Done" })
										]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "divide-y divide-ink-600 text-[12px]",
									children: [
										[
											"FAL-214",
											"Onboarding empty state",
											"In Progress",
											"#F0B232",
											"High"
										],
										[
											"ATL-98",
											"Rate limit token refresh",
											"In Review",
											"#00A8FC",
											"Highest"
										],
										[
											"DS-31",
											"Radius tokens audit",
											"To Do",
											"#80848E",
											"Medium"
										]
									].map(([k, t, s, c, p]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "flex items-center gap-3 px-3 py-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "tabular w-14 text-[11px] font-semibold text-ink-300",
												children: k
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "flex-1 text-ink-100",
												children: t
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "rounded-full px-2 py-0.5 text-[10px] font-semibold text-white",
												style: { background: c },
												children: s
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "hidden text-[11px] font-medium text-ink-300 sm:inline",
												children: p
											})
										]
									}, k))
								})]
							})
						]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute -left-4 top-24 hidden rotate-[-4deg] rounded-xl border border-ink-600 bg-ink-800 p-3 shadow-xl md:block",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 text-[11px] font-semibold text-ink-200",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pulse-dot h-2 w-2 rounded-full bg-[#23a559]" }), "Checked in · Focus mode"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "tabular mt-1 font-display text-lg font-bold text-ink-50",
					children: "06:42:18"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute -right-3 bottom-8 hidden rotate-[3deg] rounded-xl border border-ink-600 bg-ink-800 p-3 shadow-xl md:block",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 text-[11px] font-semibold text-ink-200",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2 w-2 rounded-full bg-[#00a8fc]" }), "Syncing… 3 pending"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 text-[11px] text-ink-300",
					children: "Local DB · Offline-first"
				})]
			})
		]
	});
}
function StatusPill({ state }) {
	const map = {
		in: {
			label: "In",
			color: "bg-[#23a559]",
			text: "text-[#18783f] dark:text-[#57f287]",
			bg: "bg-[#23a559]/15 border-[#23a559]/30"
		},
		out: {
			label: "Out",
			color: "bg-ink-300",
			text: "text-ink-200",
			bg: "bg-ink-900 border-ink-600"
		},
		break: {
			label: "Break",
			color: "bg-[#f0b232]",
			text: "text-[#9a6700] dark:text-[#fee75c]",
			bg: "bg-[#f0b232]/15 border-[#f0b232]/30"
		}
	}[state];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: `inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${map.bg} ${map.text}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `pulse-dot h-1.5 w-1.5 rounded-full ${map.color}` }), map.label]
	});
}
function LegendDot({ color, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "flex items-center gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "h-2 w-2 rounded-full",
			style: { background: color }
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label })]
	});
}
function Donut() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "relative h-28 w-28 rounded-full",
		style: { background: "conic-gradient(#23A559 0 57%, #F0B232 57% 78%, #00A8FC 78% 86%, #80848E 86% 100%)" },
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "absolute inset-3 grid place-items-center rounded-full bg-ink-800",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "text-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "tabular font-display text-xl font-semibold text-ink-50",
					children: "78%"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[10px] font-medium text-ink-300",
					children: "Done"
				})]
			})
		})
	});
}
function Hero() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "relative overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "atmosphere absolute inset-0 -z-10" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "grid-overlay absolute inset-0 -z-10 opacity-60" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pt-24",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-14 lg:grid-cols-12 lg:gap-10",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "lg:col-span-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyebrowChip, { children: "Desktop Agent · Enterprise Work OS" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
								className: "mt-5 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink-50 sm:text-6xl lg:text-[64px]",
								children: [
									"Capture work at the desk.",
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-brand-400",
										children: "Decide from the dashboard."
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-6 max-w-xl text-lg leading-relaxed text-ink-200",
								children: "One backend of record for time, tasks, and teams. Replace Jira, Slack, and Hubstaff with one lightweight desktop workspace — Desktop for employees, Web for managers."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-8 flex flex-wrap items-center gap-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrimaryButton, {
										icon: ArrowRight,
										children: "Start free"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SecondaryButton, {
										icon: Download,
										children: "Download for Mac / Windows"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TertiaryLink, {
										icon: LogIn,
										children: "Log in to portal"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-8 flex items-center gap-3 text-sm text-ink-300",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex -space-x-2",
									children: [
										"#5865F2",
										"#0369A1",
										"#B45309",
										"#BE123C"
									].map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "h-7 w-7 rounded-full border-2 border-ink-700",
										style: { background: c }
									}, c))
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Built for software teams, agencies, and distributed orgs (10–500+ people)" })]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "lg:col-span-7",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DesktopMockup, {})
					})]
				})
			})
		]
	});
}
function ProblemSolution() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "border-y border-ink-600 bg-ink-800",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
				eyebrow: "The tool sprawl problem",
				title: "Three tools pretending to be a workspace.",
				sub: "DockX Desktop is the always-on employee workspace — check in once, track time automatically, manage tasks, and chat without switching apps."
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-12 grid gap-6 md:grid-cols-3",
				children: [
					{
						icon: Layers,
						title: "Work scattered across Jira, Slack & time trackers",
						body: "Five tabs to log an hour. Context lives everywhere except where the work happens."
					},
					{
						icon: Activity,
						title: "Managers can't see what actually happened at the desk",
						body: "Timesheets are best-effort fiction. Real activity data lives in siloed dashboards."
					},
					{
						icon: Zap,
						title: "Employees juggle too many tools just to do their job",
						body: "Every app switch is a tax on focus — and a hole in your compliance record."
					}
				].map(({ icon: Icon, title, body }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl border border-ink-600 bg-ink-800/50 p-6 transition hover:border-brand-500/40 hover:bg-brand-500/10",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid h-10 w-10 place-items-center rounded-lg bg-ink-800 text-brand-400 ring-1 ring-ink-600",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-5 w-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "mt-4 font-display text-lg font-semibold text-ink-50",
							children: title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm leading-relaxed text-ink-300",
							children: body
						})
					]
				}, title))
			})]
		})
	});
}
function FeatureBlock({ eyebrow, title, body, bullets, visual, reverse = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${reverse ? "lg:[&>div:first-child]:order-2" : ""}`,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyebrowChip, { children: eyebrow }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-4 font-display text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl",
					children: title
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-lg leading-relaxed text-ink-300",
					children: body
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-6 space-y-3",
					children: bullets.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-start gap-3 text-[15px] text-ink-200",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/10 text-brand-400 ring-1 ring-brand-200",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
								className: "h-3 w-3",
								strokeWidth: 3
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: b })]
					}, b))
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: visual })]
		})
	});
}
function AttendanceVisual() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl border border-ink-600 bg-ink-800 p-1 shadow-xl ring-1 ring-black/[0.03]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "rounded-t-xl border-b border-ink-600 bg-ink-800/70 px-4 py-3",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, { className: "scale-90" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ml-auto flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { state: "in" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "tabular rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-[13px] font-semibold text-ink-100",
							children: "06:42:18"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: "inline-flex items-center gap-1 rounded-md border border-[#f0b232]/30 bg-[#f0b232]/15 px-2.5 py-1 text-[12px] font-semibold text-[#9a6700] dark:text-[#fee75c]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "h-3 w-3" }), " Break"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "inline-flex items-center gap-1 rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-[12px] font-semibold text-ink-200",
							children: "Check Out"
						})
					]
				})]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "p-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-3 gap-3",
				children: [
					[
						"Check In",
						"09:04",
						"In",
						"emerald"
					],
					[
						"Break",
						"12:20",
						"Break",
						"amber"
					],
					[
						"Resumed",
						"12:42",
						"In",
						"emerald"
					]
				].map(([l, t, s, c]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-ink-600 bg-ink-800/50 p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[11px] font-semibold uppercase tracking-wider text-ink-300",
							children: l
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "tabular mt-1 font-display text-xl font-semibold text-ink-50",
							children: t
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c === "emerald" ? "bg-[#23a559]/15 text-[#18783f] dark:text-[#57f287]" : "bg-[#f0b232]/15 text-[#9a6700] dark:text-[#fee75c]"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `h-1.5 w-1.5 rounded-full ${c === "emerald" ? "bg-[#23a559]" : "bg-[#f0b232]"}` }), s]
						})
					]
				}, l))
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-5 rounded-xl border border-ink-600 bg-gradient-to-br from-brand-500/10 to-ink-800 p-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs font-semibold uppercase tracking-wider text-ink-300",
							children: "Live session"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "tabular mt-1 font-display text-4xl font-bold text-ink-50",
							children: "06:42:18"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 text-xs text-ink-300",
							children: "Excludes 00:22 break · Persists across restarts"
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "grid h-14 w-14 place-items-center rounded-full bg-brand-500/100 text-white shadow-lg ring-4 ring-brand-500/25 transition hover:bg-brand-600",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "h-6 w-6" })
					})]
				})
			})]
		})]
	});
}
function ActivityVisual() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4 lg:grid-cols-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "lg:col-span-2",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-ink-600 bg-ink-800 p-5 shadow-lg",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[11px] font-semibold uppercase tracking-wider text-ink-300",
						children: "Employee view"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "tabular mt-3 font-display text-3xl font-bold text-ink-50",
						children: "06:42:18"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-1 flex items-center gap-2 text-xs text-ink-300",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pulse-dot h-2 w-2 rounded-full bg-[#23a559]" }), "Tracking in background"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-5 space-y-2 text-[12px]",
						children: [
							["VS Code", "2h 14m"],
							["Chrome · github.com", "1h 02m"],
							["Figma", "38m"],
							["Slack", "22m"]
						].map(([a, t]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-ink-200",
								children: a
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tabular text-ink-300",
								children: t
							})]
						}, a))
					})
				]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "lg:col-span-3",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-ink-600 bg-ink-800 p-5 shadow-lg",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[11px] font-semibold uppercase tracking-wider text-ink-300",
							children: "Admin activity · Mon, Mar 4"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 font-display text-lg font-semibold text-ink-50",
							children: "Org-wide breakdown"
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[11px] font-semibold text-ink-200",
							children: "12 members"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-5 space-y-3",
						children: [
							[
								"Ada L.",
								92,
								"#5865F2"
							],
							[
								"Marcus T.",
								78,
								"#4752C4"
							],
							[
								"Sana K.",
								66,
								"#8891F2"
							],
							[
								"Ivan P.",
								54,
								"#5EEAD4"
							],
							[
								"Priya D.",
								38,
								"#A5ADF8"
							]
						].map(([n, w, c]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between text-[12px]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium text-ink-200",
								children: n
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "tabular text-ink-300",
								children: [Math.round(w / 100 * 8 * 60) / 60, "h active"]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-1 flex h-2 overflow-hidden rounded-full bg-ink-600",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
									width: `${w * .7}%`,
									background: c
								} }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
									width: `${w * .2}%`,
									background: "#F0B232"
								} }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
									width: `${w * .1}%`,
									background: "#80848E"
								} })
							]
						})] }, n))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex gap-4 text-[11px] text-ink-300",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2 w-2 rounded-full bg-brand-600" }), " Focus apps"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2 w-2 rounded-full bg-[#f0b232]" }), " Comms"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2 w-2 rounded-full bg-ink-300" }), " Away"]
							})
						]
					})
				]
			})
		})]
	});
}
function DashboardVisual() {
	const [tab, setTab] = (0, import_react.useState)("Overview");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl border border-ink-600 bg-ink-800 p-1 shadow-xl",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "rounded-t-xl border-b border-ink-600 bg-ink-800/70 px-4 py-2",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex items-center gap-1 overflow-x-auto",
				children: [
					"Overview",
					"Tasks",
					"Users",
					"Timeline",
					"Activity"
				].map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => setTab(t),
					className: `whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${tab === t ? "bg-ink-800 text-ink-50 shadow-sm ring-1 ring-ink-600" : "text-ink-300 hover:text-ink-100"}`,
					children: [t, t === "Timeline" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-1.5 rounded-full bg-brand-500/100 px-1.5 py-0.5 text-[9px] font-bold text-white",
						children: "4"
					}) : null]
				}, t))
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-4 gap-3",
				children: [
					["Open", "42"],
					["Done", "78%"],
					["Due soon", "6"],
					["Overdue", "2"]
				].map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-lg border border-ink-600 bg-ink-800/40 p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[10px] font-semibold uppercase tracking-wider text-ink-300",
						children: k
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "tabular mt-1 font-display text-xl font-semibold text-ink-50",
						children: v
					})]
				}, k))
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 grid grid-cols-5 gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "col-span-2 rounded-lg border border-ink-600 bg-ink-800 p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[11px] font-semibold text-ink-200",
						children: "Status"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 flex justify-center",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Donut, {})
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "col-span-3 rounded-lg border border-ink-600 bg-ink-800 p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[11px] font-semibold text-ink-200",
							children: "Priority distribution"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-5 flex h-32 items-end gap-2",
							children: [
								[70, "#DC2626"],
								[45, "#EA580C"],
								[88, "#D97706"],
								[56, "#059669"],
								[22, "#94A3B8"]
							].map(([h, c], i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-1 flex-col items-center gap-1",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-full rounded-t",
									style: {
										height: `${h}%`,
										background: c
									}
								})
							}, i))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex justify-between text-[10px] font-medium text-ink-300",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Highest" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "High" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Med" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Low" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Lowest" })
							]
						})
					]
				})]
			})]
		})]
	});
}
function BoardVisual() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl border border-ink-600 bg-ink-800 p-1 shadow-xl",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-3 border-b border-ink-600 bg-ink-800/70 px-4 py-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1 rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[12px] font-semibold text-ink-100",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kanban, { className: "h-3.5 w-3.5 text-brand-400" }),
						"Falcon web app",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "h-3 w-3 text-ink-400" })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "hidden items-center gap-2 md:flex",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1 rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[11px] text-ink-300",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "h-3 w-3" }), " Search FAL…"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[11px] font-medium text-ink-200",
							children: "Type: All"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[11px] font-medium text-ink-200",
							children: "Priority: All"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ml-auto flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex -space-x-1.5",
						children: [
							"#5865F2",
							"#0369A1",
							"#B45309"
						].map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "h-6 w-6 rounded-full border-2 border-ink-700",
							style: { background: c }
						}, c))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						className: "inline-flex items-center gap-1 rounded-md bg-brand-500/100 px-2.5 py-1 text-[11px] font-semibold text-white",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-3 w-3" }), " Task"]
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-2 gap-3 p-3 md:grid-cols-4",
			children: [
				{
					name: "To Do",
					color: "#80848E",
					cards: [{
						k: "FAL-221",
						t: "Empty state illustrations",
						p: "Medium",
						pc: "#D97706"
					}, {
						k: "ATL-104",
						t: "Add pagination to /users",
						p: "Low",
						pc: "#059669"
					}]
				},
				{
					name: "In Progress",
					color: "#F0B232",
					cards: [{
						k: "FAL-214",
						t: "Onboarding empty state",
						p: "High",
						pc: "#EA580C",
						drag: true
					}, {
						k: "DS-31",
						t: "Radius tokens audit",
						p: "Medium",
						pc: "#D97706"
					}]
				},
				{
					name: "In Review",
					color: "#00A8FC",
					cards: [{
						k: "ATL-98",
						t: "Rate limit token refresh",
						p: "Highest",
						pc: "#DC2626"
					}]
				},
				{
					name: "Done",
					color: "#23A559",
					cards: [{
						k: "FAL-201",
						t: "Dark logo variant",
						p: "Low",
						pc: "#059669"
					}, {
						k: "OPS-12",
						t: "SSO SAML metadata",
						p: "High",
						pc: "#EA580C"
					}]
				}
			].map((col) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-lg border border-ink-600 bg-ink-800/40 p-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between px-1 py-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1.5 text-[11px] font-semibold text-ink-200",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "h-2 w-2 rounded-full",
							style: { background: col.color }
						}), col.name]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular text-[10px] font-medium text-ink-300",
						children: col.cards.length
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 space-y-2",
					children: col.cards.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `rounded-md border bg-ink-800 p-2.5 shadow-sm ${c.drag ? "border-brand-300 ring-2 ring-brand-500/25 rotate-[-1.5deg]" : "border-ink-600"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "tabular text-[10px] font-semibold text-ink-300",
								children: c.k
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-0.5 text-[12px] font-medium leading-snug text-ink-100",
								children: c.t
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "rounded px-1.5 py-0.5 text-[9px] font-semibold text-white",
									style: { background: c.pc },
									children: c.p
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "h-4 w-4 rounded-full ring-2 ring-ink-800",
									style: { background: "#5865F2" }
								})]
							})
						]
					}, c.k))
				})]
			}, col.name))
		})]
	});
}
function ChatVisual() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-3 sm:grid-cols-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "hidden rounded-2xl border border-ink-600 bg-ink-800 p-3 shadow-lg sm:col-span-2 sm:block",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 rounded-md border border-ink-600 bg-ink-800/60 px-2 py-1.5 text-[11px] text-ink-300",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "h-3 w-3" }), " Search conversations"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 space-y-1 text-[12px]",
				children: [
					{
						n: "Design guild",
						p: "Sana: ship it 🎯",
						a: true,
						u: 2
					},
					{
						n: "Ada Lovelace",
						p: "Pushed the fix — CI green",
						a: false,
						u: 0
					},
					{
						n: "#atlas-api",
						p: "Marcus: rate limits patched",
						a: false,
						u: 0
					},
					{
						n: "Ivan P.",
						p: "typing…",
						a: false,
						u: 0,
						typing: true
					}
				].map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: `flex items-center gap-2 rounded-md p-2 ${c.a ? "bg-brand-500/10 ring-1 ring-brand-500/25" : "hover:bg-ink-900"}`,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "relative",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "grid h-8 w-8 place-items-center rounded-full bg-brand-500/100 text-[11px] font-bold text-white",
								children: c.n[0]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#23a559] ring-2 ring-ink-800" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate font-semibold text-ink-100",
								children: c.n
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate text-[11px] text-ink-300",
								children: c.typing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-brand-400",
									children: "typing…"
								}) : c.p
							})]
						}),
						c.u ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded-full bg-brand-500/100 px-1.5 py-0.5 text-[9px] font-bold text-white",
							children: c.u
						}) : null
					]
				}, c.n))
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-2xl border border-ink-600 bg-ink-800 shadow-lg sm:col-span-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 border-b border-ink-600 px-4 py-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "grid h-8 w-8 place-items-center rounded-full bg-brand-500/100 text-[11px] font-bold text-white",
							children: "D"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[13px] font-semibold text-ink-50",
							children: "Design guild"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[11px] text-ink-300",
							children: "4 members · 3 online"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "ml-auto flex items-center gap-1 text-[10px] font-semibold text-[#18783f] dark:text-[#57f287]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pulse-dot h-1.5 w-1.5 rounded-full bg-[#23a559]" }), "Live"]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3 p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatBubble, {
							from: "Sana",
							color: "#B45309",
							body: "Pushed the new radius tokens — review when you can.",
							time: "10:41"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatBubble, {
							me: true,
							body: "Loving the sharper corners on cards. Merging.",
							time: "10:42",
							receipts: "✓✓"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatBubble, {
							from: "Marcus",
							color: "#0369A1",
							body: "Attaching the audit sheet 📎",
							time: "10:43",
							attach: "tokens-audit.pdf"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 text-[11px] text-ink-300",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "grid h-6 w-6 place-items-center rounded-full bg-ink-700 text-[10px] font-bold text-ink-200",
								children: "I"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "rounded-full bg-ink-600 px-2 py-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "tabular",
									children: "typing"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "ml-1 inline-flex gap-0.5",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-1 w-1 rounded-full bg-ink-400 pulse-dot" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-1 w-1 rounded-full bg-ink-400 pulse-dot" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-1 w-1 rounded-full bg-ink-400 pulse-dot" })
									]
								})]
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 border-t border-ink-600 p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "grid h-8 w-8 place-items-center rounded-md text-ink-300 hover:bg-ink-600",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Paperclip, { className: "h-4 w-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex-1 rounded-md border border-ink-600 bg-ink-800/50 px-3 py-2 text-[12px] text-ink-300",
							children: "Message #design-guild"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "grid h-8 w-8 place-items-center rounded-md bg-brand-500/100 text-white",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "h-4 w-4" })
						})
					]
				})
			]
		})]
	});
}
function ChatBubble({ from, color, body, time, me, receipts, attach }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `flex gap-2 ${me ? "flex-row-reverse" : ""}`,
		children: [!me ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white",
			style: { background: color },
			children: from?.[0]
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `max-w-[75%] ${me ? "items-end" : "items-start"} flex flex-col`,
			children: [
				!me ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[10px] font-semibold text-ink-200",
					children: from
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `mt-0.5 rounded-2xl px-3 py-2 text-[12px] leading-relaxed ${me ? "rounded-tr-sm bg-brand-500/100 text-white" : "rounded-tl-sm bg-ink-600 text-ink-100"}`,
					children: [body, attach ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 flex items-center gap-2 rounded-md bg-ink-800/60 px-2 py-1 text-[11px] font-semibold text-ink-200",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Paperclip, { className: "h-3 w-3" }),
							" ",
							attach
						]
					}) : null]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `tabular mt-1 text-[10px] ${me ? "text-ink-400" : "text-ink-400"}`,
					children: [time, receipts ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-1 text-brand-600 font-semibold",
						children: receipts
					}) : null]
				})
			]
		})]
	});
}
function OfflineVisual() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl border border-ink-600 bg-ink-800 p-6 shadow-xl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 rounded-md border border-[#f0b232]/30 bg-[#f0b232]/15 px-3 py-2 text-[12px] font-semibold text-[#9a6700] dark:text-[#fee75c]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WifiOff, { className: "h-4 w-4" }), " Offline · 3 pending · Local DB"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-5 space-y-3",
				children: [
					{
						l: "Activity session #a4c9",
						s: "Queued",
						c: "amber"
					},
					{
						l: "Message to Ada Lovelace",
						s: "Queued",
						c: "amber"
					},
					{
						l: "Task FAL-214 comment",
						s: "Queued",
						c: "amber"
					}
				].map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between rounded-lg border border-ink-600 bg-ink-800/40 px-3 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[12px] text-ink-200",
						children: r.l
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex items-center gap-1.5 rounded-full bg-[#f0b232]/15 px-2 py-0.5 text-[10px] font-semibold text-[#9a6700] dark:text-[#fee75c]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-1.5 w-1.5 rounded-full bg-[#f0b232]" }), r.s]
					})]
				}, r.l))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 rounded-lg border border-[#00a8fc]/30 bg-[#00a8fc]/10 px-3 py-2 text-[12px] text-[#006fae] dark:text-[#00a8fc]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pulse-dot h-2 w-2 rounded-full bg-[#00a8fc]" }), "Syncing… reconnected 2s ago"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2 h-1.5 overflow-hidden rounded-full bg-[#00a8fc]/20",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-full w-2/3 rounded-full bg-[#00a8fc]" })
				})]
			})
		]
	});
}
function LoginVisual() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "atmosphere rounded-2xl p-6 shadow-xl ring-1 ring-ink-600",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto max-w-sm rounded-2xl border border-ink-600 bg-ink-800 p-6 shadow-lg",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "mt-6 font-display text-2xl font-semibold text-ink-50",
					children: "Welcome back"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-ink-300",
					children: "Sign in to your DockX workspace"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-5 space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "text-[11px] font-semibold text-ink-200",
							children: "Email"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-[13px] text-ink-100",
							children: "ada@lovelace.co"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "text-[11px] font-semibold text-ink-200",
							children: "Password"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-[13px] tracking-widest text-ink-300",
							children: "••••••••••"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "mt-2 w-full rounded-md bg-brand-500/100 py-2 text-[13px] font-semibold text-white hover:bg-brand-600",
							children: "Sign in"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-center text-[11px] text-ink-300",
							children: [
								"New? ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-semibold text-brand-400",
									children: "Create workspace"
								}),
								" ·",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-semibold text-brand-400",
									children: "Use invite link"
								})
							]
						})
					]
				})
			]
		})
	});
}
function Architecture() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "border-y border-ink-600 bg-ink-800",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
				eyebrow: "Architecture",
				title: "Two clients. One source of truth.",
				sub: "Data is captured once at the desktop and consumed everywhere — no double-entry, no drift.",
				center: true
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-14 grid items-center gap-6 md:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArchCard, {
						icon: CodeXml,
						title: "Desktop Agent",
						role: "Employee execution",
						items: [
							"Tasks & Kanban",
							"Check-in & timer",
							"Chat",
							"Auto activity"
						],
						highlight: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "rounded-full border border-brand-200 bg-brand-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-brand-300",
							children: "Shared backend"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "w-full rounded-2xl border border-ink-600 bg-ink-800/60 p-5 text-center",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-display text-lg font-semibold text-ink-50",
									children: "Node.js + MongoDB"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-1 text-[12px] text-ink-300",
									children: "One record of time, tasks, teams"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-3 flex justify-center gap-1.5",
									children: [
										"#5865F2",
										"#4752C4",
										"#8891F2"
									].map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "h-2 w-2 rounded-full",
										style: { background: c }
									}, c))
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArchCard, {
						icon: LayoutDashboard,
						title: "Web Portal",
						role: "Manager console",
						items: [
							"Org setup",
							"Reports & audits",
							"Monitoring",
							"Configuration"
						]
					})
				]
			})]
		})
	});
}
function ArchCard({ icon: Icon, title, role, items, highlight }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `rounded-2xl border p-6 ${highlight ? "border-brand-300 bg-gradient-to-br from-brand-500/10 to-ink-800 shadow-lg ring-1 ring-brand-500/25" : "border-ink-600 bg-ink-800"}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid h-10 w-10 place-items-center rounded-lg bg-ink-800 text-brand-400 ring-1 ring-ink-600",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-5 w-5" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 font-display text-xl font-semibold text-ink-50",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[12px] font-semibold uppercase tracking-wider text-brand-400",
				children: role
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-4 space-y-2 text-[13px] text-ink-200",
				children: items.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
						className: "h-3.5 w-3.5 text-brand-400",
						strokeWidth: 3
					}), i]
				}, i))
			})
		]
	});
}
function Audiences() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
			eyebrow: "Who it's for",
			title: "Purpose-built for teams that ship.",
			center: true
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
			children: [
				{
					icon: CodeXml,
					title: "Software companies",
					size: "10–500 devs",
					body: "Replace Jira + Slack + Hubstaff with one integrated surface engineers actually keep open."
				},
				{
					icon: Briefcase,
					title: "Agencies & design shops",
					size: "Billable accuracy",
					body: "Automatic activity capture turns real desk time into defensible client invoices."
				},
				{
					icon: ShieldCheck,
					title: "IT consultancies & BPOs",
					size: "Compliance-grade",
					body: "Immutable attendance and activity logs — audit trails you can hand to legal."
				},
				{
					icon: Landmark,
					title: "Enterprises",
					size: "500+ seats",
					body: "Tool consolidation with role-based access, org bootstrap, and SSO-ready roadmap."
				}
			].map(({ icon: Icon, title, size, body }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "group rounded-2xl border border-ink-600 bg-ink-800 p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid h-10 w-10 place-items-center rounded-lg bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/25",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-5 w-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 font-display text-lg font-semibold text-ink-50",
						children: title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[11px] font-semibold uppercase tracking-wider text-brand-400",
						children: size
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm leading-relaxed text-ink-300",
						children: body
					})
				]
			}, title))
		})]
	});
}
function Stats() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "bg-ink-900",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8",
			children: [
				["3+", "Tools replaced with 1"],
				["<20s", "Check-in to activity sync"],
				["100%", "Offline-first with local SQLite"],
				["✓✓", "Realtime chat with read receipts"]
			].map(([n, l]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "text-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "tabular font-display text-4xl font-semibold text-brand-300 sm:text-5xl",
					children: n
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2 text-[13px] font-medium text-ink-300",
					children: l
				})]
			}, l))
		})
	});
}
function FAQ() {
	const faqs = [
		{
			q: "What platforms does the desktop app support?",
			a: "DockX Desktop runs on macOS and Windows via Tauri — a lightweight Rust runtime that keeps the app small, fast, and battery-friendly."
		},
		{
			q: "Does it track me when I'm checked out?",
			a: "No. Activity monitoring only runs while you're checked in, and it pauses automatically when you go on break. DockX itself is always excluded from recorded time."
		},
		{
			q: "Can I use it offline?",
			a: "Yes. Chat drafts, activity sessions, and task edits queue to a local SQLite outbox and sync automatically when you reconnect — usually within 8 seconds."
		},
		{
			q: "What's the difference between the Desktop app and the Web portal?",
			a: "Desktop is the employee workspace — tasks, timers, chat, activity. Web is the manager console — org setup, reports, monitoring, and configuration. Same backend, different surface."
		},
		{
			q: "Is there a free plan?",
			a: "Yes — start free and invite your team. Paid plans unlock advanced admin controls, longer activity history, and enterprise features like SSO."
		}
	];
	const [open, setOpen] = (0, import_react.useState)(0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
			eyebrow: "FAQ",
			title: "Answers, before you ask.",
			center: true
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-12 divide-y divide-ink-200 rounded-2xl border border-ink-600 bg-ink-800",
			children: faqs.map((f, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: () => setOpen(open === i ? -1 : i),
				className: "flex w-full items-center justify-between gap-6 px-5 py-4 text-left",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-display text-base font-semibold text-ink-50",
					children: f.q
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: `h-4 w-4 shrink-0 text-ink-300 transition ${open === i ? "rotate-180 text-brand-400" : ""}` })]
			}), open === i ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "px-5 pb-5 text-sm leading-relaxed text-ink-200",
				children: f.a
			}) : null] }, f.q))
		})]
	});
}
function FinalCTA() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "relative overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "atmosphere absolute inset-0 -z-10" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "grid-overlay absolute inset-0 -z-10 opacity-60" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:px-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl",
						children: "Start capturing work where it happens."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mx-auto mt-4 max-w-xl text-lg text-ink-200",
						children: "One backend of record for time, tasks, and teams — free to try, ready for your whole org."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-8 flex flex-wrap justify-center gap-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrimaryButton, {
								icon: ArrowRight,
								children: "Start free"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SecondaryButton, {
								icon: Download,
								children: "Download desktop"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TertiaryLink, {
								icon: LogIn,
								children: "Log in to portal"
							})
						]
					})
				]
			})
		]
	});
}
function Footer() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
		className: "border-t border-ink-600 bg-ink-800",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-10 md:grid-cols-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "md:col-span-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 max-w-xs text-sm text-ink-300",
						children: "The Desktop Agent for Enterprise Work OS. Capture at the desk. Decide from the dashboard."
					})]
				}), [
					["Product", [
						"Overview",
						"Desktop app",
						"Web portal",
						"Changelog"
					]],
					["Features", [
						"Attendance",
						"Activity",
						"Kanban",
						"Chat",
						"Offline"
					]],
					["Company", [
						"Pricing",
						"Customers",
						"Docs",
						"Contact"
					]],
					["Legal", [
						"Privacy",
						"Terms",
						"Security",
						"DPA"
					]]
				].map(([title, items]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[11px] font-semibold uppercase tracking-wider text-ink-300",
					children: title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-3 space-y-2 text-sm text-ink-200",
					children: items.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "#",
						className: "hover:text-brand-400",
						children: i
					}) }, i))
				})] }, title))]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-12 flex flex-col items-start justify-between gap-3 border-t border-ink-600 pt-6 text-xs text-ink-300 sm:flex-row sm:items-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					"© ",
					(/* @__PURE__ */ new Date()).getFullYear(),
					" DockX, Inc. All rights reserved."
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex items-center gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-1.5 w-1.5 rounded-full bg-[#23a559]" }), " All systems operational"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "v1.4.0" })]
				})]
			})]
		})
	});
}
function LandingPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-ink-900",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Nav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hero, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProblemSolution, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeatureBlock, {
				eyebrow: "Attendance & time",
				title: "Check in once. Time tracks itself.",
				body: "A single tap sets your workday in motion. Live session timers surface everywhere you work — and never lose a minute across restarts.",
				bullets: [
					"One-click Check In · Check Out · Break · End Break",
					"Live HH:MM:SS timer excludes break time automatically",
					"Status indicators: Out (grey) · In (green) · Break (amber)",
					"Session persists across app restarts — never lose your day",
					"Works from Dashboard, Board toolbar, and global header"
				],
				visual: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AttendanceVisual, {})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeatureBlock, {
				eyebrow: "Activity monitoring",
				title: "Know where work actually happens.",
				body: "Native desktop capture (Tauri + Rust) polls the foreground app every 5 seconds while you're checked in — including browser URL detection and away-period intelligence.",
				bullets: [
					"Captures app name, process, and window title every 5s",
					"Browser URL/host detection for Chrome, Safari, Firefox",
					"Detects screen lock, screensaver, and sleep as away time",
					"DockX excludes itself from recorded time",
					"Admin-only org-wide view with per-member drill-down"
				],
				visual: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActivityVisual, {}),
				reverse: true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "bg-ink-800",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeatureBlock, {
					eyebrow: "Dashboard",
					title: "Your command center for the workday.",
					body: "Overview, Tasks, Users, Timeline, and Activity — a single hub for employees and admins with KPIs, filters, and drill-down that actually work.",
					bullets: [
						"KPI strip: open tasks · done % · due soon · projects",
						"Donut, bar, and workload charts filterable by teammate",
						"Admin Users tab: add members, assign to projects, roles",
						"Timeline backlog with attachments and one-click assign",
						"Activity tab (admin) for org-wide monitoring"
					],
					visual: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardVisual, {})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeatureBlock, {
				eyebrow: "Kanban board",
				title: "Jira-style boards. Zero context switching.",
				body: "Projects, columns, drag-and-drop, full task modals — everything you left Jira for, without leaving the app your team already lives in.",
				bullets: [
					"Custom columns: add · rename · reorder · delete",
					"Drag-and-drop between statuses, multi-member combined boards",
					"Task types: Task · Bug · Story · Time — with estimates & hours logged",
					"Comments, attachments (2MB), labels, reporter metadata",
					"Invite by email or shareable invite link with project role"
				],
				visual: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoardVisual, {}),
				reverse: true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "bg-ink-800",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeatureBlock, {
					eyebrow: "Real-time chat",
					title: "Slack-level chat. Built into your workday.",
					body: "DMs, group chats, presence, typing indicators, and read receipts — with optimistic UI that never leaves you wondering if a message got through.",
					bullets: [
						"Direct messages and named group chats with avatars",
						"Presence with online + checked-in status dots",
						"Reply, edit, delete, forward — with confirmations",
						"Read receipts (✓ / ✓✓) and delivery states",
						"File attachments with optimistic sending states"
					],
					visual: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatVisual, {})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeatureBlock, {
				eyebrow: "Offline-first",
				title: "Works when Wi-Fi doesn't.",
				body: "A local SQLite cache means the app opens instantly, keeps chatting, and keeps tracking — then reconciles cleanly the moment you reconnect.",
				bullets: [
					"Local SQLite cache for activity + chat (Tauri)",
					"Instant launch from local DB — no spinner",
					"Outbox queue for messages sent offline",
					"Auto-sync every ~8s on reconnect",
					"Header shows: Offline · Syncing… · N pending · Local DB"
				],
				visual: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OfflineVisual, {}),
				reverse: true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "bg-ink-800",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeatureBlock, {
					eyebrow: "Profile & onboarding",
					title: "Get started in minutes.",
					body: "Bootstrap your org, invite the team, and let them auto-restore sessions on every launch. Roles map cleanly from org to project.",
					bullets: [
						"Email/password login with persistent session",
						"Org bootstrap: create workspace + Admin in one flow",
						"Invite-based registration via /register?invite=…",
						"Profile page with photo upload and read-only org role",
						"Roles: Admin, Manager, Member — plus project admin/member"
					],
					visual: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoginVisual, {})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Architecture, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Audiences, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stats, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FAQ, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FinalCTA, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Footer, {})
		]
	});
}
//#endregion
export { LandingPage as component };
