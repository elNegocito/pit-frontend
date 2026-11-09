import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadCarriers, loadWeek } from "@/lib/ctal/queries";
import type { StatementMeta } from "@/lib/ctal/types";
import { StatementsBoard } from "@/components/ctal/StatementsBoard";
import { WeekHeader } from "@/components/ctal/WeekHeader";

export default async function StatementsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ carrier?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { carrier } = await searchParams;
  const supabase = await createClient();
  const [{ week, loads }, carriers, { data: meta }] = await Promise.all([
    loadWeek(supabase, id),
    loadCarriers(supabase),
    supabase.from("ctal_statements").select("week_id, carrier_id, tickets_url, emailed_at, emailed_to").eq("week_id", id),
  ]);
  return (
    <>
      <WeekHeader week={week} active="statements" />
      <StatementsBoard week={week} loads={loads} carriers={carriers} meta={(meta ?? []) as StatementMeta[]} initial={carrier} />
    </>
  );
}
