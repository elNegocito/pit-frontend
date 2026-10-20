import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatTicketDate } from "@/lib/timezone";
import { DAY_LABELS, PAY_MODELS, PAYROLL_HEADER } from "./models";
import { computeTotals, money, num } from "./compute";
import type { PaySheet } from "./types";

const d = (iso: string | null | undefined) => (iso ? formatTicketDate(iso) : "");

export function sheetFileName(s: PaySheet): string {
  const name = s.driver_name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `PaySheet_${name}_${s.pay_date}.pdf`;
}

/** Short text used as the WhatsApp / email message body. */
export function sheetSummary(s: PaySheet): string {
  const period = s.period_start ? ` (loads ${d(s.period_start)} - ${d(s.period_end)})` : "";
  return [
    `ASG Driver Pay Sheet #${s.sheet_number}`,
    `Driver: ${s.driver_name}${s.truck_number ? ` - Truck #${s.truck_number}` : ""}`,
    `Pay date: ${d(s.pay_date)}${period}`,
    `Loads: ${s.loads_count} - Pay for loads: ${money(s.loads_pay)}`,
    `Hours: ${num(s.total_hours)} - Pay for hours: ${money(s.regular_pay + s.ot_pay)}`,
    `TOTAL PAY: ${money(s.total_pay)}`,
  ].join("\n");
}

/** Letter-size PDF laid out like the client's Excel pay sheet. */
export function buildSheetPdf(s: PaySheet): jsPDF {
  const model = PAY_MODELS[s.pay_model];
  const t = computeTotals({
    revenuePct: s.revenue_pct,
    hourlyRate: s.hourly_rate,
    otRate: s.ot_rate,
    otThreshold: s.ot_threshold,
    loads: s.loads,
    hours: s.hours,
    adjustments: s.adjustments,
  });
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;

  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text(PAYROLL_HEADER.title, W / 2, 46, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(`${PAYROLL_HEADER.phone}  •  ${PAYROLL_HEADER.email}`, W / 2, 60, { align: "center" });
  doc.text(`Sheet #${s.sheet_number}  •  ${model.label}`, W - M, 46, { align: "right" });
  if (s.status === "void") {
    doc.setTextColor(220, 38, 38).setFont("helvetica", "bold").setFontSize(16);
    doc.text("VOID", M, 46);
    doc.setTextColor(0, 0, 0);
  }

  autoTable(doc, {
    startY: 74,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 }, 2: { fontStyle: "bold", cellWidth: 60 } },
    body: [
      ["DRIVER:", s.driver_name, "TRUCK #:", s.truck_number ?? ""],
      ["PAY DATE:", d(s.pay_date), "NOTES:", s.notes ?? ""],
    ],
    margin: { left: M, right: M },
  });

  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
    head: [["LOAD #", "DATE", "REVENUE", `DRIVER PAY @ ${num(s.revenue_pct)}%`, "TICKET #", "COMPANY", model.extraLabel.toUpperCase()]],
    body: s.loads.map((l, i) => [
      `Load ${i + 1}`,
      d(l.date),
      money(l.revenue),
      money((l.revenue * s.revenue_pct) / 100),
      l.load_number,
      l.company,
      l.extra,
    ]),
    foot: [["TOTALS", "", money(t.totalRevenue), money(t.loadsPay), "", "", ""]],
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [39, 39, 42] },
    footStyles: { fillColor: [244, 244, 245], textColor: 20 },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: M, right: M },
  });

  const afterLoads = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  const half = (W - 2 * M - 12) / 2;

  autoTable(doc, {
    startY: afterLoads,
    head: [[`DRIVER HOURS @ ${money(s.hourly_rate)}/HR`, "HOURS", ""]],
    body: s.hours.map((h) => [DAY_LABELS[h.day].toUpperCase(), num(h.hours), h.note]),
    foot: [["TOTAL HOURS", num(t.totalHours), ""]],
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [39, 39, 42] },
    footStyles: { fillColor: [244, 244, 245], textColor: 20 },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: M, right: W - M - half },
  });
  const hoursEnd = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const summary: [string, string][] = [
    ["DRIVER PAY FOR LOADS", money(t.loadsPay)],
    [
      s.ot_rate === null ? "DRIVER PAY FOR HOURS" : `DRIVER PAY FOR HOURS (${num(t.regularHours)} h)`,
      money(t.regularPay),
    ],
  ];
  if (s.ot_rate !== null) {
    summary.push([`DRIVER PAY FOR OT HOURS (${num(t.otHours)} h @ ${money(s.ot_rate)})`, money(t.otPay)]);
  }
  for (const a of s.adjustments) {
    summary.push([a.label, a.deduction ? `-${money(a.amount)}` : money(a.amount)]);
  }
  autoTable(doc, {
    startY: afterLoads,
    body: summary,
    foot: [["TOTAL PAY", money(t.totalPay)]],
    styles: { fontSize: 8, cellPadding: 3 },
    footStyles: { fillColor: [39, 39, 42], fontSize: 10 },
    columnStyles: { 1: { halign: "right", cellWidth: 80 } },
    margin: { left: M + half + 12, right: M },
  });
  const summaryEnd = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(113, 113, 122);
  const audit = [
    `Prepared by ${s.created_by_name ?? "—"} on ${new Date(s.created_at).toLocaleString("en-US", { timeZone: "America/Chicago" })}`,
    s.edit_count > 0
      ? `Last edited by ${s.updated_by_name ?? "—"} on ${new Date(s.updated_at).toLocaleString("en-US", { timeZone: "America/Chicago" })} (${s.edit_count} edit${s.edit_count === 1 ? "" : "s"})`
      : "",
  ].filter(Boolean);
  doc.text(audit, M, Math.max(hoursEnd, summaryEnd) + 18);
  return doc;
}
