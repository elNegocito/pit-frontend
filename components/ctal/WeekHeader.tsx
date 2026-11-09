import Link from "next/link";
import { formatTicketDate } from "@/lib/timezone";
import { weekLabel } from "@/lib/ctal/compute";
import type { Week } from "@/lib/ctal/types";

const TABS = [
  { key: "log", label: "Log", path: "" },
  { key: "statements", label: "Statements", path: "/statements" },
  { key: "billing", label: "Billing", path: "/billing" },
  { key: "profit", label: "Broker profit", path: "/profit" },
] as const;

export function WeekHeader({ week, active, children }: { week: Week; active: (typeof TABS)[number]["key"]; children?: React.ReactNode }) {
  return (
    <div className="mb-4 print:hidden">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/ctal/weeks" className="text-sm text-pine-700 hover:underline">
            All weeks
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight tabular-nums">Week {weekLabel(week.week_start)}</h1>
          <p className="text-sm text-zinc-600">Sunday to Saturday. Paid on Friday {formatTicketDate(week.pay_date)}.</p>
        </div>
        {children}
      </div>
      <nav aria-label="Week sections" className="mt-4 flex gap-1 overflow-x-auto border-b border-rule">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/ctal/weeks/${week.id}${t.path}`}
            aria-current={t.key === active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap ${
              t.key === active ? "border-pine-900 font-semibold text-pine-900" : "border-transparent text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
