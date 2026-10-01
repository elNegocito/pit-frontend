import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { JobOrderCreateForm, JobOrderRowForm } from "@/components/CatalogForms";
import { SignOutButton } from "@/components/SignOutButton";
import type { JobOrder } from "@/lib/types";
import Link from "next/link";

export default async function JobOrdersPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: orders }, { data: customers }] = await Promise.all([
    supabase.from("job_orders").select("id, code, customer_id, active, customers(name)").order("code"),
    supabase.from("customers").select("id, name").order("name"),
  ]);

  return (
    <main className="min-h-full flex-1 bg-zinc-100 px-4 py-6">
      <div className="mx-auto mb-4 flex w-full max-w-3xl items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Orders (projects)</h1>
          <p className="text-sm text-zinc-500">
            One order per customer. It is printed on that customer&apos;s tickets automatically.
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
        <JobOrderCreateForm customers={customers ?? []} />
        {((orders ?? []) as unknown as JobOrder[]).map((o) => (
          <JobOrderRowForm key={o.id} order={o} customers={customers ?? []} />
        ))}
      </div>
    </main>
  );
}
