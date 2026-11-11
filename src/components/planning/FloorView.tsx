"use client";
// Tampilan lantai: animasi susunan orang & mesin sesuai rencana pada jam tertentu.
// PF: mesin per MC (part dari rencana), operator berjalan antar MC miliknya. Seiretsu/Senbetsu: duduk merakit,
// sesekali ke rak ambil box. Hanya ilustrasi; angka kapasitas tetap dari mesin hitung (lib/planning).
import { useEffect, useMemo, useRef, useState } from "react";
import { dayEnd, mcKey, spans, START, toClock, type PlanState, type PMaster } from "@/lib/planning";

type Area = {
  id: string;
  mc: boolean;
  machines: { id: string; part: string; owner: number }[];
  people: { name: string; part: string; mcs: string[] }[];
};

const W = 1000;
const HUES = [352, 210, 150, 32, 280, 190, 330, 90, 15, 240, 170, 55, 300, 120, 200, 5, 260, 140, 45, 225];
const RUN = 14,
  SERVE = 2.2,
  SPEED = 95;
const C = {
  ok: "#059669",
  warn: "#d97706",
  bad: "#dc2626",
  fg: "#0f172a",
  mut: "#64748b",
  line: "#cbd5e1",
  card: "#ffffff",
  floor: "#eef0f4",
  aisle: "#e0e4ec",
  sei: "#5aaeff",
  sen: "#a78bfa",
};
const short = (n: string) => {
  const p = n.split(" ")[0];
  return p.length > 11 ? p.slice(0, 10) + "." : p;
};

export function buildAreas(m: PMaster, st: PlanState, at: number): Area[] {
  const end = dayEnd(m, st.ot);
  const label = (id?: string) => m.parts.find((p) => p.id === id)?.label ?? "";
  return m.cats.map((c) => {
    const people: Area["people"] = [];
    for (const p of st.people) {
      if (p.absent) continue;
      const s = spans(p, end).find((x) => x.cat === c.name && x.at <= at && at < x.to);
      if (!s) continue;
      people.push({
        name: p.name,
        part: c.mc ? label(st.machines[mcKey(c.name, s.mcs?.[0] ?? "")]) : label(s.part),
        mcs: s.mcs ?? [],
      });
    }
    const machines = m.machines
      .filter((x) => x.category === c.name)
      .map((x) => ({
        id: x.mc,
        part: label(st.machines[mcKey(c.name, x.mc)]),
        owner: people.findIndex((p) => p.mcs.includes(x.mc)),
      }));
    return { id: c.name, mc: c.mc, machines, people };
  });
}

export default function FloorView({ m, st, initialAt }: { m: PMaster; st: PlanState; initialAt: number }) {
  const end = dayEnd(m, st.ot);
  const [at, setAt] = useState(Math.min(end - 1, Math.max(START, initialAt)));
  const areas = useMemo(() => buildAreas(m, st, at), [m, st, at]);
  const [cur, setCur] = useState(() =>
    Math.max(
      0,
      areas.findIndex((a) => a.people.length),
    ),
  );
  const [speed, setSpeed] = useState(1);
  const cv = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const area = areas[cur] ?? areas[0];
  const times: number[] = [];
  for (let t = START; t < end; t += 30) if (t < 12 * 60 || t >= 13 * 60) times.push(t);

  useEffect(() => {
    const canvas = cv.current;
    if (!canvas || !area) return;
    const ctx = canvas.getContext("2d")!;
    let H = 300;
    let tSim = 0;
    type Mc = {
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
      aisle: number;
      front: number;
      stop: boolean;
      left: number;
      owner: number;
      part: string;
      spin: number;
    };
    type Pp = {
      name: string;
      part: string;
      hue: number;
      x: number;
      y: number;
      sx: number;
      sy: number;
      phase: number;
      mine: Mc[];
      path: { x: number; y: number }[];
      target: Mc | null;
      serving: number;
      state: string;
      t: number;
      pcs: number;
    };
    let M: Mc[] = [];
    let P: Pp[] = [];
    const R = { x: W - 110, y: 60, w: 80, h: 0 };

    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
    const tag = (x: number, y: number, l1: string, l2: string, hue: number) => {
      ctx.font = "700 10.5px Inter,system-ui";
      const w1 = ctx.measureText(l1).width;
      ctx.font = "600 10px Inter,system-ui";
      const w2 = ctx.measureText(l2).width;
      const w = Math.max(w1, w2) + 12,
        h = l2 ? 28 : 16;
      ctx.fillStyle = C.card;
      rr(x - w / 2, y - h, w, h, 5);
      ctx.fill();
      ctx.strokeStyle = `hsl(${hue},60%,45%)`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = C.fg;
      ctx.font = "700 10.5px Inter,system-ui";
      ctx.fillText(l1, x - w1 / 2, y - h + 12);
      if (l2) {
        ctx.fillStyle = `hsl(${hue},60%,40%)`;
        ctx.font = "600 10px Inter,system-ui";
        ctx.fillText(l2, x - w2 / 2, y - h + 24);
      }
    };
    const person = (x: number, y: number, hue: number, walk: boolean, phase: number, arms: boolean) => {
      const bob = walk ? Math.sin(phase) * 3 : 0;
      ctx.fillStyle = "rgba(0,0,0,.15)";
      ctx.beginPath();
      ctx.ellipse(x, y + 13, 9, 3, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = `hsl(${hue},55%,32%)`;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - 3, y + 3);
      ctx.lineTo(x - 3 - bob, y + 12);
      ctx.moveTo(x + 3, y + 3);
      ctx.lineTo(x + 3 + bob, y + 12);
      ctx.stroke();
      ctx.fillStyle = `hsl(${hue},70%,48%)`;
      rr(x - 7, y - 9, 14, 14, 5);
      ctx.fill();
      if (arms) {
        ctx.strokeStyle = `hsl(${hue},70%,40%)`;
        ctx.beginPath();
        ctx.moveTo(x + 6, y - 4);
        ctx.lineTo(x + 12, y - 10 + Math.sin(tSim * 14) * 3);
        ctx.stroke();
      }
      ctx.fillStyle = "#f1c9a5";
      ctx.beginPath();
      ctx.arc(x, y - 14, 6, 0, 7);
      ctx.fill();
      ctx.fillStyle = `hsl(${hue},50%,25%)`;
      ctx.beginPath();
      ctx.arc(x, y - 16, 6, Math.PI, 0);
      ctx.fill();
    };

    if (area.mc) {
      const per = 10,
        rows = Math.ceil(area.machines.length / per),
        mw = 84,
        gap = (W - 90 - mw) / (per - 1);
      let y0 = [40, 168, 300, 428],
        aisles = [128, 128, 400, 400];
      if (rows === 1) {
        y0 = [40];
        aisles = [128];
      }
      H = rows > 2 ? 500 : rows > 1 ? 260 : 200;
      M = area.machines.map((mc, i) => {
        const r = Math.floor(i / per),
          c = i % per,
          y = y0[r] ?? 40,
          face = r % 2 === 0 ? 1 : -1;
        return {
          id: mc.id,
          x: 45 + gap * c,
          y,
          w: mw,
          h: 56,
          aisle: aisles[r] ?? 128,
          front: face > 0 ? y + 56 : y,
          stop: false,
          left: Math.random() * RUN,
          owner: mc.owner,
          part: mc.part,
          spin: Math.random() * 6,
        };
      });
      P = area.people.map((p, i) => {
        const mine = M.filter((x) => x.owner === i);
        const s = mine[0] ?? M[0];
        return {
          name: short(p.name),
          part: p.part,
          hue: HUES[i % 20],
          x: s.x + s.w / 2,
          y: s.aisle,
          sx: 0,
          sy: 0,
          phase: Math.random() * 6,
          mine,
          path: [],
          target: null,
          serving: 0,
          state: "",
          t: 0,
          pcs: 0,
        };
      });
    } else {
      const n = area.people.length,
        per = Math.min(5, Math.max(2, n)),
        rows = Math.ceil(n / per);
      H = Math.max(260, 90 + rows * 150);
      const sw = (W - 220) / per;
      P = area.people.map((p, i) => {
        const r = Math.floor(i / per),
          c = i % per,
          sx = 60 + sw * c + sw / 2,
          sy = 120 + r * 150;
        return {
          name: short(p.name),
          part: p.part,
          hue: HUES[i % 20],
          x: sx,
          y: sy,
          sx,
          sy,
          phase: 0,
          mine: [],
          path: [],
          target: null,
          serving: 0,
          state: "work",
          t: 4 + Math.random() * 40,
          pcs: Math.floor(Math.random() * 900),
        };
      });
      R.h = H - 120;
    }

    const route = (p: Pp, mc: Mc) => {
      const tx = mc.x + mc.w / 2,
        ty = mc.aisle,
        path: { x: number; y: number }[] = [];
      if (Math.abs(p.y - ty) > 4) {
        const side = (p.x + tx) / 2 < W / 2 ? 18 : W - 18;
        path.push({ x: side, y: p.y }, { x: side, y: ty });
      }
      path.push({ x: tx, y: ty });
      return path;
    };
    const walk = (p: Pp, dt: number) => {
      const w = p.path[0];
      const dx = w.x - p.x,
        dy = w.y - p.y,
        d = Math.hypot(dx, dy),
        s = SPEED * dt;
      if (d <= s) {
        p.x = w.x;
        p.y = w.y;
        p.path.shift();
      } else {
        p.x += (dx / d) * s;
        p.y += (dy / d) * s;
        p.phase += dt * 10;
      }
    };
    const step = (dt: number) => {
      tSim += dt;
      if (area.mc) {
        M.forEach((x) => {
          if (x.owner >= 0 && !x.stop && x.left > 0) {
            x.left -= dt;
            x.spin += dt * 8;
          }
        });
        P.forEach((p) => {
          if (p.serving > 0) {
            p.serving -= dt;
            if (p.serving <= 0 && p.target) {
              p.target.left = RUN;
              p.target = null;
            }
            return;
          }
          if (!p.target) {
            const c = p.mine.filter((x) => !x.stop).sort((a, b) => a.left - b.left);
            if (!c.length) return;
            p.target = c[0];
            p.path = route(p, c[0]);
          }
          if (!p.path.length) {
            p.serving = SERVE;
            return;
          }
          walk(p, dt);
        });
      } else {
        P.forEach((p) => {
          if (p.state === "work") {
            p.t -= dt;
            p.pcs += dt * (18 + (p.hue % 7));
            if (p.t <= 0) {
              p.state = "go";
              p.path = [
                { x: p.x, y: p.sy + 42 },
                { x: R.x - 14, y: p.sy + 42 },
                {
                  x: R.x - 14,
                  y: Math.min(R.y + R.h - 10, Math.max(R.y + 10, p.sy)),
                },
              ];
            }
          } else if (p.state === "pick") {
            p.t -= dt;
            if (p.t <= 0) {
              p.state = "back";
              p.path = [
                { x: R.x - 14, y: p.sy + 42 },
                { x: p.sx, y: p.sy + 42 },
                { x: p.sx, y: p.sy },
              ];
            }
          } else if (!p.path.length) {
            if (p.state === "go") {
              p.state = "pick";
              p.t = 1.5;
            } else {
              p.state = "work";
              p.t = 30 + Math.random() * 25;
            }
          } else walk(p, dt);
        });
      }
    };
    const draw = () => {
      const dpr = window.devicePixelRatio || 1,
        cw = canvas.clientWidth || W,
        sc = cw / W;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(H * sc * dpr)) {
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(H * sc * dpr);
        canvas.style.height = `${H * sc}px`;
      }
      ctx.setTransform(dpr * sc, 0, 0, dpr * sc, 0, 0);
      ctx.fillStyle = C.floor;
      ctx.fillRect(0, 0, W, H);
      if (area.mc) {
        ctx.fillStyle = C.aisle;
        const ys = new Set(M.map((x) => x.aisle));
        ys.forEach((y) => ctx.fillRect(0, y - 16, W, 32));
        if (ys.size > 1) {
          ctx.fillRect(0, 112, 30, 304);
          ctx.fillRect(W - 30, 112, 30, 304);
        }
        M.forEach((x) => {
          const off = x.owner < 0,
            col = x.stop ? C.bad : off ? C.line : x.left > 0 ? C.ok : C.warn;
          ctx.globalAlpha = off ? 0.55 : 1;
          ctx.fillStyle = C.card;
          rr(x.x, x.y, x.w, x.h, 8);
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = col;
          ctx.stroke();
          const cx = x.x + 18,
            cy = x.y + x.h / 2;
          ctx.strokeStyle = C.line;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(cx, cy, 10, 0, 7);
          ctx.stroke();
          if (!off) {
            ctx.strokeStyle = col;
            ctx.beginPath();
            const a = x.left > 0 ? x.spin : 0;
            ctx.arc(cx, cy, 10, a, a + (x.left > 0 ? Math.max(0.3, (x.left / RUN) * 6.28) : 0.001));
            ctx.stroke();
          }
          ctx.fillStyle = C.fg;
          ctx.font = "700 11.5px Inter,system-ui";
          ctx.fillText(x.id, x.x + 32, x.y + 17);
          ctx.font = "600 9.5px Inter,system-ui";
          ctx.fillStyle = off ? C.mut : col;
          ctx.fillText(off ? "KOSONG" : x.left > 0 ? "JALAN" : "TUNGGU", x.x + 32, x.y + 31);
          if (x.part) {
            ctx.fillStyle = C.mut;
            ctx.fillText(x.part, x.x + 32, x.y + 45);
          }
          ctx.globalAlpha = 1;
        });
        [...P]
          .sort((a, b) => a.y - b.y)
          .forEach((p) => {
            person(p.x, p.y, p.hue, p.path.length > 0 && p.serving <= 0, p.phase, p.serving > 0);
            ctx.font = "600 10px Inter,system-ui";
            const tw = ctx.measureText(p.name).width;
            ctx.fillStyle = C.card;
            rr(p.x - tw / 2 - 4, p.y + 16, tw + 8, 14, 4);
            ctx.fill();
            ctx.fillStyle = C.fg;
            ctx.fillText(p.name, p.x - tw / 2, p.y + 27);
          });
      } else {
        const col = /seiretsu/i.test(area.id) ? C.sei : C.sen;
        ctx.fillStyle = C.aisle;
        rr(R.x, R.y, R.w, R.h, 8);
        ctx.fill();
        for (let y = R.y + 16; y < R.y + R.h - 10; y += 34) {
          ctx.fillStyle = col;
          ctx.globalAlpha = 0.35;
          ctx.fillRect(R.x + 10, y, R.w - 20, 18);
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = C.mut;
        ctx.font = "700 11px Inter,system-ui";
        ctx.fillText("RAK PART", R.x + 12, R.y - 8);
        P.forEach((p) => {
          ctx.fillStyle = C.card;
          rr(p.sx - 48, p.sy + 4, 96, 26, 6);
          ctx.fill();
          ctx.strokeStyle = C.line;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = col;
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.arc(p.sx - 38 + k * 8, p.sy + 17, 3, 0, 7);
            ctx.fill();
          }
        });
        [...P]
          .sort((a, b) => a.y - b.y)
          .forEach((p) => {
            if (p.state === "work") {
              ctx.fillStyle = C.line;
              rr(p.sx - 10, p.sy - 30, 20, 8, 3);
              ctx.fill();
              person(p.x, p.y - 14, p.hue, false, 0, true);
            } else person(p.x, p.y, p.hue, p.state === "go" || p.state === "back", p.phase, p.state === "pick");
            tag(p.x, (p.state === "work" ? p.y - 14 : p.y) - 26, p.name, p.state === "work" ? p.part : p.state === "pick" ? "ambil box" : "jalan", p.hue);
          });
        if (!P.length) {
          ctx.fillStyle = C.mut;
          ctx.font = "600 14px Inter,system-ui";
          ctx.fillText("Tidak ada orang di bagian ini pada jam ini.", 40, H / 2);
        }
      }
    };
    for (let i = 0; i < 300; i++) step(1 / 30);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      for (let i = 0; i < speedRef.current; i++) step(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };
    draw();
    if (!reduce) raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [area]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          Jam
          <select className="input h-9 w-auto py-1" value={at} onChange={(e) => setAt(Number(e.target.value))}>
            {times.map((t) => (
              <option key={t} value={t}>
                {toClock(t)}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-secondary h-9 px-3 text-sm" onClick={() => setSpeed(speed === 1 ? 3 : speed === 3 ? 6 : 1)}>
          Kecepatan {speed}x
        </button>
        <span className="text-xs text-slate-500">Ganti jam untuk melihat siapa mengerjakan apa.</span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist">
        {areas.map((a, i) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={i === cur}
            onClick={() => setCur(i)}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-left text-sm font-semibold ${i === cur ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white"}`}
          >
            {a.id}
            <small className="block text-[11px] font-medium text-slate-500">
              {a.people.length} orang
              {a.mc ? ` · ${a.machines.filter((x) => x.owner >= 0).length}/${a.machines.length} MC` : ""}
            </small>
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <canvas ref={cv} className="block w-full" aria-label={`Animasi lantai ${area?.id ?? ""} jam ${toClock(at)}`} />
      </div>
      {area?.mc && (
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />
            Jalan
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-600" />
            Menunggu operator
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-slate-300" />
            Tanpa operator (tidak jalan)
          </span>
        </div>
      )}
    </div>
  );
}
