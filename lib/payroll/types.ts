import type { Adjustment, HoursLine, LoadLine } from "./compute";
import type { PayModel } from "./models";

export interface Driver {
  id: string;
  name: string;
  pay_model: PayModel;
  truck_number: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
}

/** A stored pay sheet (totals as computed and frozen by the DB trigger). */
export interface PaySheet {
  id: string;
  sheet_number: number;
  driver_id: string;
  driver_name: string;
  truck_number: string | null;
  pay_model: PayModel;
  pay_date: string;
  notes: string | null;
  revenue_pct: number;
  hourly_rate: number;
  ot_rate: number | null;
  ot_threshold: number;
  loads: LoadLine[];
  hours: HoursLine[];
  adjustments: Adjustment[];
  loads_count: number;
  total_revenue: number;
  loads_pay: number;
  total_hours: number;
  regular_pay: number;
  ot_pay: number;
  adjustments_total: number;
  total_pay: number;
  period_start: string | null;
  period_end: string | null;
  status: "active" | "void";
  created_by_name: string | null;
  created_at: string;
  updated_by_name: string | null;
  updated_at: string;
  edit_count: number;
}

export interface PaySheetEvent {
  id: string;
  action: "create" | "edit" | "void";
  changes: Record<string, { from: unknown; to: unknown }>;
  actor_name: string | null;
  created_at: string;
}

export const SHEET_SELECT =
  "id, sheet_number, driver_id, driver_name, truck_number, pay_model, pay_date, notes, revenue_pct, hourly_rate, ot_rate, ot_threshold, loads, hours, adjustments, loads_count, total_revenue, loads_pay, total_hours, regular_pay, ot_pay, adjustments_total, total_pay, period_start, period_end, status, created_by_name, created_at, updated_by_name, updated_at, edit_count";

/** numeric columns arrive as strings from PostgREST: normalize once. */
export function toSheet(r: Record<string, unknown>): PaySheet {
  const n = (v: unknown) => Number(v ?? 0);
  return {
    ...(r as unknown as PaySheet),
    revenue_pct: n(r.revenue_pct),
    hourly_rate: n(r.hourly_rate),
    ot_rate: r.ot_rate === null ? null : n(r.ot_rate),
    ot_threshold: n(r.ot_threshold),
    total_revenue: n(r.total_revenue),
    loads_pay: n(r.loads_pay),
    total_hours: n(r.total_hours),
    regular_pay: n(r.regular_pay),
    ot_pay: n(r.ot_pay),
    adjustments_total: n(r.adjustments_total),
    total_pay: n(r.total_pay),
  };
}
