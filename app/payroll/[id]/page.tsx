import { notFound } from "next/navigation";
import { requirePayroll } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PIT_TIME_ZONE } from "@/lib/timezone";
import { SHEET_SELECT, toSheet, type PaySheetEvent } from "@/lib/payroll/types";
import { PayrollHeader } from "@/components/payroll/PayrollHeader";
import { SheetActions } from "@/components/payroll/SheetActions";
import { SheetHistory } from "@/components/payroll/SheetHistory";
import { SheetView } from "@/components/payroll/SheetView";

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: PIT_TIME_ZONE, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

export default async function PaySheetPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePayroll();
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from("pay_sheets").select(SHEET_SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();
  const sheet = toSheet(data);

  const [{ data: driver }, { data: events }] = await Promise.all([
    supabase.from("drivers").select("phone, email").eq("id", sheet.driver_id).maybeSingle(),
    supabase
      .from("pay_sheet_events")
      .select("id, action, changes, actor_name, created_at")
      .eq("sheet_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="min-h-full flex-1 bg-zinc-100 px-4 py-6">
      <PayrollHeader
        title={`Pay sheet #${sheet.sheet_number} — ${sheet.driver_name}`}
        subtitle={`Prepared by ${sheet.created_by_name ?? "—"} · ${when(sheet.created_at)}${
          sheet.edit_count > 0 ? ` · last edited by ${sheet.updated_by_name ?? "—"} · ${when(sheet.updated_at)}` : ""
        }`}
        role={user.role}
      />
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <SheetActions sheet={sheet} driverPhone={driver?.phone ?? null} driverEmail={driver?.email ?? null} />
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <SheetView sheet={sheet} />
          <SheetHistory events={(events ?? []) as PaySheetEvent[]} />
        </div>
      </div>
    </main>
  );
}
