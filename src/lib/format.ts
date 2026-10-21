import type { ColFormat } from "./reports";
import { fmt, pct } from "./rules";

export function formatCell(v: string | number | null | undefined, f?: ColFormat): string {
  if (v == null || v === "") return "-";
  if (typeof v === "string") return v;
  switch (f) {
    case "int":
      return fmt(v, 0);
    case "dec1":
      return fmt(v, 1);
    case "dec2":
      return fmt(v, 2);
    case "pct":
      return pct(v, Math.abs(v) < 0.01 && v !== 0 ? 2 : 1);
    default:
      return String(v);
  }
}
