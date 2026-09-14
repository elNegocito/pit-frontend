import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CustomerMergeForm, CustomerRenameForm } from "@/components/CatalogForms";
import { SignOutButton } from "@/components/SignOutButton";
import Link from "next/link";

export default async function CustomersPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .order("name");
  const { count } = await supabase.from("orders").select("id", { count: "exact", head: true });

  const list = customers ?? [];

  return (
    <main className="min-h-full flex-1 bg-zinc-100 px-4 py-6">
      <div className="mx-auto mb-4 flex w-full max-w-3xl items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Customers ({list.length})</h1>
          <p className="text-sm text-zinc-500">
            Fix typos by renaming, or merge duplicates into one ({count ?? 0} orders total).
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
        <CustomerMergeForm customers={list} />
        {list.map((c) => (
          <CustomerRenameForm key={c.id} customer={c} />
        ))}
        {list.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-zinc-500 shadow">
            No customers yet — they are created automatically from the entry form.
          </p>
        )}
      </div>
    </main>
  );
}
