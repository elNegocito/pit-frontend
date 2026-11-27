import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInPit, addDays } from "@/lib/timezone";
import { validDate, type ProductionDay, type ProductionEntry } from "@/lib/trucking-production/fields";
import { DayForm, EntryForm } from "./forms";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const percent = (gross: number, goal: number) => goal ? `${(gross / goal * 100).toFixed(1)}%` : "—";
const cell = "whitespace-nowrap px-3 py-2";
const entriesPerPage = 50;

export default async function TruckingProductionPage({ searchParams }: PageProps<"/trucking-production">) {
  await requireAdmin();
  const sp = await searchParams;
  const today = todayInPit();
  const month = typeof sp.month === "string" && validDate(`${sp.month}-01`) ? sp.month : today.slice(0, 7);
  const start = `${month}-01`;
  const end = addDays(start, 32).slice(0, 7) + "-01";
  const date = validDate(sp.day) && sp.day.startsWith(`${month}-`) ? sp.day : today.startsWith(`${month}-`) ? today : start;
  const page = typeof sp.page === "string" && /^[1-9]\d{0,5}$/.test(sp.page) ? Number(sp.page) : 1;
  const offset = (page - 1) * entriesPerPage;
  const db = await createClient();
  const [summary, details] = await Promise.all([
    db.from("trucking_production_daily").select("*").gte("work_date", start).lt("work_date", end).order("work_date").returns<ProductionDay[]>(),
    db.from("trucking_production_results").select("*", { count: "exact" }).eq("work_date", date).order("truck").order("id")
      .range(offset, offset + entriesPerPage - 1).returns<ProductionEntry[]>(),
  ]);
  const days = summary.data ?? [];
  const entries = details.data ?? [];
  const day = days.find((row) => row.work_date === date);
  const totals = days.reduce((acc, row) => ({
    gross: acc.gross + Number(row.gross), goal: acc.goal + Number(row.revenue_goal),
    targets: acc.targets + Number(row.target_rows), met: acc.met + Number(row.met_rows),
    missing: acc.missing + Number(row.missing_loads),
  }), { gross: 0, goal: 0, targets: 0, met: 0, missing: 0 });
  let runningGross = 0;
  let runningGoal = 0;
  const revenue = [];
  for (const row of days) {
    const gross = Number(row.gross);
    const goal = Number(row.revenue_goal);
    runningGross += gross;
    runningGoal += goal;
    revenue.push({ row, gross, goal, cumulativeGross: runningGross, cumulativeGoal: runningGoal });
  }

  return (
    <main className="min-h-full bg-zinc-100 px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header>
          <Link href="/dashboard" className="text-sm text-blue-700">← Admin dashboard</Link>
          <h1 className="text-2xl font-semibold">Trucking production</h1>
          <p className="text-sm text-zinc-600">Daily revenue, material tonnage and load targets.</p>
        </header>
        {(summary.error || details.error) ? (
          <p role="alert" className="rounded-xl border border-red-300 bg-white p-4 text-red-700">Production could not be loaded. Verify that the database migration is applied and try again.</p>
        ) : <>
          <form action="/trucking-production" className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4 text-sm">
            <label>Report month<input className="block rounded border px-3 py-2" type="month" name="month" defaultValue={month} required /></label>
            <button className="rounded-lg border px-3 py-2">View month</button>
          </form>
          <section aria-label="Monthly summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[
              ["Actual gross", currency.format(totals.gross)],
              ["Revenue goal", currency.format(totals.goal)],
              ["Variance", currency.format(totals.gross - totals.goal)],
              ["Goal attainment", percent(totals.gross, totals.goal)],
              ["Worked days", days.length],
              ["Load targets met", `${totals.met}/${totals.targets} · ${totals.missing} loads short`],
            ].map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-3"><p className="text-sm text-zinc-600">{label}</p><strong>{value}</strong></div>)}
          </section>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-left text-sm">
              <caption className="px-3 py-2 text-left font-semibold">Daily revenue</caption>
              <thead className="bg-zinc-100"><tr>{["Date", "Gross", "Goal", "Variance", "Cumulative gross", "Cumulative goal", "Cumulative variance", "Goal %", "Status"].map((label) => <th key={label} scope="col" className={cell}>{label}</th>)}</tr></thead>
              <tbody>
                {revenue.map(({ row, gross, goal, cumulativeGross, cumulativeGoal }) => (
                  <tr key={row.work_date} className="border-t">
                    <td className={cell}><Link aria-current={date === row.work_date ? "date" : undefined} className="text-blue-700 underline" href={`?month=${month}&day=${row.work_date}#workday`}>{row.work_date}</Link></td>
                    {[currency.format(gross), currency.format(goal), currency.format(gross - goal), currency.format(cumulativeGross), currency.format(cumulativeGoal), currency.format(cumulativeGross - cumulativeGoal), percent(gross, goal), !goal ? "No goal" : gross >= goal ? "Met" : "Below goal"].map((value, i) => <td key={i} className={cell}>{value}</td>)}
                  </tr>
                ))}
                {!days.length && <tr><td className={cell} colSpan={9}>No production days recorded for this month.</td></tr>}
              </tbody>
            </table>
          </div>
          <section id="workday" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-lg font-semibold">Workday · {date}</h2>
                {day && <p className="text-sm text-zinc-600">{day.loads} loads · {day.met_rows}/{day.target_rows} load targets met · {day.missing_loads} loads short</p>}
              </div>
              <form action="/trucking-production#workday" className="flex items-end gap-2 text-sm">
                <input type="hidden" name="month" value={month} />
                <label>Work date<input key={date} className="block rounded border bg-white px-3 py-2" type="date" name="day" min={start} max={addDays(end, -1)} defaultValue={date} required /></label>
                <button className="rounded-lg border bg-white px-3 py-2">Open day</button>
              </form>
            </div>
            <DayForm key={`${date}:${day?.revenue_goal}:${day?.ashgrove_rate}:${day?.gp_rate}:${day?.shale_rate}`} date={date} day={day} />
            {day && <>
              <details className="rounded-xl border bg-white p-4" key={`new-${date}`}>
                <summary className="cursor-pointer font-semibold">Add truck entry</summary>
                <EntryForm date={date} />
              </details>
              <p className="text-sm text-zinc-600">Load targets: 8 for Alumina or Silica; otherwise 5 for Ashgrove or GP. Entries without a driver or these materials have no target.</p>
              {!entries.length && <p className="rounded-xl border bg-white p-4 text-sm">No truck entries on this page.</p>}
              {entries.map((entry) => (
                <details key={entry.id} className="rounded-xl border bg-white p-4">
                  <summary className="cursor-pointer">
                    <strong>{entry.truck}</strong> · {entry.driver || "No driver"} · {entry.loads} loads · {currency.format(entry.gross)}
                    {" · "}{!entry.load_goal ? "No load target" : entry.loads >= entry.load_goal ? `Met (${entry.load_goal})` : `Missed (${entry.load_goal - entry.loads} short)`}
                  </summary>
                  <EntryForm key={JSON.stringify(entry)} date={date} entry={entry} />
                </details>
              ))}
              {((details.count ?? 0) > entriesPerPage || page > 1) && <nav className="flex gap-4 text-sm text-blue-700">
                {page > 1 && <Link href={`?month=${month}&day=${date}&page=${page - 1}#workday`}>Previous entries</Link>}
                {offset + entriesPerPage < (details.count ?? 0) && <Link href={`?month=${month}&day=${date}&page=${page + 1}#workday`}>Next entries</Link>}
              </nav>}
            </>}
          </section>
        </>}
      </div>
    </main>
  );
}
