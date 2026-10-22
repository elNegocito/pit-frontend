import type { Day, PayModel } from "./models";

export interface LoadLine {
  date: string; // yyyy-MM-dd or ""
  truck: string; // truck used for this load (may differ from the driver's)
  revenue: number;
  load_number: string;
  company: string;
  extra: string; // zone / tons (free text)
  yards: number; // mixer: summed and paid per yard
}

export interface HoursLine {
  day: Day;
  hours: number;
  note: string;
}

export interface Adjustment {
  label: string;
  amount: number;
  deduction: boolean;
}

/** Editable content of a sheet (what the form submits). */
export interface SheetInput {
  driverId: string;
  truckNumber: string;
  payModel: PayModel;
  payDate: string;
  notes: string;
  revenuePct: number;
  hourlyRate: number;
  otRate: number | null;
  otThreshold: number;
  perYardRate: number | null;
  loads: LoadLine[];
  hours: HoursLine[];
  adjustments: Adjustment[];
}

export interface SheetTotals {
  loadsCount: number;
  totalRevenue: number;
  loadsPay: number;
  totalYards: number;
  yardsPay: number;
  totalHours: number;
  regularHours: number;
  otHours: number;
  regularPay: number;
  otPay: number;
  adjustmentsTotal: number;
  totalPay: number;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Same formula as the public.compute_pay_sheet trigger (migration 008), which
 * is the source of truth: this only drives the form's live preview.
 */
export function computeTotals(
  s: Pick<SheetInput, "revenuePct" | "hourlyRate" | "otRate" | "otThreshold" | "perYardRate" | "loads" | "hours" | "adjustments">,
): SheetTotals {
  const totalRevenue = r2(s.loads.reduce((t, l) => t + (Number(l.revenue) || 0), 0));
  const totalYards = r2(s.loads.reduce((t, l) => t + (Number(l.yards) || 0), 0));
  const yardsPay = s.perYardRate === null ? 0 : r2(totalYards * s.perYardRate);
  const totalHours = r2(s.hours.reduce((t, h) => t + (Number(h.hours) || 0), 0));
  const loadsPay = r2((totalRevenue * s.revenuePct) / 100);
  const regularHours = s.otRate === null ? totalHours : Math.min(totalHours, s.otThreshold);
  const otHours = s.otRate === null ? 0 : Math.max(totalHours - s.otThreshold, 0);
  const regularPay = r2(regularHours * s.hourlyRate);
  const otPay = r2(otHours * (s.otRate ?? 0));
  const adjustmentsTotal = r2(
    s.adjustments.reduce((t, a) => t + (a.deduction ? -1 : 1) * (Number(a.amount) || 0), 0),
  );
  return {
    loadsCount: s.loads.length,
    totalRevenue,
    loadsPay,
    totalYards,
    yardsPay,
    totalHours,
    regularHours: r2(regularHours),
    otHours: r2(otHours),
    regularPay,
    otPay,
    adjustmentsTotal,
    totalPay: r2(loadsPay + yardsPay + regularPay + otPay + adjustmentsTotal),
  };
}

/**
 * A load row counts when it has any data (empty template rows are not saved).
 * The truck alone does not count: "Apply to all loads" fills it on blank rows.
 */
export function isFilledLoad(l: LoadLine): boolean {
  return Boolean(
    l.date || l.load_number.trim() || l.company.trim() || l.extra.trim() || Number(l.revenue) || Number(l.yards),
  );
}

/**
 * Accepts what the Excel revenue cell held: a number or a simple product /
 * sum ("25.93*9.5", "27 * 5.95"). Returns null when invalid. No eval: only
 * numbers, * and +.
 */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/[$,\s]/g, "");
  if (s === "") return 0;
  if (!/^\d*\.?\d+([*+]\d*\.?\d+)*$/.test(s)) return null;
  const sum = s
    .split("+")
    .map((term) => term.split("*").reduce((p, f) => p * Number(f), 1))
    .reduce((a, b) => a + b, 0);
  // Like the Excel cell, keep the product's precision (25.93*9.5 = 246.335);
  // only totals are rounded to cents.
  return Number.isFinite(sum) ? Math.round(sum * 10000) / 10000 : null;
}

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export const num = (n: number, digits = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: digits });
