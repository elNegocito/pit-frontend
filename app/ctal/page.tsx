import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatTicketDate, todayInPit } from "@/lib/timezone";
import { billingTotal, byCarrier, insuranceState, money, profitRows, statementTotal, sumLoads, sumProfit, weekLabel, weekStartOf } from "@/lib/ctal/compute";
import { loadCarriers, loadWeek } from "@/lib/ctal/queries";
import { WEEK_SELECT, type Week } from "@/lib/ctal/types";
import { btn, btnPrimary, card } from "@/lib/ctal/ui";
import { GlobalSearch } from "@/components/ctal/GlobalSearch";
import { InsuranceBadge } from "@/components/ctal/InsuranceBadge";
import { NewWeekForm } from "@/components/ctal/NewWeekForm";

export default async function CtalHome() {
  await requireAdmin();
  const supabase = await createClient();
  const [carriers, { data: weekRows }] = await Promise.all([
    loadCarriers(supabase),
    supabase.from("ctal_weeks").select(WEEK_SELECT).order("week_start", { ascending: false }).limit(60),
  ]);
  const weeks = (weekRows ?? []) as Week[];
  const today = todayInPit();
  const current = weeks[0];
  const loads = current ? (await loadWeek(supabase, current.id)).loads : [];
  const t = sumLoads(loads);
  const profit = sumProfit(profitRows(loads));
  const active = carriers.filter((c) => c.active);
  const attention = active
    .filter((c) => ["expired", "soon"].includes(insuranceState(c, today)))
    .sort((a, b) => (a.ins_exp ?? "").localeCompare(b.ins_exp ?? ""));

  return (
    <div className="space-y-6">
      <GlobalSearch carriers={carriers} weeks={weeks} />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className={`${card} p-5`} aria-labelledby="week-h">
          {current ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 id="week-h" className="text-2xl font-semibold tracking-tight tabular-nums">Week {weekLabel(current.week_start)}</h1>
                  <p className="text-sm text-zinc-600">
                    Paid on Friday {formatTicketDate(current.pay_date)}. {t.loads} loads from {byCarrier(loads).length} carriers so far.
                  </p>
                </div>
                <Link href={`/ctal/weeks/${current.id}`} className={btnPrimary}>Open the log</Link>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                {(
                  [
                    ["Pay to carriers", statementTotal(t), `/ctal/weeks/${current.id}/statements`],
                    ["Billing", billingTotal(t), `/ctal/weeks/${current.id}/billing`],
                    ["Profit without FSC", profit.total, `/ctal/weeks/${current.id}/profit`],
                    ["Profit with FSC", profit.total_with_fsc, `/ctal/weeks/${current.id}/profit`],
                  ] as const
                ).map(([k, v, href]) => (
                  <div key={k}>
                    <dt className="text-sm text-zinc-600">{k}</dt>
                    <dd className="text-xl font-semibold tabular-nums">
                      <Link href={href} className="hover:underline">{money(v)}</Link>
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-rule pt-4">
                <Link href={`/ctal/weeks/${current.id}/statements`} className={btn}>Send statements</Link>
                <Link href={`/ctal/weeks/${current.id}/billing`} className={btn}>Billing sheets</Link>
                <Link href="/ctal/weeks" className={btn}>Earlier weeks</Link>
              </div>
            </>
          ) : (
            <>
              <h1 id="week-h" className="text-2xl font-semibold tracking-tight">Start the first week</h1>
              <p className="mt-1 mb-4 max-w-xl text-sm text-zinc-600">
                Add your carriers first, then log the invoices of a week here. Statements, billing sheets and the profit summary are built from that log.
              </p>
            </>
          )}
          {(!current || current.week_start < addDays(weekStartOf(today), -7)) && (
            <div className="mt-5 border-t border-rule pt-4">
              <NewWeekForm suggested={addDays(weekStartOf(today), -7)} />
            </div>
          )}
        </section>

        <section className={`${card} p-5`} aria-labelledby="ins-h">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="ins-h" className="text-lg font-semibold">Insurance to follow up</h2>
            <Link href="/ctal/carriers" className="text-sm text-pine-700 hover:underline">{active.length} carriers</Link>
          </div>
          {carriers.length === 0 ? (
            <div className="mt-3 space-y-3 text-sm text-zinc-600">
              <p>No carriers yet. Bring the whole Google Sheet in at once, or add them one by one.</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/ctal/carriers/import" className={btnPrimary}>Import from Google Sheets</Link>
                <Link href="/ctal/carriers/new" className={btn}>Add carrier</Link>
              </div>
            </div>
          ) : attention.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">Every active carrier&apos;s insurance is good for more than 30 days.</p>
          ) : (
            <ul className="mt-3 divide-y divide-rule">
              {attention.slice(0, 12).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <Link href={`/ctal/carriers/${c.id}`} className="truncate font-medium text-pine-900 hover:underline">{c.name}</Link>
                  <InsuranceBadge carrier={c} today={today} />
                </li>
              ))}
              {attention.length > 12 && <li className="pt-2 text-sm text-zinc-600">And {attention.length - 12} more under Carriers.</li>}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
