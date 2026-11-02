import { afterEach, describe, expect, it } from "vitest";
import { parseDate, parsePoPaste, shortFor, summarize, type CustItem } from "@/lib/po";
import { addBox, addPos, deleteBox, deletePo, readPoState, updatePo } from "@/lib/sheets/po";
import { setSheetsIO } from "@/lib/sheets/qa";
import { FakeSheet } from "./fakeSheet";

const items: CustItem[] = [
  { customer: "PT NSK INDONESIA", itemId: "SPCC-627-J*KD1", itemName: "627-J D1", pcsPerBox: 21600, active: true },
  { customer: "PT NSK INDONESIA", itemId: "PLAST-6700", itemName: "6700", pcsPerBox: 6000, active: true },
  { customer: "DALIAN", itemId: "PLAST-6700", itemName: "6700", pcsPerBox: 12000, active: true },
];

afterEach(() => setSheetsIO(null));

describe("Pantau PO", () => {
  it("membagi box FIFO per tanggal delivery, terpisah per proses dan customer", () => {
    const po = (id: string, customer: string, itemId: string, qty: number, due: string, row: number) => ({ id, row, noPo: "", customer, itemId, itemName: "", qty, due, status: "Open" as const, note: "", by: "", at: "" });
    const box = (process: "Seiretsu" | "Senbetsu", customer: string, itemId: string, n: number, per: number) => ({ id: `${process}${n}`, row: 2, date: "2026-11-02", time: "", process, customer, itemId, itemName: "", box: n, pcsPerBox: per, extra: 0, pcs: n * per, by: "", note: "" });
    const sum = summarize(
      {
        items,
        pos: [po("B", "PT NSK INDONESIA", "SPCC-627-J*KD1", 216000, "2026-11-10", 3), po("A", "PT NSK INDONESIA", "SPCC-627-J*KD1", 43200, "2026-11-04", 2), po("C", "DALIAN", "PLAST-6700", 24000, "2026-11-01", 4)],
        entries: [box("Seiretsu", "PT NSK INDONESIA", "SPCC-627-J*KD1", 3, 21600), box("Senbetsu", "PT NSK INDONESIA", "SPCC-627-J*KD1", 1, 21600), box("Seiretsu", "PT NSK INDONESIA", "PLAST-6700", 2, 6000)],
      },
      "2026-11-02",
    );
    const a = sum.rows.find((r) => r.id === "A")!;
    const b = sum.rows.find((r) => r.id === "B")!;
    expect(a.proc.Seiretsu).toEqual({ done: 43200, short: 0, shortBox: 0 });
    expect(a.proc.Senbetsu).toEqual({ done: 21600, short: 21600, shortBox: 1 });
    expect(b.proc.Seiretsu.done).toBe(21600);
    expect(b.proc.Seiretsu.shortBox).toBe(9);
    expect(a.daysLeft).toBe(2);
    expect(a.level).toBe("urgent");
    const c = sum.rows.find((r) => r.id === "C")!;
    expect(c.level).toBe("late"); // box PLAST-6700 milik NSK, bukan Dalian
    expect(sum.surplus).toEqual([{ customer: "PT NSK INDONESIA", itemId: "PLAST-6700", itemName: "6700", process: "Seiretsu", pcs: 12000 }]);
    expect(sum.customers[0].customer).toBe("DALIAN");
    const nsk = sum.customers.find((x) => x.customer === "PT NSK INDONESIA")!;
    expect(nsk.short.Seiretsu).toEqual({ pcs: 194400, box: 9 });
    expect(shortFor(sum, "PT NSK INDONESIA", "SPCC-627-J*KD1", "Senbetsu")).toMatchObject({ pcs: 237600, box: 11 });
  });

  it("membaca tempelan PO dan tanggal", () => {
    expect(parseDate("05/11/2026", "2026-11-02")).toBe("2026-11-05");
    expect(parseDate("5-Nov", "2026-11-02")).toBe("2026-11-05");
    expect(parseDate("3 Jan", "2026-11-02")).toBe("2027-01-03");
    expect(parseDate("2026-12-1", "2026-11-02")).toBe("2026-12-01");
    const r = parsePoPaste("Part\tQty\tTgl\n627-J D1\t216.000\t05/11/2026\tPO-1\n6700\t2 box\t7-Nov\nXYZ\t5\t7-Nov", items, "PT NSK INDONESIA", "2026-11-02");
    expect(r.ok).toEqual([
      { itemId: "SPCC-627-J*KD1", itemName: "627-J D1", qty: 216000, due: "2026-11-05", noPo: "PO-1" },
      { itemId: "PLAST-6700", itemName: "6700", qty: 12000, due: "2026-11-07", noPo: "" },
    ]);
    expect(r.errors).toHaveLength(1);
  });

  it("menulis dan membaca tab Sheet", async () => {
    const fake = new FakeSheet();
    setSheetsIO(fake);
    fake.sheet("Master Customer");
    fake.setCell("Master Customer", 0, 0, "Customer");
    ["PT NSK INDONESIA", "SPCC-627-J*KD1", "627-J D1", 21600, 270, 12.5, 9, 80, 1, 80, 21600, "Ya"].forEach((v, c) => fake.setCell("Master Customer", 1, c, v));
    fake.setCell("PO Customer", 0, 0, "ID");
    fake.setCell("Input Box", 0, 0, "ID");
    await addPos([{ noPo: "X1", customer: "PT NSK INDONESIA", itemId: "SPCC-627-J*KD1", itemName: "627-J D1", qty: 43200, due: "2026-11-05", note: "" }], "Anton");
    await addBox({ date: "2026-11-02", process: "Seiretsu", customer: "PT NSK INDONESIA", itemId: "SPCC-627-J*KD1", itemName: "627-J D1", box: 1, pcsPerBox: 21600, extra: 100, note: "" }, "Sari");
    let st = await readPoState();
    expect(st.items[0].pcsPerBox).toBe(21600);
    expect(st.pos[0]).toMatchObject({ noPo: "X1", qty: 43200, due: "2026-11-05", status: "Open", row: 2 });
    expect(st.entries[0]).toMatchObject({ process: "Seiretsu", pcs: 21700, by: "Sari", row: 2 });
    await updatePo(2, st.pos[0].id, { qty: 50000, status: "Selesai" }, "Anton");
    await deleteBox(2, "Anton");
    st = await readPoState();
    expect(st.pos[0]).toMatchObject({ qty: 50000, status: "Selesai" });
    expect(st.entries).toHaveLength(0);
    await expect(updatePo(2, "salah", { qty: 1 }, "Anton")).rejects.toThrow();
    await deletePo(2, st.pos[0].id);
    expect((await readPoState()).pos).toHaveLength(0);
  });
});
