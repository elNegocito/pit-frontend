import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInPit } from "@/lib/timezone";
import { listAssets } from "@/lib/roll-off/queries";
import { uuid, type DispatchOrder } from "@/lib/roll-off/types";
import { OrderForm } from "../../forms";

export default async function RollOffOrderPage({ params, searchParams }: PageProps<"/roll-off/orders/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !uuid.test(id)) notFound();
  const db = await createClient();
  const [record, containers, trucks, drivers, sp] = await Promise.all([
    isNew ? null : db.from("roll_off_dispatch").select("*").eq("id", id).maybeSingle<DispatchOrder>(),
    listAssets(db, "containers", true),
    listAssets(db, "trucks", true),
    listAssets(db, "drivers", true),
    searchParams,
  ]);
  if (record?.error) throw new Error("Could not load this work order.");
  const order = record?.data ?? undefined;
  if (!isNew && !order) notFound();

  return (
    <>
      <header className="flex flex-wrap justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">{order ? `Work order ${order.order_number}` : "New roll-off work order"}</h1>
          {order && <p className="text-sm text-zinc-600">{order.tracking_status} · Pickup due {order.due_on ?? "—"} · Days elapsed {order.elapsed_days ?? "—"}</p>}
        </div>
        {order && <Link href={`/roll-off/orders/${id}/ticket`} className="self-start rounded-lg border bg-white px-4 py-2 text-sm">Printable ticket</Link>}
      </header>
      {sp.saved === "1" && <p role="status" className="text-sm text-green-800">Work order saved.</p>}
      <OrderForm key={JSON.stringify(order ?? id)} order={order} assets={{ containers, trucks, drivers }} today={todayInPit()} />
    </>
  );
}
