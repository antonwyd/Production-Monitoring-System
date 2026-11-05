import { it, expect } from "vitest";
import { setSheetsIO, getAntrian, LEADER_SESSION } from "../src/lib/sheets/qa";
import { FakeSheet } from "./fakeSheet";
it("ditolak tanpa kiriman ulang tampil di tab Menunggu", async () => {
  const sh = new FakeSheet();
  const row = (r: number, id: string, member: string, st: string, dec: string, note = "") => {
    [id, "2026-11-05 10:00:00", "2026-11-05", member, 1, 1, 0, st, "Dian", dec, note, JSON.stringify({ items: [] })].forEach((v, c) => sh.setCell("Antrian Validasi", r, c, v as never));
  };
  row(1, "A1", "Ani", "Ditolak", "2026-11-05 11:00:00", "qty salah");
  row(2, "B1", "Budi", "Ditolak", "2026-11-05 11:00:00");
  row(3, "B2", "Budi", "Menunggu", "");
  setSheetsIO(sh);
  const r = await getAntrian("Dian", LEADER_SESSION, "Menunggu", "2026-11-05");
  expect(r.belumUlang.map((x) => x.member)).toEqual(["Ani"]);
  expect(r.counts.Menunggu).toBe(2);
});
