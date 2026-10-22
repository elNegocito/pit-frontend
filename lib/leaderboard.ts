// Public haulers leaderboard: aggregate drivers ranked by loads hauled.
// Data comes from public.public_driver_production (migration 010), which
// only exposes a short name + loads + tons per month.

export interface ProductionRow {
  driver_id: string;
  driver_label: string;
  month: number; // 1-12
  loads: number;
  tons: number | string; // numeric arrives as string
}

export interface Standing {
  driverId: string;
  name: string;
  rank: number; // ties share a rank (1, 1, 3)
  loads: number;
  tons: number;
  /** Loads per month (index 0 = January), for the yearly view. */
  byMonth: number[];
}

/**
 * Totals per driver over the given months, ranked by loads, then tons.
 * `months` = [m] for the monthly board, all twelve for the year.
 */
export function rank(rows: ProductionRow[], months: number[]): Standing[] {
  const byDriver = new Map<string, Standing>();
  for (const r of rows) {
    if (!months.includes(r.month)) continue;
    const s =
      byDriver.get(r.driver_id) ??
      ({ driverId: r.driver_id, name: r.driver_label, rank: 0, loads: 0, tons: 0, byMonth: Array(12).fill(0) } as Standing);
    s.loads += r.loads;
    s.tons += Number(r.tons);
    s.byMonth[r.month - 1] += r.loads;
    byDriver.set(r.driver_id, s);
  }
  const list = [...byDriver.values()].sort(
    (a, b) => b.loads - a.loads || b.tons - a.tons || a.name.localeCompare(b.name),
  );
  list.forEach((s, i) => {
    const prev = list[i - 1];
    s.rank = prev && prev.loads === s.loads && prev.tons === s.tons ? prev.rank : i + 1;
    s.tons = Math.round(s.tons * 100) / 100;
  });
  return list;
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-10" -> { year: 2026, month: 10 }, null when malformed. */
export function parseMonth(v: string | undefined): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(v ?? "");
  if (!m) return null;
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? { year: Number(m[1]), month } : null;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** The month before / after, as "yyyy-MM". */
export function shiftMonth(year: number, month: number, delta: number): string {
  const i = year * 12 + (month - 1) + delta;
  return monthKey(Math.floor(i / 12), (i % 12) + 1);
}
