import ExcelJS from "exceljs";
import { handle } from "@/lib/api";
import { requireApiRole } from "@/lib/auth";
import { isValidDate, monthEnd, monthStart, todayJakarta } from "@/lib/dates";
import { PROCESSES, rowsOf } from "@/lib/po";
import { readPoState } from "@/lib/sheets/po";

/** GET ?from&to&customer&state: tabel Monitoring PO sebagai file Excel (filter sama dengan halaman). */
export async function GET(req: Request) {
  return handle(async () => {
    await requireApiRole(["operator", "leader", "manager", "admin"]);
    const u = new URL(req.url).searchParams;
    const today = todayJakarta();
    const from = isValidDate(u.get("from")) ? u.get("from")! : monthStart(today);
    const to = isValidDate(u.get("to")) ? u.get("to")! : monthEnd(today);
    const cust = u.get("customer") ?? "";
    const state = u.get("state") ?? "";
    const st = await readPoState();
    const rows = rowsOf(st.pos, today).filter(
      (r) => r.due >= from && r.due <= to && (!cust || r.customer === cust) && (!state || (state === "Dikirim" ? r.status === "Dikirim" : r.state === state)),
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Monitoring PO", { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ws.addRow(["Monitoring PO Customer · PT. Takai Seiki Indonesia"]).font = { bold: true, size: 14 };
    ws.addRow([`Delivery ${from} s/d ${to}${cust ? ` · ${cust}` : ""}${state ? ` · ${state}` : ""} · dicetak ${st.asOf}`]).font = { color: { argb: "FF64748B" } };
    ws.addRow([]);
    const head = ["No", "Customer", "PO No.", "Item ID", "Part", "Pcs/Box", "Qty PO (pcs)", "Qty PO (box)", ...PROCESSES.map((p) => `${p} (pcs)`), "Total Output (pcs)", "Progress", "Kekurangan (pcs)", "Kekurangan (box)", "Delivery", "Sisa hari", "Status"];
    const h = ws.addRow(head);
    h.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    h.height = 32;
    rows.forEach((r, i) => {
      const row = ws.addRow([
        i + 1,
        r.customer,
        r.noPo,
        r.itemId,
        r.itemName,
        r.pcsPerBox,
        r.qty,
        r.qtyBox,
        ...PROCESSES.map((p) => r.proc[p].done),
        r.output,
        r.progress,
        r.short,
        r.shortBox,
        new Date(`${r.due}T00:00:00Z`),
        r.daysLeft,
        r.status === "Dikirim" ? "Dikirim" : r.state,
      ]);
      if (r.state === "Kekurangan") row.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } }));
    });
    const tot = ws.addRow(["", "Total", "", "", "", "", rows.reduce((s, r) => s + r.qty, 0), rows.reduce((s, r) => s + r.qtyBox, 0), ...PROCESSES.map((p) => rows.reduce((s, r) => s + r.proc[p].done, 0)), rows.reduce((s, r) => s + r.output, 0), null, rows.reduce((s, r) => s + r.short, 0), rows.reduce((s, r) => s + r.shortBox, 0)]);
    tot.font = { bold: true };
    const widths = [5, 22, 14, 18, 14, 9, 13, 9, 13, 13, 13, 15, 10, 14, 12, 12, 9, 13];
    widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
    [6, 7, 8, 9, 10, 11, 12, 14, 15].forEach((c) => (ws.getColumn(c).numFmt = "#,##0"));
    ws.getColumn(13).numFmt = "0.0%";
    ws.getColumn(16).numFmt = "dd mmm yyyy";
    const buf = await wb.xlsx.writeBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Monitoring-PO-${from}_${to}.xlsx"`,
      },
    });
  });
}
