import Link from "next/link";
import { requirePayroll } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayInPit, upcomingFriday } from "@/lib/timezone";
import { DRIVER_SELECT, SHEET_SELECT, toDriver, toSheet, type PaySheet } from "@/lib/payroll/types";
import { sheetRates } from "@/lib/payroll/models";
import { PayrollHeader } from "@/components/payroll/PayrollHeader";
import { PaySheetForm } from "@/components/payroll/PaySheetForm";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function NewPaySheetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePayroll();
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: drivers }, copied] = await Promise.all([
    supabase.from("drivers").select(DRIVER_SELECT).eq("active", true).order("name"),
    one(sp.from)
      ? supabase.from("pay_sheets").select(SHEET_SELECT).eq("id", one(sp.from)).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const list = (drivers ?? []).map(toDriver);

  // "Copy for next week": same driver, truck, rates, days and extras (labels
  // only); loads, hours and amounts start empty; pay date one week later.
  let template: PaySheet | null = null;
  let payDate = upcomingFriday(todayInPit());
  if (copied.data) {
    const src = toSheet(copied.data);
    // Rates follow the driver's current own rate (it may have changed).
    const own = list.find((d) => d.id === src.driver_id);
    const rates = own ? sheetRates(src.pay_model, own) : null;
    template = {
      ...src,
      ...(rates && own && (own.hourly_rate !== null || own.revenue_pct !== null)
        ? { hourly_rate: rates.hourly, revenue_pct: rates.pct, ot_rate: rates.ot }
        : {}),
      notes: null,
      loads: [],
      hours: src.hours.map((h) => ({ ...h, hours: 0, note: "" })),
      adjustments: src.adjustments.map((a) => ({ ...a, amount: 0 })),
    };
    payDate = addDays(src.pay_date, 7);
  }


  return (
    <main className="min-h-full flex-1 bg-zinc-100 px-4 py-6">
      <PayrollHeader title="New pay sheet" subtitle="Pick the driver: the pay template for what they drive fills in." role={user.role} />
      <div className="mx-auto w-full max-w-6xl">
        {list.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-sm shadow">
            No drivers yet.{" "}
            <Link href="/payroll/drivers" className="font-medium underline">
              Add the drivers first
            </Link>
            .
          </p>
        ) : (
          <PaySheetForm
            drivers={list}
            sheet={null}
            template={template}
            defaultDriverId={one(sp.driver) || undefined}
            defaultPayDate={payDate}
          />
        )}
      </div>
    </main>
  );
}
