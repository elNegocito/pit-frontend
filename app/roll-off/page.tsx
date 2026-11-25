import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInPit } from "@/lib/timezone";
import { listAssets } from "@/lib/roll-off/queries";
import { dispatchStatuses, services, trackingStatuses, uuid, validDate, type DispatchOrder } from "@/lib/roll-off/types";

const input = "block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2";
const cell = "px-3 py-2";
const perPage = 40;
const counters = [
  ["Orders", "all"], ["On site", "on-site"], ["Pending delivery", "Pending delivery"],
  ["Pick up today", "Pick up today"], ["Overdue", "Overdue"], ["Active", "Active"],
  ["Completed", "Completed"], ["Assigned / en route", "assigned"],
] as const;

export default async function RollOffPage({ searchParams }: PageProps<"/roll-off">) {
  await requireAdmin();
  const sp = await searchParams;
  function param(key: string) {
    const value = sp[key];
    return typeof value === "string" ? value : "";
  }
  const tracking = trackingStatuses.find((item) => item === param("tracking"));
  const status = dispatchStatuses.find((item) => item === param("status"));
  const service = services.find((item) => item === param("service"));
  const truck = param("truck");
  const driver = param("driver");
  const date = param("date");
  const dayField = param("date_by") === "due" ? "due_on" : param("date_by") === "order" ? "order_date" : "scheduled_date";
  const search = param("q").trim().replace(/[%_\\]/g, "").slice(0, 120);
  const pageInput = param("page");
  const page = /^[1-9]\d{0,5}$/.test(pageInput) ? Number(pageInput) : 1;
  const offset = (page - 1) * perPage;
  const db = await createClient();
  const columns = "id, order_number, order_date, scheduled_date, customer, phone, address, service, container_number, size_yards, delivered_on, due_on, picked_up_on, truck_number, driver_name, dispatch_status, tracking_status, instructions";
  let list = db.from("roll_off_dispatch").select(columns, { count: "exact" });
  if (search) list = list.ilike("order_number", `%${search}%`);
  if (validDate(date)) list = list.eq(dayField, date);
  if (truck && uuid.test(truck)) list = list.eq("truck_id", truck);
  if (driver && uuid.test(driver)) list = list.eq("driver_id", driver);
  if (service) list = list.eq("service", service);
  if (status) list = list.eq("dispatch_status", status);
  if (tracking) list = list.eq("tracking_status", tracking);
  if (param("on_site") === "1") list = list.eq("on_site", true);
  if (param("assigned") === "1") list = list.in("dispatch_status", ["Assigned", "En route"]);
  const [orders, stats, trucks, drivers] = await Promise.all([
    list.order("scheduled_date", { nullsFirst: false }).order("order_date", { ascending: false }).order("id")
      .range(offset, offset + perPage - 1).returns<DispatchOrder[]>(),
    Promise.all(counters.map(([, filter]) => {
      const query = db.from("roll_off_dispatch").select("id", { head: true, count: "exact" });
      if (filter === "all") return query;
      if (filter === "on-site") return query.eq("on_site", true);
      if (filter === "assigned") return query.in("dispatch_status", ["Assigned", "En route"]);
      return query.eq("tracking_status", filter);
    })),
    listAssets(db, "trucks", true),
    listAssets(db, "drivers", true),
  ]);
  function pageHref(number: number) {
    const params = new URLSearchParams({ page: String(number) });
    for (const key of ["date", "date_by", "truck", "driver", "service", "tracking", "status", "q", "on_site", "assigned"]) {
      const value = param(key);
      if (value) params.set(key, value);
    }
    return `?${params}`;
  }

  return (
    <>
      <header className="flex flex-wrap justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Roll-off dispatch</h1><p className="text-sm text-zinc-600">Work orders, rentals and pickups · {todayInPit()} (Chicago)</p></div>
        <Link href="/roll-off/orders/new" className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white">New order</Link>
      </header>
      <section aria-label="Operations overview" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {counters.map(([label, filter], i) => {
          const href = filter === "all" ? "/roll-off" : filter === "on-site" ? "?on_site=1" :
            filter === "assigned" ? "?assigned=1" : `?tracking=${encodeURIComponent(filter)}`;
          return <Link href={href} key={filter} className={`rounded-xl border bg-white p-3 hover:border-blue-500 ${filter === "Overdue" ? "text-red-800" : filter === "Pick up today" ? "text-amber-800" : ""}`}>
            <p className="text-sm">{label}</p><strong className="text-lg">{stats[i].count ?? "—"}</strong>
          </Link>;
        })}
      </section>
      <form action="/roll-off" className="grid gap-3 rounded-xl border bg-white p-4 text-sm sm:grid-cols-2 md:grid-cols-4">
        <label>Order #<input className={input} name="q" defaultValue={search} /></label>
        <label>Date field<select className={input} name="date_by" defaultValue={param("date_by")}><option value="">Scheduled</option><option value="order">Order date</option><option value="due">Pickup due</option></select></label>
        <label>Date<input className={input} name="date" type="date" defaultValue={validDate(date) ? date : ""} /></label>
        <label>Service<select className={input} name="service" defaultValue={service ?? ""}><option value="">All</option>{services.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Truck<select className={input} name="truck" defaultValue={truck}><option value="">All</option>{trucks.map((item) => <option key={item.id} value={item.id}>{item.truck_number}</option>)}</select></label>
        <label>Driver<select className={input} name="driver" defaultValue={driver}><option value="">All</option>{drivers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Tracking<select className={input} name="tracking" defaultValue={tracking ?? ""}><option value="">All</option>{trackingStatuses.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Dispatch<select className={input} name="status" defaultValue={status ?? ""}><option value="">All</option>{dispatchStatuses.map((item) => <option key={item}>{item}</option>)}</select></label>
        {param("on_site") === "1" && <input type="hidden" name="on_site" value="1" />}
        {param("assigned") === "1" && <input type="hidden" name="assigned" value="1" />}
        <div className="flex items-center gap-3">
          <button className="rounded-lg border px-3 py-2">Apply filters</button>
          <Link href="/roll-off" className="text-blue-700 underline">Clear</Link>
        </div>
        {param("on_site") === "1" && <span className="self-center font-medium">On-site only</span>}
        {param("assigned") === "1" && <span className="self-center font-medium">Assigned / en route only</span>}
      </form>
      {orders.error ? <p role="alert" className="rounded-xl border bg-white p-4 text-red-700">Could not load orders. Verify the database migration and try again.</p> :
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <caption className="px-3 py-2 text-left font-semibold">Work orders ({orders.count ?? 0})</caption>
            <thead className="bg-zinc-100"><tr>{["Order", "Customer / job site", "Service / container", "Scheduled", "Delivery", "Pickup due", "Truck / driver", "Dispatch / tracking", "Ticket"].map((heading) => <th key={heading} scope="col" className={cell}>{heading}</th>)}</tr></thead>
            <tbody>
              {(orders.data ?? []).map((order) => <tr key={order.id} className="border-t align-top">
                <td className={cell}><Link href={`/roll-off/orders/${order.id}`} className="font-semibold text-blue-700 underline">{order.order_number}</Link><p>{order.order_date}</p></td>
                <td className={cell}>{order.customer}<p className="text-zinc-600">{order.address}</p><p>{order.phone}</p></td>
                <td className={cell}>{order.service}<p>{order.container_number || "—"} · {order.size_yards} yd³</p>
                  {order.instructions && <p className="max-w-48 truncate text-zinc-600" title={order.instructions}>{order.instructions}</p>}
                </td>
                <td className={`${cell} whitespace-nowrap`}>{order.scheduled_date || "—"}</td>
                <td className={`${cell} whitespace-nowrap`}>{order.delivered_on || "—"}</td>
                <td className={`${cell} whitespace-nowrap`}>{order.due_on || "—"}{order.picked_up_on && <p>Done: {order.picked_up_on}</p>}</td>
                <td className={cell}>{order.truck_number || "—"}<p>{order.driver_name || "—"}</p></td>
                <td className={cell}>{order.dispatch_status}<p className={order.tracking_status === "Overdue" ? "font-semibold text-red-700" : order.tracking_status === "Pick up today" ? "font-semibold text-amber-800" : "text-zinc-600"}>{order.tracking_status}</p></td>
                <td className={cell}><Link href={`/roll-off/orders/${order.id}/ticket`} className="text-blue-700 underline">Print</Link></td>
              </tr>)}
              {!orders.data?.length && <tr><td className={cell} colSpan={9}>No orders match these filters.</td></tr>}
            </tbody>
          </table>
        </div>}
      {(page > 1 || offset + perPage < (orders.count ?? 0)) && <nav aria-label="Work order pages" className="flex gap-3 text-sm text-blue-700">
        {page > 1 && <Link href={pageHref(page - 1)}>Previous</Link>}
        {offset + perPage < (orders.count ?? 0) && <Link href={pageHref(page + 1)}>Next</Link>}
      </nav>}
    </>
  );
}
