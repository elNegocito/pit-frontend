import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPitDate, todayInPit } from "@/lib/timezone";
import { EntryWorkspace } from "@/components/EntryWorkspace";
import type { TodayRow } from "@/components/TodaysTickets";
import { SignOutButton } from "@/components/SignOutButton";
import Link from "next/link";
import { Nunito, Quicksand } from "next/font/google";

// Operator theme fonts (desing/stitch_hello_kitty_form_redesign).
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800", "900"], variable: "--ff-nunito" });
const quicksand = Quicksand({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--ff-quicksand" });

const PAGE_SIZE = 20;
const TODAY_SELECT =
  "id, truck_number, ticket_number, tons, payment, cod_method, gross, status, edited_at, materials(name), customers(name)";

type Named = { name: string } | { name: string }[] | null;
const nameOf = (m: Named) => (Array.isArray(m) ? (m[0]?.name ?? "—") : (m?.name ?? "—"));

export default async function EntryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const raw = Array.isArray(sp.tpage) ? sp.tpage[0] : sp.tpage;
  const tpage = Math.max(1, parseInt(raw || "1", 10) || 1);
  const today = todayInPit();
  const from = (tpage - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const [{ data: materials }, { data: trucks }, { data: jobOrders }, { data: profile }, { data: authData }, todayRes] =
    await Promise.all([
      supabase.from("materials").select("id, name, price_per_ton, active").eq("active", true).order("name"),
      supabase.from("trucks").select("truck_number, gross_tons").eq("active", true).order("truck_number"),
      supabase.from("job_orders").select("code, customers(name)").eq("active", true),
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      supabase.auth.getUser(),
      supabase
        .from("orders")
        .select(TODAY_SELECT, { count: "exact" })
        .eq("date", today)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1),
    ]);

  const rows: TodayRow[] = ((todayRes.data ?? []) as Array<
    Omit<TodayRow, "material" | "customer"> & { materials: Named; customers: Named }
  >).map(({ materials: m, customers: c, ...r }) => ({ ...r, material: nameOf(m), customer: nameOf(c) }));

  const weighmaster = profile?.display_name || authData.user?.email?.split("@")[0] || "";

  return (
    <div
      className={`${nunito.variable} ${quicksand.variable} flex min-h-full flex-1 flex-col bg-gradient-to-br from-[#ffe4ec] via-[#fff1f5] to-[#fce7f3] font-kitty text-slate-800 antialiased selection:bg-pink-300 selection:text-pink-900 print:bg-white`}
    >
      <header className="sticky top-0 z-40 border-b-2 border-pink-200 bg-white/90 shadow-sm backdrop-blur-md print:hidden">
        <div className="flex items-center justify-between bg-gradient-to-r from-[#ff1493] via-[#ff4081] to-[#f43f5e] px-4 py-1.5 text-xs font-bold tracking-wider text-white uppercase">
          <span className="flex items-center gap-2">
            <span>🎀</span>
            <span>ASG Operations — PIT #2 Weigh Scale System</span>
          </span>
          <span className="hidden text-[11px] font-semibold text-pink-100 sm:inline">{formatPitDate(today)}</span>
        </div>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-400 text-xl font-black text-white shadow-cute-sm ring-2 ring-pink-200">
              A
            </div>
            <div>
              <h1 className="font-cute text-xl font-black tracking-tight text-pink-700 sm:text-2xl">
                ASG Operations <span className="font-normal text-slate-400">—</span>{" "}
                <span className="text-pink-600">PIT #2</span>
              </h1>
              <p className="text-xs font-semibold text-pink-800/70">Material Entry Form &amp; Scale Ticket Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 rounded-full border border-pink-200 bg-pink-50 py-1 pr-3 pl-2 shadow-sm">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-pink-400 text-xs text-white ring-2 ring-pink-300">
                ♥
              </div>
              <div className="text-left text-xs leading-tight">
                <span className="block font-black text-pink-900">{weighmaster || "Operator"}</span>
                <span className="text-[10px] font-semibold text-pink-600 capitalize">{user.role}</span>
              </div>
            </div>
            {user.role === "admin" && (
              <Link
                href="/dashboard"
                className="rounded-xl border border-pink-200 bg-white px-3.5 py-2 text-xs font-bold text-pink-700 shadow-sm transition hover:bg-pink-50 hover:text-pink-900"
              >
                Dashboard
              </Link>
            )}
            <SignOutButton className="rounded-xl border border-pink-200 bg-white px-3.5 py-2 text-xs font-bold text-pink-700 shadow-sm transition hover:bg-pink-50 hover:text-pink-900" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 print:p-0">
        <EntryWorkspace
          materials={materials ?? []}
          trucks={(trucks ?? []).map((t) => ({ truck_number: t.truck_number, gross_tons: Number(t.gross_tons) }))}
          jobOrders={(jobOrders ?? []).map((o) => ({ code: o.code, customer: nameOf(o.customers as Named) }))}
          today={today}
          weighmaster={weighmaster}
          todays={{ rows, total: todayRes.count ?? 0, page: tpage, pageSize: PAGE_SIZE }}
        />
      </main>

      <footer className="border-t border-pink-200 bg-white/80 py-3 text-center text-xs font-semibold text-pink-700 print:hidden">
        🎀 ASG Operations Platform — PIT #2
      </footer>
    </div>
  );
}
