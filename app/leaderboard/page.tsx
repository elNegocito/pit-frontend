import type { Metadata } from "next";
import Link from "next/link";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { todayInPit } from "@/lib/timezone";
import {
  MONTH_NAMES,
  monthKey,
  parseMonth,
  rank,
  shiftMonth,
  type ProductionRow,
  type Standing,
} from "@/lib/leaderboard";
import { PitScene } from "@/components/leaderboard/PitScene";

// Truck-door lettering: condensed for names and numbers, regular for text.
const condensed = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "800"], variable: "--ff-condensed" });
const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--ff-barlow" });

// Public link for drivers: no login, kept out of search engines.
export const metadata: Metadata = {
  title: "ASG Haulers Leaderboard",
  description: "Monthly and yearly loads hauled by ASG aggregate drivers.",
  robots: { index: false, follow: false },
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const [todayYear, todayMonth] = todayInPit().split("-").map(Number);
  const isYear = one(sp.view) === "year";
  const picked = parseMonth(one(sp.m));
  // Never past the current month / year.
  const sel =
    picked && monthKey(picked.year, picked.month) <= monthKey(todayYear, todayMonth)
      ? picked
      : { year: todayYear, month: todayMonth };
  const yearParam = Number(one(sp.y));
  const year = isYear ? (yearParam >= 2000 && yearParam <= todayYear ? yearParam : todayYear) : sel.year;

  const supabase = await createClient();
  const [{ data: rows }, { data: years }] = await Promise.all([
    supabase.rpc("public_driver_production", { p_year: year }),
    supabase.rpc("public_driver_production_years"),
  ]);
  const firstYear = Math.min(todayYear, ...((years ?? []) as number[]));

  const standings = rank((rows ?? []) as ProductionRow[], isYear ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [sel.month]);
  const leader = standings[0];
  const rest = standings.slice(1);
  const period = isYear ? String(year) : MONTH_NAMES[sel.month - 1];
  const isCurrent = isYear ? year === todayYear : sel.year === todayYear && sel.month === todayMonth;

  const prev = isYear
    ? year > firstYear ? `/leaderboard?view=year&y=${year - 1}` : null
    : shiftMonth(sel.year, sel.month, -1) >= monthKey(firstYear, 1) ? `/leaderboard?m=${shiftMonth(sel.year, sel.month, -1)}` : null;
  const next = isCurrent
    ? null
    : isYear ? `/leaderboard?view=year&y=${year + 1}` : `/leaderboard?m=${shiftMonth(sel.year, sel.month, 1)}`;
  const peakMonth = Math.max(1, ...standings.flatMap((s) => s.byMonth));

  return (
    <div className={`${condensed.variable} ${barlow.variable} flex min-h-full flex-1 flex-col bg-[#E4E2DC] font-[family-name:var(--ff-barlow)] text-[#2B2F33]`}>
      <header className="bg-[#BFD6DE]">
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:pt-10">
          <p className="text-sm font-semibold text-[#4E6B7A]">ASG Operations</p>
          <h1 className="font-[family-name:var(--ff-condensed)] text-6xl leading-[0.9] font-extrabold tracking-tight sm:text-8xl">
            {isYear ? `${year} haulers` : `${period} haulers`}
          </h1>
          <p className="mt-2 max-w-md text-base text-[#3B4348]">
            {isYear
              ? "Loads hauled by aggregate drivers, all year."
              : isCurrent
                ? "Loads hauled by aggregate drivers this month. The board starts over on the 1st."
                : `Final count for ${period} ${sel.year}.`}
          </p>
        </div>
        <div className="mt-2 h-[150px] sm:h-[230px]">
          <PitScene />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Period">
          <div className="inline-flex rounded-md border-2 border-[#2B2F33] text-sm font-semibold">
            <Link
              href="/leaderboard"
              aria-current={!isYear ? "page" : undefined}
              className={`px-4 py-1.5 ${!isYear ? "bg-[#2B2F33] text-[#E4E2DC]" : "hover:bg-white/60"}`}
            >
              Month
            </Link>
            <Link
              href={`/leaderboard?view=year&y=${year}`}
              aria-current={isYear ? "page" : undefined}
              className={`px-4 py-1.5 ${isYear ? "bg-[#2B2F33] text-[#E4E2DC]" : "hover:bg-white/60"}`}
            >
              Year
            </Link>
          </div>
          <div className="flex items-center gap-1 font-[family-name:var(--ff-condensed)] text-xl font-semibold">
            <PeriodLink href={prev} label={isYear ? "Previous year" : "Previous month"}>‹</PeriodLink>
            <span className="min-w-36 text-center">{isYear ? year : `${period} ${sel.year}`}</span>
            <PeriodLink href={next} label={isYear ? "Next year" : "Next month"}>›</PeriodLink>
          </div>
        </nav>

        {leader ? (
          <>
            <section
              aria-label="First place"
              className="mt-6 flex items-center gap-4 rounded-md border-2 border-[#2B2F33] bg-[#F2B705] px-4 py-4 sm:gap-6 sm:px-6"
            >
              <span className="font-[family-name:var(--ff-condensed)] text-7xl leading-none font-extrabold sm:text-8xl">1</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-[family-name:var(--ff-condensed)] text-3xl leading-tight font-extrabold sm:text-5xl">
                  {leader.name}
                </p>
                <p className="text-sm font-medium">
                  {fmt(leader.tons)} tons{standings.filter((s) => s.rank === 1).length > 1 && ", tied for first"}
                </p>
              </div>
              <p className="text-right font-[family-name:var(--ff-condensed)] leading-none font-extrabold">
                <span className="block text-6xl sm:text-7xl">{leader.loads}</span>
                <span className="text-base font-semibold">loads</span>
              </p>
            </section>

            {rest.length > 0 && (
              <ol className="mt-4 divide-y divide-[#CFCBC2] rounded-md bg-white/70">
                {rest.map((s) => (
                  <Row key={s.driverId} s={s} leaderLoads={leader.loads} isYear={isYear} peakMonth={peakMonth} />
                ))}
              </ol>
            )}
          </>
        ) : (
          <p className="mt-6 rounded-md border-2 border-dashed border-[#9A938A] px-4 py-8 text-center text-[#4E5459]">
            {isCurrent
              ? "No loads recorded yet. They show up here as payroll saves the pay sheets."
              : `No loads were recorded for ${isYear ? year : `${period} ${sel.year}`}.`}
          </p>
        )}

        <p className="mt-6 text-sm text-[#5C6368]">
          Ranked by loads hauled, then tons. Only aggregate drivers are listed, from the pay sheets saved by payroll.
        </p>
      </main>
    </div>
  );
}

function PeriodLink({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  const cls = "flex h-9 w-9 items-center justify-center rounded-md text-2xl";
  if (!href) {
    return (
      <span aria-hidden className={`${cls} text-[#A7A29A]`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={`${cls} hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-[#2B2F33]`}>
      {children}
    </Link>
  );
}

function Row({ s, leaderLoads, isYear, peakMonth }: { s: Standing; leaderLoads: number; isYear: boolean; peakMonth: number }) {
  return (
    <li className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-x-3 px-3 py-3 sm:grid-cols-[3rem_1fr_auto_4.5rem] sm:px-4">
      <span className="font-[family-name:var(--ff-condensed)] text-3xl leading-none font-extrabold text-[#4E6B7A]">{s.rank}</span>
      <div className="min-w-0">
        <p className="truncate font-[family-name:var(--ff-condensed)] text-2xl leading-tight font-semibold">{s.name}</p>
        {isYear ? (
          <div className="mt-1 flex h-6 items-end gap-[3px]" aria-label="Loads per month">
            {s.byMonth.map((n, i) => (
              <span
                key={i}
                title={`${n} loads`}
                className="w-[7px] rounded-t-[1px] bg-[#8C4A2F]"
                style={{ height: `${Math.max(n ? 12 : 4, (n / peakMonth) * 100)}%`, opacity: n ? 1 : 0.25 }}
              />
            ))}
          </div>
        ) : (
          <div className="mt-1.5 h-1.5 w-full max-w-xs rounded-full bg-[#D9D5CD]">
            <div className="h-full rounded-full bg-[#8C4A2F]" style={{ width: `${(s.loads / leaderLoads) * 100}%` }} />
          </div>
        )}
      </div>
      <p className="text-right font-[family-name:var(--ff-condensed)] leading-none">
        <span className="text-3xl font-extrabold">{s.loads}</span>
        <span className="ml-1 text-sm font-semibold">loads</span>
      </p>
      <p className="col-start-2 text-sm text-[#5C6368] sm:col-start-auto sm:text-right">{fmt(s.tons)} tons</p>
    </li>
  );
}
