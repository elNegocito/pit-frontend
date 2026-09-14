import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;
const SELECT =
  "id, truck_number, ticket_number, tons, payment, cod_method, gross, created_at, materials(name), customers(name)";

export async function TodaysTickets({ today, page }: { today: string; page: number }) {
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;
  const { data: rows, count } = await supabase
    .from("orders")
    .select(SELECT, { count: "exact" })
    .eq("date", today)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const list = (rows ?? []) as Array<{
    id: string;
    truck_number: string;
    ticket_number: string;
    tons: number;
    payment: string;
    cod_method: string | null;
    gross: number;
    materials: { name: string } | { name: string }[] | null;
    customers: { name: string } | { name: string }[] | null;
  }>;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dayTons = list.reduce((s, r) => s + Number(r.tons), 0);

  const mat = (m: { name: string } | { name: string }[] | null) =>
    Array.isArray(m) ? (m[0]?.name ?? "—") : (m?.name ?? "—");

  return (
    <section className="mx-auto mt-6 w-full max-w-xl rounded-2xl bg-white p-6 shadow sm:p-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Today&apos;s tickets ({total})</h2>
        <span className="text-sm text-zinc-500">{dayTons.toFixed(2)} t this page</span>
      </div>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No tickets saved today yet.</p>
      ) : (
        <ul className="mt-3 divide-y text-sm">
          {list.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {mat(r.customers)} · {mat(r.materials)}
                </p>
                <p className="text-xs text-zinc-500">
                  Truck {r.truck_number} · Tkt {r.ticket_number} · {Number(r.tons).toFixed(2)} t · {r.payment}
                  {r.cod_method ? `/${r.cod_method}` : ""}
                </p>
              </div>
              <span className="shrink-0 font-semibold">${Number(r.gross).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-zinc-500">
            Page {page} of {totalPages}
          </span>
          <span className="flex gap-2">
            <Link
              href={`/entry?tpage=${Math.max(1, page - 1)}`}
              aria-disabled={page <= 1}
              className={`rounded-lg border px-3 py-1 ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-zinc-100"}`}
            >
              ← Prev
            </Link>
            <Link
              href={`/entry?tpage=${page + 1}`}
              aria-disabled={page >= totalPages}
              className={`rounded-lg border px-3 py-1 ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-zinc-100"}`}
            >
              Next →
            </Link>
          </span>
        </div>
      )}
    </section>
  );
}
