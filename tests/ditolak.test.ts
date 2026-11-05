import { it, expect } from "vitest";
import { setSheetsIO, getAntrian, ditolakBelumUlang, menungguTelat, LEADER_SESSION } from "../src/lib/sheets/qa";
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
it("ditolak di tanggal lain muncul di tolakOther dan ditolakBelumUlang", async () => {
  const sh = new FakeSheet();
  const row = (r: number, id: string, date: string, member: string, st: string, dec: string, note = "") => {
    [id, date + " 10:00:00", date, member, 1, 1, 0, st, "Dian", dec, note, JSON.stringify({ items: [] })].forEach((v, c) => sh.setCell("Antrian Validasi", r, c, v as never));
  };
  row(1, "S1", "2026-11-04", "Suryaningsih", "Ditolak", "2026-11-04 20:08:00", "oiban belum");
  row(2, "S2", "2026-11-05", "Suryaningsih", "Menunggu", "");
  row(3, "C1", "2026-11-03", "Cici", "Ditolak", "2026-11-03 20:00:00");
  row(4, "C2", "2026-11-03", "Cici", "Disetujui", "2026-11-03 21:00:00");
  setSheetsIO(sh);
  const r = await getAntrian("Dian", LEADER_SESSION, "Menunggu", "2026-11-05");
  expect(r.tolakOther).toEqual([{ date: "2026-11-04", count: 1 }]);
  expect(r.belumUlang).toEqual([]);
  const t = await ditolakBelumUlang("2026-10-29");
  expect(t.map((x) => [x.member, x.date, x.note])).toEqual([["Suryaningsih", "2026-11-04", "oiban belum"]]);
});
it("kiriman Menunggu tanggal sebelumnya ikut di tab Menunggu (paling atas)", async () => {
  const sh = new FakeSheet();
  const row = (r: number, id: string, sent: string, date: string, member: string, st: string) => {
    [id, sent, date, member, 1, 1, 0, st, "", "", "", JSON.stringify({ items: [] })].forEach((v, c) => sh.setCell("Antrian Validasi", r, c, v as never));
  };
  row(1, "T1", "2026-11-04 20:18:42", "2026-11-03", "Tiyana", "Menunggu");
  row(2, "N1", "2026-11-05 19:18:41", "2026-11-05", "Nova", "Menunggu");
  row(3, "F1", "2026-11-05 19:00:00", "2026-11-06", "Fajar", "Menunggu");
  setSheetsIO(sh);
  const r = await getAntrian("Dian", LEADER_SESSION, "Menunggu", "2026-11-05");
  expect(r.list.map((x) => x.id)).toEqual(["T1", "N1"]);
  expect(r.counts.Menunggu).toBe(2);
  expect(r.waitOther).toEqual([{ date: "2026-11-06", count: 1 }]);
  expect((await menungguTelat("2026-11-05")).map((x) => x.member)).toEqual(["Tiyana"]);
});
