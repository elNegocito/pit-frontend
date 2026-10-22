import { formatTicketDate } from "@/lib/timezone";
import { money, num } from "@/lib/payroll/compute";
import { loadColumns, summaryLines } from "@/lib/payroll/layout";
import { DAY_LABELS, PAYROLL_HEADER } from "@/lib/payroll/models";
import type { PaySheet } from "@/lib/payroll/types";

const d = (iso: string | null | undefined) => (iso ? formatTicketDate(iso) : "");

/** Read-only pay sheet, same structure as the Excel template (totals from the DB). */
export function SheetView({ sheet: s }: { sheet: PaySheet }) {
  const cols = loadColumns(s);
  return (
    <div className="relative rounded-2xl bg-white p-5 shadow">
      {s.status === "void" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rotate-[-12deg] border-4 border-red-600 px-6 text-6xl font-black tracking-widest text-red-600 opacity-40">
            VOID
          </span>
        </div>
      )}
      <div className="text-center">
        <h2 className="font-bold">{PAYROLL_HEADER.title}</h2>
        <p className="text-xs text-zinc-500">
          {PAYROLL_HEADER.phone} · {PAYROLL_HEADER.email}
        </p>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="w-20 font-semibold">Driver:</dt>
          <dd>{s.driver_name}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 font-semibold">Notes:</dt>
          <dd>{s.notes}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 font-semibold">Pay date:</dt>
          <dd>{d(s.pay_date)}</dd>
        </div>
      </dl>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-zinc-900 text-left text-xs text-white uppercase">
            <tr>
              {cols.map((c) => (
                <th key={c.header} className={`px-2 py-1.5 ${c.right ? "text-right" : ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.loads.map((l, i) => (
              <tr key={i} className="border-b border-zinc-100">
                {cols.map((c, j) => (
                  <td key={c.header} className={`px-2 py-1 ${c.right ? "text-right tabular-nums" : ""} ${j === 0 ? "text-zinc-500" : ""}`}>
                    {c.cell(l, i)}
                  </td>
                ))}
              </tr>
            ))}
            {s.loads.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="px-2 py-3 text-center text-zinc-400">
                  No loads
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-zinc-100 font-semibold">
            <tr>
              {cols.map((c, j) => (
                <td key={c.header} className={`px-2 py-1.5 ${c.right ? "text-right tabular-nums" : ""} ${j === 0 ? "text-xs uppercase" : ""}`}>
                  {c.total}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <table className="text-sm">
          <thead className="text-left text-xs uppercase">
            <tr>
              <th className="py-1">Driver hours @ {money(s.hourly_rate)}/hr</th>
              <th className="py-1 text-right">Hours</th>
            </tr>
          </thead>
          <tbody>
            {s.hours.map((h) => (
              <tr key={h.day} className="border-b border-zinc-100">
                <td className="py-1">
                  {DAY_LABELS[h.day]}
                  {h.note && <span className="ml-2 text-xs text-zinc-500">{h.note}</span>}
                </td>
                <td className="py-1 text-right tabular-nums">{num(h.hours)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="font-semibold">
            <tr>
              <td className="py-1 text-xs uppercase">Total hours</td>
              <td className="py-1 text-right tabular-nums">{num(s.total_hours)}</td>
            </tr>
          </tfoot>
        </table>

        <dl className="space-y-1 text-sm">
          {summaryLines(s).map((l, i) => (
            <div key={i} className="flex justify-between gap-2">
              <dt>{l.label}</dt>
              <dd className={`tabular-nums ${l.deduction ? "text-red-700" : ""}`}>
                {l.deduction ? `−${money(l.amount)}` : money(l.amount)}
              </dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between border-t pt-2">
            <dt className="font-semibold uppercase">Total pay</dt>
            <dd className="text-xl font-bold tabular-nums">{money(s.total_pay)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
