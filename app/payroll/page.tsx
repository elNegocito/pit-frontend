import Link from "next/link";
import { requirePayroll } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatTicketDate } from "@/lib/timezone";
import { money, num } from "@/lib/payroll/compute";
import { isPayModel, PAY_MODEL_KEYS, PAY_MODELS } from "@/lib/payroll/models";
import { PayrollHeader } from "@/components/payroll/PayrollHeader";

const PAGE_SIZE = 50;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const LIST_SELECT =
  "id, sheet_number, driver_name, truck_number, pay_model, pay_date, period_start, period_end, loads_count, total_hours, total_pay, status, created_by_name, updated_by_name, edit_count";

type Row = {
  id: string;
  sheet_number: number;
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
    status: one(sp.status) || "active",
  };
  const page = Math.max(1, parseInt(one(sp.page) || "1", 10) || 1);
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
  if (f.status === "active" || f.status === "void") q = q.eq("status", f.status);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await q
    .order("pay_date", { ascending: false })
    .order("sheet_number", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  const rows = (data ?? []) as Row[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
            <input name="driver" defaultValue={f.driver} placeholder="Name" className="mt-1 w-full rounded-lg border px-3 py-2" />
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
            <input name="by" defaultValue={f.by} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="text-sm font-medium">
            Status
            <select name="status" defaultValue={f.status} className="mt-1 w-full rounded-lg border px-3 py-2">
              <option value="active">Active</option>
              <option value="void">Void</option>
              <option value="all">All</option>
            </select>
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
            <button className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white">Search</button>
            <Link href="/payroll" className="rounded-lg border px-4 py-2 text-sm hover:bg-zinc-100">
              Clear
            </Link>
            <span className="ml-auto text-sm text-zinc-500">{total} sheets</span>
          </div>
        </form>

        <div className="overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b text-left text-xs text-zinc-500 uppercase">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Pay date</th>
                <th className="px-3 py-2">Driver</th>
                <th className="px-3 py-2">Truck</th>
                <th className="px-3 py-2">Drives</th>
                <th className="px-3 py-2">Loads period</th>
                <th className="px-3 py-2 text-right">Loads</th>
                <th className="px-3 py-2 text-right">Hours</th>
                <th className="px-3 py-2 text-right">Total pay</th>
                <th className="px-3 py-2">Prepared by</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-b border-zinc-100 hover:bg-zinc-50 ${r.status === "void" ? "text-zinc-400 line-through" : ""}`}>
                  <td className="px-3 py-2">
                    <Link href={`/payroll/${r.id}`} className="font-medium text-zinc-900 underline-offset-2 hover:underline">
                      {r.sheet_number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{d(r.pay_date)}</td>
                  <td className="px-3 py-2">
                    <Link href={`/payroll/${r.id}`} className="hover:underline">
                      {r.driver_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.truck_number}</td>
                  <td className="px-3 py-2">{isPayModel(r.pay_model) ? PAY_MODELS[r.pay_model].label : r.pay_model}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.period_start ? `${d(r.period_start)} – ${d(r.period_end)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.loads_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(Number(r.total_hours))}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(Number(r.total_pay))}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.created_by_name}
                    {r.edit_count > 0 && <span className="block text-zinc-500">edited by {r.updated_by_name}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.status === "void" ? (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-700 no-underline">VOID</span>
                    ) : r.edit_count > 0 ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">Edited</span>
                    ) : null}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-zinc-400">
                    No pay sheets found.{" "}
                    <Link href="/payroll/new" className="underline">
                      Create one
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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
