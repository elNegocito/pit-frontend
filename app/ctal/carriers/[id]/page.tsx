import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatTicketDate, todayInPit } from "@/lib/timezone";
import { money, statementTotal, sumLoads, weekLabel } from "@/lib/ctal/compute";
import { CARRIER_SELECT, DOCUMENT_SELECT, toLoad, type Carrier, type CarrierDocument, type Load } from "@/lib/ctal/types";
import { btn, card } from "@/lib/ctal/ui";
import { CarrierDocuments } from "@/components/ctal/CarrierDocuments";
import { CarrierForm } from "@/components/ctal/CarrierForm";
import { InsuranceBadge } from "@/components/ctal/InsuranceBadge";

export default async function CarrierPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { created } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: carrier }, { data: docs }, { data: cityRows }, { data: loadRows }] = await Promise.all([
    supabase.from("ctal_carriers").select(CARRIER_SELECT).eq("id", id).maybeSingle(),
    supabase.from("ctal_carrier_documents").select(DOCUMENT_SELECT).eq("carrier_id", id).order("uploaded_at", { ascending: false }),
    supabase.from("ctal_carriers").select("hub_city"),
    supabase
      .from("ctal_loads")
      .select("week_id, carrier_id, carrier_name, bill_to, quantity, carrier_amount, broker_amount, broker_fee, quick_pay_fee, fsc_amount, ctal_weeks(week_start, pay_date)")
      .eq("carrier_id", id)
      .limit(5000),
  ]);
  if (!carrier) notFound();
  const c = carrier as Carrier;
  const today = todayInPit();
  const cities = [...new Set((cityRows ?? []).map((r) => r.hub_city as string | null).filter((x): x is string => Boolean(x)))].sort();

  // Past statements: one line per week this carrier hauled in.
  const weeks = new Map<string, { start: string; pay: string; rows: Load[] }>();
  for (const r of loadRows ?? []) {
    const w = r.ctal_weeks as unknown as { week_start: string; pay_date: string } | null;
    if (!w) continue;
    const entry = weeks.get(r.week_id as string) ?? { start: w.week_start, pay: w.pay_date, rows: [] };
    entry.rows.push(toLoad(r));
    weeks.set(r.week_id as string, entry);
  }
  const history = [...weeks.entries()].sort((a, b) => b[1].start.localeCompare(a[1].start));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <Link href="/ctal/carriers" className="text-sm text-pine-700 hover:underline">All carriers</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="mr-2 font-normal text-zinc-500 tabular-nums">#{c.carrier_number}</span>
            {c.name}
          </h1>
          <InsuranceBadge carrier={c} today={today} />
          {!c.active && <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-700">Inactive</span>}
          {c.tickets_url && (
            <a href={c.tickets_url} target="_blank" rel="noopener noreferrer" className={`${btn} ml-auto`}>Open tickets folder</a>
          )}
        </div>
        {created && <p role="status" className="mt-2 rounded-md bg-pine-100 px-3 py-2 text-sm text-pine-950">Carrier added. Drop the insurance, contract and CDL below.</p>}
      </div>

      <section id="documents" className={`${card} scroll-mt-4 p-5`} aria-labelledby="docs-h">
        <h2 id="docs-h" className="mb-3 text-lg font-semibold">Documents</h2>
        <CarrierDocuments carrierId={c.id} documents={(docs ?? []) as CarrierDocument[]} today={today} />
      </section>

      <section className={`${card} p-5`} aria-labelledby="info-h">
        <h2 id="info-h" className="mb-3 text-lg font-semibold">Carrier information</h2>
        <CarrierForm carrier={c} cities={cities} />
      </section>

      <section className={`${card} p-5`} aria-labelledby="st-h">
        <h2 id="st-h" className="mb-3 text-lg font-semibold">Statements</h2>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-500">No loads logged for this carrier yet.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {history.map(([weekId, w]) => {
              const t = sumLoads(w.rows);
              return (
                <li key={weekId} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2 text-sm">
                  <Link href={`/ctal/weeks/${weekId}/statements?carrier=${c.id}`} className="font-medium text-pine-900 tabular-nums hover:underline">
                    Week {weekLabel(w.start)}
                  </Link>
                  <span className="text-zinc-600 tabular-nums">paid {formatTicketDate(w.pay)}</span>
                  <span className="text-zinc-600 tabular-nums">{t.loads} loads</span>
                  <span className="ml-auto font-medium tabular-nums">{money(statementTotal(t))}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
