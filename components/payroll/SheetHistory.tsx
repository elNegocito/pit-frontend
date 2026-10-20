import { PIT_TIME_ZONE } from "@/lib/timezone";
import { money } from "@/lib/payroll/compute";
import type { PaySheetEvent } from "@/lib/payroll/types";

const FIELD_LABELS: Record<string, string> = {
  driver_name: "Driver",
  truck_number: "Truck #",
  pay_date: "Pay date",
  notes: "Notes",
  revenue_pct: "Driver pay %",
  hourly_rate: "$ / hour",
  ot_rate: "OT $ / hour",
  ot_threshold: "OT after (hours)",
  total_revenue: "Total revenue",
  total_hours: "Total hours",
  adjustments_total: "Extras / deductions",
  total_pay: "Total pay",
};

type Obj = Record<string, unknown>;
const MONEY_FIELDS = new Set(["hourly_rate", "ot_rate", "total_revenue", "adjustments_total", "total_pay", "revenue", "amount"]);

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
const showField = (field: string, v: unknown) =>
  MONEY_FIELDS.has(field) && v !== null && v !== undefined && v !== "" ? money(Number(v)) : show(v);

/** Row-level diff of a JSON array (loads / hours / adjustments), by position. */
function arrayDiff(label: (row: Obj, i: number) => string, from: Obj[], to: Obj[]): string[] {
  const out: string[] = [];
  const len = Math.max(from.length, to.length);
  for (let i = 0; i < len; i++) {
    const a = from[i];
    const b = to[i];
    if (!a && b) out.push(`${label(b, i)} added`);
    else if (a && !b) out.push(`${label(a, i)} removed`);
    else if (a && b) {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      const changed = [...keys]
        .filter((k) => show(a[k]) !== show(b[k]))
        .map((k) => `${k.replace("_", " ")} ${showField(k, a[k])} → ${showField(k, b[k])}`);
      if (changed.length) out.push(`${label(b, i)}: ${changed.join(", ")}`);
    }
  }
  return out;
}

function describe(changes: PaySheetEvent["changes"]): string[] {
  const lines: string[] = [];
  for (const [field, { from, to }] of Object.entries(changes)) {
    if (field === "loads") {
      lines.push(...arrayDiff((_, i) => `Load ${i + 1}`, (from as Obj[]) ?? [], (to as Obj[]) ?? []));
    } else if (field === "hours") {
      lines.push(...arrayDiff((r) => `Hours ${show(r.day)}`, (from as Obj[]) ?? [], (to as Obj[]) ?? []));
    } else if (field === "adjustments") {
      lines.push(...arrayDiff((r) => show(r.label), (from as Obj[]) ?? [], (to as Obj[]) ?? []));
    } else {
      lines.push(`${FIELD_LABELS[field] ?? field}: ${showField(field, from)} → ${showField(field, to)}`);
    }
  }
  return lines;
}

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: PIT_TIME_ZONE, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

/** Who created / changed / voided the sheet and what changed (newest first). */
export function SheetHistory({ events }: { events: PaySheetEvent[] }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow">
      <h2 className="mb-2 text-sm font-semibold">History</h2>
      <ol className="space-y-3 text-sm">
        {events.map((e) => (
          <li key={e.id} className="border-l-2 border-zinc-200 pl-3">
            <p>
              <strong>{e.actor_name ?? "—"}</strong>{" "}
              {e.action === "create" ? "created the sheet" : e.action === "void" ? "voided the sheet" : "edited"}
              <span className="ml-2 text-xs text-zinc-500">{when(e.created_at)}</span>
            </p>
            {e.action === "create" ? (
              <p className="text-xs text-zinc-600">Total pay: {showField("total_pay", e.changes.total_pay?.to)}</p>
            ) : (
              <ul className="mt-0.5 list-disc pl-4 text-xs text-zinc-600">
                {describe(e.changes).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {events.length === 0 && <li className="text-zinc-400">No history.</li>}
      </ol>
    </section>
  );
}
