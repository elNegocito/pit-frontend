import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadCustomers } from "@/lib/ctal/queries";
import { CustomerCreateForm, CustomerRowForm } from "@/components/ctal/CustomerForms";

export default async function CtalCustomersPage() {
  await requireAdmin();
  const customers = await loadCustomers(await createClient());
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          The rules of each job. Picking a customer in the log fills in the unit, rates, fee and FSC; every row can still be changed. Editing a customer here
          never rewrites weeks already logged.
        </p>
      </div>
      <CustomerCreateForm />
      {customers.map((c) => (
        <CustomerRowForm key={c.id} customer={c} />
      ))}
    </div>
  );
}
