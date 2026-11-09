import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatTicketDate, todayInPit } from "@/lib/timezone";
import { billingTotal, money, statementTotal, sumLoads, weekLabel, weekStartOf } from "@/lib/ctal/compute";
import { toLoad, WEEK_SELECT, type Load, type Week } from "@/lib/ctal/types";
import { card, td, th } from "@/lib/ctal/ui";
import { NewWeekForm } from "@/components/ctal/NewWeekForm";

const SUMMARY = "week_id, carrier_id, carrier_name, bill_to, quantity, carrier_amount, broker_amount, broker_fee, quick_pay_fee, fsc_amount";

export default async function WeeksPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("ctal_weeks").select(WEEK_SELECT).order("week_start", { ascending: false }).limit(60);
  const weeks = (data ?? []) as Week[];
  const { data: rows } = weeks.length
    ? await supabase.from("ctal_loads").select(SUMMARY).in("week_id", weeks.map((w) => w.id)).limit(20000)
    : { data: [] };
  const byWeek = new Map<string, Load[]>();
  for (const r of rows ?? []) {
    const list = byWeek.get(r.week_id as string) ?? [];
    list.push(toLoad(r));
    byWeek.set(r.week_id as string, list);
  }
  // Invoices come in on Monday for the week that just ended.
  const suggested = addDays(weekStartOf(todayInPit()), -7);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Weeks</h1>
          <p className="max-w-2xl text-sm text-zinc-600">One log per week, Sunday to Saturday. Every week stays here, so an old statement can be opened and printed again.</p>
        </div>
        <NewWeekForm suggested={suggested} />
      </div>
      {weeks.length === 0 ? (
        <p className={`${card} px-4 py-10 text-center text-sm text-zinc-600`}>No weeks yet. Pick a day above and start the first one.</p>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-rule bg-pine-50">
                <th className={th}>Week</th>
                <th className={th}>Pay date</th>
                <th className={`${th} text-right`}>Loads</th>
                <th className={`${th} text-right`}>Carriers</th>
                <th className={`${th} text-right`}>Pay to carriers</th>
                <th className={`${th} text-right`}>Billing</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => {
                const list = byWeek.get(w.id) ?? [];
                const t = sumLoads(list);
                return (
                  <tr key={w.id} className="border-b border-rule last:border-0 hover:bg-pine-50/50">
                    <td className={`${td} font-medium tabular-nums`}>
                      <Link href={`/ctal/weeks/${w.id}`} className="text-pine-900 hover:underline">{weekLabel(w.week_start)}</Link>
                    </td>
                    <td className={`${td} tabular-nums`}>{formatTicketDate(w.pay_date)}</td>
                    <td className={`${td} text-right tabular-nums`}>{t.loads}</td>
                    <td className={`${td} text-right tabular-nums`}>{new Set(list.map((l) => l.carrier_id)).size}</td>
                    <td className={`${td} text-right tabular-nums`}>{money(statementTotal(t))}</td>
                    <td className={`${td} text-right tabular-nums`}>{money(billingTotal(t))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
