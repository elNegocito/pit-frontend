import { notFound, redirect } from "next/navigation";
import { requirePayroll } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DRIVER_SELECT, SHEET_SELECT, toDriver, toSheet } from "@/lib/payroll/types";
import { PayrollHeader } from "@/components/payroll/PayrollHeader";
import { PaySheetForm } from "@/components/payroll/PaySheetForm";

export default async function EditPaySheetPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePayroll();
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from("pay_sheets").select(SHEET_SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();
  const sheet = toSheet(data);
  if (sheet.status === "void") redirect(`/payroll/${id}`);

  // Active drivers + this sheet's driver even if since deactivated.
  const { data: drivers } = await supabase
    .from("drivers")
    .select(DRIVER_SELECT)
    .or(`active.eq.true,id.eq.${sheet.driver_id}`)
    .order("name");

  return (
    <main className="min-h-full flex-1 bg-zinc-100 px-4 py-6">
      <PayrollHeader
        title={`Edit pay sheet #${sheet.sheet_number}`}
        subtitle="Every change is recorded with your name in the sheet history."
        role={user.role}
      />
      <div className="mx-auto w-full max-w-6xl">
        <PaySheetForm drivers={(drivers ?? []).map(toDriver)} sheet={sheet} defaultPayDate={sheet.pay_date} />
      </div>
    </main>
  );
}
