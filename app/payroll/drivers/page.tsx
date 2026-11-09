import { requirePayroll } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DRIVER_SELECT, toDriver } from "@/lib/payroll/types";
import { PAY_MODELS, type PayModel } from "@/lib/payroll/models";
import { PayrollHeader } from "@/components/payroll/PayrollHeader";
import { DriverCreateForm, DriverRowForm } from "@/components/payroll/DriverForms";

// Drivers listed by group, each with what sets their pay.
const GROUPS: { model: PayModel; note: string }[] = [
  { model: "mixer", note: "Paid by the hour: each driver has their own rate (overtime 1.5x)." },
  { model: "trucking", note: "Paid a % of each load's revenue: each driver has their own %." },
  { model: "flatbed", note: `Fixed rates: ${PAY_MODELS.flatbed.revenuePct}% + $${PAY_MODELS.flatbed.hourlyRate}/h.` },
];

export default async function DriversPage() {
  const user = await requirePayroll();
  const supabase = await createClient();
  const { data } = await supabase
    .from("drivers")
    .select(DRIVER_SELECT)
    .order("active", { ascending: false })
    .order("name");
  const drivers = (data ?? []).map(toDriver);

  return (
    <main className="min-h-full flex-1 bg-zinc-100 px-4 py-6">
      <PayrollHeader
        title="Drivers"
        subtitle="Pick the group first: mixer drivers get their own $ per hour, aggregate drivers their own %. New pay sheets start with that rate. Phone and email are used by Send."
        role={user.role}
      />
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <DriverCreateForm />
        {GROUPS.map(({ model, note }) => {
          const list = drivers.filter((d) => d.pay_model === model);
          return (
            <details key={model} open className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 select-none [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="text-xs text-zinc-500 transition-transform group-open:rotate-90">▶</span>
                <div>
                  <h2 className="text-base font-semibold">
                    {PAY_MODELS[model].label} <span className="font-normal text-zinc-500">({list.length})</span>
                  </h2>
                  <p className="text-sm text-zinc-500">{note}</p>
                </div>
              </summary>
              <div className="mt-3 space-y-3">
              {list.map((d) => (
                <DriverRowForm key={d.id} driver={d} />
              ))}
              {list.length === 0 && <p className="text-sm text-zinc-400">No {PAY_MODELS[model].label.toLowerCase()} drivers yet.</p>}
              </div>
            </details>
          );
        })}
      </div>
    </main>
  );
}
