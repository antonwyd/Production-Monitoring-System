import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { openRejections, setTransport, type RawSubmission } from "@/lib/backend";
import { buildReport, clearReportCache, loadFacts } from "@/lib/reports";
import { invalidateMaster, loadMaster } from "@/lib/service";
import * as qa from "@/lib/sheets/qa";
import { FakeSheet } from "./fakeSheet";

const DATE = "2026-10-20";
let fs: FakeSheet;

// Riwayat member hanya 7 hari terakhir, jadi "hari ini" dikunci sehari setelah DATE.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-21T03:00:00Z"));
});
afterAll(() => vi.useRealTimers());

/** Isi Google Sheet palsu dengan tata letak yang sama seperti sheet asli. */
function seed() {
  fs = new FakeSheet();
  const set = (t: string, r: number, c: number, v: string | number) => fs.setCell(t, r - 1, c, v);
  const M = "Master Data";
  // Baris 6 = judul tabel. Kolom: B NIK, C nama, D status | G..K part | P,Q kategori + lost time | S,T setting
  const head: Record<number, string> = { 1: "NIK", 2: "Member Name", 3: "Status", 6: "Category", 8: "Part Name", 9: "Type", 10: "STKI (pcs/hr)", 15: "Category", 16: "Process", 18: "Parameter", 19: "Value", 39: "No", 40: "Category", 41: "MC No", 42: "Line", 43: "Part utama", 44: "Bisa ganti ke", 45: "Status", 51: "Code", 52: "NG Group", 53: "NG Type", 55: "Category", 56: "NG Group", 60: "Std Category", 61: "Std Part", 62: "Std Type", 63: "Std MC (pcs/hr per MC)", 64: "Std Key" };
  Object.entries(head).forEach(([c, v]) => set(M, 6, +c, v));
  [["201003", "Harjuki", "Active"], ["201004", "Suharyanto", "Active"], ["201005", "Keluar", "Inactive"]].forEach((m, i) => m.forEach((v, j) => set(M, 7 + i, 1 + j, v)));
  [["PF Iron Cage", "Bowl PF", "6902-J", "D1", 1100], ["PF Iron Cage", "Bowl PF", "627-J", "D1", 2000], ["Seiretsu Iron Cage", "Seiretsu", "608JCL-1-J", "D1", 6656]].forEach((p, i) =>
    p.forEach((v, j) => set(M, 7 + i, 6 + j, v)),
  );
  [["PF Iron Cage", "Bowl PF"], ["Seiretsu Iron Cage", "Seiretsu"], ["", ""], ["⏱️ LOST TIME TYPES", ""], ["Lost Time Type", ""], ["5S", "Another Job"], ["Ganti Pole", "Lost Time"]].forEach((x, i) => x.forEach((v, j) => set(M, 7 + i, 15 + j, v)));
  [["Normal working time / day (min)", 480], ["OT limit / member / day (hrs)", 4], ["Achievement target", 1], ["Grade A  (≥)", 1], ["Grade B  (≥)", 0.9], ["Grade C  (≥)", 0.8]].forEach((x, i) => x.forEach((v, j) => set(M, 7 + i, 18 + j, v)));
  [[1, "PF Iron Cage", "MC 01", "EXPO", "6902-J D1", "627-J D1", "Active"], [2, "PF Iron Cage", "MC 02", "EXPO", "627-J D1", "", "Inactive"], [3, "PF Iron Cage", "MC 03", "EXPO", "627-J D1", "", "Active"]].forEach((x, i) => x.forEach((v, j) => set(M, 7 + i, 39 + j, v)));
  [[1, "Iron Cage", "Part Tercampur"], [2, "Iron Cage", "Kizu"], [3, "Iron Cage", "Lain-Lain"]].forEach((x, i) => x.forEach((v, j) => set(M, 7 + i, 51 + j, v)));
  [["PF Iron Cage", "Iron Cage"], ["Seiretsu Iron Cage", "Iron Cage"]].forEach((x, i) => x.forEach((v, j) => set(M, 7 + i, 55 + j, v)));
  [["PF Iron Cage", "6902-J", "D1", 1000], ["PF Iron Cage", "627-J", "D1", ""]].forEach((x, i) => x.forEach((v, j) => set(M, 7 + i, 60 + j, v)));
  set("Leader", 1, 0, "Nama Leader");
  set("Leader", 2, 0, "Dian Kartika");
  set("Leader", 2, 1, "4139");
  ["NIK", "Nama", "Peran", "PIN", "Status"].forEach((v, j) => set("Users", 1, j, v));
  ["2016162", "Anton Wahyudi", "admin", "6162", "Aktif"].forEach((v, j) => set("Users", 2, j, v));
  ["201004", "Suharyanto", "operator", "1004", "Nonaktif"].forEach((v, j) => set("Users", 3, j, v));
  ["ID", "Waktu Kirim", "Tanggal", "Member", "Jumlah Part", "Total Qty", "Lost Time (menit)", "Status", "Leader", "Waktu Validasi", "Catatan Leader", "Data"].forEach((v, j) => set("Antrian Validasi", 1, j, v));
  fs.sheet("Input - Production", 7); // grid kecil: approve kedua harus menambah baris
  fs.sheet("Input - Lost Time", 1000);
  set("Input - Production", 6, 1, "Input Date");
  set("Input - Lost Time", 6, 1, "Input Date");
}

const payload = () => ({
  date: DATE,
  member: "Harjuki",
  items: [{ category: "PF Iron Cage", part: "6902-J", type: "D1", mc: "MC 01", normalQty: "7920", normalMin: "450", otQty: "", otMin: "", lot: "012300001", oiban: "509", ng: ["", "5", "3", "", "", "", "", "", "", ""] }],
  lostTimes: [{ type: "5S", minutes: "30", remarks: "pagi" }],
});

beforeEach(() => {
  seed();
  qa.setSheetsIO(fs);
  setTransport(null);
  invalidateMaster();
  clearReportCache();
});

describe("Master Data dari sheet", () => {
  it("dibaca sama seperti Code.gs", async () => {
    const m = await qa.getMasterData();
    expect(m.members).toEqual(["Harjuki", "Suharyanto"]);
    expect(m.lostTypes).toEqual(["5S", "Ganti Pole"]);
    expect(m.lostGroups["5S"]).toBe("Another Job");
    expect(m.leaders).toEqual(["Dian Kartika"]);
    expect(m.normalMin).toBe(480);
    const pf = m.categories.find((c) => c.name === "PF Iron Cage")!;
    expect(pf.parts.map((p) => p.name)).toEqual(["6902-J", "627-J"]);
    expect(pf.machines).toEqual(["MC 01", "MC 03"]); // MC 02 Inactive
    expect(pf.mcInfo!["MC 01"]).toEqual({ line: "EXPO", main: "6902-J D1", alt: "627-J D1" });
    expect(pf.ng).toEqual(["Part Tercampur", "Kizu", "Lain-Lain"]);
    const raw = await qa.apiMaster();
    expect(raw.parts.find((p) => p.name === "6902-J")!.stki).toBe(1100);
    expect(raw.settings).toMatchObject({ gradeB: 90, target: 100 });
  });
});

describe("form member → leader → report", () => {
  it("alur lengkap tersimpan di sheet dengan format v1", async () => {
    const r = await qa.submitReport(payload());
    expect(r.id).toMatch(/^QA\d{14}$/);
    const q = fs.data["Antrian Validasi"][1];
    expect(q.slice(3, 8)).toEqual(["Harjuki", 1, 7920, 30, "Menunggu"]);
    expect(JSON.parse(String(q[11])).items[0].lot).toBe("012300001");

    const cek = await qa.cekLaporan(DATE, "Harjuki");
    expect(cek).toMatchObject({ prod: 0, lt: 0, subs: [{ id: r.id, status: "Menunggu" }] });
    expect((await qa.riwayatMember("Harjuki")).map((x) => x.id)).toEqual([r.id]);

    await expect(qa.getAntrian("Dian Kartika", "0000", "Menunggu", "")).rejects.toThrow(/PIN salah/);
    const ant = await qa.getAntrian("Dian Kartika", "4139", "Menunggu", "");
    expect(ant.counts).toEqual({ Menunggu: 1, Disetujui: 0, Ditolak: 0 });
    expect(ant.list[0]).toMatchObject({ id: r.id, date: DATE, member: "Harjuki" });
    // Per tanggal: tanggal lain kosong, kiriman Menunggu tanggal ini dilaporkan di waitOther.
    const lain = await qa.getAntrian("Dian Kartika", "4139", "Menunggu", "2026-10-19");
    expect(lain.counts).toEqual({ Menunggu: 0, Disetujui: 0, Ditolak: 0 });
    expect(lain.list).toEqual([]);
    expect(lain.waitOther).toEqual([{ date: DATE, count: 1 }]);
    expect((await qa.getAntrian("Dian Kartika", "4139", "Menunggu", DATE)).waitOther).toEqual([]);

    // Leader mengedit qty; data asli tetap tersimpan.
    const edited = { ...payload(), items: [{ ...payload().items[0], normalQty: "7000" }] };
    await qa.editKiriman("Dian Kartika", "4139", r.id, edited);
    const rec = JSON.parse(String(fs.data["Antrian Validasi"][1][11]));
    expect(rec.items[0].normalQty).toBe("7000");
    expect(rec.original.items[0].normalQty).toBe("7920");
    expect(fs.data["Antrian Validasi"][1][10]).toBe("Diedit oleh Dian Kartika");

    // Leader membetulkan tanggal yang salah pilih; tanggal masa depan ditolak.
    await expect(qa.editKiriman("Dian Kartika", "4139", r.id, { ...edited, date: "2026-10-25" })).rejects.toThrow(/Tanggal/);
    await qa.editKiriman("Dian Kartika", "4139", r.id, { ...edited, date: "2026-10-19" });
    expect(fs.data["Antrian Validasi"][1][10]).toBe("Diedit oleh Dian Kartika (tanggal 2026-10-20 → 2026-10-19)");
    expect(JSON.parse(String(fs.data["Antrian Validasi"][1][11]))).toMatchObject({ date: "2026-10-19", dateBefore: DATE });
    await qa.editKiriman("Dian Kartika", "4139", r.id, { ...edited, date: DATE });

    await expect(qa.putuskan("Dian Kartika", "4139", [r.id], "no", "")).rejects.toThrow(/alasan/);
    const ok = await qa.putuskan("Dian Kartika", "4139", [r.id], "ok", "");
    expect(ok).toMatchObject({ ok: 1, skip: 0 });
    expect(fs.grown).toEqual([]);
    const row = fs.data["Input - Production"][6];
    expect(row.slice(1, 14)).toEqual([46315, "Harjuki", "PF Iron Cage", "6902-J", "D1", 7000, 450, "", "", "012300001", "509", "MC 01", ""]);
    expect(fs.data["Input - Lost Time"][6].slice(1, 6)).toEqual([46315, "Harjuki", "5S", 30, "pagi"]);
    expect(fs.data["Antrian Validasi"][1].slice(7, 9)).toEqual(["Disetujui", "Dian Kartika"]);

    // Keputusan ganda diabaikan; member tidak bisa mengedit kiriman yang sudah disetujui.
    expect(await qa.putuskan("Dian Kartika", "4139", [r.id], "no", "x")).toMatchObject({ ok: 0, skip: 1 });
    await expect(qa.submitReport({ ...payload(), replaceId: r.id })).rejects.toThrow(/tidak bisa diedit/);

    // Kiriman kedua ditulis di bawah baris pertama.
    const r2 = await qa.submitReport({ ...payload(), member: "Suharyanto" });
    await qa.putuskan("Dian Kartika", "4139", [r2.id], "ok", "");
    expect(fs.data["Input - Production"][7][2]).toBe("Suharyanto");
    expect(fs.grown).toEqual(["Input - Production"]);

    const dash = await buildReport("dashboard", { from: DATE, to: DATE }, DATE);
    expect(dash.kpis[0].value).toBe(14920);
    expect(dash.kpis.find((k) => k.label === "NG rate")!.hint).toBe("16 pcs NG");
    const daily = await buildReport("daily", { date: DATE }, DATE);
    expect(daily.tables[0].rows.find((x) => x.member === "Harjuki")!.status).toBe("Disetujui");
    const ngType = await buildReport("ng-type", { from: DATE, to: DATE }, DATE);
    expect(ngType.tables[0].rows[0]).toMatchObject({ ng: "Kizu", qty: 10 });
    const cat = await buildReport("category", { from: DATE, to: DATE }, DATE);
    const piv = cat.tables[0];
    expect(piv.title).toBe("Total per part (semua kategori)");
    expect(piv.total!.qty).toBe(14920);
    expect(piv.columns.map((c) => c.label)).toContain("PF Iron Cage");
    const one = await buildReport("category", { from: DATE, to: DATE, q: "6902 j" }, DATE);
    expect(one.tables[0].rows.every((x) => String(x.part).startsWith("6902-J"))).toBe(true);
    for (const kind of ["member", "category", "machine", "ng-lot", "monthly"] as const)
      expect((await buildReport(kind, { from: DATE, to: DATE, month: "2026-10" }, DATE)).tables.length).toBeGreaterThan(0);
  });

  it("member mengedit kiriman sendiri yang masih Menunggu", async () => {
    const r = await qa.submitReport(payload());
    await qa.submitReport({ ...payload(), replaceId: r.id, lostTimes: [{ type: "Ganti Pole", minutes: "30", remarks: "" }] });
    expect(fs.data["Antrian Validasi"]).toHaveLength(2);
    expect(fs.data["Antrian Validasi"][1][10]).toBe("Diedit member");
    await expect(qa.submitReport({ ...payload(), member: "Suharyanto", replaceId: r.id })).rejects.toThrow(/tidak ditemukan/);
  });

  it("menolak isian yang tidak ada di Master Data", async () => {
    await expect(qa.submitReport({ ...payload(), member: "Orang Lain" })).rejects.toThrow(/member/);
    await expect(qa.submitReport({ ...payload(), lostTimes: [{ type: "Tidur", minutes: "30" }] })).rejects.toThrow(/jenis tidak dikenal/);
    const withItem = (o: Record<string, string>) => ({ ...payload(), items: [{ ...payload().items[0], ...o }] });
    await expect(qa.submitReport(withItem({ lot: "3126060626" }))).rejects.toThrow(/Lot harus 9 angka/);
    await expect(qa.submitReport(withItem({ lot: ",31260802" }))).rejects.toThrow(/Lot harus 9 angka/);
    await expect(qa.submitReport(withItem({ normalQty: "12.600" }))).rejects.toThrow(/angka bulat/);
    expect(fs.data["Antrian Validasi"]).toHaveLength(1);
  });

  it("lost time OT ditulis ke kolom J dan terbaca sebagai OT", async () => {
    const r = await qa.submitReport({ ...payload(), lostTimes: [{ type: "5S", minutes: "30", remarks: "pagi" }, { type: "5S", minutes: "120", remarks: "ganti pole", ot: true }] });
    await qa.putuskan("Dian Kartika", "4139", [r.id], "ok", "");
    const L = fs.data["Input - Lost Time"];
    expect([L[6][9] ?? "", L[7][9]]).toEqual(["", "OT"]);
    const rows = await qa.apiRows(DATE, DATE);
    expect(rows.lost.map((x) => x[5])).toEqual([0, 1]);
  });

  it("ditolak dengan alasan tidak menulis ke Input", async () => {
    const r = await qa.submitReport(payload());
    await qa.putuskan("Dian Kartika", "4139", [r.id], "no", "Qty salah");
    expect(fs.data["Antrian Validasi"][1].slice(7, 11)).toEqual(["Ditolak", "Dian Kartika", expect.any(Number), "Qty salah"]);
    expect(fs.data["Input - Production"]).toHaveLength(6);
    const cek = await qa.cekLaporan(DATE, "Harjuki");
    expect(cek.subs[0].items).toHaveLength(1); // data dikirim balik untuk "Perbaiki & kirim ulang"
  });
});

describe("login report dari tab Users", () => {
  it("NIK + PIN, status nonaktif ditolak", async () => {
    expect(await qa.apiLogin("2016162", "6162")).toMatchObject({ ok: true, role: "admin", name: "Anton Wahyudi" });
    expect(await qa.apiLogin("2016162", "0000")).toEqual({ ok: false });
    expect(await qa.apiLogin("201004", "1004")).toEqual({ ok: false, inactive: true });
  });
});

describe("v1.7: menit MC per mesin, waktu operator, oiban rentang", () => {
  it("mengurai oiban rentang", () => {
    expect(qa.uraiOiban("1-6, 8, 10-12").list).toEqual(["1", "2", "3", "4", "5", "6", "8", "10", "11", "12"]);
    expect(qa.uraiOiban("001 s/d 003").list).toEqual(["001", "002", "003"]);
    expect(qa.uraiOiban("5sd7.9").list).toEqual(["5", "6", "7", "9"]);
    expect(qa.uraiOiban("A12").list).toEqual(["A12"]);
    expect(qa.uraiOiban("1-3, 2, 2")).toEqual({ list: ["1", "2", "3", "2", "2"], err: "" }); // oiban double boleh
    expect(qa.uraiOiban("9-3").err).toMatch(/tidak wajar/);
    expect(qa.uraiOiban("").list).toEqual([]);
  });

  it("waktu operator dibagi ke part mesin, menit MC ke AM:AP, report mesin pakai Standar MC", async () => {
    const mc = (part: string, mcNo: string, qty: string, mcMin: string, oiban: string) => ({
      category: "PF Iron Cage", part, type: "D1", mc: mcNo, normalQty: qty, normalMin: "", otQty: "", otMin: "", mcMin, mcOtMin: "", lot: "312600001", oiban, ng: ["", "", "", "", "", "", "", "", "", ""],
    });
    const p17 = {
      date: DATE,
      member: "Harjuki",
      items: [mc("6902-J", "MC 01", "7920", "480", "1-6, 8"), mc("627-J", "MC 03", "9000", "240", "")],
      lostTimes: [{ type: "5S", minutes: "20", remarks: "" }],
      op: { min: 460, ot: "" },
    };
    await expect(qa.submitReport({ ...p17, items: [{ ...p17.items[0], oiban: "9-3" }] })).rejects.toThrow(/oiban/);
    const r = await qa.submitReport(p17);
    const rec = JSON.parse(String(fs.data["Antrian Validasi"][1][11]));
    expect(rec.op).toEqual({ min: 460, ot: "" });
    expect(rec.items.map((x: { normalMin: number }) => x.normalMin)).toEqual([306.67, 153.33]);
    expect((await qa.riwayatMember("Harjuki"))[0].op).toEqual({ min: 460, ot: "" });

    await qa.putuskan("Dian Kartika", "4139", [r.id], "ok", "");
    const rows = fs.data["Input - Production"];
    expect(rows[6].slice(6, 8)).toEqual([7920, 306.67]);
    expect(rows[6].slice(38, 42)).toEqual([480, "", "1, 2, 3, 4, 5, 6, 8", 7]);
    expect(rows[7].slice(38, 42)).toEqual([240, "", "", ""]);

    const rep = await buildReport("machine", { from: DATE, to: DATE }, DATE);
    const byMc = Object.fromEntries(rep.tables[0].rows.map((x) => [x.mcNo, x]));
    expect(byMc["MC 01"]).toMatchObject({ mcHours: 8, stdHours: 7.92, eff: 0.99 });
    expect(byMc["MC 03"]).toMatchObject({ mcHours: 4, pcsHr: 2250, stdHours: null, eff: null }); // Std MC belum diisi
  });
});

describe("v1.8: catatan NG Lain-lain", () => {
  it("ditulis ke kolom AW saat approve dan tampil di report NG per jenis", async () => {
    const base = payload();
    const r = await qa.submitReport({ ...base, items: [{ ...base.items[0], ng: ["", "", "4", "", "", "", "", "", "", ""], ngNote: "retak" }] });
    await qa.putuskan("Dian Kartika", "4139", [r.id], "ok", "");
    expect(fs.data["Input - Production"][6][48]).toBe("retak");
    const rep = await buildReport("ng-type", { from: DATE, to: DATE }, DATE);
    expect(rep.tables.find((t) => t.title === "Catatan NG Lain-lain")!.rows).toEqual([expect.objectContaining({ member: "Harjuki", qty: 4, note: "retak" })]);
    expect(rep.tables.some((t) => /lot/i.test(t.title))).toBe(true);
  });
});

describe("tampilan baru: Hari Ini dan Laporan", () => {
  it("antrian, belum kirim, angka disetujui, dan laporan bulanan", async () => {
    const { buildToday, buildLaporan, laporanToReport } = await import("@/lib/views");
    const r1 = await qa.submitReport(payload());
    const r2 = await qa.submitReport({ ...payload(), member: "Suharyanto", lostTimes: [] });

    const before = await buildToday(DATE);
    expect(before.queue.map((c) => c.member).sort()).toEqual(["Harjuki", "Suharyanto"]);
    // Harjuki 450 + 30 = 480 lengkap, Suharyanto 450 menit saja kurang dari 480.
    expect(before.queue.find((c) => c.member === "Harjuki")!.warnings).toEqual([]);
    expect(before.queue.find((c) => c.member === "Suharyanto")!.warnings.length).toBeGreaterThan(0);

    await qa.putuskanTanpaPin("Dian Kartika", [r1.id], "ok", "");
    await qa.putuskanTanpaPin("Dian Kartika", [r2.id], "no", "menit kurang");
    clearReportCache();
    const after = await buildToday(DATE);
    expect(after.queue).toEqual([]);
    expect(after.rejected).toEqual([{ member: "Suharyanto", note: "menit kurang" }]);
    expect(after.topNg[0]).toMatchObject({ name: "Kizu", qty: 5 });

    const lap = await buildLaporan({ from: "2026-10-01", to: DATE }, DATE);
    expect(lap.people.map((p) => p.name)).toEqual(["Harjuki"]);
    expect(lap.totalNg).toBe(8);
    expect(lap.month.problems.length).toBeGreaterThan(0);
    expect(laporanToReport(lap).tables.length).toBeGreaterThan(0);
  });
});

describe("report baru dan Excel", () => {
  it("waktu, disiplin, cari lot/oiban, dan semua halaman bisa jadi Excel", async () => {
    const { reportToXlsx } = await import("@/lib/excel");
    const { reportToPdf } = await import("@/lib/pdf");
    const { buildToday, buildLaporan, laporanToReport, todayToReport } = await import("@/lib/views");
    const r = await qa.submitReport({ ...payload(), lostTimes: [{ type: "Ganti Pole", minutes: "30", remarks: "pole aus" }] });
    await qa.putuskanTanpaPin("Dian Kartika", [r.id], "ok", "");
    const r2 = await qa.submitReport({ ...payload(), member: "Suharyanto", lostTimes: [] });
    await qa.putuskanTanpaPin("Dian Kartika", [r2.id], "no", "menit kurang");
    clearReportCache();

    const waktu = await buildReport("waktu", { from: DATE, to: DATE }, DATE);
    expect(waktu.tables[0].rows[0]).toMatchObject({ name: "Ganti Pole", group: "Lost Time", count: 1 });
    // 30 menit x STKI 1100 pcs/jam = 550 pcs
    expect(waktu.kpis.find((k) => k.label === "Lost Time (jam)")!.hint).toBe("potensi hilang 550 pcs");
    expect(waktu.tables[3].rows[0]).toMatchObject({ member: "Harjuki", minutes: 30, remarks: "pole aus" });

    const dis = await buildReport("disiplin", { from: DATE, to: DATE }, DATE);
    expect(dis.kpis[0].hint).toBe("0 dari 2 kiriman"); // tes mengirim di hari lain
    expect(dis.tables[1].rows).toEqual([expect.objectContaining({ member: "Suharyanto", note: "menit kurang" })]);

    const byOiban = await buildReport("ng-type", { from: DATE, to: DATE, q: "509" }, DATE);
    expect(byOiban.tables[0].rows).toEqual([expect.objectContaining({ member: "Harjuki", lot: "012300001", detail: "Kizu 5, Lain-Lain 3" })]);
    const byLot = await buildReport("ng-type", { from: DATE, to: DATE, q: "012" }, DATE);
    expect(byLot.tables[0].rows).toHaveLength(1);
    expect(byLot.tables.find((t) => t.title === "Part x jenis NG")!.rows[0]).toMatchObject({ part: "6902-J D1", ng: 8 });

    const reports = [
      waktu,
      dis,
      byOiban,
      todayToReport(await buildToday(DATE)),
      laporanToReport(await buildLaporan({ from: "2026-10-01", to: DATE }, DATE)),
      ...(await Promise.all((["member", "machine", "monthly"] as const).map((k) => buildReport(k, { from: DATE, to: DATE, month: "2026-10" }, DATE)))),
    ];
    for (const rep of reports) {
      const buf = await reportToXlsx(rep);
      expect(buf.subarray(0, 2).toString()).toBe("PK");
      expect(reportToPdf(rep).subarray(0, 5).toString()).toBe("%PDF-");
    }
  });
});

describe("Master Data dari web (admin)", () => {
  it("baca, tambah, validasi, dan tolak bila sheet berubah", async () => {
    const me = await import("@/lib/sheets/masterEdit");
    const m = await me.getMasterTable("member");
    expect(m.rows.map((r) => r.name)).toEqual(["Harjuki", "Suharyanto", "Keluar"]);
    await me.saveMasterTable("member", m.version, [...m.rows, { nik: "0201999", name: "Ahmad Syakir Baehaqie", status: "Active" }]);
    expect(fs.data["Master Data"][9].slice(1, 4)).toEqual(["0201999", "Ahmad Syakir Baehaqie", "Active"]);
    expect((await qa.getMasterData()).members).toContain("Ahmad Syakir Baehaqie");
    // versi lama ditolak
    await expect(me.saveMasterTable("member", m.version, m.rows)).rejects.toThrow(/baru saja diubah/);
    // duplikat ditolak
    const m2 = await me.getMasterTable("member");
    await expect(me.saveMasterTable("member", m2.version, [...m2.rows, { nik: "1", name: "Harjuki", status: "Active" }])).rejects.toThrow(/sama dengan/);
    // hapus baris: sisa baris lama dikosongkan
    await me.saveMasterTable("member", m2.version, m2.rows.slice(0, 2));
    expect(fs.data["Master Data"][9].slice(1, 4)).toEqual(["", "", ""]);

    const p = await me.getMasterTable("part");
    expect(p.options.category).toEqual(["PF Iron Cage", "Seiretsu Iron Cage"]);
    await me.saveMasterTable("part", p.version, [...p.rows, { category: "PF Iron Cage", part: "608-J", type: "D1", stki: "1.250" }]);
    expect(fs.data["Master Data"][9].slice(5, 11)).toEqual([4, "PF Iron Cage", "Bowl PF", "608-J", "D1", 1250]);
    await expect(me.saveMasterTable("part", (await me.getMasterTable("part")).version, [{ category: "Tidak Ada", part: "x", stki: "1" }])).rejects.toThrow(/tidak ada di tabel Kategori/);

    const cat = await me.getMasterTable("category");
    expect(cat.rows.map((r) => r.name)).toEqual(["PF Iron Cage", "Seiretsu Iron Cage"]);
    await me.saveMasterTable("category", cat.version, cat.rows.slice(1));
    expect(fs.data["Master Data"][7][15]).toBe("");
    expect(fs.data["Master Data"][9][15]).toBe("⏱️ LOST TIME TYPES");
    await me.saveMasterTable("category", (await me.getMasterTable("category")).version, cat.rows);
    const lost = await me.getMasterTable("lost");
    expect(lost.rows).toEqual([{ name: "5S", group: "Another Job" }, { name: "Ganti Pole", group: "Lost Time" }]);

    const st = await me.getMasterTable("setting");
    expect(st.rows.find((r) => r.param.startsWith("Grade B"))!.value).toBe("90");
    await me.saveMasterTable("setting", st.version, st.rows.map((r) => (r.param.startsWith("Normal") ? { ...r, value: "460" } : r)));
    expect(fs.data["Master Data"][6][19]).toBe(460);
    expect(fs.data["Master Data"][10][19]).toBe(0.9);

    const u = await me.getMasterTable("users");
    await me.saveMasterTable("users", u.version, [...u.rows, { nik: "300001", name: "Dian Kartika", role: "leader", pin: "0412", status: "Aktif" }]);
    expect(await qa.apiLogin("300001", "0412")).toMatchObject({ ok: true, role: "leader" });
  });
});

describe("Sinkron dari Sheet lama", () => {
  it("menyalin laporan disetujui per member-tanggal, tanpa dobel", async () => {
    const src = new FakeSheet();
    const P = "Input - Production", L = "Input - Lost Time";
    src.sheet(P, 100);
    src.sheet(L, 100);
    const serial = (d: number) => 46000 + d; // 46000 = 2025-12-09; cukup untuk membedakan hari
    const day = (d: number) => {
      const t = new Date(Date.UTC(1899, 11, 30) + serial(d) * 86400000);
      return t.toISOString().slice(0, 10);
    };
    const row = (r: number, d: number, member: string) => {
      [serial(d), member, "PF Iron Cage", "6902-J", "D1", 7920, 450, "", "", "0123", "509", "MC 01", "", 5].forEach((v, j) => src.setCell(P, r - 1, 1 + j, v));
      src.setCell(P, r - 1, 38, 420); // AM
      src.setCell(P, r - 1, 40, "509"); // AO
      src.setCell(P, r - 1, 41, 1); // AP
    };
    row(7, 1, "Harjuki");
    row(8, 1, "Suharyanto");
    row(9, 2, "Harjuki");
    [serial(1), "Harjuki", "5S", 30, "pagi"].forEach((v, j) => src.setCell(L, 6, 1 + j, v));
    // Suharyanto sudah input langsung di Vercel untuk hari 1 -> dilewati
    fs.setCell(L, 6, 1, serial(1));
    fs.setCell(L, 6, 2, "Suharyanto");

    const r1 = await qa.sinkronDariSheetLama(src, day(1), day(1));
    expect(r1.members).toEqual([`${day(1)}|Harjuki`]);
    expect(r1.prod).toBe(1);
    expect(r1.lt).toBe(1);
    const again = await qa.sinkronDariSheetLama(src, day(1), day(2));
    expect(again.members).toEqual([`${day(2)}|Harjuki`]);
    const [prod] = await fs.get(["'Input - Production'!B7:AP"], "UNFORMATTED_VALUE");
    expect(prod.filter((r) => r[1]).length).toBe(2);
    expect(prod[0][5]).toBe(7920);
    expect(prod[0][37]).toBe(420);
  });
});

describe("Tahap 1: keandalan", () => {
  it("kiriman ganda yang persis sama tidak menambah baris", async () => {
    const a = await qa.submitReport(payload());
    const b = await qa.submitReport(payload());
    expect(b).toMatchObject({ id: a.id, duplicate: true });
    expect(fs.data["Antrian Validasi"]).toHaveLength(2);
    // Isi berbeda tetap kiriman baru.
    const c = await qa.submitReport({ ...payload(), lostTimes: [{ type: "5S", minutes: "30", remarks: "sore" }] });
    expect(c.id).not.toBe(a.id);
  });

  it("halaman leader dengan sesi tidak butuh PIN, PIN salah tetap ditolak", async () => {
    const r = await qa.submitReport(payload());
    await expect(qa.putuskan("Dian Kartika", "0000", [r.id], "ok", "")).rejects.toThrow(/PIN salah/);
    await qa.putuskan("Dian Kartika Sari", qa.LEADER_SESSION, [r.id], "ok", "");
    expect(fs.data["Antrian Validasi"][1].slice(7, 9)).toEqual(["Disetujui", "Dian Kartika Sari"]);
  });

  it("lost time dibagi per kategori sesuai porsi menit kerja", async () => {
    const it2 = { category: "Seiretsu Iron Cage", part: "608JCL-1-J", type: "D1", mc: "", normalQty: "1000", normalMin: "225", otQty: "", otMin: "", lot: "312600002", oiban: "", ng: ["", "", "", "", "", "", "", "", "", ""] };
    const r = await qa.submitReport({ ...payload(), items: [{ ...payload().items[0], normalMin: "225" }, it2] });
    await qa.putuskan("Dian Kartika", "4139", [r.id], "ok", "");
    const master = await loadMaster();
    const pf = master.categories.find((c) => c.name === "PF Iron Cage")!.id;
    const all = await loadFacts(master, DATE, DATE);
    const onlyPf = await loadFacts(master, DATE, DATE, pf);
    expect(all.lost.reduce((a, l) => a + l.minutes, 0)).toBe(30);
    expect(onlyPf.lost.reduce((a, l) => a + l.minutes, 0)).toBe(15);
  });

  it("kiriman ditolak yang belum dikirim ulang tetap terlihat", () => {
    const sub = (id: string, sent: string, status: RawSubmission["status"]) => ({ id, sent, date: DATE, member: "Harjuki", status }) as RawSubmission;
    expect(openRejections([sub("a", "2026-10-20 08:00", "Disetujui"), sub("b", "2026-10-20 09:00", "Ditolak")]).map((x) => x.id)).toEqual(["b"]);
    expect(openRejections([sub("b", "2026-10-20 09:00", "Ditolak"), sub("c", "2026-10-20 10:00", "Menunggu")])).toEqual([]);
  });

  it("jam mesin tersedia bisa per kategori", async () => {
    fs.setCell("Master Data", 12, 18, "Machine available hrs / day");
    fs.setCell("Master Data", 12, 19, 8);
    fs.setCell("Master Data", 13, 18, "Machine available hrs / day - PF Iron Cage");
    fs.setCell("Master Data", 13, 19, 16);
    const st = (await loadMaster()).settings;
    expect(st.mcHrsDay).toBe(8);
    expect(st.mcHrsCat).toEqual({ "PF Iron Cage": 16 });
  });
});
