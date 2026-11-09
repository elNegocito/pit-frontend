import { formatTicketDate } from "@/lib/timezone";
import { money, pct, qty, rate, sumLoads } from "@/lib/ctal/compute";
import type { Load } from "@/lib/ctal/types";

const th = "border-b border-rule bg-pine-50 px-2.5 py-2 text-left text-xs font-semibold text-zinc-700 whitespace-nowrap";
const td = "border-b border-rule px-2.5 py-1.5 text-sm whitespace-nowrap";
const r = "text-right tabular-nums";

/** Read-only rows of a statement (carrier side) or a billing sheet (broker side). */
export function LoadsTable({ rows, side }: { rows: Load[]; side: "carrier" | "broker" }) {
  const t = sumLoads(rows);
  const carrier = side === "carrier";
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={th}>Date</th>
            {!carrier && <th className={th}>Company</th>}
            <th className={th}>Truck #</th>
            <th className={th}>Driver</th>
            <th className={th}>Customer</th>
            <th className={th}>Ticket</th>
            <th className={`${th} ${r}`}>Qty</th>
            <th className={th}>Unit</th>
            <th className={`${th} ${r}`}>{carrier ? "Rate" : "Broker rate"}</th>
            <th className={`${th} ${r}`}>{carrier ? "Amount" : "Broker amount"}</th>
            {carrier && <th className={`${th} ${r}`}>Broker fee</th>}
            {carrier && <th className={`${th} ${r}`}>Quick pay</th>}
            <th className={`${th} ${r}`}>FSC $</th>
            <th className={`${th} ${r}`}>FSC %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id}>
              <td className={`${td} tabular-nums`}>{formatTicketDate(l.load_date)}</td>
              {!carrier && <td className={td}>{l.carrier_name}</td>}
              <td className={td}>{l.truck}</td>
              <td className={td}>{l.driver}</td>
              <td className={td}>{l.customer_name}</td>
              <td className={`${td} tabular-nums`}>{l.ticket}</td>
              <td className={`${td} ${r}`}>{qty(l.quantity)}</td>
              <td className={td}>{l.unit}</td>
              <td className={`${td} ${r}`}>{rate(carrier ? l.carrier_rate : l.broker_rate)}</td>
              <td className={`${td} ${r}`}>{money(carrier ? l.carrier_amount : l.broker_amount)}</td>
              {carrier && <td className={`${td} ${r}`}>{money(l.broker_fee)}</td>}
              {carrier && <td className={`${td} ${r}`}>{money(l.quick_pay_fee)}</td>}
              <td className={`${td} ${r}`}>{money(l.fsc_amount)}</td>
              <td className={`${td} ${r} text-zinc-500`}>{l.fsc_mode === "percent" ? pct(l.fsc_value) : "N/A"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className={td} colSpan={carrier ? 5 : 6}>
              {t.loads} load{t.loads === 1 ? "" : "s"}
            </td>
            <td className={`${td} ${r}`}>{qty(t.quantity)}</td>
            <td className={td} colSpan={2} />
            <td className={`${td} ${r}`}>{money(carrier ? t.carrier_amount : t.broker_amount)}</td>
            {carrier && <td className={`${td} ${r}`}>{money(t.broker_fee)}</td>}
            {carrier && <td className={`${td} ${r}`}>{money(t.quick_pay_fee)}</td>}
            <td className={`${td} ${r}`}>{money(t.fsc_amount)}</td>
            <td className={td} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** SUBTOTAL / fees / TOTAL box, like the bottom of each Excel sheet. */
export function TotalsBox({ lines, total }: { lines: [string, number][]; total: number }) {
  return (
    <dl className="ml-auto w-full max-w-xs overflow-hidden rounded-lg border border-rule text-sm">
      {lines.map(([k, v]) => (
        <div key={k} className="flex justify-between border-b border-rule px-3 py-1.5">
          <dt className="text-zinc-600">{k}</dt>
          <dd className="tabular-nums">{money(v)}</dd>
        </div>
      ))}
      <div className="flex justify-between bg-pine-900 px-3 py-2 text-base font-semibold text-white">
        <dt>Total</dt>
        <dd className="tabular-nums">{money(total)}</dd>
      </div>
    </dl>
  );
}
