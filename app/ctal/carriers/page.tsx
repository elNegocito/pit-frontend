import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInPit } from "@/lib/timezone";
import { CARRIER_SELECT, type Carrier } from "@/lib/ctal/types";
import { btn, btnPrimary } from "@/lib/ctal/ui";
import { CarrierList } from "@/components/ctal/CarrierList";

export default async function CarriersPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("ctal_carriers").select(`${CARRIER_SELECT}, ctal_carrier_documents(count)`).order("carrier_number");
  const carriers = (data ?? []).map((c) => {
    const { ctal_carrier_documents: docs, ...rest } = c as unknown as Carrier & { ctal_carrier_documents: { count: number }[] };
    return { ...rest, documents: docs?.[0]?.count ?? 0 };
  });
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Carriers</h1>
          <p className="text-sm text-zinc-600">Contractors, their contacts and their paperwork.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/ctal/carriers/import" className={btn}>Import from Google Sheets</Link>
          <Link href="/ctal/carriers/new" className={btnPrimary}>Add carrier</Link>
        </div>
      </div>
      <CarrierList carriers={carriers} today={todayInPit()} />
    </>
  );
}
