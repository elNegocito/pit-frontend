import Link from "next/link";
import { requirePayroll } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatTicketDate, todayInPit } from "@/lib/timezone";
import { money, num } from "@/lib/payroll/compute";
import { isPayModel, PAY_MODEL_KEYS, PAY_MODELS, type PayModel } from "@/lib/payroll/models";
import { sheetState } from "@/lib/payroll/status";
import { DRIVER_SELECT, toDriver } from "@/lib/payroll/types";
import { PayrollHeader } from "@/components/payroll/PayrollHeader";
import { SheetBadge } from "@/components/payroll/SheetBadge";
import { FilterCombobox } from "@/components/payroll/FilterCombobox";

const PAGE_SIZE = 50;
// The week's view lists every current sheet on one page (a handful per driver).
const CURRENT_LIMIT = 1000;
// Same order as the Drivers page.
const GROUPS: PayModel[] = ["mixer", "trucking", "flatbed"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const LIST_SELECT =
  "id, sheet_number, driver_id, driver_name, truck_number, pay_model, pay_date, period_start, period_end, loads_count, total_hours, total_pay, status, created_by_name, updated_by_name, edit_count";

type Row = {
  id: string;
  sheet_number: number;
  driver_id: string;
  driver_name: string;
  truck_number: string | null;
  pay_model: string;
  pay_date: string;
  period_start: string | null;
  period_end: string | null;
  loads_count: number;
  total_hours: number | string;
  total_pay: number | string;
  status: "active" | "void";
  created_by_name: string | null;
  updated_by_name: string | null;
  edit_count: number;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const d = (iso: string | null) => (iso ? formatTicketDate(iso) : "");

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePayroll();
  const sp = await searchParams;
  const f = {
    driver: one(sp.driver).trim(),
    model: one(sp.model),
    from: one(sp.from),
    to: one(sp.to),
    worked: one(sp.worked),
    by: one(sp.by).trim(),
    status: one(sp.status),
  };
  const page = Math.max(1, parseInt(one(sp.page) || "1", 10) || 1);
  const today = todayInPit();
  // Old sheets only show up when looked for: any search widens the default
  // from this week's sheets to everything (finished and void included).
  const searching = Boolean(
    f.driver || ISO_DATE.test(f.from) || ISO_DATE.test(f.to) || ISO_DATE.test(f.worked) || f.by,
  );
  const status = ["current", "finished", "void", "all"].includes(f.status) ? f.status : searching ? "all" : "current";
  const weekView = status === "current" && !searching;
  const like = (s: string) => `%${s.replace(/[%_\\,()]/g, "")}%`;

  const supabase = await createClient();
  let q = supabase.from("pay_sheets").select(LIST_SELECT, { count: "exact" });
  if (f.driver) q = q.ilike("driver_name", like(f.driver));
  if (isPayModel(f.model)) q = q.eq("pay_model", f.model);
  if (ISO_DATE.test(f.from)) q = q.gte("pay_date", f.from);
  if (ISO_DATE.test(f.to)) q = q.lte("pay_date", f.to);
  // "Who worked on day X": sheets with a load dated that day (jsonb containment).
  // JSON string on purpose: supabase-js would encode an array as a Postgres array literal.
  if (ISO_DATE.test(f.worked)) q = q.contains("loads", JSON.stringify([{ date: f.worked }]));
  if (f.by) q = q.or(`created_by_name.ilike.${like(f.by)},updated_by_name.ilike.${like(f.by)}`);
  if (status === "current") q = q.eq("status", "active").gte("pay_date", today);
  if (status === "finished") q = q.eq("status", "active").lt("pay_date", today);
  if (status === "void") q = q.eq("status", "void");
  const size = weekView ? CURRENT_LIMIT : PAGE_SIZE;
  const from = (page - 1) * size;
  const [{ data, count }, { data: driverRows }, { data: authorRows }] = await Promise.all([
    q
      .order("pay_date", { ascending: false })
      .order("sheet_number", { ascending: false })
      .range(from, from + size - 1),
    supabase.from("drivers").select(DRIVER_SELECT).order("name"),
    // Names for the "Prepared / edited by" filter (snapshots on the sheets:
    // payroll users cannot read other users' profiles).
    supabase.from("pay_sheets").select("created_by_name, updated_by_name").order("updated_at", { ascending: false }).limit(1000),
  ]);
  const rows = (data ?? []) as Row[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / size));

  // One card per driver with the sheets found. The week's view also lists the
  // active drivers still without a sheet, so a missing one stands out.
  const drivers = (driverRows ?? []).map(toDriver);
  const authors = [
    ...new Set((authorRows ?? []).flatMap((r) => [r.created_by_name, r.updated_by_name]).filter((n): n is string => Boolean(n))),
  ].sort();
  const byDriver = new Map<string, Row[]>();
  for (const r of rows) byDriver.set(r.driver_id, [...(byDriver.get(r.driver_id) ?? []), r]);
  const cards = drivers
    .filter((x) => byDriver.has(x.id) || (weekView && x.active && (!isPayModel(f.model) || x.pay_model === f.model)))
    .map((driver) => ({ driver, sheets: byDriver.get(driver.id) ?? [] }));

  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
    u.set("page", String(p));
    return `/payroll?${u}`;
  };

  return (
    <main className="min-h-full flex-1 bg-zinc-100 px-4 py-6">
      <PayrollHeader title="Driver pay sheets" role={user.role} />

      <div className="mx-auto w-full max-w-6xl space-y-4">
        <form className="grid gap-3 rounded-2xl bg-white p-4 shadow sm:grid-cols-3 lg:grid-cols-7">
          <label className="text-sm font-medium lg:col-span-2">
            Driver
            <FilterCombobox key={f.driver} name="driver" defaultValue={f.driver} options={drivers.map((x) => x.name)} placeholder="Name" />
          </label>
          <label className="text-sm font-medium">
            Drives
            <select name="model" defaultValue={f.model} className="mt-1 w-full rounded-lg border px-3 py-2">
              <option value="">All</option>
              {PAY_MODEL_KEYS.map((k) => (
                <option key={k} value={k}>
                  {PAY_MODELS[k].label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Pay date from
            <input type="date" name="from" defaultValue={f.from} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="text-sm font-medium">
            Pay date to
            <input type="date" name="to" defaultValue={f.to} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="text-sm font-medium" title="Sheets whose loads cover this day">
            Worked on
            <input type="date" name="worked" defaultValue={f.worked} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="text-sm font-medium">
            Prepared / edited by
            <FilterCombobox key={f.by} name="by" defaultValue={f.by} options={authors} />
          </label>
          <label className="text-sm font-medium">
            Status
            <select name="status" defaultValue={f.status} className="mt-1 w-full rounded-lg border px-3 py-2">
              <option value="">Default</option>
              <option value="current">Active</option>
              <option value="finished">Finished</option>
              <option value="void">Void</option>
              <option value="all">All</option>
            </select>
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
            <button className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white">Search</button>
            <Link href="/payroll" className="rounded-lg border px-4 py-2 text-sm hover:bg-zinc-100">
              Clear
            </Link>
            <span className="ml-auto text-sm text-zinc-500">
              {total} sheets{weekView ? " this week" : ""}
            </span>
          </div>
        </form>

        {GROUPS.map((model) => {
          const list = cards.filter((c) => c.driver.pay_model === model);
          if (list.length === 0) return null;
          return (
            <details key={model} open className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 select-none [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="text-xs text-zinc-500 transition-transform group-open:rotate-90">▶</span>
                <h2 className="text-base font-semibold">
                  {PAY_MODELS[model].label} <span className="font-normal text-zinc-500">({list.length})</span>
                </h2>
              </summary>
              <div className="mt-3 space-y-3">
              {list.map(({ driver, sheets }) => (
                <div key={driver.id} className="rounded-2xl bg-white p-4 shadow">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-semibold">{driver.name}</span>
                    {driver.truck_number && <span className="text-sm text-zinc-500">Truck #{driver.truck_number}</span>}
                    {!driver.active && <span className="text-xs text-zinc-400">Inactive driver</span>}
                    {driver.active && (
                      <Link href={`/payroll/new?driver=${driver.id}`} className="ml-auto rounded-lg border px-3 py-1 text-sm hover:bg-zinc-100">
                        + New sheet
                      </Link>
                    )}
                  </div>
                  {sheets.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-400">No sheet this week.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-zinc-100 border-t border-zinc-100">
                      {sheets.map((r) => {
                        const state = sheetState(r.status, r.pay_date, today);
                        return (
                          <li key={r.id}>
                            <Link
                              href={`/payroll/${r.id}`}
                              className={`flex flex-wrap items-center gap-x-5 gap-y-1 px-1 py-2 text-sm hover:bg-zinc-50 ${state === "void" ? "text-zinc-400" : ""}`}
                            >
                              <span className="font-medium">#{r.sheet_number}</span>
                              <span>Pay date {d(r.pay_date)}</span>
                              <span className="text-xs text-zinc-500">
                                {r.period_start ? `Loads ${d(r.period_start)} – ${d(r.period_end)}` : "No loads yet"}
                              </span>
                              <span className="tabular-nums">{r.loads_count} loads</span>
                              <span className="tabular-nums">{num(Number(r.total_hours))} h</span>
                              <span className="text-xs text-zinc-500">
                                {r.created_by_name}
                                {r.edit_count > 0 && ` · edited by ${r.updated_by_name}`}
                              </span>
                              <span className="ml-auto flex items-center gap-3">
                                <span className={`font-semibold tabular-nums ${state === "void" ? "line-through" : ""}`}>
                                  {money(Number(r.total_pay))}
                                </span>
                                <SheetBadge state={state} />
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
              </div>
            </details>
          );
        })}
        {cards.length === 0 && (
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-zinc-400 shadow">
            No pay sheets found.{" "}
            <Link href="/payroll/new" className="underline">
              Create one
            </Link>
          </p>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 text-sm">
            {page > 1 && (
              <Link href={qs(page - 1)} className="rounded-lg border bg-white px-3 py-1.5">
                ← Prev
              </Link>
            )}
            <span>
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link href={qs(page + 1)} className="rounded-lg border bg-white px-3 py-1.5">
                Next →
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
