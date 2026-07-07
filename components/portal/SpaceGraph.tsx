"use client";

import { useEffect, useRef, useState } from "react";
import type { SpacePerson } from "@/lib/matching";
import { Button, Card, MatchBadge } from "@/components/ds";
import { ComponentBars } from "./match-ui";
import { track } from "@/lib/telemetry-client";

/**
 * The in-app value constellation — same 3D physics as the landing ValueGraph,
 * but fed with REAL user vectors: nodes are actual people in your pool,
 * layout distance follows weighted-Euclidean similarity. Violet = men,
 * amber = women, "Ty" ringed. Interactions: drag rotates, mouse wheel /
 * pinch zooms toward the cursor ("fly in"), ↺ resets the view, and clicking
 * an opposite-gender point opens their match card (initials + % + breakdown
 * + FLIRT interest CTA). Initials only — the anonymity rule of the cards
 * applies here too.
 */

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAN_COLOR = "#7C5CE6";
const WOMAN_COLOR = "#E89B3C";
const INK = "#2E2A4D";
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 5;

type N = {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  r: number; name: string; man: boolean; you: boolean;
  matchPct: number | null;
  px: number; py: number; ps: number; pz: number;
};
type E = { a: number; b: number; sim: number };

function build(people: SpacePerson[], sims: number[][], R: number) {
  const rnd = mulberry32(20260707);
  const nodes: N[] = people.map((p) => {
    let x = 0, y = 0, z = 0;
    do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; }
    while (x * x + y * y + z * z > 1);
    return {
      x: x * R, y: y * R, z: z * R, vx: 0, vy: 0, vz: 0,
      r: p.you ? 8 : 3.4 + rnd() * 2.6,
      name: p.initials, man: p.man, you: p.you, matchPct: p.matchPct,
      px: 0, py: 0, ps: 1, pz: 0,
    };
  });
  if (nodes[0]?.you) { nodes[0].x = 0; nodes[0].y = 0; nodes[0].z = R * 0.35; }

  // edges: each node → top-2 most similar of the OPPOSITE gender (real sims)
  const edges: E[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    const cand = nodes
      .map((n, j) => ({ j, s: i === j || n.man === nodes[i].man ? -1 : sims[i][j] }))
      .sort((p, q) => q.s - p.s)
      .slice(0, 2);
    for (const { j, s } of cand) {
      if (s < 0) continue;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ a: Math.min(i, j), b: Math.max(i, j), sim: s });
      }
    }
  }

  // 3D force layout: springs on match edges, repulsion, ball containment
  for (let it = 0; it < 160; it++) {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const m = nodes[j];
        let dx = n.x - m.x, dy = n.y - m.y, dz = n.z - m.z;
        let d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 1) d2 = 1;
        if (d2 < R * R * 0.6) {
          const f = (R * 14) / d2;
          const d = Math.sqrt(d2);
          dx /= d; dy /= d; dz /= d;
          n.vx += dx * f; n.vy += dy * f; n.vz += dz * f;
          m.vx -= dx * f; m.vy -= dy * f; m.vz -= dz * f;
        }
      }
    }
    for (const e of edges) {
      const a = nodes[e.a], b = nodes[e.b];
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1);
      const rest = R * (0.18 + (1 - e.sim) * 0.9);
      const f = (d - rest) * 0.02;
      const ux = dx / d, uy = dy / d, uz = dz / d;
      a.vx += ux * f; a.vy += uy * f; a.vz += uz * f;
      b.vx -= ux * f; b.vy -= uy * f; b.vz -= uz * f;
    }
    for (const n of nodes) {
      const d = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z) || 1;
      if (d > R) {
        const k = ((d - R) / d) * 0.08;
        n.vx -= n.x * k; n.vy -= n.y * k; n.vz -= n.z * k;
      }
      n.vx *= 0.82; n.vy *= 0.82; n.vz *= 0.82;
      n.x += Math.max(-8, Math.min(8, n.vx));
      n.y += Math.max(-8, Math.min(8, n.vy));
      n.z += Math.max(-8, Math.min(8, n.vz));
    }
  }
  const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
  const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
  const cz = nodes.reduce((s, n) => s + n.z, 0) / nodes.length;
  for (const n of nodes) { n.x -= cx; n.y -= cy; n.z -= cz; }

  return { nodes, edges };
}

export default function SpaceGraph({
  people, sims, height = 420,
}: {
  people: SpacePerson[]; sims: number[][]; height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const selectedRef = useRef<number | null>(null);
  const [viewChanged, setViewChanged] = useState(false);
  const viewChangedRef = useRef(false);
  const resetRef = useRef<() => void>(() => {});
  const [invited, setInvited] = useState<Set<string>>(new Set());

  const select = (i: number | null) => { selectedRef.current = i; setSelected(i); };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, dpr = 1, R = 0;
    let nodes: N[] = [], edges: E[] = [];
    let hover = -1;
    let running = true, raf = 0;
    let yaw = 0.4, pitch = 0.15;
    let dragging = false, lastX = 0, lastY = 0;
    let downX = 0, downY = 0, moved = false;
    let zoom = 1, panX = 0, panY = 0;
    let pinchD = 0;
    const pts = new Map<number, { x: number; y: number }>();
    const spin = 0.0022;
    const youMan = people[0]?.man ?? true;

    const markView = () => {
      if (!viewChangedRef.current) { viewChangedRef.current = true; setViewChanged(true); }
    };
    resetRef.current = () => {
      zoom = 1; panX = 0; panY = 0;
      viewChangedRef.current = false; setViewChanged(false);
    };

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      if (rect.width < 50) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      R = Math.min(W, H) * 0.4;
      if (!nodes.length) ({ nodes, edges } = build(people, sims, R));
    };

    const project = () => {
      const sy = Math.sin(yaw), cy2 = Math.cos(yaw);
      const sp = Math.sin(pitch), cp = Math.cos(pitch);
      const f = R * 2.6;
      for (const n of nodes) {
        const x1 = n.x * cy2 + n.z * sy;
        const z1 = -n.x * sy + n.z * cy2;
        const y2 = n.y * cp - z1 * sp;
        const z2 = n.y * sp + z1 * cp;
        const s = (f / (f + z2 + R * 1.2)) * zoom;
        n.px = W / 2 + panX + x1 * s;
        n.py = H / 2 + panY + y2 * s;
        n.ps = s;
        n.pz = z2;
      }
    };

    /** Zoom keeping the point under (cx,cy) fixed — the "fly in" feel. */
    const applyZoom = (factor: number, cx: number, cy: number) => {
      const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
      const k = nz / zoom;
      if (k === 1) return;
      panX = cx - W / 2 - (cx - W / 2 - panX) * k;
      panY = cy - H / 2 - (cy - H / 2 - panY) * k;
      zoom = nz;
      markView();
    };

    function draw() {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, W, H);
      project();

      const linked = new Set<number>();
      if (hover >= 0)
        for (const e of edges) {
          if (e.a === hover) linked.add(e.b);
          if (e.b === hover) linked.add(e.a);
        }

      for (const e of edges) {
        const a = nodes[e.a], b = nodes[e.b];
        const depth = Math.min(a.ps, b.ps) / zoom;
        const active = hover >= 0 && (e.a === hover || e.b === hover);
        const base = Math.max(0, (depth - 0.55) * 0.35) * (0.35 + e.sim);
        ctx!.strokeStyle = active
          ? "rgba(124,92,230,0.6)"
          : `rgba(46,42,77,${hover >= 0 ? base * 0.35 : base})`;
        ctx!.lineWidth = active ? 1.5 : 0.8;
        ctx!.beginPath();
        ctx!.moveTo(a.px, a.py);
        ctx!.lineTo(b.px, b.py);
        ctx!.stroke();
      }

      const order = nodes.map((_, i) => i).sort((i, j) => nodes[j].pz - nodes[i].pz);
      for (const i of order) {
        const n = nodes[i];
        const active = i === hover || linked.has(i);
        const dim = hover >= 0 && !active && !n.you;
        const depthAlpha = 0.25 + Math.max(0, Math.min(1, (n.ps / zoom - 0.55) * 1.6)) * 0.75;
        ctx!.globalAlpha = dim ? depthAlpha * 0.35 : depthAlpha;
        const rad = Math.max(1.2, n.r * n.ps);
        ctx!.beginPath();
        ctx!.arc(n.px, n.py, rad, 0, Math.PI * 2);
        ctx!.fillStyle = n.man ? MAN_COLOR : WOMAN_COLOR;
        ctx!.fill();
        if (i === selectedRef.current) {
          ctx!.globalAlpha = 1;
          ctx!.strokeStyle = "rgba(124,92,230,0.55)";
          ctx!.lineWidth = Math.min(4, 3 * n.ps);
          ctx!.beginPath();
          ctx!.arc(n.px, n.py, rad + Math.min(7, 4 * n.ps), 0, Math.PI * 2);
          ctx!.stroke();
        }
        if (n.you) {
          ctx!.strokeStyle = "rgba(232,155,60,0.45)";
          ctx!.lineWidth = 5 * n.ps;
          ctx!.beginPath();
          ctx!.arc(n.px, n.py, rad + 5 * n.ps, 0, Math.PI * 2);
          ctx!.stroke();
          ctx!.globalAlpha = 1;
          ctx!.fillStyle = INK;
          ctx!.font = `600 ${Math.min(18, Math.max(11, 13 * n.ps))}px var(--font-dm-sans, sans-serif)`;
          ctx!.textAlign = "center";
          ctx!.fillText("Ty", n.px, n.py - rad - 8 * Math.min(n.ps, 1.6));
        }
        ctx!.globalAlpha = 1;
      }

      if (hover > 0) {
        const n = nodes[hover];
        const cross = n.man !== youMan;
        const label = cross && n.matchPct !== null
          ? `${n.name} · ${n.matchPct}% — zobacz kartę`
          : n.name;
        ctx!.font = "600 13px var(--font-dm-sans, sans-serif)";
        const w = ctx!.measureText(label).width + 22;
        const x = Math.max(8, Math.min(W - w - 8, n.px - w / 2));
        const y = Math.max(10, n.py - n.r * n.ps - 36);
        ctx!.fillStyle = "rgba(46,42,77,0.92)";
        ctx!.beginPath();
        ctx!.roundRect(x, y, w, 26, 13);
        ctx!.fill();
        ctx!.fillStyle = "#FAF6EF";
        ctx!.textAlign = "center";
        ctx!.fillText(label, x + w / 2, y + 17);
      }
    }

    const loop = () => {
      if (running) {
        if (!reduced && !dragging && hover < 0 && selectedRef.current === null) yaw += spin;
        draw();
      }
      raf = requestAnimationFrame(loop);
    };

    const pick = (mx: number, my: number) => {
      let best = -1, bd = 300;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const d = (n.px - mx) ** 2 + (n.py - my) ** 2 - n.ps * 40;
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    };
    const pos = (ev: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { mx: ev.clientX - r.left, my: ev.clientY - r.top };
    };
    const setCursor = () => {
      const clickable =
        hover > 0 && nodes[hover] && nodes[hover].man !== youMan && nodes[hover].matchPct !== null;
      canvas.style.cursor = dragging ? "grabbing" : clickable ? "pointer" : "grab";
    };
    const onMove = (ev: PointerEvent) => {
      const { mx, my } = pos(ev);
      if (pts.has(ev.pointerId)) pts.set(ev.pointerId, { x: mx, y: my });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        if (pinchD > 0) applyZoom(d / pinchD, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinchD = d;
        moved = true;
        return;
      }
      if (dragging) {
        if (Math.abs(mx - downX) + Math.abs(my - downY) > 5) moved = true;
        yaw += (mx - lastX) * 0.005;
        pitch += (my - lastY) * 0.003;
        pitch = Math.max(-0.9, Math.min(0.9, pitch));
        lastX = mx; lastY = my;
        return;
      }
      hover = pick(mx, my);
      setCursor();
    };
    const onDown = (ev: PointerEvent) => {
      const { mx, my } = pos(ev);
      pts.set(ev.pointerId, { x: mx, y: my });
      try { canvas.setPointerCapture(ev.pointerId); } catch {}
      if (pts.size === 2) {
        dragging = false;
        const [a, b] = [...pts.values()];
        pinchD = Math.hypot(a.x - b.x, a.y - b.y);
        return;
      }
      dragging = true; moved = false;
      downX = mx; downY = my; lastX = mx; lastY = my;
      canvas.style.cursor = "grabbing";
    };
    const onUp = (ev: PointerEvent) => {
      pts.delete(ev.pointerId);
      if (pts.size < 2) pinchD = 0;
      const wasDrag = dragging;
      dragging = false;
      if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
      if (wasDrag && !moved && ev.type === "pointerup") {
        const { mx, my } = pos(ev);
        const i = pick(mx, my);
        if (i > 0 && nodes[i].man !== youMan && nodes[i].matchPct !== null) select(i);
        else select(null);
      }
      setCursor();
    };
    const onLeave = () => { hover = -1; };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const r = canvas.getBoundingClientRect();
      applyZoom(Math.exp(-ev.deltaY * 0.0012), ev.clientX - r.left, ev.clientY - r.top);
    };

    const io = new IntersectionObserver(
      ([entry]) => { running = entry.isIntersecting; },
      { threshold: 0.05 },
    );
    io.observe(canvas);

    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas.parentElement!);
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [people, sims]);

  const sel = selected !== null ? people[selected] : null;
  const micro: React.CSSProperties = {
    margin: "8px 0 0", font: "var(--type-micro)", color: "var(--text-muted)",
  };

  return (
    <div style={{ position: "relative", width: "100%", height, touchAction: "none" }}>
      <canvas
        ref={canvasRef}
        aria-label="Trójwymiarowa mapa dopasowań — fioletowe punkty to mężczyźni, bursztynowe to kobiety, bliskość oznacza zgodność wartości. Przybliżaj kółkiem myszy, kliknij osobę, by zobaczyć jej kartę."
      />
      <div style={{
        position: "absolute", left: "12px", bottom: "10px",
        display: "flex", gap: "14px", font: "var(--type-micro)",
        color: "var(--text-secondary)", pointerEvents: "none",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <i style={{ width: 9, height: 9, borderRadius: "50%", background: WOMAN_COLOR, display: "inline-block" }} /> kobiety
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <i style={{ width: 9, height: 9, borderRadius: "50%", background: MAN_COLOR, display: "inline-block" }} /> mężczyźni
        </span>
      </div>

      {viewChanged && (
        <button
          onClick={() => resetRef.current()}
          style={{
            position: "absolute", right: "12px", bottom: "10px",
            padding: "6px 12px", borderRadius: "var(--radius-pill)",
            border: "1px solid var(--border-hairline)",
            background: "var(--surface-card)", color: "var(--text-secondary)",
            font: "var(--type-micro)", cursor: "pointer",
            boxShadow: "var(--shadow-md)",
          }}
        >
          ↺ cały widok
        </button>
      )}

      {sel && (
        <div style={{
          position: "absolute", top: "10px", right: "10px", zIndex: 6,
          width: "320px", maxWidth: "calc(100% - 20px)",
        }}>
          <Card variant="raised" padding="16px">
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "50%", flexShrink: 0,
                background: "var(--grad-veil, var(--surface-veil))",
                border: "1px solid var(--border-hairline)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-serif-display)", fontSize: "16px",
                color: "var(--text-secondary)", filter: "blur(0.3px)",
              }}>
                {sel.initials}
              </div>
              <div style={{ flex: 1 }}>
                <MatchBadge score={sel.matchPct ?? 0} size="sm" ring={false} />
              </div>
              <button
                onClick={() => select(null)}
                aria-label="Zamknij kartę"
                style={{
                  border: "none", background: "transparent", color: "var(--text-muted)",
                  fontSize: "17px", lineHeight: 1, cursor: "pointer",
                  padding: "4px", alignSelf: "flex-start",
                }}
              >
                ✕
              </button>
            </div>

            {sel.components && (
              <div style={{ marginTop: "12px" }}>
                <ComponentBars components={sel.components} labelWidth={118} />
              </div>
            )}
            {sel.passions.length > 0 && (
              <p style={{ margin: "10px 0 0", font: "var(--type-caption)", color: "var(--text-secondary)" }}>
                Wspólne pasje: {sel.passions.join(" · ")}
              </p>
            )}

            {invited.has(sel.id) ? (
              <p style={{ margin: "14px 0 0", font: "var(--type-caption)", color: "var(--accent-value)" }}>
                ✨ Zapisane! Gdy gra FLIRT wystartuje, damy Ci znać.
              </p>
            ) : (
              <div style={{ marginTop: "14px" }}>
                <Button
                  size="sm" variant="reward" full
                  onClick={() => {
                    track("flirt_interest", "matches", { target: sel.id, match_pct: sel.matchPct });
                    setInvited((prev) => new Set(prev).add(sel.id));
                  }}
                >
                  Chcę poznać tę osobę
                </Button>
              </div>
            )}
            <p style={micro}>
              Poznawanie zaczyna się od gry FLIRT (wzajemne pytania) — w budowie.
              Twoje zainteresowanie zapisujemy już teraz.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
