import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInPit } from "@/lib/timezone";
import { insuranceState } from "@/lib/ctal/compute";
import { loadCarriers, loadCustomers, loadWeek } from "@/lib/ctal/queries";
import { LogGrid, type TruckDriver } from "@/components/ctal/LogGrid";
import { WeekHeader } from "@/components/ctal/WeekHeader";
import { WeekSettings } from "@/components/ctal/WeekSettings";

export default async function WeekLogPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ticket?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { ticket } = await searchParams;
  const supabase = await createClient();
  const [{ week, loads }, carriers, customers, { data: recent }] = await Promise.all([
    loadWeek(supabase, id),
    loadCarriers(supabase),
    loadCustomers(supabase),
    // Trucks and drivers each carrier used lately, to suggest them while typing.
    supabase.from("ctal_loads").select("carrier_id, truck, driver").order("created_at", { ascending: false }).limit(3000),
  ]);

  const history: Record<string, TruckDriver[]> = {};
  for (const r of recent ?? []) {
    const truck = (r.truck as string | null) ?? "";
    const driver = (r.driver as string | null) ?? "";
    if (!truck && !driver) continue;
    const list = (history[r.carrier_id as string] ??= []);
    if (list.length < 30 && !list.some((k) => k.truck === truck && k.driver === driver)) list.push({ truck, driver });
  }
  const today = todayInPit();
  const expired = carriers.filter((c) => insuranceState(c, today) === "expired").map((c) => c.id);

  return (
    <>
      <WeekHeader week={week} active="log">
        <WeekSettings week={week} empty={loads.length === 0} />
      </WeekHeader>
      <LogGrid week={week} initialLoads={loads} carriers={carriers} customers={customers} history={history} expired={expired} focusTicket={ticket} />
    </>
  );
}
