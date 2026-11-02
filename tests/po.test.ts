import { afterEach, describe, expect, it } from "vitest";
import { byCustomer, rowsOf, type Po } from "@/lib/po";
import { addBox, addPos, readPoState, updatePo } from "@/lib/sheets/po";
import { setSheetsIO } from "@/lib/sheets/qa";
import { FakeSheet } from "./fakeSheet";

afterEach(() => setSheetsIO(null));

const po = (p: Partial<Po>): Po => ({ id: "x", row: 2, customer: "NSK", itemId: "A", itemName: "A", pcsPerBox: 21600, qty: 172800, due: "2026-11-04", box: { Seiretsu: 0, Senbetsu: 0, Washing: 0 }, status: "Open", noPo: "", by: "", updated: "", ...p });

describe("Pantau PO", () => {
  it("menghitung kurang pcs & box per proses dan per customer", () => {
    const rows = rowsOf(
      [
        po({ id: "a", box: { Seiretsu: 9, Senbetsu: 5, Washing: 4 } }),
        po({ id: "b", due: "2026-11-01", qty: 30000, pcsPerBox: 6000, box: { Seiretsu: 5, Senbetsu: 2, Washing: 2 } }),
        po({ id: "c", customer: "DALIAN", due: "2026-11-20", status: "Dikirim" }),
        po({ id: "d", status: "Batal" }),
      ],
      "2026-11-02",
    );
    expect(rows.map((r) => r.id)).toEqual(["b", "a", "c"]);
    const a = rows.find((r) => r.id === "a")!;
    expect(a.qtyBox).toBe(8);
    expect(a.proc.Seiretsu).toEqual({ done: 172800, short: 0, shortBox: 0 });
    expect(a.proc.Senbetsu).toEqual({ done: 108000, short: 64800, shortBox: 3 });
    expect(a.level).toBe("urgent");
    expect(a.output).toBe(86400);
    expect(a.short).toBe(86400);
    expect(a.state).toBe("Kekurangan");
    expect(rows[0].level).toBe("late");
    expect(rows[2].level).toBe("done");
    const nsk = byCustomer(rows).find((c) => c.customer === "NSK")!;
    expect(nsk.short.Senbetsu).toEqual({ pcs: 64800 + 18000, box: 3 + 3 });
    expect(nsk.open).toBe(2);
  });

  it("menulis dan membaca tab Sheet", async () => {
    const fake = new FakeSheet();
    setSheetsIO(fake);
    ["PT NSK INDONESIA", "SPCC-627-J*KD1", "627-J D1", 21600, 270, 12.5, 9, 80, 1, 80, 21600, "Ya"].forEach((v, c) => fake.setCell("Master Customer", 1, c, v));
    fake.setCell("PO Customer", 0, 0, "ID");
    await addPos([{ customer: "PT NSK INDONESIA", itemId: "SPCC-627-J*KD1", itemName: "627-J D1", pcsPerBox: 21600, qty: 43200, due: "2026-11-05", noPo: "X1" }], "Anton");
    let st = await readPoState();
    expect(st.items[0].pcsPerBox).toBe(21600);
    expect(st.pos[0]).toMatchObject({ noPo: "X1", qty: 43200, due: "2026-11-05", status: "Open", row: 2, box: { Seiretsu: 0, Senbetsu: 0, Washing: 0 } });
    expect(fake.data["PO Customer"][1][6]).toContain("ROUNDUP(F2/E2)");
    await addBox(2, st.pos[0].id, "Seiretsu", 1, "Sari");
    await addBox(2, st.pos[0].id, "Seiretsu", 2, "Sari");
    await expect(addBox(2, st.pos[0].id, "Senbetsu", -1, "Sari")).rejects.toThrow();
    await expect(addBox(2, "salah", "Senbetsu", 1, "Sari")).rejects.toThrow();
    st = await readPoState();
    expect(st.pos[0].box).toEqual({ Seiretsu: 3, Senbetsu: 0, Washing: 0 });
    expect(st.pos[0].updated).toContain("Sari");
    await updatePo(2, st.pos[0].id, { status: "Dihapus" }, "Anton");
    expect((await readPoState()).pos).toHaveLength(0);
  });
});
