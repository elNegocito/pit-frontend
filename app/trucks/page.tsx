import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TruckCreateForm, TruckRowForm } from "@/components/CatalogForms";
import { SignOutButton } from "@/components/SignOutButton";
import Link from "next/link";

export default async function TrucksPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: trucks } = await supabase
    .from("trucks")
    .select("id, truck_number, gross_tons, active")
    .order("truck_number");

  return (
    <main className="min-h-full flex-1 bg-zinc-100 px-4 py-6">
      <div className="mx-auto mb-4 flex w-full max-w-3xl items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Trucks</h1>
          <p className="text-sm text-zinc-500">
            Registered trucks print Gross / Tare / Net (Tare = Gross − Net). Others print Net only.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard" className="rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-zinc-50">
            Dashboard
          </Link>
          <SignOutButton />
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-4">
        <TruckCreateForm />
        {(trucks ?? []).map((t) => (
          <TruckRowForm key={t.id} truck={t} />
        ))}
      </div>
    </main>
  );
}
