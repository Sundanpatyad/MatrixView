import { useEffect, useRef, useState } from "react";

type Props = {
  className?: string;
};

function isDark() {
  return document.documentElement.classList.contains("dark");
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

type DashState = {
  bars: number[];
  activeBar: number;
  pulse: number;
  liveBlink: number;
  kpiFlash: number;
};

function paintDashboard(
  canvas: HTMLCanvasElement,
  dark: boolean,
  state: DashState,
) {
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
    [2, green],
  ] as const) {
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
  ctx.globalAlpha = 0.45 + state.liveBlink * 0.55;
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
  const nav = [brand, muted, muted, muted, muted];
  nav.forEach((c, i) => {
    if (c === brand) {
      ctx.fillStyle = `rgba(88,101,242,${0.15 + state.pulse * 0.12})`;
      roundRect(ctx, 12, 76 + i * 56, 48, 40, 10);
      ctx.fill();
    }
    ctx.fillStyle = c;
    roundRect(ctx, 24, 88 + i * 56, 24, 16, 4);
    ctx.fill();
  });

  const kpis = [
    { l: "Checked in", v: "18", c: green },
    { l: "On break", v: "3", c: yellow },
    { l: "Tasks done", v: "42", c: brand },
    { l: "Focus hrs", v: "126", c: blue },
  ];
  kpis.forEach((k, i) => {
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
    ctx.arc(x + 22, y + 28, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = muted;
    ctx.font = "600 13px system-ui, sans-serif";
    ctx.fillText(k.l.toUpperCase(), x + 36, y + 32);
    ctx.fillStyle = text;
    ctx.font = "700 36px system-ui, sans-serif";
    ctx.fillText(k.v, x + 22, y + 78);
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
    const bhPx = Math.max(0.08, bh) * 160;
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

  const tasks = [
    ["Realtime board sync", green],
    ["Invite email polish", blue],
    ["Attendance offline", brand],
    ["Dashboard KPI strip", yellow],
  ] as const;
  tasks.forEach(([title, c], i) => {
    const ty = 268 + i * 48;
    const sel = Math.floor(state.pulse * 3.9) % 4 === i;
    ctx.fillStyle = sel
      ? dark
        ? "rgba(88,101,242,0.22)"
        : "rgba(88,101,242,0.12)"
      : dark
        ? "#313338"
        : "#f2f3f5";
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
  const people = ["AR", "LK", "MT", "JP", "SW", "NK"];
  people.forEach((p, i) => {
    const px = 130 + i * 64;
    const bob = Math.sin(state.pulse * Math.PI * 2 + i) * 3;
    ctx.beginPath();
    ctx.fillStyle =
      i % 2 === 0 ? "rgba(88,101,242,0.25)" : "rgba(0,168,252,0.2)";
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
export function HeroScene({ className = "" }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const mount = mountRef.current;
      if (!mount) return;

      const THREE = await import("three");
      if (disposed || !mountRef.current) return;

      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      const mobile = w < 768;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
      camera.position.set(0, 0.15, mobile ? 5.2 : 4.55);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);
      setReady(true);

      // —— Starfield ——
      const pCount = reduce ? 100 : mobile ? 180 : 320;
      const pPos = new Float32Array(pCount * 3);
      const pVel = new Float32Array(pCount);
      for (let i = 0; i < pCount; i++) {
        pPos[i * 3] = (Math.random() - 0.5) * 12;
        pPos[i * 3 + 1] = (Math.random() - 0.5) * 8;
        pPos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1;
        pVel[i] = 0.002 + Math.random() * 0.006;
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
      const pMat = new THREE.PointsMaterial({
        color: 0x5865f2,
        size: 0.022,
        transparent: true,
        opacity: isDark() ? 0.45 : 0.28,
        depthWrite: false,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
      });
      const points = new THREE.Points(pGeo, pMat);
      scene.add(points);

      // —— Orbit rings ——
      const rings = new THREE.Group();
      scene.add(rings);
      if (!reduce) {
        for (let i = 0; i < 3; i++) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(2.4 + i * 0.35, 0.006, 8, 128),
            new THREE.MeshBasicMaterial({
              color: i === 1 ? 0x5865f2 : 0xa5adf8,
              transparent: true,
              opacity: 0.18 - i * 0.04,
            }),
          );
          ring.rotation.x = Math.PI / 2.6 + i * 0.2;
          ring.rotation.y = i * 0.5;
          rings.add(ring);
        }
      }

      // —— Product ——
      const product = new THREE.Group();
      product.position.set(mobile ? 0 : 0.9, mobile ? 0.3 : 0.08, 0);
      const baseRotY = mobile ? -0.06 : -0.28;
      const baseRotX = 0.1;
      product.rotation.set(baseRotX, baseRotY, 0);
      scene.add(product);

      const dashState: DashState = {
        bars: [0.42, 0.68, 0.55, 0.82, 0.7, 0.28, 0.18],
        activeBar: 3,
        pulse: 0,
        liveBlink: 1,
        kpiFlash: -1,
      };

      const canvas = document.createElement("canvas");
      paintDashboard(canvas, isDark(), dashState);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();

      const panelW = 3.2;
      const panelH = 2.12;
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(panelW, panelH),
        new THREE.MeshBasicMaterial({ map: tex }),
      );
      screen.position.z = 0.02;
      product.add(screen);

      // Soft ground shadow only — no backdrop plate / glow box
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(panelW * 0.95, panelH * 0.28),
        new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: isDark() ? 0.22 : 0.1,
        }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(0, -panelH / 2 - 0.12, 0.2);
      product.add(shadow);

      // floating chips
      const makeChip = (label: string, value: string, color: string) => {
        const c = document.createElement("canvas");
        c.width = 420;
        c.height = 140;
        const cx = c.getContext("2d")!;
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
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1.15, 0.38),
          new THREE.MeshBasicMaterial({ map: t, transparent: true }),
        );
        return { mesh, canvas: c, draw, tex: t };
      };

      const chipA = makeChip("DESK STATUS", "Checked in", "#23a559");
      chipA.mesh.position.set(mobile ? -0.95 : -1.6, mobile ? -0.9 : 0.95, 0.65);
      chipA.mesh.rotation.y = 0.28;
      product.add(chipA.mesh);

      const chipB = makeChip("SYNC", "Realtime · on", "#00a8fc");
      chipB.mesh.position.set(mobile ? 0.95 : 1.55, mobile ? 0.85 : -0.95, 0.55);
      chipB.mesh.rotation.y = -0.22;
      product.add(chipB.mesh);

      // lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const key = new THREE.DirectionalLight(0xffffff, 0.7);
      key.position.set(3, 4, 5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x5865f2, 0.45);
      rim.position.set(-3, 1, -2);
      scene.add(rim);

      // Soft float + cursor follow only (no drag / no 360 spin)
      const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

      const onMove = (e: PointerEvent) => {
        const rect = mount.getBoundingClientRect();
        pointer.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.ty = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      const themeObs = new MutationObserver(() => {
        paintDashboard(canvas, isDark(), dashState);
        tex.needsUpdate = true;
        chipA.draw();
        chipA.tex.needsUpdate = true;
        chipB.draw();
        chipB.tex.needsUpdate = true;
        pMat.opacity = isDark() ? 0.45 : 0.28;
        (shadow.material as THREE.MeshBasicMaterial).opacity = isDark()
          ? 0.22
          : 0.1;
      });
      themeObs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });

      let t = 0;
      let raf = 0;
      let lastPaint = 0;

      const animate = () => {
        raf = requestAnimationFrame(animate);
        t += reduce ? 0.004 : 0.016;

        pointer.x += (pointer.tx - pointer.x) * 0.06;
        pointer.y += (pointer.ty - pointer.y) * 0.06;

        // Gentle float
        const floatY = reduce ? 0 : Math.sin(t * 1.05) * 0.08;
        const floatX = reduce ? 0 : Math.sin(t * 0.7) * 0.03;
        product.position.x = (mobile ? 0 : 0.9) + floatX + pointer.x * 0.12;
        product.position.y = (mobile ? 0.3 : 0.08) + floatY + pointer.y * 0.08;

        // Limited tilt toward cursor (not a full spin)
        product.rotation.y = baseRotY + pointer.x * 0.22;
        product.rotation.x = baseRotX + pointer.y * 0.14;
        product.rotation.z = pointer.x * -0.04;

        chipA.mesh.position.y =
          (mobile ? -0.9 : 0.95) + Math.sin(t * 1.35 + 0.5) * 0.07;
        chipB.mesh.position.y =
          (mobile ? 0.85 : -0.95) + Math.sin(t * 1.15 + 2) * 0.07;
        chipA.mesh.position.x =
          (mobile ? -0.95 : -1.6) + pointer.x * 0.05;
        chipB.mesh.position.x =
          (mobile ? 0.95 : 1.55) + pointer.x * 0.04;
        chipA.mesh.rotation.z = pointer.x * 0.05;
        chipB.mesh.rotation.z = -pointer.x * 0.04;

        rings.rotation.z = t * 0.08;
        rings.rotation.x = 0.4 + pointer.y * 0.12;
        rings.rotation.y = pointer.x * 0.15;

        const arr = pGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < pCount; i++) {
          arr[i * 3 + 1] += pVel[i];
          if (arr[i * 3 + 1] > 4) arr[i * 3 + 1] = -4;
        }
        pGeo.attributes.position.needsUpdate = true;
        points.rotation.y = t * 0.03;

        dashState.pulse = (Math.sin(t * 0.8) + 1) / 2;
        dashState.liveBlink = (Math.sin(t * 4) + 1) / 2;
        if (!reduce) {
          dashState.bars = dashState.bars.map((b, i) => {
            const target =
              0.25 +
              0.55 * (0.5 + 0.5 * Math.sin(t * 1.2 + i * 0.7)) +
              (i === dashState.activeBar ? 0.12 : 0);
            return b + (target - b) * 0.08;
          });
          if (Math.floor(t * 0.35) !== Math.floor((t - 0.016) * 0.35)) {
            dashState.activeBar = (dashState.activeBar + 1) % 7;
          }
        }

        if (t - lastPaint > 0.05) {
          paintDashboard(canvas, isDark(), dashState);
          tex.needsUpdate = true;
          lastPaint = t;
        }

        camera.position.x = pointer.x * 0.18;
        camera.position.y = 0.15 + pointer.y * 0.1;
        camera.lookAt(mobile ? 0 : 0.55, 0.08, 0);

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
            (obj.material as THREE.Material).dispose();
          }
        });
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) {
          mount.removeChild(renderer.domElement);
        }
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-0 ${className}`}
      aria-hidden
    >
      <div
        ref={mountRef}
        className={`h-full w-full transition-opacity duration-700 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
