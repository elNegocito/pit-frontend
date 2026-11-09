import { addDays, formatTicketDate } from "@/lib/timezone";
import type { BillTo, Carrier, CtalCustomer, FeeKind, FscMode, LoadAmounts, Unit } from "./types";

const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

/** Mirror of the `compute_ctal_load` trigger (migration 012), for the live preview. */
export function computeLoad(l: {
  quantity: number;
  unit: Unit;
  broker_rate: number;
  carrier_rate: number;
  fee_kind: FeeKind;
  fee_pct: number;
  fsc_mode: FscMode;
  fsc_value: number;
}): LoadAmounts {
  // YDS and LOAD are paid per load: the rate counts once whatever the quantity.
  const factor = l.unit === "TON" || l.unit === "HR" ? l.quantity || 0 : 1;
  const carrier_amount = round4(factor * (l.carrier_rate || 0));
  const broker_amount = round4(factor * (l.broker_rate || 0));
  // `|| 0` keeps a zero fee from showing as -0.
  const fee = -round4((carrier_amount * (l.fee_pct || 0)) / 100) || 0;
  const fsc_amount =
    l.fsc_mode === "percent" ? round4((carrier_amount * (l.fsc_value || 0)) / 100) : l.fsc_mode === "fixed" ? l.fsc_value || 0 : 0;
  return {
    carrier_amount,
    broker_amount,
    broker_fee: l.fee_kind === "broker_fee" ? fee : 0,
    quick_pay_fee: l.fee_kind === "quick_pay" ? fee : 0,
    fsc_amount,
  };
}

/** Fee and FSC a new row starts with: the customer's rules, minus quick pay for 28-day carriers. */
export function defaultRules(customer: CtalCustomer | null, carrier: Pick<Carrier, "pay_term"> | null) {
  const fee_kind: FeeKind = customer?.fee_kind ?? "quick_pay";
  const base = customer?.fee_pct ?? 3.5;
  return {
    fee_kind,
    fee_pct: fee_kind === "quick_pay" && carrier?.pay_term === "28" ? 0 : base,
    fsc_mode: (customer?.fsc_mode ?? "none") as FscMode,
    fsc_value: customer?.fsc_value ?? 0,
  };
}

type Row = LoadAmounts & { quantity: number; carrier_id: string | null; carrier_name: string; bill_to: BillTo };

export interface Totals {
  loads: number;
  quantity: number;
  carrier_amount: number;
  broker_amount: number;
  broker_fee: number;
  quick_pay_fee: number;
  fsc_amount: number;
}

export function sumLoads(rows: Row[]): Totals {
  const t: Totals = { loads: 0, quantity: 0, carrier_amount: 0, broker_amount: 0, broker_fee: 0, quick_pay_fee: 0, fsc_amount: 0 };
  for (const r of rows) {
    t.loads += 1;
    t.quantity += r.quantity || 0;
    t.carrier_amount += r.carrier_amount;
    t.broker_amount += r.broker_amount;
    t.broker_fee += r.broker_fee;
    t.quick_pay_fee += r.quick_pay_fee;
    t.fsc_amount += r.fsc_amount;
  }
  return t;
}

/** What the carrier is paid: carrier amount + (negative) fees + FSC. */
export const statementTotal = (t: Totals) => t.carrier_amount + t.broker_fee + t.quick_pay_fee + t.fsc_amount;

/** What the company is billed: broker amount + FSC. */
export const billingTotal = (t: Totals) => t.broker_amount + t.fsc_amount;

/** Rows grouped by carrier, in carrier name order. */
export function byCarrier<T extends Row>(rows: T[]): { carrierId: string; name: string; rows: T[]; totals: Totals }[] {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    if (!r.carrier_id) continue;
    const list = groups.get(r.carrier_id);
    if (list) list.push(r);
    else groups.set(r.carrier_id, [r]);
  }
  return [...groups.entries()]
    .map(([carrierId, list]) => ({ carrierId, name: list[0].carrier_name, rows: list, totals: sumLoads(list) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface ProfitRow {
  name: string;
  loads: number;
  carrier_amount: number;
  broker_amount: number;
  difference: number;
  broker_fee: number;
  quick_pay: number;
  fsc: number;
  total: number;
  total_with_fsc: number;
}

/** The Excel "Profit" sheet: every figure shown as a positive number. */
export function profitRows(rows: Row[]): ProfitRow[] {
  return byCarrier(rows).map(({ name, totals: t }) => {
    const difference = Math.abs(t.carrier_amount - t.broker_amount);
    const broker_fee = Math.abs(t.broker_fee);
    const quick_pay = Math.abs(t.quick_pay_fee);
    const fsc = Math.abs(t.fsc_amount);
    const total = difference + broker_fee + quick_pay;
    return { name, loads: t.loads, carrier_amount: t.carrier_amount, broker_amount: t.broker_amount, difference, broker_fee, quick_pay, fsc, total, total_with_fsc: total + fsc };
  });
}

export function sumProfit(rows: ProfitRow[]): ProfitRow {
  const z: ProfitRow = { name: "Grand total", loads: 0, carrier_amount: 0, broker_amount: 0, difference: 0, broker_fee: 0, quick_pay: 0, fsc: 0, total: 0, total_with_fsc: 0 };
  for (const r of rows) {
    z.loads += r.loads;
    z.carrier_amount += r.carrier_amount;
    z.broker_amount += r.broker_amount;
    z.difference += r.difference;
    z.broker_fee += r.broker_fee;
    z.quick_pay += r.quick_pay;
    z.fsc += r.fsc;
    z.total += r.total;
    z.total_with_fsc += r.total_with_fsc;
  }
  return z;
}

// ---------------------------------------------------------------- weeks

/** Sunday of the week `isoDate` falls in. */
export function weekStartOf(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return addDays(isoDate, -new Date(Date.UTC(y, m - 1, d)).getUTCDay());
}

/** Invoices arrive the Monday after the week and are paid that Friday. */
export const payDateOf = (weekStart: string) => addDays(weekStart, 12);

/** "10/25/2026 - 10/31/2026" */
export const weekLabel = (weekStart: string) => `${formatTicketDate(weekStart)} - ${formatTicketDate(addDays(weekStart, 6))}`;

// ---------------------------------------------------------------- insurance

export type InsuranceState = "ok" | "soon" | "expired" | "unknown";

/** Expired, or expiring within 30 days of `today` (yyyy-MM-dd). */
export function insuranceState(c: Pick<Carrier, "ins_exp" | "ins_note">, today: string): InsuranceState {
  if (!c.ins_exp) return /expired/i.test(c.ins_note ?? "") ? "expired" : "unknown";
  if (c.ins_exp < today) return "expired";
  return c.ins_exp <= addDays(today, 30) ? "soon" : "ok";
}

// ---------------------------------------------------------------- format

export const money = (n: number) => (Math.round((n + Number.EPSILON) * 100) / 100 || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
export const qty = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const rate = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
export const pct = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 3 })}%`;
export const fileSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
