import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInPit } from "@/lib/timezone";
import { EntryForm } from "@/components/EntryForm";
import { TodaysTickets } from "@/components/TodaysTickets";
import { SignOutButton } from "@/components/SignOutButton";

export default async function EntryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;
  const raw = Array.isArray(sp.tpage) ? sp.tpage[0] : sp.tpage;
  const tpage = Math.max(1, parseInt(raw || "1", 10) || 1);
  const today = todayInPit();

  const supabase = await createClient();
  const { data: materials } = await supabase
    .from("materials")
    .select("id, name, price_per_ton, active")
    .eq("active", true)
    .order("name");

  return (
    <main className="min-h-full flex-1 bg-zinc-100 px-4 py-6">
      <div className="mx-auto mb-4 flex w-full max-w-xl items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">ASG Operations — PIT #2</h1>
          <p className="text-sm text-zinc-500">Ticket entry</p>
        </div>
        <SignOutButton />
      </div>
      <EntryForm materials={materials ?? []} today={today} />
      <TodaysTickets today={today} page={tpage} />
    </main>
  );
}
