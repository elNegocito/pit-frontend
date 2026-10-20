"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePaySheet } from "@/lib/payroll/actions";
import {
  computeTotals,
  isFilledLoad,
  money,
  num,
  parseAmount,
  type Adjustment,
  type HoursLine,
  type LoadLine,
  type SheetInput,
} from "@/lib/payroll/compute";
import { DAY_LABELS, PAY_MODEL_KEYS, PAY_MODELS, type Day, type PayModel } from "@/lib/payroll/models";
import type { Driver, PaySheet } from "@/lib/payroll/types";

// Form rows keep the raw text the user typed (revenue accepts "25.93*9.5").
interface LoadRow extends Omit<LoadLine, "revenue"> {
  key: number;
  revenueRaw: string;
}
interface AdjRow {
  key: number;
  label: string;
  amountRaw: string;
  deduction: boolean;
}
interface HoursRow {
  day: Day;
  hoursRaw: string;
  note: string;
}

const EMPTY_LOAD_ROWS = 8;
let nextKey = 1;
const blankLoad = (date = ""): LoadRow => ({
  key: nextKey++,
  date,
  revenueRaw: "",
  load_number: "",
  company: "",
  extra: "",
});

function templateHours(model: PayModel, keep: HoursRow[] = []): HoursRow[] {
  return PAY_MODELS[model].days.map(
    (day) => keep.find((h) => h.day === day) ?? { day, hoursRaw: "", note: "" },
  );
}

function templateAdjustments(model: PayModel, keep: AdjRow[] = []): AdjRow[] {
  return PAY_MODELS[model].adjustments.map((a) => {
    const prev = keep.find((k) => k.label.trim().toUpperCase() === a.label);
    return { key: nextKey++, label: a.label, amountRaw: prev?.amountRaw ?? "", deduction: a.deduction };
  });
}

const input = "w-full rounded-lg border px-2 py-1.5 text-sm";
const cell = "rounded border border-zinc-200 px-1.5 py-1 text-sm focus:border-zinc-500 focus:outline-none";

interface Props {
  drivers: Driver[];
  sheet: PaySheet | null; // null = new sheet
  /** New sheet prefilled from another one ("Copy for next week"). */
  template?: PaySheet | null;
  defaultDriverId?: string;
  defaultPayDate: string;
}

export function PaySheetForm({ drivers, sheet, template, defaultDriverId, defaultPayDate }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ id: string; number: number } | null>(null);

  // Initial values: the sheet being edited, else the copied one.
  const init = sheet ?? template ?? null;
  const initialDriver = drivers.find((d) => d.id === (init?.driver_id ?? defaultDriverId));
  const initialModel: PayModel = init?.pay_model ?? initialDriver?.pay_model ?? "trucking";
  const m0 = PAY_MODELS[initialModel];

  const [driverId, setDriverId] = useState(init?.driver_id ?? initialDriver?.id ?? "");
  const [payModel, setPayModel] = useState<PayModel>(initialModel);
  const [truck, setTruck] = useState(init?.truck_number ?? initialDriver?.truck_number ?? "");
  const [payDate, setPayDate] = useState(sheet?.pay_date ?? defaultPayDate);
  const [notes, setNotes] = useState(init?.notes ?? "");
  const [pctRaw, setPctRaw] = useState(String(init?.revenue_pct ?? m0.revenuePct));
  const [rateRaw, setRateRaw] = useState(String(init?.hourly_rate ?? m0.hourlyRate));
  const [otRaw, setOtRaw] = useState(
    init ? (init.ot_rate === null ? "" : String(init.ot_rate)) : m0.otRate === null ? "" : String(m0.otRate),
  );
  const [otThresholdRaw, setOtThresholdRaw] = useState(String(init?.ot_threshold ?? m0.otThreshold));

  const [loads, setLoads] = useState<LoadRow[]>(() => {
    const saved = (sheet?.loads ?? []).map((l) => ({
      key: nextKey++,
      date: l.date,
      revenueRaw: l.revenue ? String(l.revenue) : "",
      load_number: l.load_number,
      company: l.company,
      extra: l.extra,
    }));
    const fill = Math.max(sheet ? 2 : EMPTY_LOAD_ROWS, EMPTY_LOAD_ROWS - saved.length);
    return [...saved, ...Array.from({ length: fill }, () => blankLoad())];
  });
  const [hours, setHours] = useState<HoursRow[]>(() =>
    init
      ? init.hours.map((h) => ({ day: h.day, hoursRaw: h.hours ? String(h.hours) : "", note: h.note ?? "" }))
      : templateHours(initialModel),
  );
  const [adjustments, setAdjustments] = useState<AdjRow[]>(() =>
    init
      ? init.adjustments.map((a) => ({
          key: nextKey++,
          label: a.label,
          amountRaw: a.amount ? String(a.amount) : "",
          deduction: a.deduction,
        }))
      : templateAdjustments(initialModel),
  );

  const model = PAY_MODELS[payModel];

  /** Switching model loads that model's template (rates, days, extras), keeping what was typed. */
  function applyModel(next: PayModel) {
    const m = PAY_MODELS[next];
    setPayModel(next);
    setPctRaw(String(m.revenuePct));
    setRateRaw(String(m.hourlyRate));
    setOtRaw(m.otRate === null ? "" : String(m.otRate));
    setOtThresholdRaw(String(m.otThreshold));
    setHours((h) => templateHours(next, h));
    setAdjustments((a) => templateAdjustments(next, a));
  }

  function onDriverChange(id: string) {
    setDriverId(id);
    const d = drivers.find((x) => x.id === id);
    if (!d) return;
    setTruck(d.truck_number ?? "");
    if (d.pay_model !== payModel) applyModel(d.pay_model);
  }

  // ---------------------------------------------------------------- parsing
  const parsed = useMemo(() => {
    const bad = new Set<string>();
    const n = (raw: string, key: string) => {
      const v = parseAmount(raw);
      if (v === null) bad.add(key);
      return v ?? 0;
    };
    const loadLines: LoadLine[] = loads.map((l) => ({
      date: l.date,
      revenue: n(l.revenueRaw, `load-${l.key}`),
      load_number: l.load_number,
      company: l.company,
      extra: l.extra,
    }));
    const hourLines: HoursLine[] = hours.map((h) => ({ day: h.day, hours: n(h.hoursRaw, `hours-${h.day}`), note: h.note }));
    const adjLines: Adjustment[] = adjustments.map((a) => ({
      label: a.label,
      amount: n(a.amountRaw, `adj-${a.key}`),
      deduction: a.deduction,
    }));
    const pct = n(pctRaw, "pct");
    const rate = n(rateRaw, "rate");
    const ot = otRaw.trim() === "" ? null : n(otRaw, "ot");
    const otThreshold = n(otThresholdRaw, "otThreshold");
    const filled = loadLines.filter(isFilledLoad);
    const totals = computeTotals({
      revenuePct: pct,
      hourlyRate: rate,
      otRate: ot,
      otThreshold,
      loads: filled,
      hours: hourLines,
      adjustments: adjLines,
    });
    return { bad, loadLines, hourLines, adjLines, pct, rate, ot, otThreshold, totals };
  }, [loads, hours, adjustments, pctRaw, rateRaw, otRaw, otThresholdRaw]);

  const t = parsed.totals;

  // ---------------------------------------------------------------- save
  function save(force = false) {
    setError(null);
    setDuplicate(null);
    if (parsed.bad.size > 0) {
      setError("Some amounts are not valid numbers (marked in red).");
      return;
    }
    const payload: SheetInput = {
      driverId,
      truckNumber: truck,
      payModel,
      payDate,
      notes,
      revenuePct: parsed.pct,
      hourlyRate: parsed.rate,
      otRate: parsed.ot,
      otThreshold: parsed.otThreshold,
      loads: parsed.loadLines,
      hours: parsed.hourLines,
      adjustments: parsed.adjLines,
    };
    startTransition(async () => {
      const res = await savePaySheet(sheet?.id ?? null, payload, sheet?.updated_at ?? null, force);
      if (res.ok) {
        router.push(`/payroll/${res.id}`);
        router.refresh();
      } else if ("duplicateOf" in res && res.duplicateOf) {
        setDuplicate(res.duplicateOf);
      } else {
        setError(res.message);
      }
    });
  }

  const updateLoad = (key: number, patch: Partial<LoadRow>) =>
    setLoads((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const updateAdj = (key: number, patch: Partial<AdjRow>) =>
    setAdjustments((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const red = (key: string) => (parsed.bad.has(key) ? " border-red-500 bg-red-50" : "");

  const missingDays = (Object.keys(DAY_LABELS) as Day[]).filter((d) => !hours.some((h) => h.day === d));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-4"
    >
      {/* Header: driver, truck, pay date */}
      <section className="rounded-2xl bg-white p-4 shadow">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium">
            Driver
            <select
              required
              value={driverId}
              onChange={(e) => onDriverChange(e.target.value)}
              className={`mt-1 ${input}`}
            >
              <option value="" disabled>
                Select…
              </option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Drives (pay model)
            <select value={payModel} onChange={(e) => applyModel(e.target.value as PayModel)} className={`mt-1 ${input}`}>
              {PAY_MODEL_KEYS.map((k) => (
                <option key={k} value={k}>
                  {PAY_MODELS[k].label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Truck #
            <input value={truck} onChange={(e) => setTruck(e.target.value)} maxLength={40} className={`mt-1 ${input}`} />
          </label>
          <label className="text-sm font-medium">
            Pay date
            <input
              type="date"
              required
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              className={`mt-1 ${input}`}
            />
          </label>
        </div>
        <label className="mt-3 block text-sm font-medium">
          Notes
          <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className={`mt-1 ${input}`} />
        </label>
        <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
          <label className="font-medium">
            Driver pay %
            <input value={pctRaw} onChange={(e) => setPctRaw(e.target.value)} inputMode="decimal" className={`mt-1 w-20 ${cell}${red("pct")}`} />
          </label>
          <label className="font-medium">
            $ / hour
            <input value={rateRaw} onChange={(e) => setRateRaw(e.target.value)} inputMode="decimal" className={`mt-1 w-20 ${cell}${red("rate")}`} />
          </label>
          <label className="font-medium">
            OT $ / hour <span className="font-normal text-zinc-400">(blank = no OT)</span>
            <input value={otRaw} onChange={(e) => setOtRaw(e.target.value)} inputMode="decimal" className={`mt-1 w-20 ${cell}${red("ot")}`} />
          </label>
          {otRaw.trim() !== "" && (
            <label className="font-medium">
              OT after (hours)
              <input
                value={otThresholdRaw}
                onChange={(e) => setOtThresholdRaw(e.target.value)}
                inputMode="decimal"
                className={`mt-1 w-20 ${cell}${red("otThreshold")}`}
              />
            </label>
          )}
          <p className="text-xs text-zinc-500">
            Defaults for {model.label}: {model.revenuePct}% · ${model.hourlyRate}/h
            {model.otRate !== null && ` · OT $${model.otRate}/h after ${model.otThreshold} h`}
          </p>
        </div>
      </section>

      {/* Loads */}
      <section className="rounded-2xl bg-white p-4 shadow">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Loads</h2>
          <p className="text-xs text-zinc-500">Revenue accepts a formula like 25.93*9.5 · empty rows are ignored</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-zinc-500 uppercase">
              <tr>
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">Date</th>
                <th className="py-1 pr-2">Revenue</th>
                <th className="py-1 pr-2 text-right">Pay @ {num(parsed.pct)}%</th>
                <th className="py-1 pr-2">Ticket #</th>
                <th className="py-1 pr-2">Company</th>
                <th className="py-1 pr-2">{model.extraLabel}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loads.map((l, i) => {
                const rev = parsed.loadLines[i]?.revenue ?? 0;
                const isExpr = /[*+]/.test(l.revenueRaw);
                return (
                  <tr key={l.key}>
                    <td className="py-0.5 pr-2 text-xs text-zinc-400">{i + 1}</td>
                    <td className="py-0.5 pr-2">
                      <input type="date" value={l.date} onChange={(e) => updateLoad(l.key, { date: e.target.value })} className={`${cell} w-36`} />
                    </td>
                    <td className="py-0.5 pr-2">
                      <input
                        value={l.revenueRaw}
                        onChange={(e) => updateLoad(l.key, { revenueRaw: e.target.value })}
                        inputMode="decimal"
                        placeholder="0.00"
                        className={`${cell} w-28${red(`load-${l.key}`)}`}
                      />
                      {isExpr && !parsed.bad.has(`load-${l.key}`) && (
                        <span className="ml-1 text-xs text-zinc-500">= {money(rev)}</span>
                      )}
                    </td>
                    <td className="py-0.5 pr-2 text-right tabular-nums text-zinc-600">
                      {rev ? money((rev * parsed.pct) / 100) : ""}
                    </td>
                    <td className="py-0.5 pr-2">
                      <input value={l.load_number} onChange={(e) => updateLoad(l.key, { load_number: e.target.value })} maxLength={40} className={`${cell} w-28`} />
                    </td>
                    <td className="py-0.5 pr-2">
                      <input value={l.company} onChange={(e) => updateLoad(l.key, { company: e.target.value })} maxLength={120} className={`${cell} w-full min-w-40`} />
                    </td>
                    <td className="py-0.5 pr-2">
                      <input value={l.extra} onChange={(e) => updateLoad(l.key, { extra: e.target.value })} maxLength={40} className={`${cell} w-20`} />
                    </td>
                    <td className="py-0.5">
                      <button
                        type="button"
                        onClick={() => setLoads((rows) => rows.filter((r) => r.key !== l.key))}
                        aria-label={`Remove load ${i + 1}`}
                        className="px-1 text-zinc-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t font-semibold">
              <tr>
                <td className="py-1.5 pr-2 text-xs uppercase" colSpan={2}>
                  Totals ({t.loadsCount} loads)
                </td>
                <td className="py-1.5 pr-2 tabular-nums">{money(t.totalRevenue)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{money(t.loadsPay)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
        <button
          type="button"
          onClick={() => setLoads((rows) => [...rows, blankLoad([...rows].reverse().find((r) => r.date)?.date ?? "")])}
          className="mt-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-zinc-100"
        >
          + Add load
        </button>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Hours */}
        <section className="rounded-2xl bg-white p-4 shadow">
          <h2 className="mb-2 text-sm font-semibold">Driver hours @ {money(parsed.rate)}/hr</h2>
          <table className="w-full text-sm">
            <tbody>
              {hours.map((h, i) => (
                <tr key={h.day}>
                  <td className="w-28 py-0.5 pr-2 text-xs font-medium uppercase">{DAY_LABELS[h.day]}</td>
                  <td className="w-24 py-0.5 pr-2">
                    <input
                      value={h.hoursRaw}
                      onChange={(e) => setHours((rows) => rows.map((r, j) => (j === i ? { ...r, hoursRaw: e.target.value } : r)))}
                      inputMode="decimal"
                      placeholder="0"
                      className={`${cell} w-20${red(`hours-${h.day}`)}`}
                    />
                  </td>
                  <td className="py-0.5">
                    <input
                      value={h.note}
                      onChange={(e) => setHours((rows) => rows.map((r, j) => (j === i ? { ...r, note: e.target.value } : r)))}
                      placeholder="note (optional)"
                      maxLength={120}
                      className={`${cell} w-full`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t font-semibold">
              <tr>
                <td className="py-1.5 text-xs uppercase">Total hours</td>
                <td className="py-1.5 tabular-nums">{num(t.totalHours)}</td>
                <td className="py-1.5 text-xs font-normal text-zinc-500">
                  {parsed.ot !== null && t.otHours > 0 && `${num(t.regularHours)} regular + ${num(t.otHours)} OT`}
                </td>
              </tr>
            </tfoot>
          </table>
          {missingDays.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                const day = e.target.value as Day;
                const order = Object.keys(DAY_LABELS) as Day[];
                setHours((rows) =>
                  [...rows, { day, hoursRaw: "", note: "" }].sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day)),
                );
              }}
              className="mt-2 rounded-lg border px-2 py-1.5 text-sm"
            >
              <option value="">+ Add day…</option>
              {missingDays.map((d) => (
                <option key={d} value={d}>
                  {DAY_LABELS[d]}
                </option>
              ))}
            </select>
          )}
        </section>

        {/* Extras + summary */}
        <section className="rounded-2xl bg-white p-4 shadow">
          <h2 className="mb-2 text-sm font-semibold">Pay summary</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>Driver pay for loads</dt>
              <dd className="tabular-nums">{money(t.loadsPay)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Driver pay for hours{parsed.ot !== null && ` (${num(t.regularHours)} h)`}</dt>
              <dd className="tabular-nums">{money(t.regularPay)}</dd>
            </div>
            {parsed.ot !== null && (
              <div className="flex justify-between">
                <dt>
                  Driver pay for OT hours ({num(t.otHours)} h @ {money(parsed.ot)})
                </dt>
                <dd className="tabular-nums">{money(t.otPay)}</dd>
              </div>
            )}
          </dl>
          <div className="mt-2 space-y-1">
            {adjustments.map((a) => (
              <div key={a.key} className="flex items-center gap-2">
                <input
                  value={a.label}
                  onChange={(e) => updateAdj(a.key, { label: e.target.value })}
                  maxLength={80}
                  className={`${cell} min-w-0 flex-1 text-xs uppercase`}
                />
                <label className="flex items-center gap-1 text-xs text-zinc-500" title="Subtract from total">
                  <input
                    type="checkbox"
                    checked={a.deduction}
                    onChange={(e) => updateAdj(a.key, { deduction: e.target.checked })}
                    className="h-3.5 w-3.5"
                  />
                  −
                </label>
                <input
                  value={a.amountRaw}
                  onChange={(e) => updateAdj(a.key, { amountRaw: e.target.value })}
                  inputMode="decimal"
                  placeholder="0.00"
                  className={`${cell} w-24 text-right${red(`adj-${a.key}`)}`}
                />
                <button
                  type="button"
                  onClick={() => setAdjustments((rows) => rows.filter((r) => r.key !== a.key))}
                  aria-label={`Remove ${a.label}`}
                  className="px-1 text-zinc-400 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setAdjustments((rows) => [...rows, { key: nextKey++, label: "", amountRaw: "", deduction: false }])}
              className="mt-1 rounded-lg border px-3 py-1 text-xs hover:bg-zinc-100"
            >
              + Add line
            </button>
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t pt-3">
            <span className="text-sm font-semibold uppercase">Total pay</span>
            <span className="text-2xl font-bold tabular-nums">{money(t.totalPay)}</span>
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow">
        <button disabled={pending} className="rounded-lg bg-zinc-900 px-6 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? "Saving…" : sheet ? "Save changes" : "Save pay sheet"}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-lg border px-4 py-2 text-sm hover:bg-zinc-100">
          Cancel
        </button>
        <span className="ml-auto text-sm">
          Total pay <strong className="tabular-nums">{money(t.totalPay)}</strong>
        </span>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
        {duplicate && (
          <p className="w-full text-sm text-amber-700">
            This driver already has a pay sheet for this pay date (
            <a href={`/payroll/${duplicate.id}`} target="_blank" className="underline">
              #{duplicate.number}
            </a>
            ).{" "}
            <button type="button" onClick={() => save(true)} className="font-semibold underline">
              Save anyway
            </button>
          </p>
        )}
      </div>
    </form>
  );
}
