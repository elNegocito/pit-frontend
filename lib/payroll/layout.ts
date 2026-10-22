import { formatTicketDate } from "@/lib/timezone";
import { money, num, type LoadLine } from "./compute";
import { PAY_MODELS } from "./models";
import type { PaySheet } from "./types";

export interface LoadColumn {
  header: string;
  right?: boolean;
  cell: (l: LoadLine, i: number) => string;
  /** Text in the totals row under this column ("" = blank). */
  total: string;
}

const d = (iso: string) => (iso ? formatTicketDate(iso) : "");

/**
 * Loads table columns of a saved sheet, shared by the on-screen view and the
 * PDF. Revenue models (flat bed, aggregate): date, truck, revenue, pay %,
 * ticket, company, zone/tons. Mixer: date, truck, ticket, yards (+ total).
 */
export function loadColumns(s: PaySheet): LoadColumn[] {
  const model = PAY_MODELS[s.pay_model];
  const cols: LoadColumn[] = [
    { header: "Load #", cell: (_, i) => `Load ${i + 1}`, total: "TOTALS" },
    { header: "Date", cell: (l) => d(l.date), total: "" },
    { header: "Truck #", cell: (l) => l.truck, total: "" },
  ];
  if (model.byRevenue) {
    cols.push(
      { header: "Revenue", right: true, cell: (l) => money(l.revenue), total: money(s.total_revenue) },
      {
        header: `Driver pay @ ${num(s.revenue_pct)}%`,
        right: true,
        cell: (l) => money((l.revenue * s.revenue_pct) / 100),
        total: money(s.loads_pay),
      },
    );
  }
  cols.push({ header: "Ticket #", cell: (l) => l.load_number, total: "" });
  if (model.byRevenue) cols.push({ header: "Company", cell: (l) => l.company, total: "" });
  cols.push(
    model.extraLabel
      ? { header: model.extraLabel, cell: (l) => l.extra, total: "" }
      : { header: "Yards", right: true, cell: (l) => num(l.yards), total: num(s.total_yards) },
  );
  return cols;
}

/** Summary lines above TOTAL PAY (pay for loads / yards / hours / OT / extras). */
export function summaryLines(s: PaySheet): { label: string; amount: number; deduction?: boolean }[] {
  const model = PAY_MODELS[s.pay_model];
  const lines: { label: string; amount: number; deduction?: boolean }[] = [];
  if (model.byRevenue || s.loads_pay) lines.push({ label: "DRIVER PAY FOR LOADS", amount: s.loads_pay });
  if (s.per_yard_rate !== null) {
    lines.push({
      label: `EXTRA PER YARD (${num(s.total_yards)} yds × ${money(s.per_yard_rate)})`,
      amount: s.yards_pay,
    });
  }
  const regularHours = s.ot_rate === null ? s.total_hours : Math.min(s.total_hours, s.ot_threshold);
  lines.push({
    label: s.ot_rate === null ? "DRIVER PAY FOR HOURS" : `DRIVER PAY FOR HOURS (${num(regularHours)} h)`,
    amount: s.regular_pay,
  });
  if (s.ot_rate !== null) {
    const otHours = Math.max(s.total_hours - s.ot_threshold, 0);
    lines.push({ label: `DRIVER PAY FOR OT HOURS (${num(otHours)} h @ ${money(s.ot_rate)})`, amount: s.ot_pay });
  }
  for (const a of s.adjustments) lines.push({ label: a.label, amount: a.amount, deduction: a.deduction });
  return lines;
}
