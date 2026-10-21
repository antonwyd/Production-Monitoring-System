// Google Sheet palsu di memori untuk tes: meniru values.get/update/append dengan USER_ENTERED.
import type { Cell, Grid, SheetsIO } from "@/lib/sheets/client";

const colNum = (letters: string) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

function parse(range: string) {
  const m = /^'(.+)'!([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/.exec(range);
  if (!m) throw new Error(`range tidak dikenal: ${range}`);
  return { title: m[1], c0: colNum(m[2]) - 1, r0: m[3] ? Number(m[3]) - 1 : 0, c1: colNum(m[4] ?? m[2]) - 1, r1: m[5] ? Number(m[5]) - 1 : Infinity };
}

const serial = (y: number, mo: number, d: number, hh = 0, mi = 0, ss = 0) => Date.UTC(y, mo - 1, d, hh, mi, ss) / 86400000 + 25569;

function userEntered(v: Cell): Cell {
  if (typeof v !== "string") return v;
  if (v.startsWith("'")) return v.slice(1);
  let m = /^=DATE\((\d+),(\d+),(\d+)\)$/.exec(v);
  if (m) return serial(+m[1], +m[2], +m[3]);
  m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?$/.exec(v);
  if (m) return serial(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  if (v !== "" && !Number.isNaN(Number(v))) return Number(v);
  return v;
}

export class FakeSheet implements SheetsIO {
  data: Record<string, Grid> = {};
  rows: Record<string, number> = {};
  grown: string[] = [];

  sheet(title: string, rows = 1000) {
    this.data[title] ??= [];
    this.rows[title] ??= rows;
    return this.data[title];
  }

  setCell(title: string, r: number, c: number, v: Cell) {
    const g = this.sheet(title);
    while (g.length <= r) g.push([]);
    while (g[r].length <= c) g[r].push("");
    g[r][c] = v;
  }

  async get(ranges: string[], render: "FORMATTED_VALUE" | "UNFORMATTED_VALUE") {
    return ranges.map((range) => {
      const { title, c0, r0, c1, r1 } = parse(range);
      const g = this.sheet(title);
      const out: Grid = [];
      for (let r = r0; r < Math.min(g.length, r1 + 1); r++) {
        const row = (g[r] ?? []).slice(c0, c1 + 1).map((v) => (render === "FORMATTED_VALUE" && typeof v === "number" ? String(v) : v));
        while (row.length && (row[row.length - 1] === "" || row[row.length - 1] === undefined)) row.pop();
        out.push(row);
      }
      while (out.length && !out[out.length - 1].length) out.pop();
      return out;
    });
  }

  async update(data: { range: string; values: Cell[][] }[]) {
    for (const { range, values } of data) {
      const { title, c0, r0 } = parse(range);
      if (r0 + values.length > this.rows[title]) throw new Error(`tulis di luar grid ${title}`);
      values.forEach((row, i) => row.forEach((v, j) => this.setCell(title, r0 + i, c0 + j, userEntered(v))));
    }
  }

  async append(range: string, values: Cell[][]) {
    const { title, c0 } = parse(range);
    const g = this.sheet(title);
    let last = g.length - 1;
    while (last >= 0 && !(g[last] ?? []).some((v) => v !== "")) last--;
    this.rows[title] = Math.max(this.rows[title], last + 1 + values.length);
    values.forEach((row, i) => row.forEach((v, j) => this.setCell(title, last + 1 + i, c0 + j, userEntered(v))));
  }

  async rowCounts() {
    return Object.fromEntries(Object.keys(this.data).map((t, i) => [t, { sheetId: i, rows: this.rows[t] }]));
  }

  async growSheet(title: string, count: number) {
    this.grown.push(title);
    this.rows[title] += count;
  }
}
