import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseFilters } from "@/lib/orders/query";
import { OrdersFilters } from "@/components/OrdersFilters";
import { OrdersTable } from "@/components/OrdersTable";
import { ExportButtons } from "@/components/ExportButtons";
import { SignOutButton } from "@/components/SignOutButton";
import Link from "next/link";

const PAGE_SIZE = 50;

const SELECT =
  "id, date, material_id, truck_number, ticket_number, tons, customer_id, payment, cod_method, gross, created_at, materials(name), customers(name)";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { filters, sort, dir, page } = parseFilters(sp);
  const supabase = await createClient();

  const ascending = dir === "asc";

  function filtered() {
    let q = supabase.from("orders").select(SELECT, { count: "exact" });
    if (filters.truck) q = q.ilike("truck_number", `%${filters.truck.replace(/[%_\\]/g, "")}%`);
    if (filters.ticket) q = q.ilike("ticket_number", `%${filters.ticket.replace(/[%_\\]/g, "")}%`);
    if (filters.customerId) q = q.eq("customer_id", filters.customerId);
    if (filters.materialId) q = q.eq("material_id", filters.materialId);
    if (filters.payment) q = q.eq("payment", filters.payment);
    if (filters.codMethod) q = q.eq("cod_method", filters.codMethod);
    if (filters.dateFrom) q = q.gte("date", filters.dateFrom);
    if (filters.dateTo) q = q.lte("date", filters.dateTo);
    if (sort === "customer") q = q.order("name", { referencedTable: "customers", ascending });
    else if (sort === "material") q = q.order("name", { referencedTable: "materials", ascending });
    else q = q.order(sort, { ascending });
    return q;
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data: rows, count } = await filtered().range(from, from + PAGE_SIZE - 1);

  // Totals over the whole filtered set (pit scale: a few thousand rows max).
  const { data: all } = await (() => {
    let q = supabase.from("orders").select("tons, gross");
    if (filters.truck) q = q.ilike("truck_number", `%${filters.truck.replace(/[%_\\]/g, "")}%`);
    if (filters.ticket) q = q.ilike("ticket_number", `%${filters.ticket.replace(/[%_\\]/g, "")}%`);
    if (filters.customerId) q = q.eq("customer_id", filters.customerId);
    if (filters.materialId) q = q.eq("material_id", filters.materialId);
    if (filters.payment) q = q.eq("payment", filters.payment);
    if (filters.codMethod) q = q.eq("cod_method", filters.codMethod);
    if (filters.dateFrom) q = q.gte("date", filters.dateFrom);
    if (filters.dateTo) q = q.lte("date", filters.dateTo);
    return q;
  })();
  const totalTons = (all ?? []).reduce((s, r) => s + Number(r.tons), 0);
  const totalGross = (all ?? []).reduce((s, r) => s + Number(r.gross), 0);

  const [{ data: customers }, { data: materials }] = await Promise.all([
    supabase.from("customers").select("id, name").order("name"),
    supabase.from("materials").select("id, name, price_per_ton, active").order("name"),
  ]);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="min-h-full flex-1 bg-zinc-100 px-4 py-6">
      <div className="mx-auto mb-4 flex w-full max-w-6xl flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">ASG Operations — PIT #2</h1>
          <p className="text-sm text-zinc-500">Orders ledger (admin)</p>
        </div>
        <div className="flex gap-2">
          <Link href="/entry" className="rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-zinc-50">
            Entry form
          </Link>
          <Link href="/materials" className="rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-zinc-50">
            Materials
          </Link>
          <Link href="/customers" className="rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-zinc-50">
            Customers
          </Link>
          <SignOutButton />
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow">
          <div className="text-sm">
            <span className="text-zinc-500">Loads: </span>
            <strong>{total}</strong>
          </div>
          <div className="text-sm">
            <span className="text-zinc-500">Tons: </span>
            <strong>{totalTons.toFixed(2)}</strong>
          </div>
          <div className="text-sm">
            <span className="text-zinc-500">Gross: </span>
            <strong>${totalGross.toFixed(2)}</strong>
          </div>
          <div className="ml-auto">
            <ExportButtons filters={filters} sort={sort} dir={dir} />
          </div>
        </div>

        <OrdersFilters
          initial={filters}
          sort={sort}
          dir={dir}
          customers={customers ?? []}
          materials={materials ?? []}
        />
        <OrdersTable
          rows={(rows ?? []) as never}
          filters={filters}
          sort={sort}
          dir={dir}
          page={page}
          totalPages={totalPages}
          total={total}
        />
      </div>
    </main>
  );
}
