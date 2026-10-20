import { formatTicketDate } from "@/lib/timezone";
import { money, num } from "@/lib/payroll/compute";
import { DAY_LABELS, PAY_MODELS, PAYROLL_HEADER } from "@/lib/payroll/models";
import type { PaySheet } from "@/lib/payroll/types";

const d = (iso: string | null | undefined) => (iso ? formatTicketDate(iso) : "");

/** Read-only pay sheet, same structure as the Excel template (totals from the DB). */
export function SheetView({ sheet: s }: { sheet: PaySheet }) {
  const model = PAY_MODELS[s.pay_model];
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
          <dt className="w-20 font-semibold">Truck #:</dt>
          <dd>{s.truck_number}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 font-semibold">Pay date:</dt>
          <dd>{d(s.pay_date)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 font-semibold">Notes:</dt>
          <dd>{s.notes}</dd>
        </div>
      </dl>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-zinc-900 text-left text-xs text-white uppercase">
            <tr>
              <th className="px-2 py-1.5">Load #</th>
              <th className="px-2 py-1.5">Date</th>
              <th className="px-2 py-1.5 text-right">Revenue</th>
              <th className="px-2 py-1.5 text-right">Driver pay @ {num(s.revenue_pct)}%</th>
              <th className="px-2 py-1.5">Ticket #</th>
              <th className="px-2 py-1.5">Company</th>
              <th className="px-2 py-1.5">{model.extraLabel}</th>
            </tr>
          </thead>
          <tbody>
            {s.loads.map((l, i) => (
              <tr key={i} className="border-b border-zinc-100">
                <td className="px-2 py-1 text-zinc-500">Load {i + 1}</td>
                <td className="px-2 py-1">{d(l.date)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{money(l.revenue)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{money((l.revenue * s.revenue_pct) / 100)}</td>
                <td className="px-2 py-1">{l.load_number}</td>
                <td className="px-2 py-1">{l.company}</td>
                <td className="px-2 py-1">{l.extra}</td>
              </tr>
            ))}
            {s.loads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-3 text-center text-zinc-400">
                  No loads
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-zinc-100 font-semibold">
            <tr>
              <td className="px-2 py-1.5 text-xs uppercase" colSpan={2}>
                Totals
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{money(s.total_revenue)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{money(s.loads_pay)}</td>
              <td colSpan={3} />
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
          <div className="flex justify-between">
            <dt>Driver pay for loads</dt>
            <dd className="tabular-nums">{money(s.loads_pay)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Driver pay for hours</dt>
            <dd className="tabular-nums">{money(s.regular_pay)}</dd>
          </div>
          {s.ot_rate !== null && (
            <div className="flex justify-between">
              <dt>
                Driver pay for OT hours (after {num(s.ot_threshold)} h @ {money(s.ot_rate)})
              </dt>
              <dd className="tabular-nums">{money(s.ot_pay)}</dd>
            </div>
          )}
          {s.adjustments.map((a, i) => (
            <div key={i} className="flex justify-between">
              <dt>{a.label}</dt>
              <dd className={`tabular-nums ${a.deduction ? "text-red-700" : ""}`}>
                {a.deduction ? `−${money(a.amount)}` : money(a.amount)}
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
