import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { billingTotal, money, sumLoads } from "@/lib/ctal/compute";
import { loadWeek } from "@/lib/ctal/queries";
import { BILL_TO, BILL_TO_LABEL } from "@/lib/ctal/types";
import { card } from "@/lib/ctal/ui";
import { BillingActions, BillingsExport } from "@/components/ctal/ExportBar";
import { LoadsTable, TotalsBox } from "@/components/ctal/LoadsTable";
import { WeekHeader } from "@/components/ctal/WeekHeader";

export default async function BillingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { week, loads } = await loadWeek(await createClient(), id);
  const sheets = BILL_TO.map((key) => {
    const rows = loads.filter((l) => l.bill_to === key);
    return { key, rows, totals: sumLoads(rows) };
  });

  return (
    <>
      <WeekHeader week={week} active="billing">
        <BillingsExport week={week} rows={loads} />
      </WeekHeader>
      <p className="mb-4 max-w-3xl text-sm text-zinc-600">
        Each load goes to the company its customer bills through. Change a customer&apos;s company under Customers.
      </p>
      <div className="space-y-5">
        {sheets.map(({ key, rows, totals }) => (
          <section key={key} className={`${card} p-4`} aria-label={`${BILL_TO_LABEL[key]} billing`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {BILL_TO_LABEL[key]}
                <span className="ml-3 text-base font-normal text-zinc-600 tabular-nums">{money(billingTotal(totals))}</span>
              </h2>
              {rows.length > 0 && <BillingActions week={week} billTo={key} rows={rows} />}
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-zinc-500">No loads billed to {BILL_TO_LABEL[key]} this week.</p>
            ) : (
              <>
                <LoadsTable rows={rows} side="broker" />
                <div className="mt-4">
                  <TotalsBox lines={[["Subtotal", totals.broker_amount], ["FSC", totals.fsc_amount]]} total={billingTotal(totals)} />
                </div>
              </>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
