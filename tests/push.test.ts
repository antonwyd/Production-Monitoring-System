import { describe, expect, it } from "vitest";
import { isiKeputusan } from "../src/lib/push";
import { bacaLangganan, hapusLangganan, setSheetsIO, simpanLangganan, SHEET_PUSH } from "../src/lib/sheets/qa";
import { FakeSheet } from "./fakeSheet";

class TabSheet extends FakeSheet {
  async addTab(title: string) {
    this.sheet(title);
  }
}

describe("notifikasi HP", () => {
  it("isi notifikasi disetujui / ditolak", () => {
    const ok = isiKeputusan("Dian Kartika Sari", "ok", "", "2026-11-04");
    expect(ok.title).toBe("❤️ Dian berterima kasih untuk laporanmu");
    expect(ok.body).toContain("4 Nov");
    const no = isiKeputusan("Dian", "no", "Qty salah", "2026-11-03");
    expect(no.title).toContain("ditolak");
    expect(no.body).toContain("Alasan: Qty salah");
  });

  it("satu HP satu baris, tab dibuat otomatis, langganan mati dihapus", async () => {
    const sh = new TabSheet();
    setSheetsIO(sh);
    expect(await bacaLangganan()).toEqual([]);
    const sub = { endpoint: "https://fcm.googleapis.com/abc", keys: { p256dh: "x", auth: "y" } };
    await simpanLangganan("201277", "Saeful Bahri", sub, "Android");
    await simpanLangganan("201277", "Saeful Bahri", sub, "Android 2");
    await simpanLangganan("1", "Ani", { ...sub, endpoint: "https://web.push.apple.com/z" }, "iPhone");
    let l = await bacaLangganan();
    expect(l.map((x) => x.nama)).toEqual(["Saeful Bahri", "Ani"]);
    expect(sh.data[SHEET_PUSH][0][0]).toBe("NIK");
    await hapusLangganan([l[0].row]);
    l = await bacaLangganan();
    expect(l.map((x) => x.nama)).toEqual(["Ani"]);
    await expect(simpanLangganan("1", "Ani", { endpoint: "javascript:x" }, "")).rejects.toThrow();
  });
});

describe("kunci VAPID dari SESSION_SECRET", () => {
  it("kunci publik 65 byte dan tetap", async () => {
    process.env.SESSION_SECRET = "tes-rahasia";
    const { vapidPublik } = await import("../src/lib/push");
    const a = vapidPublik();
    expect(Buffer.from(a, "base64url").length).toBe(65);
    expect(vapidPublik()).toBe(a);
  });
});
