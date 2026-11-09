import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { byCarrier, money, profitRows, sumProfit } from "@/lib/ctal/compute";
import { loadWeek } from "@/lib/ctal/queries";
import { card } from "@/lib/ctal/ui";
import { ProfitActions } from "@/components/ctal/ExportBar";
import { WeekHeader } from "@/components/ctal/WeekHeader";

const th = "border-b border-rule bg-pine-50 px-3 py-2 text-right text-xs font-semibold text-zinc-700 whitespace-nowrap";
const td = "border-b border-rule px-3 py-2 text-right text-sm tabular-nums whitespace-nowrap";

export default async function ProfitPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { week, loads } = await loadWeek(await createClient(), id);
  const rows = profitRows(loads);
  const g = sumProfit(rows);
  const ids = byCarrier(loads).map((c) => c.carrierId);

  return (
    <>
      <WeekHeader week={week} active="profit">
        <ProfitActions week={week} rows={loads} />
      </WeekHeader>
      {rows.length === 0 ? (
        <p className={`${card} px-4 py-10 text-center text-sm text-zinc-600`}>No loads in this week yet. The summary fills in as the log does.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <p>
              <span className="text-3xl font-semibold tracking-tight tabular-nums">{money(g.total_with_fsc)}</span>
              <span className="ml-2 text-sm text-zinc-600">profit with FSC</span>
            </p>
            <p className="text-sm text-zinc-600">
              <span className="font-medium text-zinc-900 tabular-nums">{money(g.total)}</span> without FSC, from {g.loads} loads by {rows.length} companies
            </p>
          </div>
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={`${th} text-left`}>Company</th>
                  {["Loads", "Carrier amount", "Broker amount", "Difference", "Broker fee", "Quick pay", "FSC $", "Total without FSC", "Total with FSC"].map((h) => (
                    <th key={h} className={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.name} className="hover:bg-pine-50/50">
                    <td className={`${td} text-left font-medium`}>
                      <Link href={`/ctal/weeks/${week.id}/statements?carrier=${ids[i]}`} className="hover:underline">{r.name}</Link>
                    </td>
                    <td className={td}>{r.loads}</td>
                    <td className={td}>{money(r.carrier_amount)}</td>
                    <td className={td}>{money(r.broker_amount)}</td>
                    <td className={td}>{money(r.difference)}</td>
                    <td className={td}>{money(r.broker_fee)}</td>
                    <td className={td}>{money(r.quick_pay)}</td>
                    <td className={td}>{money(r.fsc)}</td>
                    <td className={td}>{money(r.total)}</td>
                    <td className={`${td} font-semibold`}>{money(r.total_with_fsc)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-pine-900 font-semibold text-white">
                  <td className="px-3 py-2 text-left text-sm">Grand total</td>
                  {[String(g.loads), money(g.carrier_amount), money(g.broker_amount), money(g.difference), money(g.broker_fee), money(g.quick_pay), money(g.fsc), money(g.total), money(g.total_with_fsc)].map((v, i) => (
                    <td key={i} className="px-3 py-2 text-right text-sm tabular-nums whitespace-nowrap">{v}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-3 max-w-3xl text-sm text-zinc-600">
            Difference is broker amount minus carrier amount. Broker fee and quick pay are what was kept from the carriers. Add FSC for the profit with FSC.
          </p>
        </>
      )}
    </>
  );
}
