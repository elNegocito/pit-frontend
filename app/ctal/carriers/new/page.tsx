import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { card } from "@/lib/ctal/ui";
import { CarrierForm } from "@/components/ctal/CarrierForm";

export default async function NewCarrierPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("ctal_carriers").select("carrier_number, hub_city");
  const cities = [...new Set((data ?? []).map((c) => c.hub_city as string | null).filter((c): c is string => Boolean(c)))].sort();
  const next = Math.max(3000, ...(data ?? []).map((c) => c.carrier_number as number)) + 1;
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/ctal/carriers" className="text-sm text-pine-700 hover:underline">All carriers</Link>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Add carrier</h1>
      <p className="mb-5 text-sm text-zinc-600">Only the name is required. Documents are added on the next screen.</p>
      <div className={`${card} p-5`}>
        <CarrierForm cities={cities} nextNumber={next} />
      </div>
    </div>
  );
}
