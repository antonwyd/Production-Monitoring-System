import { beforeEach, describe, expect, it } from "vitest";
import { setTransport } from "@/lib/backend";
import { buildReport, clearReportCache } from "@/lib/reports";
import { invalidateMaster } from "@/lib/service";
import * as qa from "@/lib/sheets/qa";
import { FakeSheet } from "./fakeSheet";

const DATE = "2026-10-20";
let fs: FakeSheet;

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
  [["PF Iron Cage", "Bowl PF"], ["Seiretsu Iron Cage", "Seiretsu"], ["", ""], ["Lost Time Type", ""], ["5S", "Another Job"], ["Ganti Pole", "Lost Time"]].forEach((x, i) => x.forEach((v, j) => set(M, 7 + i, 15 + j, v)));
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
  items: [{ category: "PF Iron Cage", part: "6902-J", type: "D1", mc: "MC 01", normalQty: "7920", normalMin: "450", otQty: "", otMin: "", lot: "0123", oiban: "509", ng: ["", "5", "3", "", "", "", "", "", "", ""] }],
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
    expect(JSON.parse(String(q[11])).items[0].lot).toBe("0123");

    const cek = await qa.cekLaporan(DATE, "Harjuki");
    expect(cek).toMatchObject({ prod: 0, lt: 0, subs: [{ id: r.id, status: "Menunggu" }] });
    expect((await qa.riwayatMember("Harjuki")).map((x) => x.id)).toEqual([r.id]);

    await expect(qa.getAntrian("Dian Kartika", "0000", "Menunggu", "")).rejects.toThrow(/PIN salah/);
    const ant = await qa.getAntrian("Dian Kartika", "4139", "Menunggu", "");
    expect(ant.counts).toEqual({ Menunggu: 1, Disetujui: 0, Ditolak: 0 });
    expect(ant.list[0]).toMatchObject({ id: r.id, date: DATE, member: "Harjuki" });

    // Leader mengedit qty; data asli tetap tersimpan.
    const edited = { ...payload(), items: [{ ...payload().items[0], normalQty: "7000" }] };
    await qa.editKiriman("Dian Kartika", "4139", r.id, edited);
    const rec = JSON.parse(String(fs.data["Antrian Validasi"][1][11]));
    expect(rec.items[0].normalQty).toBe("7000");
    expect(rec.original.items[0].normalQty).toBe("7920");
    expect(fs.data["Antrian Validasi"][1][10]).toBe("Diedit oleh Dian Kartika");

    await expect(qa.putuskan("Dian Kartika", "4139", [r.id], "no", "")).rejects.toThrow(/alasan/);
    const ok = await qa.putuskan("Dian Kartika", "4139", [r.id], "ok", "");
    expect(ok).toMatchObject({ ok: 1, skip: 0 });
    expect(fs.grown).toEqual([]);
    const row = fs.data["Input - Production"][6];
    expect(row.slice(1, 14)).toEqual([46315, "Harjuki", "PF Iron Cage", "6902-J", "D1", 7000, 450, "", "", "0123", "509", "MC 01", ""]);
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
    expect(dash.kpis[1].value).toBe(16);
    const daily = await buildReport("daily", { date: DATE }, DATE);
    expect(daily.tables[0].rows.find((x) => x.member === "Harjuki")!.status).toBe("Disetujui");
    const ngType = await buildReport("ng-type", { from: DATE, to: DATE }, DATE);
    expect(ngType.tables[0].rows[0]).toMatchObject({ ng: "Kizu", qty: 10 });
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
    expect(fs.data["Antrian Validasi"]).toHaveLength(1);
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
      category: "PF Iron Cage", part, type: "D1", mc: mcNo, normalQty: qty, normalMin: "", otQty: "", otMin: "", mcMin, mcOtMin: "", lot: "L1", oiban, ng: ["", "", "", "", "", "", "", "", "", ""],
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
    expect(rep.tables[1].rows).toEqual([expect.objectContaining({ member: "Harjuki", qty: 4, note: "retak" })]);
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
