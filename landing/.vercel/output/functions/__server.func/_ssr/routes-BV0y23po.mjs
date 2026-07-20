import { i as __toESM } from "../_runtime.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { n as gsapWithCSS, t as ScrollTrigger } from "../_libs/gsap.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BV0y23po.js
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
		"data-cursor": "grow",
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
function isDark() {
	return document.documentElement.classList.contains("dark");
}
function roundRect(ctx, x, y, w, h, r) {
	const rr = Math.min(r, w / 2, h / 2);
	ctx.beginPath();
	ctx.moveTo(x + rr, y);
	ctx.arcTo(x + w, y, x + w, y + h, rr);
	ctx.arcTo(x + w, y + h, x, y + h, rr);
	ctx.arcTo(x, y + h, x, y, rr);
	ctx.arcTo(x, y, x + w, y, rr);
	ctx.closePath();
}
function paintDashboard(canvas, dark, state) {
	const w = 1024;
	const h = 680;
	if (canvas.width !== w) {
		canvas.width = w;
		canvas.height = h;
	}
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	const bg = dark ? "#1e1f22" : "#f2f3f5";
	const panel = dark ? "#2b2d31" : "#ffffff";
	const border = dark ? "#383a40" : "#d6d9dc";
	const text = dark ? "#f2f3f5" : "#111214";
	const muted = dark ? "#949ba4" : "#5c5e66";
	const brand = "#5865f2";
	const green = "#23a559";
	const yellow = "#f0b232";
	const blue = "#00a8fc";
	ctx.clearRect(0, 0, w, h);
	ctx.fillStyle = dark ? "#111214" : "#e3e5e8";
	roundRect(ctx, 0, 0, w, h, 28);
	ctx.fill();
	ctx.fillStyle = panel;
	roundRect(ctx, 0, 0, w, 56, 28);
	ctx.fill();
	ctx.fillRect(0, 28, w, 28);
	for (const [i, c] of [
		[0, "#ed4245"],
		[1, yellow],
		[2, green]
	]) {
		ctx.beginPath();
		ctx.fillStyle = c;
		ctx.arc(28 + i * 22, 28, 7, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.fillStyle = muted;
	ctx.font = "600 18px system-ui, sans-serif";
	ctx.fillText("DockX · Overview", 100, 34);
	ctx.fillStyle = dark ? "#313338" : "#eef0ff";
	roundRect(ctx, w - 110, 16, 78, 26, 13);
	ctx.fill();
	ctx.beginPath();
	ctx.globalAlpha = .45 + state.liveBlink * .55;
	ctx.fillStyle = blue;
	ctx.arc(w - 92, 29, 4, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalAlpha = 1;
	ctx.fillStyle = brand;
	ctx.font = "600 12px system-ui, sans-serif";
	ctx.fillText("LIVE", w - 80, 33);
	ctx.fillStyle = bg;
	ctx.fillRect(0, 56, w, h - 56);
	ctx.fillStyle = panel;
	ctx.fillRect(0, 56, 72, h - 56);
	[
		brand,
		muted,
		muted,
		muted,
		muted
	].forEach((c, i) => {
		if (c === brand) {
			ctx.fillStyle = `rgba(88,101,242,${.15 + state.pulse * .12})`;
			roundRect(ctx, 12, 76 + i * 56, 48, 40, 10);
			ctx.fill();
		}
		ctx.fillStyle = c;
		roundRect(ctx, 24, 88 + i * 56, 24, 16, 4);
		ctx.fill();
	});
	[
		{
			l: "Checked in",
			v: "18",
			c: green
		},
		{
			l: "On break",
			v: "3",
			c: yellow
		},
		{
			l: "Tasks done",
			v: "42",
			c: brand
		},
		{
			l: "Focus hrs",
			v: "126",
			c: blue
		}
	].forEach((k, i) => {
		const x = 96 + i * 220;
		const y = 80;
		const glow = state.kpiFlash === i;
		ctx.fillStyle = panel;
		roundRect(ctx, x, y, 200, 100, 16);
		ctx.fill();
		if (glow) {
			ctx.strokeStyle = brand;
			ctx.lineWidth = 2;
			roundRect(ctx, x, y, 200, 100, 16);
			ctx.stroke();
		} else {
			ctx.strokeStyle = border;
			ctx.lineWidth = 1;
			roundRect(ctx, x, y, 200, 100, 16);
			ctx.stroke();
		}
		ctx.beginPath();
		ctx.fillStyle = k.c;
		ctx.arc(x + 22, 108, 5, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = muted;
		ctx.font = "600 13px system-ui, sans-serif";
		ctx.fillText(k.l.toUpperCase(), x + 36, 112);
		ctx.fillStyle = text;
		ctx.font = "700 36px system-ui, sans-serif";
		ctx.fillText(k.v, x + 22, 158);
	});
	ctx.fillStyle = panel;
	roundRect(ctx, 96, 204, 560, 280, 16);
	ctx.fill();
	ctx.strokeStyle = border;
	roundRect(ctx, 96, 204, 560, 280, 16);
	ctx.stroke();
	ctx.fillStyle = text;
	ctx.font = "600 16px system-ui, sans-serif";
	ctx.fillText("Focus this week", 120, 236);
	state.bars.forEach((bh, i) => {
		const bx = 140 + i * 68;
		const bhPx = Math.max(.08, bh) * 160;
		const by = 430 - bhPx;
		const active = i === state.activeBar;
		ctx.fillStyle = active ? brand : "rgba(88,101,242,0.28)";
		if (active) {
			ctx.shadowColor = "rgba(88,101,242,0.55)";
			ctx.shadowBlur = 18;
		}
		roundRect(ctx, bx, by, 36, bhPx, 8);
		ctx.fill();
		ctx.shadowBlur = 0;
	});
	ctx.fillStyle = panel;
	roundRect(ctx, 680, 204, 312, 280, 16);
	ctx.fill();
	ctx.strokeStyle = border;
	roundRect(ctx, 680, 204, 312, 280, 16);
	ctx.stroke();
	ctx.fillStyle = text;
	ctx.font = "600 16px system-ui, sans-serif";
	ctx.fillText("Recent tasks", 704, 236);
	[
		["Realtime board sync", green],
		["Invite email polish", blue],
		["Attendance offline", brand],
		["Dashboard KPI strip", yellow]
	].forEach(([title, c], i) => {
		const ty = 268 + i * 48;
		const sel = Math.floor(state.pulse * 3.9) % 4 === i;
		ctx.fillStyle = sel ? dark ? "rgba(88,101,242,0.22)" : "rgba(88,101,242,0.12)" : dark ? "#313338" : "#f2f3f5";
		roundRect(ctx, 700, ty, 272, 40, 10);
		ctx.fill();
		ctx.beginPath();
		ctx.fillStyle = c;
		ctx.arc(722, ty + 20, 5, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = text;
		ctx.font = "500 14px system-ui, sans-serif";
		ctx.fillText(title, 740, ty + 25);
	});
	ctx.fillStyle = panel;
	roundRect(ctx, 96, 508, 896, 120, 16);
	ctx.fill();
	ctx.strokeStyle = border;
	roundRect(ctx, 96, 508, 896, 120, 16);
	ctx.stroke();
	ctx.fillStyle = muted;
	ctx.font = "600 12px system-ui, sans-serif";
	ctx.fillText("TEAM PRESENCE", 120, 540);
	[
		"AR",
		"LK",
		"MT",
		"JP",
		"SW",
		"NK"
	].forEach((p, i) => {
		const px = 130 + i * 64;
		const bob = Math.sin(state.pulse * Math.PI * 2 + i) * 3;
		ctx.beginPath();
		ctx.fillStyle = i % 2 === 0 ? "rgba(88,101,242,0.25)" : "rgba(0,168,252,0.2)";
		ctx.arc(px, 580 + bob, 20, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = brand;
		ctx.font = "700 12px system-ui, sans-serif";
		ctx.fillText(p, px - 10, 584 + bob);
		ctx.beginPath();
		ctx.fillStyle = i === 2 ? yellow : i === 4 ? muted : green;
		ctx.arc(px + 14, 594 + bob, 5, 0, Math.PI * 2);
		ctx.fill();
	});
}
/**
* Floating 3D hero mock — gentle bob + cursor parallax (no spin).
*/
function HeroScene({ className = "" }) {
	const mountRef = (0, import_react.useRef)(null);
	const [ready, setReady] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		let disposed = false;
		let cleanup;
		(async () => {
			const mount = mountRef.current;
			if (!mount) return;
			const THREE = await import("../_libs/three.mjs").then((n) => n.t);
			if (disposed || !mountRef.current) return;
			const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			const w = mount.clientWidth || window.innerWidth;
			const h = mount.clientHeight || window.innerHeight;
			const mobile = w < 768;
			const scene = new THREE.Scene();
			const camera = new THREE.PerspectiveCamera(42, w / h, .1, 100);
			camera.position.set(0, .15, mobile ? 5.2 : 4.55);
			const renderer = new THREE.WebGLRenderer({
				antialias: true,
				alpha: true,
				powerPreference: "high-performance"
			});
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
			renderer.setSize(w, h);
			renderer.setClearColor(0, 0);
			mount.appendChild(renderer.domElement);
			setReady(true);
			const pCount = reduce ? 100 : mobile ? 180 : 320;
			const pPos = new Float32Array(pCount * 3);
			const pVel = new Float32Array(pCount);
			for (let i = 0; i < pCount; i++) {
				pPos[i * 3] = (Math.random() - .5) * 12;
				pPos[i * 3 + 1] = (Math.random() - .5) * 8;
				pPos[i * 3 + 2] = (Math.random() - .5) * 8 - 1;
				pVel[i] = .002 + Math.random() * .006;
			}
			const pGeo = new THREE.BufferGeometry();
			pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
			const pMat = new THREE.PointsMaterial({
				color: 5793266,
				size: .022,
				transparent: true,
				opacity: isDark() ? .45 : .28,
				depthWrite: false,
				sizeAttenuation: true,
				blending: THREE.AdditiveBlending
			});
			const points = new THREE.Points(pGeo, pMat);
			scene.add(points);
			const rings = new THREE.Group();
			scene.add(rings);
			if (!reduce) for (let i = 0; i < 3; i++) {
				const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4 + i * .35, .006, 8, 128), new THREE.MeshBasicMaterial({
					color: i === 1 ? 5793266 : 10857976,
					transparent: true,
					opacity: .18 - i * .04
				}));
				ring.rotation.x = Math.PI / 2.6 + i * .2;
				ring.rotation.y = i * .5;
				rings.add(ring);
			}
			const product = new THREE.Group();
			product.position.set(mobile ? 0 : .9, mobile ? .3 : .08, 0);
			const baseRotY = mobile ? -.06 : -.28;
			const baseRotX = .1;
			product.rotation.set(baseRotX, baseRotY, 0);
			scene.add(product);
			const dashState = {
				bars: [
					.42,
					.68,
					.55,
					.82,
					.7,
					.28,
					.18
				],
				activeBar: 3,
				pulse: 0,
				liveBlink: 1,
				kpiFlash: -1
			};
			const canvas = document.createElement("canvas");
			paintDashboard(canvas, isDark(), dashState);
			const tex = new THREE.CanvasTexture(canvas);
			tex.colorSpace = THREE.SRGBColorSpace;
			tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
			const panelW = 3.2;
			const panelH = 2.12;
			const screen = new THREE.Mesh(new THREE.PlaneGeometry(panelW, panelH), new THREE.MeshBasicMaterial({ map: tex }));
			screen.position.z = .02;
			product.add(screen);
			const shadow = new THREE.Mesh(new THREE.PlaneGeometry(panelW * .95, panelH * .28), new THREE.MeshBasicMaterial({
				color: 0,
				transparent: true,
				opacity: isDark() ? .22 : .1
			}));
			shadow.rotation.x = -Math.PI / 2;
			shadow.position.set(0, -2.12 / 2 - .12, .2);
			product.add(shadow);
			const makeChip = (label, value, color) => {
				const c = document.createElement("canvas");
				c.width = 420;
				c.height = 140;
				const cx = c.getContext("2d");
				const draw = () => {
					const dark = isDark();
					cx.clearRect(0, 0, 420, 140);
					cx.fillStyle = dark ? "#2b2d31" : "#ffffff";
					roundRect(cx, 0, 0, 420, 140, 22);
					cx.fill();
					cx.strokeStyle = dark ? "#383a40" : "#d6d9dc";
					cx.lineWidth = 2;
					roundRect(cx, 1, 1, 418, 138, 22);
					cx.stroke();
					cx.fillStyle = dark ? "#949ba4" : "#5c5e66";
					cx.font = "600 18px system-ui, sans-serif";
					cx.fillText(label, 28, 42);
					cx.fillStyle = color;
					cx.beginPath();
					cx.arc(40, 88, 8, 0, Math.PI * 2);
					cx.fill();
					cx.fillStyle = dark ? "#f2f3f5" : "#111214";
					cx.font = "700 28px system-ui, sans-serif";
					cx.fillText(value, 60, 98);
				};
				draw();
				const t = new THREE.CanvasTexture(c);
				t.colorSpace = THREE.SRGBColorSpace;
				return {
					mesh: new THREE.Mesh(new THREE.PlaneGeometry(1.15, .38), new THREE.MeshBasicMaterial({
						map: t,
						transparent: true
					})),
					canvas: c,
					draw,
					tex: t
				};
			};
			const chipA = makeChip("DESK STATUS", "Checked in", "#23a559");
			chipA.mesh.position.set(mobile ? -.95 : -1.6, mobile ? -.9 : .95, .65);
			chipA.mesh.rotation.y = .28;
			product.add(chipA.mesh);
			const chipB = makeChip("SYNC", "Realtime · on", "#00a8fc");
			chipB.mesh.position.set(mobile ? .95 : 1.55, mobile ? .85 : -.95, .55);
			chipB.mesh.rotation.y = -.22;
			product.add(chipB.mesh);
			scene.add(new THREE.AmbientLight(16777215, .9));
			const key = new THREE.DirectionalLight(16777215, .7);
			key.position.set(3, 4, 5);
			scene.add(key);
			const rim = new THREE.DirectionalLight(5793266, .45);
			rim.position.set(-3, 1, -2);
			scene.add(rim);
			const pointer = {
				x: 0,
				y: 0,
				tx: 0,
				ty: 0
			};
			const onMove = (e) => {
				const rect = mount.getBoundingClientRect();
				pointer.tx = (e.clientX - rect.left) / rect.width * 2 - 1;
				pointer.ty = -((e.clientY - rect.top) / rect.height * 2 - 1);
			};
			window.addEventListener("pointermove", onMove, { passive: true });
			const themeObs = new MutationObserver(() => {
				paintDashboard(canvas, isDark(), dashState);
				tex.needsUpdate = true;
				chipA.draw();
				chipA.tex.needsUpdate = true;
				chipB.draw();
				chipB.tex.needsUpdate = true;
				pMat.opacity = isDark() ? .45 : .28;
				shadow.material.opacity = isDark() ? .22 : .1;
			});
			themeObs.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ["class"]
			});
			let t = 0;
			let raf = 0;
			let lastPaint = 0;
			const animate = () => {
				raf = requestAnimationFrame(animate);
				t += reduce ? .004 : .016;
				pointer.x += (pointer.tx - pointer.x) * .06;
				pointer.y += (pointer.ty - pointer.y) * .06;
				const floatY = reduce ? 0 : Math.sin(t * 1.05) * .08;
				const floatX = reduce ? 0 : Math.sin(t * .7) * .03;
				product.position.x = (mobile ? 0 : .9) + floatX + pointer.x * .12;
				product.position.y = (mobile ? .3 : .08) + floatY + pointer.y * .08;
				product.rotation.y = baseRotY + pointer.x * .22;
				product.rotation.x = baseRotX + pointer.y * .14;
				product.rotation.z = pointer.x * -.04;
				chipA.mesh.position.y = (mobile ? -.9 : .95) + Math.sin(t * 1.35 + .5) * .07;
				chipB.mesh.position.y = (mobile ? .85 : -.95) + Math.sin(t * 1.15 + 2) * .07;
				chipA.mesh.position.x = (mobile ? -.95 : -1.6) + pointer.x * .05;
				chipB.mesh.position.x = (mobile ? .95 : 1.55) + pointer.x * .04;
				chipA.mesh.rotation.z = pointer.x * .05;
				chipB.mesh.rotation.z = -pointer.x * .04;
				rings.rotation.z = t * .08;
				rings.rotation.x = .4 + pointer.y * .12;
				rings.rotation.y = pointer.x * .15;
				const arr = pGeo.attributes.position.array;
				for (let i = 0; i < pCount; i++) {
					arr[i * 3 + 1] += pVel[i];
					if (arr[i * 3 + 1] > 4) arr[i * 3 + 1] = -4;
				}
				pGeo.attributes.position.needsUpdate = true;
				points.rotation.y = t * .03;
				dashState.pulse = (Math.sin(t * .8) + 1) / 2;
				dashState.liveBlink = (Math.sin(t * 4) + 1) / 2;
				if (!reduce) {
					dashState.bars = dashState.bars.map((b, i) => {
						return b + (.25 + .55 * (.5 + .5 * Math.sin(t * 1.2 + i * .7)) + (i === dashState.activeBar ? .12 : 0) - b) * .08;
					});
					if (Math.floor(t * .35) !== Math.floor((t - .016) * .35)) dashState.activeBar = (dashState.activeBar + 1) % 7;
				}
				if (t - lastPaint > .05) {
					paintDashboard(canvas, isDark(), dashState);
					tex.needsUpdate = true;
					lastPaint = t;
				}
				camera.position.x = pointer.x * .18;
				camera.position.y = .15 + pointer.y * .1;
				camera.lookAt(mobile ? 0 : .55, .08, 0);
				renderer.render(scene, camera);
			};
			animate();
			const onResize = () => {
				const nw = mount.clientWidth || window.innerWidth;
				const nh = mount.clientHeight || window.innerHeight;
				camera.aspect = nw / nh;
				camera.updateProjectionMatrix();
				renderer.setSize(nw, nh);
			};
			window.addEventListener("resize", onResize);
			cleanup = () => {
				cancelAnimationFrame(raf);
				themeObs.disconnect();
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("resize", onResize);
				pGeo.dispose();
				pMat.dispose();
				tex.dispose();
				chipA.tex.dispose();
				chipB.tex.dispose();
				product.traverse((obj) => {
					if (obj instanceof THREE.Mesh) {
						obj.geometry.dispose();
						const m = obj.material;
						if (Array.isArray(m)) m.forEach((x) => x.dispose());
						else m.dispose();
					}
				});
				rings.traverse((obj) => {
					if (obj instanceof THREE.Mesh) {
						obj.geometry.dispose();
						obj.material.dispose();
					}
				});
				renderer.dispose();
				if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
			};
		})();
		return () => {
			disposed = true;
			cleanup?.();
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: `pointer-events-none absolute inset-0 z-0 ${className}`,
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: mountRef,
			className: `h-full w-full transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`
		})
	});
}
/** Soft glow cursor + particle trail + click ripples. */
function CursorGlow() {
	const dotRef = (0, import_react.useRef)(null);
	const ringRef = (0, import_react.useRef)(null);
	const trailRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const fine = window.matchMedia("(pointer: fine)").matches;
		if (reduce || !fine) return;
		const dot = dotRef.current;
		const ring = ringRef.current;
		const trailHost = trailRef.current;
		if (!dot || !ring || !trailHost) return;
		const pos = {
			x: window.innerWidth / 2,
			y: window.innerHeight / 2
		};
		const ringPos = {
			x: pos.x,
			y: pos.y
		};
		let raf = 0;
		let trailTick = 0;
		const onMove = (e) => {
			pos.x = e.clientX;
			pos.y = e.clientY;
			gsapWithCSS.to(dot, {
				x: pos.x,
				y: pos.y,
				duration: .1,
				ease: "power2.out"
			});
			trailTick++;
			if (trailTick % 2 === 0) {
				const speck = document.createElement("span");
				speck.className = "pointer-events-none absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-400";
				speck.style.left = `${pos.x}px`;
				speck.style.top = `${pos.y}px`;
				trailHost.appendChild(speck);
				gsapWithCSS.to(speck, {
					opacity: 0,
					scale: 0,
					y: -12 - Math.random() * 18,
					x: (Math.random() - .5) * 24,
					duration: .55,
					ease: "power2.out",
					onComplete: () => speck.remove()
				});
			}
		};
		const tick = () => {
			ringPos.x += (pos.x - ringPos.x) * .16;
			ringPos.y += (pos.y - ringPos.y) * .16;
			gsapWithCSS.set(ring, {
				x: ringPos.x,
				y: ringPos.y
			});
			raf = requestAnimationFrame(tick);
		};
		tick();
		const onOver = (e) => {
			if (e.target?.closest?.("a, button, [data-cursor='grow']")) {
				gsapWithCSS.to(ring, {
					scale: 2.8,
					opacity: .7,
					borderColor: "rgba(88,101,242,0.9)",
					duration: .25
				});
				gsapWithCSS.to(dot, {
					scale: .35,
					duration: .2
				});
			}
		};
		const onOut = (e) => {
			if (e.target?.closest?.("a, button, [data-cursor='grow']")) {
				gsapWithCSS.to(ring, {
					scale: 1,
					opacity: .4,
					duration: .25
				});
				gsapWithCSS.to(dot, {
					scale: 1,
					duration: .2
				});
			}
		};
		const onClick = (e) => {
			const ripple = document.createElement("span");
			ripple.className = "pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-400";
			ripple.style.left = `${e.clientX}px`;
			ripple.style.top = `${e.clientY}px`;
			trailHost.appendChild(ripple);
			gsapWithCSS.fromTo(ripple, {
				scale: .4,
				opacity: .9
			}, {
				scale: 6,
				opacity: 0,
				duration: .65,
				ease: "power2.out",
				onComplete: () => ripple.remove()
			});
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: trailRef,
			className: "pointer-events-none fixed inset-0 z-[99]",
			"aria-hidden": true
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: ringRef,
			"aria-hidden": true,
			className: "pointer-events-none fixed top-0 left-0 z-[100] hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-400/70 md:block",
			style: { opacity: .4 }
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: dotRef,
			"aria-hidden": true,
			className: "pointer-events-none fixed top-0 left-0 z-[101] hidden h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-400 shadow-[0_0_12px_rgba(88,101,242,0.8)] md:block"
		})
	] });
}
/** Strong magnetic CTA with shimmer. */
function MagneticLink({ href, children, className = "" }) {
	const ref = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const el = ref.current;
		if (!el) return;
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const fine = window.matchMedia("(pointer: fine)").matches;
		if (reduce || !fine) return;
		const onMove = (e) => {
			const rect = el.getBoundingClientRect();
			const x = e.clientX - rect.left - rect.width / 2;
			const y = e.clientY - rect.top - rect.height / 2;
			gsapWithCSS.to(el, {
				x: x * .38,
				y: y * .38,
				duration: .3,
				ease: "power3.out"
			});
		};
		const onLeave = () => {
			gsapWithCSS.to(el, {
				x: 0,
				y: 0,
				duration: .7,
				ease: "elastic.out(1, 0.35)"
			});
		};
		const onEnter = () => {
			gsapWithCSS.fromTo(el, { scale: 1 }, {
				scale: 1.05,
				duration: .25,
				yoyo: true,
				repeat: 1,
				ease: "power2.out"
			});
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
		ref,
		href,
		className: `landing-shimmer relative inline-flex will-change-transform ${className}`,
		children
	});
}
/** Split letters that cascade in + react on hover. */
function SplitBrand({ text }) {
	const ref = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const el = ref.current;
		if (!el) return;
		const letters = el.querySelectorAll("[data-letter]");
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			gsapWithCSS.set(letters, { clearProps: "all" });
			return;
		}
		gsapWithCSS.fromTo(letters, {
			y: 36,
			opacity: 0
		}, {
			y: 0,
			opacity: 1,
			stagger: .045,
			duration: .7,
			ease: "power3.out",
			delay: .1
		});
	}, [text]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		ref,
		className: "inline-flex",
		children: text.split("").map((ch, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			"data-letter": true,
			className: "inline-block origin-bottom transition-transform duration-200 hover:-translate-y-1.5 hover:text-brand-300",
			children: ch === " " ? "\xA0" : ch
		}, `${ch}-${i}`))
	});
}
/** Override with VITE_DESKTOP_DOWNLOAD_URL when you have a direct installer CDN. */
var DESKTOP_DOWNLOAD_URL = "https://github.com/Sundanpatyad/MatrixView/releases/latest";
function detectDesktopPlatform() {
	if (typeof navigator === "undefined") return "other";
	const ua = navigator.userAgent;
	if (/Windows/i.test(ua)) return "windows";
	if (/Mac OS|Macintosh/i.test(ua)) return "mac";
	if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "linux";
	return "other";
}
function desktopDownloadLabel(platform) {
	switch (platform) {
		case "mac": return "Download for macOS";
		case "windows": return "Download for Windows";
		case "linux": return "Download for Linux";
		default: return "Download desktop app";
	}
}
function DownloadIcon({ className = "" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 24 24",
		className,
		fill: "none",
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: "M12 3v12m0 0 4-4m-4 4-4-4M5 19h14",
			stroke: "currentColor",
			strokeWidth: "1.8",
			strokeLinecap: "round",
			strokeLinejoin: "round"
		})
	});
}
/** Magnetic download button with OS-aware label. */
function DownloadDesktopButton({ className = "", variant = "primary", showIcon = true }) {
	const [platform, setPlatform] = (0, import_react.useState)("other");
	(0, import_react.useEffect)(() => {
		setPlatform(detectDesktopPlatform());
	}, []);
	const label = desktopDownloadLabel(platform);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(MagneticLink, {
		href: DESKTOP_DOWNLOAD_URL,
		className: `items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${{
			primary: "bg-brand-500 text-white hover:bg-brand-600",
			secondary: "border border-ink-600 bg-ink-800/70 text-ink-100 hover:border-brand-400/40 hover:text-ink-50",
			ghost: "border border-ink-600 text-ink-200 hover:border-brand-400/40 hover:text-ink-50"
		}[variant]} ${className}`,
		children: [showIcon && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DownloadIcon, { className: "h-4 w-4" }), label]
	});
}
/** Compact nav download control. */
function DownloadDesktopNavLink({ className = "" }) {
	const [label, setLabel] = (0, import_react.useState)("Download app");
	(0, import_react.useEffect)(() => {
		setLabel(desktopDownloadLabel(detectDesktopPlatform()));
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
		href: DESKTOP_DOWNLOAD_URL,
		"data-cursor": "grow",
		className: `inline-flex items-center gap-1.5 rounded-full border border-ink-600 bg-ink-800/60 px-3 py-1.5 text-[12px] font-semibold text-ink-100 transition hover:border-brand-400/50 hover:text-ink-50 ${className}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DownloadIcon, { className: "h-3.5 w-3.5" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "hidden sm:inline",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sm:hidden",
				children: "Download"
			})
		]
	});
}
var KPIS = [
	{
		label: "Checked in",
		value: "18",
		hint: "of 24",
		color: "bg-status-in"
	},
	{
		label: "On break",
		value: "3",
		hint: "now",
		color: "bg-status-break"
	},
	{
		label: "Tasks done",
		value: "42",
		hint: "today",
		color: "bg-brand-500"
	},
	{
		label: "Focus hrs",
		value: "126",
		hint: "team",
		color: "bg-status-sync"
	}
];
var BARS = [
	{
		name: "Mon",
		h: 42
	},
	{
		name: "Tue",
		h: 68
	},
	{
		name: "Wed",
		h: 55
	},
	{
		name: "Thu",
		h: 82
	},
	{
		name: "Fri",
		h: 70
	},
	{
		name: "Sat",
		h: 28
	},
	{
		name: "Sun",
		h: 18
	}
];
var TASKS = [
	{
		title: "Realtime board sync",
		who: "Asha",
		status: "Doing",
		tone: "bg-brand-500"
	},
	{
		title: "Invite email polish",
		who: "Leo",
		status: "Review",
		tone: "bg-status-sync"
	},
	{
		title: "Attendance offline queue",
		who: "Mia",
		status: "Done",
		tone: "bg-status-in"
	},
	{
		title: "Dashboard KPI strip",
		who: "Jon",
		status: "Todo",
		tone: "bg-ink-400"
	}
];
var TEAM = [
	{
		name: "Asha R.",
		status: "in",
		time: "05:12"
	},
	{
		name: "Leo K.",
		status: "in",
		time: "04:48"
	},
	{
		name: "Mia T.",
		status: "break",
		time: "00:22"
	},
	{
		name: "Jon P.",
		status: "in",
		time: "06:01"
	},
	{
		name: "Sam W.",
		status: "out",
		time: "—"
	}
];
var statusDot = {
	in: "bg-status-in",
	break: "bg-status-break",
	out: "bg-status-out"
};
/** Interactive dashboard mock — hover bars, click tasks. */
function DashboardMock() {
	const [activeBar, setActiveBar] = (0, import_react.useState)(3);
	const [selected, setSelected] = (0, import_react.useState)(0);
	const [pulse, setPulse] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const id = window.setInterval(() => setPulse((p) => !p), 2400);
		return () => clearInterval(id);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 shadow-[0_24px_80px_-24px_var(--card-shadow)]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between border-b border-ink-600 bg-ink-900/60 px-4 py-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2.5 w-2.5 rounded-full bg-[#ed4245]/80" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2.5 w-2.5 rounded-full bg-status-break/80" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2.5 w-2.5 rounded-full bg-status-in/80" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-3 text-[12px] font-semibold text-ink-100",
						children: "DockX · Overview"
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `h-1.5 w-1.5 rounded-full bg-status-sync ${pulse ? "opacity-100" : "opacity-40"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[11px] font-medium tracking-wider text-ink-300 uppercase",
					children: "Live"
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-4 p-4 lg:grid-cols-[1fr_16rem]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-2 gap-2 sm:grid-cols-4",
					children: KPIS.map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						"data-cursor": "grow",
						className: "rounded-xl border border-ink-600 bg-ink-900/40 p-3 text-left transition hover:border-brand-400/40 hover:bg-brand-500/5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `h-1.5 w-1.5 rounded-full ${k.color}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] font-semibold tracking-wider text-ink-300 uppercase",
									children: k.label
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "tabular mt-1.5 font-landing text-2xl font-semibold text-ink-50",
								children: k.value
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[11px] text-ink-400",
								children: k.hint
							})
						]
					}, k.label))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-4 md:grid-cols-[1.1fr_1fr]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-ink-600 bg-ink-900/30 p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[12px] font-semibold text-ink-100",
								children: "Focus this week"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "tabular text-[11px] text-ink-300",
								children: [
									BARS[activeBar].name,
									" · ",
									BARS[activeBar].h,
									"h"
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-4 flex h-36 items-end gap-2",
							children: BARS.map((b, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								"data-cursor": "grow",
								onClick: () => setActiveBar(i),
								onMouseEnter: () => setActiveBar(i),
								className: "group flex flex-1 flex-col items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "relative flex h-28 w-full items-end justify-center",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: `w-full max-w-[28px] rounded-t-md transition-all duration-300 ${activeBar === i ? "bg-brand-500" : "bg-brand-500/25 group-hover:bg-brand-500/50"}`,
										style: { height: `${b.h}%` }
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `text-[10px] font-medium ${activeBar === i ? "text-brand-300" : "text-ink-400"}`,
									children: b.name
								})]
							}, b.name))
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-ink-600 bg-ink-900/30 p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[12px] font-semibold text-ink-100",
							children: "Recent tasks"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-3 space-y-1.5",
							children: TASKS.map((t, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								"data-cursor": "grow",
								onClick: () => setSelected(i),
								className: `flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition ${selected === i ? "bg-brand-500/15 ring-1 ring-brand-500/40" : "hover:bg-ink-700/60"}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `h-2 w-2 shrink-0 rounded-full ${t.tone}` }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0 flex-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "truncate text-[12px] font-medium text-ink-100",
											children: t.title
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[10px] text-ink-400",
											children: t.who
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded-md bg-ink-700 px-1.5 py-0.5 text-[10px] font-semibold text-ink-200",
										children: t.status
									})
								]
							}) }, t.title))
						})]
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl border border-ink-600 bg-ink-900/30 p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[12px] font-semibold text-ink-100",
						children: "Team"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 space-y-2",
						children: TEAM.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							"data-cursor": "grow",
							className: "flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition hover:bg-ink-700/50",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "relative grid h-8 w-8 place-items-center rounded-full bg-brand-500/20 text-[11px] font-bold text-brand-300",
									children: [m.name.split(" ").map((p) => p[0]).join(""), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `absolute right-0 bottom-0 h-2 w-2 rounded-full border-2 border-ink-800 ${statusDot[m.status]}` })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "truncate text-[12px] font-medium text-ink-100",
										children: m.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[10px] capitalize text-ink-400",
										children: m.status === "in" ? "Checked in" : m.status === "break" ? "On break" : "Out"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "tabular text-[11px] font-semibold text-ink-300",
									children: m.time
								})
							]
						}, m.name))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"data-cursor": "grow",
						onClick: () => {
							window.location.href = "https://matrix-view.vercel.app/";
						},
						className: "mt-4 w-full rounded-lg bg-brand-500 py-2 text-[12px] font-semibold text-white transition hover:bg-brand-600",
						children: "Open full dashboard"
					})
				]
			})]
		})]
	});
}
var INITIAL = [
	{
		id: "1",
		title: "Ship attendance sync",
		tag: "P0",
		col: "doing"
	},
	{
		id: "2",
		title: "Board realtime QA",
		tag: "Eng",
		col: "todo"
	},
	{
		id: "3",
		title: "Manager dashboard polish",
		tag: "Design",
		col: "todo"
	},
	{
		id: "4",
		title: "Invite flow copy",
		tag: "Ops",
		col: "done"
	}
];
var COLS = [
	{
		key: "todo",
		label: "To do",
		tint: "border-ink-600"
	},
	{
		key: "doing",
		label: "In progress",
		tint: "border-brand-400/40"
	},
	{
		key: "done",
		label: "Done",
		tint: "border-ink-600"
	}
];
/** Click a card to cycle columns — live board feel. */
function LiveBoardPlayground() {
	const [cards, setCards] = (0, import_react.useState)(INITIAL);
	const [pulse, setPulse] = (0, import_react.useState)(null);
	const cycle = (id) => {
		setCards((prev) => prev.map((c) => {
			if (c.id !== id) return c;
			const next = c.col === "todo" ? "doing" : c.col === "doing" ? "done" : "todo";
			return {
				...c,
				col: next
			};
		}));
		setPulse(id);
		window.setTimeout(() => setPulse(null), 450);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "overflow-hidden rounded-2xl border border-ink-600 bg-ink-800",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between border-b border-ink-600 px-4 py-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2 w-2 animate-pulse rounded-full bg-brand-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[12px] font-medium text-ink-200",
					children: "Live board · click a card to move it"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-[11px] tracking-wider text-ink-400 uppercase",
				children: "Interactive"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-3 p-4 sm:grid-cols-3",
			children: COLS.map((col) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `min-h-[220px] rounded-xl border ${col.tint} bg-ink-900/40 p-3`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-3 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[11px] font-semibold tracking-wider text-ink-300 uppercase",
						children: col.label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular text-[11px] text-ink-400",
						children: cards.filter((c) => c.col === col.key).length
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-2",
					children: cards.filter((c) => c.col === col.key).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						"data-cursor": "grow",
						onClick: () => cycle(c.id),
						className: `w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-left transition hover:border-brand-400/50 hover:bg-brand-500/5 ${pulse === c.id ? "ring-1 ring-brand-400/60" : ""}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[13px] font-medium text-ink-50",
							children: c.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1.5 text-[10px] font-semibold tracking-wider text-brand-300 uppercase",
							children: c.tag
						})]
					}, c.id))
				})]
			}, col.key))
		})]
	});
}
var STATUSES = [
	{
		key: "in",
		label: "Checked in",
		color: "#23a559",
		hint: "Focusing on desk work"
	},
	{
		key: "break",
		label: "On break",
		color: "#f0b232",
		hint: "Paused · timer still running"
	},
	{
		key: "out",
		label: "Checked out",
		color: "#80848e",
		hint: "Day complete"
	}
];
/** Toggle desk status — attendance interaction. */
function DeskStatusToggle() {
	const [status, setStatus] = (0, import_react.useState)("in");
	const [seconds, setSeconds] = (0, import_react.useState)(8073);
	const active = STATUSES.find((s) => s.key === status);
	(0, import_react.useEffect)(() => {
		if (status === "out") return;
		const id = window.setInterval(() => setSeconds((n) => n + 1), 1e3);
		return () => clearInterval(id);
	}, [status]);
	const time = [
		Math.floor(seconds / 3600),
		Math.floor(seconds % 3600 / 60),
		seconds % 60
	].map((n) => String(n).padStart(2, "0")).join(":");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl border border-ink-600 bg-ink-800 p-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start justify-between gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] font-semibold tracking-[0.18em] text-ink-400 uppercase",
					children: "Desk status"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 font-landing text-2xl font-semibold text-ink-50",
					children: active.label
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-ink-300",
					children: active.hint
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "tabular font-landing text-3xl font-semibold tracking-tight",
				style: { color: active.color },
				children: time
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-6 flex flex-wrap gap-2",
			children: STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				"data-cursor": "grow",
				onClick: () => setStatus(s.key),
				className: `rounded-full px-4 py-2 text-[13px] font-semibold transition ${status === s.key ? "bg-brand-500 text-white" : "border border-ink-600 bg-ink-900/40 text-ink-200 hover:border-brand-400/40 hover:text-ink-50"}`,
				children: s.label
			}, s.key))
		})]
	});
}
var MODULES = [
	{
		id: "attendance",
		title: "Attendance",
		body: "Check in, break, checkout — with offline capture that syncs when you're back.",
		points: [
			"One-tap desk status",
			"Break timers",
			"Manager presence view"
		]
	},
	{
		id: "boards",
		title: "Boards",
		body: "Kanban that updates for everyone instantly. Columns, assignees, and priorities stay shared.",
		points: [
			"Realtime moves",
			"Filters that stick",
			"Compact card density"
		]
	},
	{
		id: "chat",
		title: "Chat & calls",
		body: "Talk next to the work — DMs, project rooms, and quick calls without leaving the agent.",
		points: [
			"Project threads",
			"Presence-aware",
			"File drop-in"
		]
	},
	{
		id: "activity",
		title: "Activity",
		body: "Desk truth for leads: focus windows, status flips, and who is actually shipping.",
		points: [
			"Live feed",
			"Per-person focus",
			"Export-ready days"
		]
	}
];
/** Tabbed module explorer. */
function ModuleExplorer() {
	const [active, setActive] = (0, import_react.useState)("boards");
	const mod = MODULES.find((m) => m.id === active);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-8 lg:grid-cols-[14rem_1fr]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible",
			children: MODULES.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				"data-cursor": "grow",
				onClick: () => setActive(m.id),
				className: `shrink-0 rounded-xl px-4 py-3 text-left text-sm font-semibold transition lg:w-full ${active === m.id ? "bg-brand-500 text-white" : "border border-ink-600 bg-ink-800 text-ink-200 hover:border-brand-400/40 hover:text-ink-50"}`,
				children: m.title
			}, m.id))
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-2xl border border-ink-600 bg-gradient-to-br from-brand-500/10 to-transparent p-8 sm:p-10",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "font-landing text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl",
					children: mod.title
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 max-w-xl text-base leading-relaxed text-ink-300",
					children: mod.body
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-8 space-y-3",
					children: mod.points.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center gap-3 text-sm text-ink-200",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-1.5 w-1.5 rounded-full bg-brand-400" }), p]
					}, p))
				})
			]
		}, mod.id)]
	});
}
var FAQS = [
	{
		q: "Is DockX a desktop app?",
		a: "Yes — the agent lives on the desk for check-in and focus. Boards, chat, and dashboards stay in sync with the team."
	},
	{
		q: "Does the board update live?",
		a: "Moves, assignees, and column changes broadcast to everyone in the project — no refresh required."
	},
	{
		q: "What if I go offline?",
		a: "Attendance and local work capture queue offline, then sync when the connection returns."
	},
	{
		q: "Who is it for?",
		a: "Teams that want one place for time, tasks, and talk — ICs at the desk, managers on the dashboard."
	}
];
function FaqAccordion() {
	const [open, setOpen] = (0, import_react.useState)(0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "divide-y divide-ink-600 border-y border-ink-600",
		children: FAQS.map((item, i) => {
			const isOpen = open === i;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				"data-cursor": "grow",
				onClick: () => setOpen(isOpen ? -1 : i),
				className: "flex w-full items-center justify-between gap-6 py-6 text-left",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-landing text-lg font-semibold text-ink-50 sm:text-xl",
					children: item.q
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: `grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink-600 text-lg text-ink-300 transition ${isOpen ? "rotate-45 border-brand-500 bg-brand-500 text-white" : ""}`,
					children: "+"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr] pb-6" : "grid-rows-[0fr]"}`,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "overflow-hidden text-sm leading-relaxed text-ink-300 sm:text-base",
					children: item.a
				})
			})] }, item.q);
		})
	});
}
/** Horizontal audience switcher. */
function AudienceSwitcher() {
	const audiences = [
		{
			id: "ic",
			label: "ICs",
			title: "Stay in flow at the desk",
			body: "Check in once. Move tasks without leaving the agent. Chat when you need context — not a dozen tabs."
		},
		{
			id: "lead",
			label: "Leads",
			title: "See the board breathe",
			body: "Realtime columns, assignee clarity, and presence that matches what's actually happening."
		},
		{
			id: "ops",
			label: "Ops",
			title: "Desk truth, not guesswork",
			body: "Attendance, activity, and day summaries for the people who keep capacity honest."
		}
	];
	const [active, setActive] = (0, import_react.useState)("ic");
	const a = audiences.find((x) => x.id === active);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex flex-wrap gap-2",
		children: audiences.map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"data-cursor": "grow",
			onClick: () => setActive(x.id),
			className: `rounded-full px-5 py-2 text-sm font-semibold transition ${active === x.id ? "bg-brand-500 text-white" : "border border-ink-600 text-ink-200 hover:border-brand-400/40 hover:text-ink-50"}`,
			children: x.label
		}, x.id))
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-10 max-w-2xl",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
			className: "font-landing text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl",
			children: a.title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-base leading-relaxed text-ink-300 sm:text-lg",
			children: a.body
		})]
	}, a.id)] });
}
gsapWithCSS.registerPlugin(ScrollTrigger);
var APP_LOGIN_URL = "https://matrix-view.vercel.app/";
var FEATURES = [
	{
		n: "01",
		title: "Desk capture",
		body: "Check in once. Time, focus, and activity stay with the work — not five other tabs."
	},
	{
		n: "02",
		title: "Live boards",
		body: "Move a task and every teammate sees it. Status, assignee, and columns stay in sync."
	},
	{
		n: "03",
		title: "Manager clarity",
		body: "One dashboard for priority, progress, and presence. Decide without chasing updates."
	}
];
var METRICS = [
	{
		value: "<20s",
		label: "Check-in to focus"
	},
	{
		value: "Live",
		label: "Board sync"
	},
	{
		value: "1",
		label: "Agent for the desk"
	},
	{
		value: "0",
		label: "Tab tax"
	}
];
function ScrollProgress() {
	const ref = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const el = ref.current;
		if (!el) return;
		const st = ScrollTrigger.create({
			start: 0,
			end: "max",
			onUpdate: (self) => {
				gsapWithCSS.set(el, { scaleX: self.progress });
			}
		});
		return () => st.kill();
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref,
		"aria-hidden": true,
		className: "fixed top-0 left-0 z-[60] h-[3px] w-full origin-left scale-x-0 bg-gradient-to-r from-brand-500 via-status-sync to-brand-300"
	});
}
function LandingExperience() {
	const rootRef = (0, import_react.useRef)(null);
	const [navSolid, setNavSolid] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const onScroll = () => setNavSolid(window.scrollY > 40);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);
	(0, import_react.useEffect)(() => {
		const root = rootRef.current;
		if (!root) return;
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const ctx = gsapWithCSS.context(() => {
			if (reduce) {
				gsapWithCSS.set("[data-reveal], [data-hero], [data-line], [data-metric]", { clearProps: "all" });
				return;
			}
			gsapWithCSS.timeline({ defaults: { ease: "power3.out" } }).from("[data-hero='brand']", {
				y: 28,
				opacity: 0,
				duration: .75
			}, 0).from("[data-hero='line']", {
				y: 28,
				opacity: 0,
				duration: .7
			}, "-=0.35").from("[data-hero='sub']", {
				y: 22,
				opacity: 0,
				duration: .6
			}, "-=0.35").from("[data-hero='cta']", {
				y: 18,
				opacity: 0,
				duration: .55
			}, "-=0.3").from("[data-hero='meta']", {
				opacity: 0,
				duration: .45
			}, "-=0.25");
			gsapWithCSS.utils.toArray("[data-reveal]").forEach((el) => {
				gsapWithCSS.from(el, {
					scrollTrigger: {
						trigger: el,
						start: "top 88%",
						toggleActions: "play none none none"
					},
					y: 56,
					opacity: 0,
					rotateX: 12,
					transformOrigin: "top center",
					duration: 1,
					ease: "power3.out"
				});
			});
			gsapWithCSS.utils.toArray("[data-line]").forEach((el) => {
				gsapWithCSS.from(el, {
					scrollTrigger: {
						trigger: el,
						start: "top 90%"
					},
					scaleX: 0,
					transformOrigin: "left center",
					duration: 1.2,
					ease: "power2.out"
				});
			});
			gsapWithCSS.from("[data-metric]", {
				scrollTrigger: {
					trigger: "[data-metrics]",
					start: "top 85%"
				},
				y: 40,
				opacity: 0,
				scale: .85,
				stagger: .1,
				duration: .85,
				ease: "back.out(1.5)"
			});
			gsapWithCSS.to("[data-marquee]", {
				xPercent: -50,
				ease: "none",
				duration: 22,
				repeat: -1
			});
			gsapWithCSS.to("[data-marquee-rev]", {
				xPercent: -50,
				ease: "none",
				duration: 28,
				repeat: -1
			});
			gsapWithCSS.to("[data-orb]", {
				y: "+=28",
				x: "+=12",
				duration: 3.5,
				yoyo: true,
				repeat: -1,
				ease: "sine.inOut",
				stagger: {
					each: .4,
					from: "random"
				}
			});
			gsapWithCSS.utils.toArray("[data-feature-row]").forEach((el) => {
				gsapWithCSS.from(el, {
					scrollTrigger: {
						trigger: el,
						start: "top 90%"
					},
					x: -40,
					opacity: 0,
					duration: .8,
					ease: "power3.out"
				});
			});
			const pin = root.querySelector("[data-pin-product]");
			const pinEnd = root.querySelector("[data-pin-end]");
			if (pin && pinEnd && window.innerWidth >= 900) ScrollTrigger.create({
				trigger: pin,
				start: "top 96px",
				endTrigger: pinEnd,
				end: "bottom 70%",
				pin: true,
				pinSpacing: false
			});
			gsapWithCSS.utils.toArray("[data-parallax]").forEach((el) => {
				const speed = Number(el.dataset.parallax) || 40;
				gsapWithCSS.to(el, {
					y: speed,
					ease: "none",
					scrollTrigger: {
						trigger: el,
						start: "top bottom",
						end: "bottom top",
						scrub: true
					}
				});
			});
			gsapWithCSS.to("[data-cta-glow]", {
				opacity: .55,
				scale: 1.15,
				duration: 2.2,
				yoyo: true,
				repeat: -1,
				ease: "sine.inOut"
			});
		}, root);
		return () => ctx.revert();
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: rootRef,
		className: "landing-root atmosphere relative min-h-screen overflow-x-hidden bg-ink-900 text-ink-100",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CursorGlow, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollProgress, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
				className: `fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${navSolid ? "border-ink-600 bg-ink-900/85 backdrop-blur-md" : "border-transparent bg-transparent"}`,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-16 sm:px-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							href: "/",
							className: "flex items-center gap-2.5",
							"data-cursor": "grow",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: "/logo.png",
								alt: "",
								width: 28,
								height: 28,
								className: "h-7 w-7 rounded-md object-cover"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-landing text-[15px] font-semibold tracking-tight text-ink-50",
								children: "DockX"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
							className: "hidden items-center gap-6 text-[13px] font-medium text-ink-300 md:flex",
							children: [
								["#product", "Product"],
								["#dashboard", "Dashboard"],
								["#download", "Download"],
								["#play", "Try it"],
								["#faq", "FAQ"]
							].map(([href, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href,
								className: "transition hover:text-ink-50",
								"data-cursor": "grow",
								children: label
							}, href))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeToggle, {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DownloadDesktopNavLink, {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MagneticLink, {
									href: APP_LOGIN_URL,
									className: "hidden rounded-full bg-brand-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-600 sm:inline-flex",
									children: "Log in"
								})
							]
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "relative flex min-h-[100dvh] items-center overflow-x-hidden pb-16 pt-28 sm:pb-20 sm:pt-32",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeroScene, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						"aria-hidden": true,
						className: "pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-ink-900 via-ink-900/75 to-ink-900/15 lg:via-ink-900/50 lg:to-transparent"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						"aria-hidden": true,
						className: "pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-28 bg-gradient-to-t from-ink-900 to-transparent"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						"aria-hidden": true,
						"data-orb": true,
						className: "pointer-events-none absolute top-[22%] left-[12%] z-[1] h-40 w-40 rounded-full bg-brand-500/20 blur-3xl"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						"aria-hidden": true,
						"data-orb": true,
						className: "pointer-events-none absolute top-[40%] right-[18%] z-[1] h-52 w-52 rounded-full bg-status-sync/15 blur-3xl"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative z-[2] mx-auto grid w-full max-w-6xl gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "max-w-xl",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
									"data-hero": "brand",
									className: "font-landing text-[clamp(3.25rem,12vw,6.5rem)] leading-[0.9] font-semibold tracking-[-0.04em] text-ink-50",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SplitBrand, { text: "DockX" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									"data-hero": "line",
									className: "mt-5 font-landing text-xl leading-snug font-medium tracking-tight text-ink-100 sm:text-2xl md:text-[1.75rem]",
									children: [
										"Capture work at the desk.",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
										"Decide from the dashboard."
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									"data-hero": "sub",
									className: "mt-4 max-w-md text-base leading-relaxed text-ink-300",
									children: "One workspace for time, tasks, and teams — live for everyone on the board."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									"data-hero": "cta",
									className: "mt-8 flex flex-wrap items-center gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DownloadDesktopButton, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(MagneticLink, {
										href: APP_LOGIN_URL,
										className: "items-center gap-2 rounded-full border border-ink-600 bg-ink-800/70 px-6 py-3 text-sm font-semibold text-ink-100 hover:border-brand-400/40",
										children: ["Log in to DockX", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											"aria-hidden": true,
											className: "text-lg leading-none",
											children: "→"
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									"data-hero": "meta",
									className: "mt-8 text-[11px] font-medium tracking-[0.2em] text-ink-400 uppercase",
									children: "Desktop agent · Live boards · Org dashboard"
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							"aria-hidden": true,
							className: "pointer-events-none hidden min-h-[380px] lg:block lg:min-h-[480px]"
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-hidden border-y border-ink-600 py-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					"data-marquee": true,
					className: "flex w-max gap-10 whitespace-nowrap font-landing text-sm font-medium tracking-[0.08em] text-ink-400 uppercase",
					children: [0, 1].map((copy) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-10",
						children: [
							"Attendance",
							"Kanban",
							"Realtime sync",
							"Chat",
							"Activity",
							"Offline-first",
							"Teams"
						].map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-center gap-10",
							children: [t, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-brand-400/60",
								children: "◆"
							})]
						}, `${copy}-${t}`))
					}, copy))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				"data-metrics": true,
				className: "mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-2 gap-8 border-y border-ink-600 py-10 md:grid-cols-4",
					children: METRICS.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						"data-metric": true,
						"data-cursor": "grow",
						className: "group transition hover:-translate-y-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-landing text-3xl font-semibold tracking-tight text-ink-50 transition group-hover:text-brand-300 sm:text-4xl",
							children: m.value
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 text-[12px] font-medium tracking-wider text-ink-400 uppercase",
							children: m.label
						})]
					}, m.label))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				id: "product",
				className: "mx-auto max-w-6xl px-5 pb-24 sm:px-8 sm:pb-32",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						"data-pin-product": true,
						className: "lg:pt-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							"data-reveal": true,
							className: "max-w-md",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] font-semibold tracking-[0.22em] text-brand-300 uppercase",
									children: "Product"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "mt-4 font-landing text-4xl leading-[1.05] font-semibold tracking-tight text-ink-50 sm:text-5xl",
									children: "Refined for how teams actually work."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									"data-line": true,
									className: "mt-8 h-px w-24 bg-brand-500"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-6 text-sm leading-relaxed text-ink-300",
									children: "Scroll the system. Hover the letters. Click the board."
								})
							]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						"data-pin-end": true,
						className: "border-t border-ink-600",
						children: FEATURES.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							"data-reveal": true,
							"data-feature-row": true,
							"data-cursor": "grow",
							className: "group border-b border-ink-600 py-10 transition hover:bg-brand-500/[0.04] sm:py-12",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-3 sm:flex-row sm:items-baseline sm:gap-8",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-landing text-sm font-medium text-brand-300",
									children: f.n
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-landing text-2xl font-semibold tracking-tight text-ink-50 transition group-hover:text-brand-300 sm:text-3xl",
									children: f.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-3 max-w-md text-base leading-relaxed text-ink-300",
									children: f.body
								})] })]
							})
						}, f.n))
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				id: "dashboard",
				className: "border-t border-ink-600 bg-ink-950/40 py-24 sm:py-32",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto max-w-6xl px-5 sm:px-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						"data-reveal": true,
						className: "mb-12 max-w-2xl",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] font-semibold tracking-[0.22em] text-brand-300 uppercase",
								children: "Dashboard"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
								className: "mt-4 font-landing text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl",
								children: [
									"The view managers",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
									"actually use."
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-5 max-w-lg text-base text-ink-300",
								children: "Hover the bars, select a task, scan the team rail — a live mock of DockX overview."
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						"data-reveal": true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardMock, {})
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				id: "download",
				className: "border-t border-ink-600 py-24 sm:py-32",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto max-w-6xl px-5 sm:px-8",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							"data-reveal": true,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] font-semibold tracking-[0.22em] text-brand-300 uppercase",
									children: "Desktop app"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
									className: "mt-4 font-landing text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl",
									children: [
										"Install DockX",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
										"on the desk."
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-5 max-w-lg text-base leading-relaxed text-ink-300",
									children: "The desktop agent captures attendance, focus, and board work offline-first — then syncs live with your team."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-8 flex flex-wrap items-center gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DownloadDesktopButton, { className: "px-6 py-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
										href: DESKTOP_DOWNLOAD_URL,
										"data-cursor": "grow",
										className: "inline-flex items-center rounded-full border border-ink-600 px-5 py-3 text-sm font-semibold text-ink-300 transition hover:border-brand-400/40 hover:text-ink-50",
										children: "All releases"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-5 text-xs text-ink-400",
									children: "Windows builds ship via CI. macOS / Linux installers appear on the same releases page when published."
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							"data-reveal": true,
							className: "rounded-2xl border border-ink-600 bg-ink-800/60 p-6 sm:p-8",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] font-semibold tracking-[0.18em] text-ink-400 uppercase",
								children: "What you get"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "mt-5 space-y-4",
								children: [
									"Native check-in, break, and checkout",
									"Offline queue that syncs when you’re back",
									"Live boards, chat, and presence in one agent",
									"Works alongside the web dashboard"
								].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-start gap-3 text-sm text-ink-200",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" }), item]
								}, item))
							})]
						})]
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				id: "play",
				className: "relative border-t border-ink-600 py-24 sm:py-32",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					"aria-hidden": true,
					"data-parallax": "80",
					className: "pointer-events-none absolute -left-20 top-20 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative mx-auto max-w-6xl px-5 sm:px-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						"data-reveal": true,
						className: "max-w-2xl",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] font-semibold tracking-[0.22em] text-brand-300 uppercase",
								children: "Try it"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
								className: "mt-4 font-landing text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl",
								children: [
									"Touch the product",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
									"before you log in."
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-5 max-w-lg text-base text-ink-300",
								children: "Desk status and a mini kanban — click around."
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-14 grid gap-6 lg:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							"data-reveal": true,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeskStatusToggle, {})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							"data-reveal": true,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveBoardPlayground, {})
						})]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-hidden border-y border-ink-600 py-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					"data-marquee-rev": true,
					className: "flex w-max gap-10 whitespace-nowrap font-landing text-sm font-medium tracking-[0.12em] text-ink-400/70 uppercase",
					children: [0, 1].map((copy) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-10",
						children: [
							"Check in",
							"Move a card",
							"See it live",
							"Talk in context",
							"Close the day"
						].map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-center gap-10",
							children: [t, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-brand-400/50",
								children: "→"
							})]
						}, `${copy}-${t}`))
					}, copy))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				id: "modules",
				className: "mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					"data-reveal": true,
					className: "mb-12 max-w-xl",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[11px] font-semibold tracking-[0.22em] text-brand-300 uppercase",
						children: "Modules"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "mt-4 font-landing text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl",
						children: [
							"Pick a layer.",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
							"See what it unlocks."
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					"data-reveal": true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModuleExplorer, {})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				id: "who",
				className: "border-t border-ink-600 bg-ink-950/40 py-24 sm:py-32",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto max-w-6xl px-5 sm:px-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						"data-reveal": true,
						className: "mb-12",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] font-semibold tracking-[0.22em] text-brand-300 uppercase",
							children: "Built for"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
							className: "mt-4 font-landing text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl",
							children: [
								"Different seats.",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
								"Same workspace."
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						"data-reveal": true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AudienceSwitcher, {})
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-28",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					"data-reveal": true,
					className: "mb-12 max-w-lg",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[11px] font-semibold tracking-[0.22em] text-brand-300 uppercase",
						children: "Flow"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-4 font-landing text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl",
						children: "From open → done."
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "grid gap-0 border-t border-ink-600 md:grid-cols-4",
					children: [
						{
							n: "01",
							t: "Open DockX",
							d: "Agent on the desk"
						},
						{
							n: "02",
							t: "Check in",
							d: "Status goes live"
						},
						{
							n: "03",
							t: "Move work",
							d: "Board updates for all"
						},
						{
							n: "04",
							t: "Close the day",
							d: "Activity stays true"
						}
					].map((step, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						"data-reveal": true,
						"data-cursor": "grow",
						className: "group border-b border-ink-600 py-8 md:border-r md:border-b-0 md:px-5 md:py-10 md:last:border-r-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-landing text-xs font-medium text-brand-300",
								children: step.n
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "mt-3 font-landing text-xl font-semibold text-ink-50 transition group-hover:text-brand-300",
								children: step.t
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-ink-300",
								children: step.d
							}),
							i < 3 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								"aria-hidden": true,
								className: "mt-6 hidden text-brand-400/40 md:block",
								children: "→"
							})
						]
					}, step.n))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				id: "faq",
				className: "border-t border-ink-600 py-24 sm:py-32",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto max-w-3xl px-5 sm:px-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						"data-reveal": true,
						className: "mb-10",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] font-semibold tracking-[0.22em] text-brand-300 uppercase",
							children: "FAQ"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-4 font-landing text-4xl font-semibold tracking-tight text-ink-50",
							children: "Straight answers."
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						"data-reveal": true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FaqAccordion, {})
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				id: "start",
				className: "relative overflow-hidden py-28 sm:py-36",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						"aria-hidden": true,
						"data-cta-glow": true,
						className: "pointer-events-none absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/25 blur-3xl"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						"aria-hidden": true,
						className: "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,var(--atmosphere-glow),transparent_55%)]"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative mx-auto max-w-3xl px-5 text-center sm:px-8",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
								"data-reveal": true,
								className: "font-landing text-4xl font-semibold tracking-tight text-ink-50 sm:text-6xl",
								children: [
									"Ready when",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
									"your team is."
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								"data-reveal": true,
								className: "mx-auto mt-5 max-w-md text-base text-ink-300",
								children: "Open DockX, check in, and keep work moving — live for every member on the board."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								"data-reveal": true,
								className: "mt-10 flex flex-wrap items-center justify-center gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DownloadDesktopButton, { className: "px-7 py-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(MagneticLink, {
									href: APP_LOGIN_URL,
									className: "items-center gap-2 rounded-full border border-ink-600 bg-ink-800/70 px-7 py-3.5 text-sm font-semibold text-ink-100 hover:border-brand-400/40",
									children: ["Log in to DockX", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										"aria-hidden": true,
										children: "→"
									})]
								})]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "border-t border-ink-600 py-8",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-xs text-ink-400 sm:flex-row sm:px-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						"© ",
						(/* @__PURE__ */ new Date()).getFullYear(),
						" DockX"
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: "#download",
								className: "transition hover:text-brand-300",
								children: "Download"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: "#product",
								className: "transition hover:text-brand-300",
								children: "Product"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: "#dashboard",
								className: "transition hover:text-brand-300",
								children: "Dashboard"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: APP_LOGIN_URL,
								className: "font-medium text-ink-300 transition hover:text-brand-300",
								children: "matrix-view.vercel.app"
							})
						]
					})]
				})
			})
		]
	});
}
function LandingPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LandingExperience, {});
}
//#endregion
export { LandingPage as component };
