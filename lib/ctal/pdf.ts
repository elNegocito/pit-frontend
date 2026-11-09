import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { formatTicketDate } from "@/lib/timezone";
import { billingTotal, money, pct, qty, rate, statementTotal, sumLoads, sumProfit, weekLabel, type ProfitRow } from "./compute";
import { CTAL } from "./config";
import { BILL_TO_LABEL, type BillTo, type Load, type Week } from "./types";

const M = 36;
const DARK: [number, number, number] = [20, 61, 50];
const SOFT: [number, number, number] = [238, 243, 240];
const lastY = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
const slug = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
const right = (content: string) => ({ content, styles: { halign: "right" as const } });

function header(doc: jsPDF, title: string, lines: string[]) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...DARK);
  doc.text(CTAL.name, M, 44);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90, 90, 90);
  if (CTAL.contact) doc.text(CTAL.contact, M, 58);
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(0, 0, 0);
  doc.text(title, W - M, 40, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9.5);
  doc.text(lines, W - M, 54, { align: "right" });
  return 54 + lines.length * 12 + 6;
}

/** Totals box at the bottom right, like the Excel (SUBTOTAL / fees / TOTAL). */
function totalsBox(doc: jsPDF, lines: [string, string][], total: [string, string]) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = lastY(doc) + 14;
  if (y + (lines.length + 1) * 18 > H - M) {
    doc.addPage();
    y = M;
  }
  autoTable(doc, {
    startY: y,
    theme: "plain",
    body: lines.map(([l, v]) => [l, right(v)]),
    foot: [[total[0], right(total[1])]],
    styles: { fontSize: 10, cellPadding: 3 },
    footStyles: { fillColor: DARK, textColor: 255, fontSize: 11 },
    margin: { left: W - M - 230, right: M },
  });
}

const d = (iso: string) => formatTicketDate(iso);
const weekLines = (week: Week, withPayDate = true) => [`Week ${weekLabel(week.week_start)}`, ...(withPayDate ? [`Pay date ${d(week.pay_date)}`] : [])];

export const statementFileName = (week: Week, carrier: string) => `CTAL_Statement_${slug(carrier)}_${week.week_start}.pdf`;

/** What one carrier is paid for the week. Broker rates are left out on purpose. */
export function buildStatementPdf(week: Week, carrier: string, rows: Load[]): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  const t = sumLoads(rows);
  const startY = header(doc, "Carrier statement", [carrier, ...weekLines(week)]);
  autoTable(doc, {
    startY,
    head: [["Date", "Truck #", "Driver", "Customer", "Ticket", "Qty", "Unit", "Rate", "Amount", "Broker fee", "Quick pay", "FSC $", "FSC %"]],
    body: rows.map((r) => [
      d(r.load_date), r.truck, r.driver, r.customer_name, r.ticket, qty(r.quantity), r.unit, rate(r.carrier_rate), money(r.carrier_amount),
      money(r.broker_fee), money(r.quick_pay_fee), money(r.fsc_amount), r.fsc_mode === "percent" ? pct(r.fsc_value) : "N/A",
    ]),
    foot: [[`${t.loads} load${t.loads === 1 ? "" : "s"}`, "", "", "", "", "", "", "", money(t.carrier_amount), money(t.broker_fee), money(t.quick_pay_fee), money(t.fsc_amount), ""].map((c, i) => (i >= 5 ? right(c) : c)) as RowInput],
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: DARK },
    footStyles: { fillColor: SOFT, textColor: 20 },
    columnStyles: Object.fromEntries([5, 7, 8, 9, 10, 11, 12].map((i) => [i, { halign: "right" as const }])),
    margin: { left: M, right: M },
  });
  totalsBox(
    doc,
    [
      ["Subtotal", money(t.carrier_amount)],
      ["Broker fee", money(t.broker_fee)],
      ["Quick pay fee", money(t.quick_pay_fee)],
      ["FSC", money(t.fsc_amount)],
    ],
    ["TOTAL", money(statementTotal(t))],
  );
  return doc;
}

export const billingFileName = (week: Week, billTo: BillTo) => `CTAL_Billing_${slug(BILL_TO_LABEL[billTo])}_${week.week_start}.pdf`;

/** What one company (ASG / Ready Mix / Excavation) is billed for the week. */
export function buildBillingPdf(week: Week, billTo: BillTo, rows: Load[]): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  const t = sumLoads(rows);
  const startY = header(doc, `Billing: ${BILL_TO_LABEL[billTo]}`, weekLines(week, false));
  autoTable(doc, {
    startY,
    head: [["Date", "Company", "Truck #", "Driver", "Customer", "Ticket", "Qty", "Unit", "Broker rate", "Broker amount", "FSC $", "FSC %"]],
    body: rows.map((r) => [
      d(r.load_date), r.carrier_name, r.truck, r.driver, r.customer_name, r.ticket, qty(r.quantity), r.unit, rate(r.broker_rate),
      money(r.broker_amount), money(r.fsc_amount), r.fsc_mode === "percent" ? pct(r.fsc_value) : "N/A",
    ]),
    foot: [[`${t.loads} load${t.loads === 1 ? "" : "s"}`, "", "", "", "", "", "", "", "", money(t.broker_amount), money(t.fsc_amount), ""].map((c, i) => (i >= 6 ? right(c) : c)) as RowInput],
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: DARK },
    footStyles: { fillColor: SOFT, textColor: 20 },
    columnStyles: Object.fromEntries([6, 8, 9, 10, 11].map((i) => [i, { halign: "right" as const }])),
    margin: { left: M, right: M },
  });
  totalsBox(doc, [["Subtotal", money(t.broker_amount)], ["FSC", money(t.fsc_amount)]], ["TOTAL", money(billingTotal(t))]);
  return doc;
}

export const profitFileName = (week: Week) => `CTAL_Broker_Profit_${week.week_start}.pdf`;

export function buildProfitPdf(week: Week, rows: ProfitRow[]): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  const g = sumProfit(rows);
  const startY = header(doc, "Broker profit", [...weekLines(week), `${g.loads} loads, ${rows.length} companies`]);
  const line = (r: ProfitRow) => [
    r.name, String(r.loads), money(r.carrier_amount), money(r.broker_amount), money(r.difference), money(r.broker_fee), money(r.quick_pay),
    money(r.fsc), money(r.total), money(r.total_with_fsc),
  ];
  autoTable(doc, {
    startY,
    head: [["Company", "Loads", "Carrier amount", "Broker amount", "Difference", "Broker fee", "Quick pay", "FSC $", "Total without FSC", "Total with FSC"]],
    body: rows.map(line),
    foot: [line(g).map((c, i) => (i >= 1 ? right(c) : c)) as RowInput],
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: DARK },
    footStyles: { fillColor: SOFT, textColor: 20 },
    columnStyles: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => [i, { halign: "right" as const }])),
    margin: { left: M, right: M },
  });
  return doc;
}

// ---------------------------------------------------------------- browser helpers

export function downloadPdf(doc: jsPDF, name: string) {
  downloadBlob(doc.output("blob"), name);
}

export function printPdf(doc: jsPDF) {
  doc.autoPrint();
  const url = URL.createObjectURL(doc.output("blob"));
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
