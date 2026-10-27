// Master Data untuk Dashboard & Report, dengan id tetap yang dibuat dari nama.
import { callBackend, type RawMaster } from "./backend";
import { catId, ltId, mcId, memberId, ngGroupId, partId } from "./ids";
import type { MasterData } from "./types";

export class ValidationError extends Error {
  constructor(public errors: string[]) {
    super(errors.join(" "));
  }
}

// ---------- Master ----------

let masterCache: { at: number; data: MasterData } | null = null;
const MASTER_TTL = 60_000;

export function invalidateMaster() {
  masterCache = null;
}

export function masterFromRaw(raw: RawMaster): MasterData {
  const groups = new Map<string, string[]>();
  for (const c of raw.categories) if (c.ngGroup && !groups.has(c.ngGroup)) groups.set(c.ngGroup, c.ng);
  return {
    categories: raw.categories.map((c) => ({
      id: catId(c.name),
      name: c.name,
      process: c.process,
      area: c.process,
      ngGroupId: c.ngGroup ? ngGroupId(c.ngGroup) : null,
    })),
    parts: raw.parts.map((p) => ({ id: partId(p.category, p.name, p.type), categoryId: catId(p.category), name: p.name, type: p.type, stki: p.stki })),
    machines: raw.machines.map((m) => ({
      id: mcId(m.category, m.mc),
      categoryId: catId(m.category),
      mcNo: m.mc,
      line: m.line,
      mainPart: m.main,
      canSwitchTo: m.alt.replace(/[;\n]/g, ","),
    })),
    lostTimeTypes: raw.lostTypes.map((t) => ({ id: ltId(t.name), name: t.name, group: /another/i.test(t.group) ? "ANOTHER_JOB" : "LOST_TIME" })),
    members: raw.members.map((m) => ({ id: memberId(m.name), nik: m.nik, name: m.name, area: m.section?.trim() || "QA" })),
    ngGroups: [...groups.entries()].map(([name, codes]) => ({
      id: ngGroupId(name),
      name,
      codes: Array.from({ length: 10 }, (_, i) => codes[i] || `NG${i + 1}`),
    })),
    settings: { ...raw.settings, ngPpmMax: raw.settings.ngPpmMax ?? 1000, utilTarget: raw.settings.utilTarget ?? 85, mcHrsDay: raw.settings.mcHrsDay ?? raw.settings.normalMin / 60, stkiHighPct: 150, stkiLowPct: 30 },
  };
}

export async function loadMaster(opts: { fresh?: boolean } = {}): Promise<MasterData> {
  if (!opts.fresh && masterCache && Date.now() - masterCache.at < MASTER_TTL) return masterCache.data;
  const data = masterFromRaw(await callBackend<RawMaster>("master"));
  masterCache = { at: Date.now(), data };
  return data;
}
