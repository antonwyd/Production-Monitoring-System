import { describe, expect, it } from "vitest";
import { bahanOf, ngPerBahan, type Fact } from "../src/lib/reports";

const f = (categoryName: string, lot: string, qty: number, ng: number) => ({ categoryName, lot, qty, ng: [ng] }) as unknown as Fact;

describe("NG rate per material", () => {
  it("lot 31 = Press PT, 01 = Press JPN, kategori Plastik selalu Plastik", () => {
    expect(bahanOf(f("Senbetsu Iron Cage", "312609042", 0, 0))).toBe("Press PT");
    expect(bahanOf(f("PF Iron Cage", " 0126101", 0, 0))).toBe("Press JPN");
    expect(bahanOf(f("Senbetsu Plastik Cage", "312609042", 0, 0))).toBe("Plastik");
    expect(bahanOf(f("Drum PF", "(tanpa lot)", 0, 0))).toBeNull();
  });
  it("NG rate = NG / (OK + NG) per kelompok", () => {
    const r = ngPerBahan([f("PF Iron Cage", "31A", 990, 10), f("PF Iron Cage", "01B", 1000, 0), f("PF Plastik", "33", 95, 5), f("X", "99", 5, 5)]);
    expect(r.map((x) => [x.name, x.rate])).toEqual([["Press PT", 0.01], ["Press JPN", 0], ["Plastik", 0.05]]);
  });
});
