"use client";

import { useEffect, useRef } from "react";

/**
 * Interactive constellation of people-as-value-vectors (Obsidian-graph style).
 * Marketing demo on synthetic data — in the app this becomes the real match
 * space (nodes = users, distance = vector similarity). Canvas 2D, no deps.
 */

// deterministic PRNG — same constellation on every load, SSR-safe
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  "Ola", "Marek", "Kasia", "Tomek", "Ania", "Paweł", "Zosia", "Michał",
  "Ewa", "Kuba", "Magda", "Piotr", "Julia", "Adam", "Natalia", "Szymon",
  "Karolina", "Filip", "Weronika", "Bartek", "Lena", "Wojtek", "Marta",
  "Igor", "Hania", "Krzysiek", "Emilia", "Janek", "Alicja", "Mateusz",
];

// dominant-value colour classes (design-system accents)
const COLORS = ["#7C5CE6", "#E89B3C", "#3FA97C", "#8B6FA8"];
const YOU_COLOR = "#E89B3C";
const INK = "#2E2A4D";

type N = {
  x: number; y: number; vx: number; vy: number;
  r: number; vec: number[]; name: string; color: string; you: boolean;
  phase: number;
};
type E = { a: number; b: number; sim: number };

function similarity(a: number[], b: number[]) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += (a[i] - b[i]) ** 2;
  return 1 - Math.sqrt(d / a.length); // vectors in [0,1] → sim in (0,1]
}

function build(w: number, h: number) {
  const rnd = mulberry32(20260704);
  const nodes: N[] = [];
  const count = 42;
  // three loose value-archetypes so real clusters emerge
  const archetypes = [
    [0.85, 0.2, 0.75, 0.3], [0.25, 0.85, 0.35, 0.7], [0.55, 0.5, 0.15, 0.85],
  ];
  for (let i = 0; i < count; i++) {
    const arch = archetypes[i % 3];
    const vec = arch.map((v) => Math.min(1, Math.max(0, v + (rnd() - 0.5) * 0.55)));
    const dom = vec.indexOf(Math.max(...vec));
    nodes.push({
      x: w / 2 + (rnd() - 0.5) * w * 0.8,
      y: h / 2 + (rnd() - 0.5) * h * 0.8,
      vx: 0, vy: 0,
      r: 5 + rnd() * 3.5,
      vec, name: NAMES[i % NAMES.length],
      color: COLORS[dom],
      you: false,
      phase: rnd() * Math.PI * 2,
    });
  }
  // "you" — blend of archetype 0, centered, bigger
  const you: N = {
    x: w / 2, y: h / 2, vx: 0, vy: 0, r: 11,
    vec: [0.8, 0.35, 0.7, 0.4], name: "Ty", color: YOU_COLOR, you: true,
    phase: 0,
  };
  nodes.unshift(you);

  // edges: each node → its top-3 most similar (dedup)
  const edges: E[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    const sims = nodes
      .map((n, j) => ({ j, s: i === j ? -1 : similarity(nodes[i].vec, n.vec) }))
      .sort((p, q) => q.s - p.s)
      .slice(0, 3);
    for (const { j, s } of sims) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key) && s > 0.45) {
        seen.add(key);
        edges.push({ a: Math.min(i, j), b: Math.max(i, j), sim: s });
      }
    }
  }
  return { nodes, edges };
}

export default function ValueGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, dpr = 1;
    let nodes: N[] = [], edges: E[] = [];
    let hover = -1, drag = -1;
    let running = true, raf = 0, t = 0;

    let builtAtW = 0;
    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      if (rect.width < 50) return; // layout not ready yet — ResizeObserver will call again
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      if (!nodes.length || builtAtW < 200) {
        builtAtW = W;
        ({ nodes, edges } = build(W, H));
        simOf.clear();
        for (let i = 0; i < 260; i++) tick(true); // settle before first paint
      }
    };

    const simOf = new Map<number, number>(); // node → sim with "you", for labels
    const simsReady = () => {
      if (simOf.size) return;
      for (let i = 1; i < nodes.length; i++)
        simOf.set(i, similarity(nodes[0].vec, nodes[i].vec));
    };

    function tick(warmup = false) {
      const cx = W / 2, cy = H / 2;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (i === drag) continue;
        // centering + gentle organic drift
        n.vx += (cx - n.x) * 0.0012;
        n.vy += (cy - n.y) * 0.0012;
        if (!warmup && !reduced) {
          n.vx += Math.cos(t * 0.01 + n.phase) * 0.006;
          n.vy += Math.sin(t * 0.013 + n.phase) * 0.006;
        }
        // pairwise repulsion
        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          let dx = n.x - m.x, dy = n.y - m.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) d2 = 1;
          if (d2 < 32000) {
            const f = 900 / d2;
            const d = Math.sqrt(d2);
            dx /= d; dy /= d;
            n.vx += dx * f; n.vy += dy * f;
            if (j !== drag) { m.vx -= dx * f; m.vy -= dy * f; }
          }
        }
      }
      // springs along edges — rest length shrinks with similarity
      for (const e of edges) {
        const a = nodes[e.a], b = nodes[e.b];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const rest = 46 + (1 - e.sim) * 210;
        const f = (d - rest) * 0.018;
        const ux = dx / d, uy = dy / d;
        if (e.a !== drag) { a.vx += ux * f; a.vy += uy * f; }
        if (e.b !== drag) { b.vx -= ux * f; b.vy -= uy * f; }
      }
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (i === drag) continue;
        n.vx *= 0.86; n.vy *= 0.86;
        n.x += Math.max(-4, Math.min(4, n.vx));
        n.y += Math.max(-4, Math.min(4, n.vy));
        const pad = 24;
        n.x = Math.max(pad, Math.min(W - pad, n.x));
        n.y = Math.max(pad, Math.min(H - pad, n.y));
      }
      t++;
    }

    function draw() {
      simsReady();
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, W, H);

      const linked = new Set<number>();
      if (hover >= 0)
        for (const e of edges) {
          if (e.a === hover) linked.add(e.b);
          if (e.b === hover) linked.add(e.a);
        }

      // edges
      for (const e of edges) {
        const a = nodes[e.a], b = nodes[e.b];
        const active = hover >= 0 && (e.a === hover || e.b === hover);
        const dim = hover >= 0 && !active;
        ctx!.strokeStyle = active
          ? "rgba(124,92,230,0.55)"
          : `rgba(46,42,77,${dim ? 0.04 : 0.05 + e.sim * 0.16})`;
        ctx!.lineWidth = active ? 1.6 : 1;
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.stroke();
      }

      // nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const active = i === hover || linked.has(i) || (hover < 0 && n.you) || (i === hover);
        const dim = hover >= 0 && !active && !n.you;
        ctx!.globalAlpha = dim ? 0.35 : 1;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fillStyle = n.color;
        ctx!.fill();
        if (n.you) {
          ctx!.strokeStyle = "rgba(232,155,60,0.4)";
          ctx!.lineWidth = 6;
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, n.r + 6, 0, Math.PI * 2);
          ctx!.stroke();
          ctx!.fillStyle = INK;
          ctx!.font = "600 13px var(--font-dm-sans, sans-serif)";
          ctx!.textAlign = "center";
          ctx!.fillText("Ty", n.x, n.y - n.r - 12);
        }
        ctx!.globalAlpha = 1;
      }

      // hover label: name + match % with "you"
      if (hover > 0) {
        const n = nodes[hover];
        const pct = Math.round((simOf.get(hover) || 0) * 100);
        const label = `${n.name} · ${pct}% dopasowania`;
        ctx!.font = "600 13px var(--font-dm-sans, sans-serif)";
        const w = ctx!.measureText(label).width + 22;
        const x = Math.max(8, Math.min(W - w - 8, n.x - w / 2));
        const y = Math.max(10, n.y - n.r - 34);
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
        if (!reduced || drag >= 0) tick();
        draw();
      }
      raf = requestAnimationFrame(loop);
    };

    const pick = (mx: number, my: number) => {
      let best = -1, bd = 400; // 20px radius
      for (let i = 0; i < nodes.length; i++) {
        const d = (nodes[i].x - mx) ** 2 + (nodes[i].y - my) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    };
    const pos = (ev: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { mx: ev.clientX - r.left, my: ev.clientY - r.top };
    };
    const onMove = (ev: PointerEvent) => {
      const { mx, my } = pos(ev);
      if (drag >= 0) {
        nodes[drag].x = mx; nodes[drag].y = my;
        nodes[drag].vx = 0; nodes[drag].vy = 0;
        return;
      }
      hover = pick(mx, my);
      canvas.style.cursor = hover >= 0 ? "grab" : "default";
    };
    const onDown = (ev: PointerEvent) => {
      const { mx, my } = pos(ev);
      drag = pick(mx, my);
      if (drag >= 0) {
        canvas.setPointerCapture(ev.pointerId);
        canvas.style.cursor = "grabbing";
      }
    };
    const onUp = (ev: PointerEvent) => {
      if (drag >= 0) canvas.releasePointerCapture(ev.pointerId);
      drag = -1;
      canvas.style.cursor = hover >= 0 ? "grab" : "default";
    };
    const onLeave = () => { hover = -1; };

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
    };
  }, []);

  return (
    <div className="vg-wrap">
      <canvas ref={canvasRef} aria-label="Interaktywna mapa dopasowań — każdy punkt to osoba, bliskość oznacza zgodność wartości" />
      <div className="vg-hint">Najedź na punkt — zobaczysz dopasowanie. Złap i przeciągnij.</div>
    </div>
  );
}
