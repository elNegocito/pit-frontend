import { requirePayroll } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Driver } from "@/lib/payroll/types";
import { PayrollHeader } from "@/components/payroll/PayrollHeader";
import { DriverCreateForm, DriverRowForm } from "@/components/payroll/DriverForms";

export default async function DriversPage() {
  const user = await requirePayroll();
  const supabase = await createClient();
  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, name, pay_model, truck_number, phone, email, active")
    .order("active", { ascending: false })
    .order("name");

  return (
    <main className="min-h-full flex-1 bg-zinc-100 px-4 py-6">
      <PayrollHeader
        title="Drivers"
        subtitle="What each driver drives picks their pay template (Flat bed / Mixer / Trucking). Phone and email are used by Send."
        role={user.role}
      />
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <DriverCreateForm />
        {((drivers ?? []) as Driver[]).map((d) => (
          <DriverRowForm key={d.id} driver={d} />
        ))}
      </div>
    </main>
  );
}
