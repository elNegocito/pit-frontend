import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CarrierImport } from "@/components/ctal/CarrierImport";

export default async function ImportCarriersPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("ctal_carriers").select("name_key");
  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/ctal/carriers" className="text-sm text-pine-700 hover:underline">All carriers</Link>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Import carriers from Google Sheets</h1>
      <p className="mb-5 max-w-2xl text-sm text-zinc-600">Paste the carrier table and check the preview before importing. Carriers already in the list are left as they are.</p>
      <CarrierImport existing={(data ?? []).map((c) => c.name_key as string)} />
    </div>
  );
}
