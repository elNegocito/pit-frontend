import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uuid, type DispatchOrder } from "@/lib/roll-off/types";
import { PrintButton } from "./print";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function RollOffTicketPage({ params }: PageProps<"/roll-off/orders/[id]/ticket">) {
  await requireAdmin();
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const db = await createClient();
  const { data: order, error } = await db.from("roll_off_dispatch").select(
    "order_number, order_date, customer, phone, address, service, container_number, size_yards, scheduled_date, delivered_on, rental_days, due_on, picked_up_on, truck_number, driver_name, instructions, charge, reference",
  ).eq("id", id).maybeSingle<DispatchOrder>();
  if (error) throw new Error("Could not load this work order ticket.");
  if (!order) notFound();

  const fields = [
    ["Customer / Cliente", order.customer],
    ["Phone / Teléfono", order.phone],
    ["Job address / Dirección", order.address],
    ["Service / Servicio", order.service],
    ["Container # / Contenedor", order.container_number],
    ["Size / Tamaño", `${order.size_yards} yd³`],
    ["Scheduled / Programado", order.scheduled_date],
    ["Delivered / Entrega", order.delivered_on],
    ["Contracted days / Días contratados", order.rental_days],
    ["Pickup due / Recoger el", order.due_on],
    ["Picked up / Recogido", order.picked_up_on],
    ["Truck / Camión", order.truck_number],
    ["Driver / Chofer", order.driver_name],
    ["Reference / PO", order.reference],
    ["Charge / Cargo", order.charge === null ? null : usd.format(order.charge)],
  ];
  return (
    <>
      <div className="flex items-center gap-4 print:hidden">
        <Link href={`/roll-off/orders/${id}`} className="text-sm text-blue-700 underline">Back to work order</Link>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-3xl rounded-xl border bg-white p-5 text-black sm:p-8 print:m-0 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <header className="border-b-2 border-black pb-3">
          <h1 className="text-xl font-bold">Roll-off service | Work order / Ticket</h1>
          <p className="mt-1">Order #{order.order_number} · {order.order_date}</p>
        </header>
        <dl className="my-4 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2 print:grid-cols-2">
          {fields.map(([label, value]) => <div key={label} className="border-b border-zinc-300 py-1">
            <dt className="font-semibold">{label}</dt><dd className="break-words">{value || "—"}</dd>
          </div>)}
        </dl>
        <h2 className="text-sm font-semibold">Instructions / Instrucciones</h2>
        <p className="min-h-10 whitespace-pre-wrap break-words text-sm">{order.instructions || "—"}</p>
        <h2 className="text-sm font-semibold">Driver notes / Notas del chofer</h2>
        <div className="mb-10 h-16 border-b border-zinc-400" />
        <div className="grid gap-8 text-sm sm:grid-cols-2 print:grid-cols-2">
          <div className="border-t border-black pt-1">Customer signature / Firma del cliente</div>
          <div className="border-t border-black pt-1">Driver signature / Firma del chofer</div>
        </div>
      </article>
    </>
  );
}
