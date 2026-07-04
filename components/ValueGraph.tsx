"use client";

import { useEffect, useRef } from "react";

/**
 * 3D constellation of people-as-value-vectors.
 * Violet nodes = men, amber nodes = women; edges connect only opposite
 * genders (Lovli matches women to men and men to women). Nodes are laid
 * out by a 3D force simulation (similar people end up closer), then the
 * whole sphere slowly rotates; dragging rotates it by hand. Hovering a
 * node of the opposite gender to "Ty" shows the match %.
 * Synthetic demo data — in the app this becomes the real match space.
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

const WOMEN = [
  "Ola", "Kasia", "Ania", "Zosia", "Ewa", "Magda", "Julia", "Natalia",
  "Karolina", "Weronika", "Lena", "Marta", "Hania", "Emilia", "Alicja",
  "Basia", "Iga", "Klara", "Pola", "Nina", "Maja", "Laura", "Gabrysia",
  "Oliwia", "Amelia",
];
const MEN = [
  "Marek", "Tomek", "Paweł", "Michał", "Kuba", "Piotr", "Adam", "Szymon",
  "Filip", "Bartek", "Wojtek", "Igor", "Krzysiek", "Janek", "Mateusz",
  "Antek", "Franek", "Staś", "Leon", "Oskar", "Tymek", "Borys", "Aleks",
  "Dawid", "Miłosz",
];

const MAN_COLOR = "#7C5CE6"; // violet
const WOMAN_COLOR = "#E89B3C"; // amber
const INK = "#2E2A4D";

type N = {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  r: number; vec: number[]; name: string;
  man: boolean; you: boolean;
  // projected (per frame)
  px: number; py: number; ps: number; pz: number;
};
type E = { a: number; b: number; sim: number };

function similarity(a: number[], b: number[]) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += (a[i] - b[i]) ** 2;
  return 1 - Math.sqrt(d / a.length);
}

function build(R: number) {
  const rnd = mulberry32(20260704);
  const nodes: N[] = [];
  const count = 150;
  const archetypes = [
    [0.85, 0.2, 0.75, 0.3], [0.25, 0.85, 0.35, 0.7],
    [0.55, 0.5, 0.15, 0.85], [0.7, 0.65, 0.6, 0.2],
  ];
  for (let i = 0; i < count; i++) {
    const arch = archetypes[i % archetypes.length];
    const vec = arch.map((v) => Math.min(1, Math.max(0, v + (rnd() - 0.5) * 0.55)));
    const man = i % 2 === 0;
    // random point in a ball
    let x = 0, y = 0, z = 0;
    do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; }
    while (x * x + y * y + z * z > 1);
    nodes.push({
      x: x * R, y: y * R, z: z * R, vx: 0, vy: 0, vz: 0,
      r: 3.4 + rnd() * 2.6, vec,
      name: man ? MEN[(i / 2) % MEN.length | 0] : WOMEN[(i / 2) % WOMEN.length | 0],
      man, you: false, px: 0, py: 0, ps: 1, pz: 0,
    });
  }
  // "Ty" — a man matched to the women around him
  nodes[0] = {
    ...nodes[0], r: 8, vec: [0.8, 0.35, 0.7, 0.4], name: "Ty",
    man: true, you: true, x: 0, y: 0, z: R * 0.35,
  };

  // edges: each node → top-2 most similar of the OPPOSITE gender
  const edges: E[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    const sims = nodes
      .map((n, j) => ({ j, s: n.man === nodes[i].man ? -1 : similarity(nodes[i].vec, n.vec) }))
      .sort((p, q) => q.s - p.s)
      .slice(0, 2);
    for (const { j, s } of sims) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key) && s > 0.5) {
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
      // soft ball containment
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
  // recenter so rotation spins around the cloud's centroid
  const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
  const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
  const cz = nodes.reduce((s, n) => s + n.z, 0) / nodes.length;
  for (const n of nodes) { n.x -= cx; n.y -= cy; n.z -= cz; }

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
    let W = 0, H = 0, dpr = 1, R = 0;
    let nodes: N[] = [], edges: E[] = [];
    let hover = -1;
    let running = true, raf = 0;
    let yaw = 0.4, pitch = 0.15;
    let dragging = false, lastX = 0, lastY = 0, spin = 0.0022;

    const simOf = new Map<number, number>();

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      if (rect.width < 50) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      R = Math.min(W, H) * 0.4;
      if (!nodes.length) {
        ({ nodes, edges } = build(R));
        for (let i = 1; i < nodes.length; i++)
          simOf.set(i, similarity(nodes[0].vec, nodes[i].vec));
      }
    };

    const project = () => {
      const sy = Math.sin(yaw), cy2 = Math.cos(yaw);
      const sp = Math.sin(pitch), cp = Math.cos(pitch);
      const f = R * 2.6; // focal length
      for (const n of nodes) {
        // rotate around Y, then X
        const x1 = n.x * cy2 + n.z * sy;
        const z1 = -n.x * sy + n.z * cy2;
        const y2 = n.y * cp - z1 * sp;
        const z2 = n.y * sp + z1 * cp;
        const s = f / (f + z2 + R * 1.2); // perspective
        n.px = W / 2 + x1 * s;
        n.py = H / 2 + y2 * s;
        n.ps = s;
        n.pz = z2;
      }
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

      // edges (behind nodes)
      for (const e of edges) {
        const a = nodes[e.a], b = nodes[e.b];
        const depth = Math.min(a.ps, b.ps); // 0..~1.6
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

      // nodes, painter's order (far → near)
      const order = nodes.map((_, i) => i).sort((i, j) => nodes[j].pz - nodes[i].pz);
      for (const i of order) {
        const n = nodes[i];
        const active = i === hover || linked.has(i);
        const dim = hover >= 0 && !active && !n.you;
        const depthAlpha = 0.25 + Math.max(0, Math.min(1, (n.ps - 0.55) * 1.6)) * 0.75;
        ctx!.globalAlpha = dim ? depthAlpha * 0.35 : depthAlpha;
        const rad = Math.max(1.2, n.r * n.ps);
        ctx!.beginPath();
        ctx!.arc(n.px, n.py, rad, 0, Math.PI * 2);
        ctx!.fillStyle = n.man ? MAN_COLOR : WOMAN_COLOR;
        ctx!.fill();
        if (n.you) {
          ctx!.strokeStyle = "rgba(232,155,60,0.45)";
          ctx!.lineWidth = 5 * n.ps;
          ctx!.beginPath();
          ctx!.arc(n.px, n.py, rad + 5 * n.ps, 0, Math.PI * 2);
          ctx!.stroke();
          ctx!.globalAlpha = 1;
          ctx!.fillStyle = INK;
          ctx!.font = `600 ${Math.max(11, 13 * n.ps)}px var(--font-dm-sans, sans-serif)`;
          ctx!.textAlign = "center";
          ctx!.fillText("Ty", n.px, n.py - rad - 8 * n.ps);
        }
        ctx!.globalAlpha = 1;
      }

      // hover label — match % only across genders
      if (hover > 0) {
        const n = nodes[hover];
        const cross = n.man !== nodes[0].man;
        const pct = Math.round((simOf.get(hover) || 0) * 100);
        const label = cross ? `${n.name} · ${pct}% dopasowania` : n.name;
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
        if (!reduced && !dragging && hover < 0) yaw += spin;
        draw();
      }
      raf = requestAnimationFrame(loop);
    };

    const pick = (mx: number, my: number) => {
      let best = -1, bd = 300; // ~17px radius, prefer nearer nodes
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
    const onMove = (ev: PointerEvent) => {
      const { mx, my } = pos(ev);
      if (dragging) {
        yaw += (mx - lastX) * 0.005;
        pitch += (my - lastY) * 0.003;
        pitch = Math.max(-0.9, Math.min(0.9, pitch));
        lastX = mx; lastY = my;
        return;
      }
      hover = pick(mx, my);
      canvas.style.cursor = hover >= 0 ? "pointer" : "grab";
    };
    const onDown = (ev: PointerEvent) => {
      const { mx, my } = pos(ev);
      dragging = true; lastX = mx; lastY = my;
      canvas.setPointerCapture(ev.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const onUp = (ev: PointerEvent) => {
      dragging = false;
      canvas.releasePointerCapture(ev.pointerId);
      canvas.style.cursor = hover >= 0 ? "pointer" : "grab";
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
      <canvas ref={canvasRef} aria-label="Trójwymiarowa mapa dopasowań — fioletowe punkty to mężczyźni, bursztynowe to kobiety, bliskość oznacza zgodność wartości" />
      <div className="vg-legend">
        <span><i style={{ background: WOMAN_COLOR }} /> kobiety</span>
        <span><i style={{ background: MAN_COLOR }} /> mężczyźni</span>
      </div>
    </div>
  );
}
