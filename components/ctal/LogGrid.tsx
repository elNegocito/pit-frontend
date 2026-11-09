"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { quickCreateCustomer, saveLoads } from "@/lib/ctal/actions";
import { billingTotal, byCarrier, computeLoad, defaultRules, money, qty, statementTotal, sumLoads } from "@/lib/ctal/compute";
import { UNITS, type Carrier, type CtalCustomer, type FscMode, type Load, type LoadFields, type Unit, type Week } from "@/lib/ctal/types";
import { btn, btnPrimary } from "@/lib/ctal/ui";
import { Combobox, fold, type ComboOption } from "./Combobox";

export interface TruckDriver {
  truck: string;
  driver: string;
}

const TICKET_COL = 5;
const cell =
  "w-full min-w-0 bg-transparent px-1.5 py-1.5 text-[13px] outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-pine-500 placeholder:text-zinc-300";
const bad = "bg-red-50 ring-1 ring-inset ring-red-300";
const tdc = "border-b border-r border-rule p-0 align-middle";
const amount = "border-b border-r border-rule bg-pine-50/60 px-1.5 py-1.5 text-right text-[13px] tabular-nums whitespace-nowrap";

const complete = (r: LoadFields) => Boolean(r.load_date && r.carrier_id && r.customer_id);
const blank = (r: LoadFields) => !r.carrier_name && !r.customer_name && !r.ticket && !r.truck && !r.driver && !r.quantity;

function newRow(position: number, from?: LoadFields, date = ""): LoadFields {
  return {
    id: crypto.randomUUID(),
    position,
    load_date: from?.load_date ?? date,
    carrier_id: from?.carrier_id ?? null,
    carrier_name: from?.carrier_name ?? "",
    customer_id: from?.customer_id ?? null,
    customer_name: from?.customer_name ?? "",
    bill_to: from?.bill_to ?? "asg",
    truck: from?.truck ?? "",
    driver: from?.driver ?? "",
    ticket: "",
    quantity: from && from.unit !== "TON" && from.unit !== "HR" ? from.quantity : 0,
    unit: from?.unit ?? "TON",
    broker_rate: from?.broker_rate ?? 0,
    carrier_rate: from?.carrier_rate ?? 0,
    fee_kind: from?.fee_kind ?? "quick_pay",
    fee_pct: from?.fee_pct ?? 3.5,
    fsc_mode: from?.fsc_mode ?? "none",
    fsc_value: from?.fsc_value ?? 0,
  };
}

/** Number field that keeps what is being typed ("12." or "") instead of reformatting it. */
function NumCell({ value, onValue, row, col, label, invalid }: { value: number; onValue: (n: number) => void; row: number; col: number; label: string; invalid?: boolean }) {
  const show = (n: number) => (n ? String(n) : "");
  const [text, setText] = useState(show(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if ((parseFloat(text) || 0) !== value) setText(show(value));
  }
  return (
    <input
      type="number"
      inputMode="decimal"
      min="0"
      step="any"
      value={text}
      aria-label={label}
      data-row={row}
      data-col={col}
      placeholder="0"
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        onValue(Number.isFinite(n) && n >= 0 ? n : 0);
      }}
      className={`${cell} text-right tabular-nums ${invalid ? bad : ""}`}
    />
  );
}

interface RowProps {
  row: LoadFields;
  index: number;
  carrierOptions: ComboOption[];
  customerOptions: ComboOption[];
  known: TruckDriver[] | undefined;
  duplicate: boolean;
  onPatch: (id: string, patch: Partial<LoadFields>) => void;
  onCarrier: (id: string, text: string, carrierId: string | null) => void;
  onCustomer: (id: string, text: string, customerId: string | null) => void;
  onCreateCustomer: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

const GridRow = memo(function GridRow({ row, index, carrierOptions, customerOptions, known, duplicate, onPatch, onCarrier, onCustomer, onCreateCustomer, onDuplicate, onDelete }: RowProps) {
  const a = computeLoad(row);
  const started = !blank(row);
  const perUnit = row.unit === "TON" || row.unit === "HR";

  const truckOptions = useMemo(() => [...new Set((known ?? []).map((k) => k.truck).filter(Boolean))].map((t) => ({ value: t, label: t })), [known]);
  const driverOptions = useMemo(() => {
    // Drivers seen on this truck first.
    const list = [...(known ?? [])].sort((x, y) => Number(y.truck === row.truck) - Number(x.truck === row.truck));
    return [...new Set(list.map((k) => k.driver).filter(Boolean))].map((d) => ({ value: d, label: d }));
  }, [known, row.truck]);

  return (
    <tr className="group hover:bg-pine-50/40">
      <td className="border-b border-r border-rule px-2 text-right text-xs text-zinc-400 tabular-nums select-none">{index + 1}</td>
      <td className={tdc}>
        <input
          type="date"
          value={row.load_date}
          aria-label="Date"
          data-row={index}
          data-col={0}
          onChange={(e) => onPatch(row.id, { load_date: e.target.value })}
          className={`${cell} ${started && !row.load_date ? bad : ""}`}
        />
      </td>
      <td className={tdc}>
        <Combobox
          value={row.carrier_name}
          options={carrierOptions}
          onChange={(text, o) => onCarrier(row.id, text, o?.value ?? null)}
          ariaLabel="Company"
          title={row.carrier_name}
          placeholder="Carrier name or #"
          dataCell={{ row: index, col: 1 }}
          invalid={started && !row.carrier_id}
          emptyText="No carrier matches. Add it under Carriers."
          className={`${cell} ${started && !row.carrier_id ? bad : ""}`}
        />
      </td>
      <td className={tdc}>
        <Combobox value={row.truck} options={truckOptions} onChange={(text) => onPatch(row.id, { truck: text })} ariaLabel="Truck #" dataCell={{ row: index, col: 2 }} emptyText="New truck" className={cell} />
      </td>
      <td className={tdc}>
        <Combobox value={row.driver} options={driverOptions} onChange={(text) => onPatch(row.id, { driver: text.toUpperCase() })} ariaLabel="Driver" dataCell={{ row: index, col: 3 }} emptyText="New driver" className={cell} />
      </td>
      <td className={tdc}>
        <Combobox
          value={row.customer_name}
          options={customerOptions}
          onChange={(text, o) => onCustomer(row.id, text, o?.value ?? null)}
          onCreate={(name) => onCreateCustomer(row.id, name)}
          ariaLabel="Customer"
          title={row.customer_name}
          placeholder="Customer"
          dataCell={{ row: index, col: 4 }}
          invalid={started && !row.customer_id}
          className={`${cell} ${started && !row.customer_id ? bad : ""}`}
        />
      </td>
      <td className={tdc}>
        <input
          value={row.ticket}
          aria-label="Ticket"
          data-row={index}
          data-col={TICKET_COL}
          maxLength={40}
          title={duplicate ? "This ticket is on another row of this week" : undefined}
          onChange={(e) => onPatch(row.id, { ticket: e.target.value })}
          className={`${cell} tabular-nums ${duplicate ? "bg-amber-100 ring-1 ring-inset ring-amber-400" : ""}`}
        />
      </td>
      <td className={tdc}>
        <NumCell value={row.quantity} onValue={(n) => onPatch(row.id, { quantity: n })} row={index} col={6} label="Quantity" />
      </td>
      <td className={tdc}>
        <select value={row.unit} aria-label="Unit" data-row={index} data-col={7} onChange={(e) => onPatch(row.id, { unit: e.target.value as Unit })} className={`${cell} cursor-pointer`}>
          {UNITS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </td>
      <td className={tdc}>
        <NumCell value={row.broker_rate} onValue={(n) => onPatch(row.id, { broker_rate: n })} row={index} col={8} label="Broker rate" />
      </td>
      <td className={tdc}>
        <NumCell value={row.carrier_rate} onValue={(n) => onPatch(row.id, { carrier_rate: n })} row={index} col={9} label="Carrier rate" />
      </td>
      <td className={amount} title={perUnit ? `${qty(row.quantity)} × ${row.carrier_rate}` : `Per ${row.unit.toLowerCase()}: rate × 1`}>
        {money(a.carrier_amount)}
      </td>
      <td className={amount}>{money(a.broker_amount)}</td>
      <td className={tdc}>
        <div className="flex items-center">
          <button
            type="button"
            tabIndex={-1}
            title={row.fee_kind === "broker_fee" ? "Broker fee. Click to switch to quick pay." : "Quick pay fee. Click to switch to broker fee."}
            onClick={() => onPatch(row.id, { fee_kind: row.fee_kind === "broker_fee" ? "quick_pay" : "broker_fee" })}
            className={`ml-1 shrink-0 rounded px-1 py-0.5 text-[11px] font-semibold ${row.fee_kind === "broker_fee" ? "bg-pine-900 text-white" : "bg-zinc-100 text-zinc-600"}`}
          >
            {row.fee_kind === "broker_fee" ? "BF" : "QP"}
          </button>
          <NumCell value={row.fee_pct} onValue={(n) => onPatch(row.id, { fee_pct: n })} row={index} col={10} label="Fee %" />
        </div>
      </td>
      <td className={amount}>{money(a.broker_fee + a.quick_pay_fee)}</td>
      <td className={tdc}>
        <div className="flex items-center">
          <select
            value={row.fsc_mode}
            aria-label="FSC type"
            data-row={index}
            data-col={11}
            onChange={(e) => onPatch(row.id, { fsc_mode: e.target.value as FscMode, ...(e.target.value === "none" ? { fsc_value: 0 } : {}) })}
            className={`${cell} w-14 shrink-0 cursor-pointer px-1`}
          >
            <option value="none">N/A</option>
            <option value="percent">%</option>
            <option value="fixed">$</option>
          </select>
          {row.fsc_mode !== "none" && <NumCell value={row.fsc_value} onValue={(n) => onPatch(row.id, { fsc_value: n })} row={index} col={12} label="FSC value" />}
        </div>
      </td>
      <td className={amount}>{money(a.fsc_amount)}</td>
      <td className="border-b border-rule px-1 whitespace-nowrap">
        <button type="button" tabIndex={-1} onClick={() => onDuplicate(row.id)} title="Duplicate row" aria-label={`Duplicate row ${index + 1}`} className="rounded px-1.5 py-1 text-zinc-500 hover:bg-pine-100 hover:text-pine-900">
          ⧉
        </button>
        <button type="button" tabIndex={-1} onClick={() => onDelete(row.id)} title="Delete row" aria-label={`Delete row ${index + 1}`} className="rounded px-1.5 py-1 text-zinc-500 hover:bg-red-50 hover:text-red-700">
          ✕
        </button>
      </td>
    </tr>
  );
});

type Status = "saved" | "pending" | "saving" | "waiting" | "error";

export function LogGrid({
  week,
  initialLoads,
  carriers,
  customers: initialCustomers,
  history,
  expired,
  focusTicket,
}: {
  week: Week;
  initialLoads: Load[];
  carriers: Carrier[];
  customers: CtalCustomer[];
  /** Truck / driver pairs each carrier used before, most recent first. */
  history: Record<string, TruckDriver[]>;
  /** Carrier ids whose insurance is expired. */
  expired: string[];
  /** Ticket to scroll to (from the search). */
  focusTicket?: string;
}) {
  const [rows, setRows] = useState<LoadFields[]>(() => (initialLoads.length > 0 ? initialLoads : [newRow(0, undefined, week.week_start)]));
  const [customers, setCustomers] = useState(initialCustomers);
  const [status, setStatus] = useState<Status>("saved");
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [find, setFind] = useState("");
  const [undo, setUndo] = useState<{ row: LoadFields; at: number } | null>(null);

  const rowsRef = useRef(rows);
  const versions = useRef(new Map<string, number>());
  const deleted = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const again = useRef(false);
  const pendingFocus = useRef<{ row: number; col: number } | null>(null);
  const table = useRef<HTMLTableElement>(null);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const carrierById = useMemo(() => new Map(carriers.map((c) => [c.id, c])), [carriers]);
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const customersRef = useRef(customerById);
  useEffect(() => {
    customersRef.current = customerById;
  }, [customerById]);

  const carrierOptions = useMemo<ComboOption[]>(() => {
    const out = new Set(expired);
    return carriers
      .filter((c) => c.active)
      .map((c) => ({
        value: c.id,
        label: c.name,
        hint: out.has(c.id) ? "Insurance expired" : [`#${c.carrier_number}`, c.pay_term === "28" ? "28 days" : "QP", c.hub_city].filter(Boolean).join("  "),
        warn: out.has(c.id),
        search: `${c.carrier_number} ${c.usdot ?? ""} ${c.owner ?? ""}`,
      }));
  }, [carriers, expired]);
  const customerOptions = useMemo<ComboOption[]>(
    () => customers.filter((c) => c.active).map((c) => ({ value: c.id, label: c.name, hint: `${c.default_unit}  $${c.carrier_rate}` })),
    [customers],
  );

  // ------------------------------------------------------------ saving
  const flush = useCallback(async () => {
    if (saving.current) {
      again.current = true;
      return;
    }
    saving.current = true;
    // Loops while rows keep changing during a save.
    do {
      again.current = false;
      const snapshot = new Map(versions.current);
      const toSave = rowsRef.current.filter((r) => snapshot.has(r.id) && complete(r));
      const toDelete = [...deleted.current];
      if (toSave.length === 0 && toDelete.length === 0) break;
      setStatus("saving");
      const res = await saveLoads(week.id, toSave, toDelete).catch(() => ({ ok: false as const, message: "No connection. Your changes are still on this screen." }));
      if (!res.ok) {
        saving.current = false;
        setError(res.message);
        setStatus("error");
        return;
      }
      setError(null);
      // Rows edited again while saving stay marked as changed.
      for (const r of toSave) if (versions.current.get(r.id) === snapshot.get(r.id)) versions.current.delete(r.id);
      for (const id of toDelete) deleted.current.delete(id);
    } while (again.current);
    saving.current = false;
    // What is left are rows still missing a date, carrier or customer.
    setStatus(versions.current.size > 0 ? "waiting" : "saved");
  }, [week.id]);

  const touch = useCallback(
    (ids: string[]) => {
      for (const id of ids) versions.current.set(id, (versions.current.get(id) ?? 0) + 1);
      setStatus((s) => (s === "saving" ? s : "pending"));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 900);
    },
    [flush],
  );

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (versions.current.size > 0 || deleted.current.size > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      // Leaving the page through the app: save what is pending right away.
      if (timer.current) clearTimeout(timer.current);
      void flush();
    };
  }, [flush]);

  // ------------------------------------------------------------ editing
  const onPatch = useCallback(
    (id: string, patch: Partial<LoadFields>) => {
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      touch([id]);
    },
    [touch],
  );

  const onCarrier = useCallback(
    (id: string, text: string, carrierId: string | null) => {
      setRows((rs) =>
        rs.map((r) => {
          if (r.id !== id) return r;
          if (!carrierId) return { ...r, carrier_name: text, carrier_id: null };
          const carrier = carrierById.get(carrierId)!;
          const known = history[carrierId] ?? [];
          // A carrier with a single known truck: fill it in.
          const only = known.length === 1 ? known[0] : null;
          const changed = r.carrier_id !== carrierId;
          return {
            ...r,
            carrier_id: carrierId,
            carrier_name: carrier.name,
            // Truck and driver belong to the carrier: a new carrier starts clean.
            ...(changed ? { truck: only?.truck ?? "", driver: only?.driver ?? "" } : {}),
            ...(r.customer_id ? defaultRules(customersRef.current.get(r.customer_id) ?? null, carrier) : {}),
          };
        }),
      );
      touch([id]);
    },
    [carrierById, history, touch],
  );

  const applyCustomer = useCallback(
    (id: string, customer: CtalCustomer) => {
      setRows((rs) =>
        rs.map((r) => {
          if (r.id !== id) return r;
          // Rates: what this carrier was last paid for this customer this week, else the customer's own.
          const same = rs.filter((o) => o.id !== id && o.customer_id === customer.id && (o.broker_rate || o.carrier_rate));
          const last = same.findLast((o) => o.carrier_id === r.carrier_id) ?? same.at(-1);
          return {
            ...r,
            customer_id: customer.id,
            customer_name: customer.name,
            bill_to: customer.bill_to,
            unit: last?.unit ?? customer.default_unit,
            broker_rate: last?.broker_rate ?? customer.broker_rate,
            carrier_rate: last?.carrier_rate ?? customer.carrier_rate,
            ...defaultRules(customer, r.carrier_id ? (carrierById.get(r.carrier_id) ?? null) : null),
            ...(last && last.fsc_mode === customer.fsc_mode ? { fsc_value: last.fsc_value } : {}),
          };
        }),
      );
      touch([id]);
    },
    [carrierById, touch],
  );

  const onCustomer = useCallback(
    (id: string, text: string, customerId: string | null) => {
      const customer = customerId ? customersRef.current.get(customerId) : null;
      if (customer) return applyCustomer(id, customer);
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, customer_name: text, customer_id: null } : r)));
      touch([id]);
    },
    [applyCustomer, touch],
  );

  const onCreateCustomer = useCallback(
    async (id: string, name: string) => {
      const res = await quickCreateCustomer(name);
      if (!res.ok) return setError(res.message);
      setCustomers((cs) => (cs.some((c) => c.id === res.customer.id) ? cs : [...cs, res.customer].sort((a, b) => a.name.localeCompare(b.name))));
      customersRef.current = new Map(customersRef.current).set(res.customer.id, res.customer);
      applyCustomer(id, res.customer);
    },
    [applyCustomer],
  );

  /** Inserts `row` after `afterId` (or at the end) and renumbers what moved. */
  const insert = useCallback(
    (row: LoadFields, afterId?: string) => {
      const rs = rowsRef.current;
      const at = afterId ? rs.findIndex((r) => r.id === afterId) + 1 : rs.length;
      const next = [...rs.slice(0, at), row, ...rs.slice(at)].map((r, i) => (r.position === i ? r : { ...r, position: i }));
      const moved = next.filter((r, i) => r.id === row.id || rs[i]?.id !== r.id || rs[i]?.position !== r.position).map((r) => r.id);
      rowsRef.current = next;
      setRows(next);
      touch(moved);
    },
    [touch],
  );

  const onDuplicate = useCallback(
    (id: string) => {
      const src = rowsRef.current.find((r) => r.id === id);
      if (src) insert({ ...newRow(0, src), quantity: src.quantity }, id);
    },
    [insert],
  );

  const onDelete = useCallback(
    (id: string) => {
      const at = rowsRef.current.findIndex((r) => r.id === id);
      if (at < 0) return;
      const row = rowsRef.current[at];
      setRows((rs) => rs.filter((r) => r.id !== id));
      versions.current.delete(id);
      deleted.current.add(id);
      touch([]);
      if (!blank(row)) setUndo({ row, at });
    },
    [touch],
  );

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 7000);
    return () => clearTimeout(t);
  }, [undo]);

  function restore() {
    if (!undo) return;
    deleted.current.delete(undo.row.id);
    insert(undo.row, rowsRef.current[undo.at - 1]?.id);
    setUndo(null);
  }

  // ------------------------------------------------------------ view
  const needle = fold(find.trim());
  const visible = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!filter || r.carrier_id === filter) &&
          (!needle || fold(`${r.ticket} ${r.truck} ${r.driver} ${r.customer_name} ${r.carrier_name}`).includes(needle)),
      ),
    [rows, filter, needle],
  );
  const computed = useMemo(() => rows.filter(complete).map((r) => ({ ...r, ...computeLoad(r) })), [rows]);
  const groups = useMemo(() => byCarrier(computed), [computed]);
  const totals = useMemo(() => sumLoads(filter || needle ? visible.filter(complete).map((r) => ({ ...r, ...computeLoad(r) })) : computed), [computed, visible, filter, needle]);
  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) if (r.ticket.trim()) seen.set(`${r.customer_id}|${r.ticket.trim()}`, (seen.get(`${r.customer_id}|${r.ticket.trim()}`) ?? 0) + 1);
    return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
  }, [rows]);
  const unsaved = rows.filter((r) => !blank(r) && !complete(r)).length;

  const focusCell = (row: number, col: number) => {
    const el = table.current?.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`);
    el?.focus();
    return Boolean(el);
  };
  useEffect(() => {
    if (!pendingFocus.current) return;
    const { row, col } = pendingFocus.current;
    pendingFocus.current = null;
    focusCell(row, col);
  });

  useEffect(() => {
    if (!focusTicket) return;
    const at = rowsRef.current.findIndex((r) => r.ticket === focusTicket);
    if (at >= 0) focusCell(at, TICKET_COL);
  }, [focusTicket]);

  function addRow() {
    const last = visible.at(-1);
    insert(newRow(0, last, week.week_start), last?.id);
    pendingFocus.current = { row: visible.length, col: last?.carrier_id && last.customer_id ? TICKET_COL : last ? 1 : 0 };
  }

  // Enter moves down the column like a spreadsheet; on the last row it starts the next load.
  function onKeyDown(e: React.KeyboardEvent<HTMLTableSectionElement>) {
    if (e.key !== "Enter") return;
    const el = e.target as HTMLElement;
    if (el.dataset.row === undefined) return;
    e.preventDefault();
    const row = Number(el.dataset.row);
    const col = Number(el.dataset.col);
    if (e.shiftKey) return void focusCell(row - 1, col);
    if (!focusCell(row + 1, col) && !blank(visible[row])) addRow();
  }

  const statusText = { saved: "All changes saved", pending: "Saving…", saving: "Saving…", waiting: "Waiting for missing fields", error: "Not saved" }[status];
  const head = "sticky top-0 z-10 border-b border-r border-pine-950 bg-pine-900 px-2 py-2 text-left text-xs font-medium whitespace-nowrap text-white";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-64">
          <Combobox
            value={filter ? (carrierById.get(filter)?.name ?? "") : find}
            options={groups.map((g) => ({ value: g.carrierId, label: g.name, hint: `${g.totals.loads} loads` }))}
            onChange={(text, o) => {
              setFilter(o?.value ?? null);
              setFind(o ? "" : text);
            }}
            ariaLabel="Find in this week"
            placeholder="Find a carrier, ticket, driver…"
            emptyText="Showing rows that contain this text"
            className="w-full rounded-md border border-rule bg-white px-3 py-1.5 text-sm outline-none focus:border-pine-500 focus:ring-2 focus:ring-pine-200"
          />
        </div>
        {(filter || find) && (
          <button type="button" onClick={() => { setFilter(null); setFind(""); }} className={btn}>
            Show all rows
          </button>
        )}
        <p role="status" aria-live="polite" className={`ml-auto flex items-center gap-2 text-sm ${status === "error" ? "font-medium text-red-700" : "text-zinc-600"}`}>
          <span aria-hidden className={`h-2 w-2 rounded-full ${status === "saved" ? "bg-pine-500" : status === "error" ? "bg-red-600" : "bg-amber-500"}`} />
          {statusText}
          {status === "error" && (
            <button type="button" onClick={() => void flush()} className="underline">
              Try again
            </button>
          )}
        </p>
        <button type="button" onClick={addRow} className={btnPrimary}>
          Add row
        </button>
      </div>

      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {unsaved > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {unsaved === 1 ? "1 row is" : `${unsaved} rows are`} not saved yet: each row needs a date, a carrier and a customer picked from the list.
        </p>
      )}

      {groups.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Carriers in this week">
          {groups.map((g) => (
            <button
              key={g.carrierId}
              type="button"
              aria-pressed={filter === g.carrierId}
              onClick={() => { setFilter(filter === g.carrierId ? null : g.carrierId); setFind(""); }}
              className={`shrink-0 rounded-md border px-2.5 py-1 text-left text-xs ${filter === g.carrierId ? "border-pine-900 bg-pine-900 text-white" : "border-rule bg-white hover:bg-pine-50"}`}
            >
              <span className="block font-medium">{g.name}</span>
              <span className={`tabular-nums ${filter === g.carrierId ? "text-pine-200" : "text-zinc-500"}`}>
                {g.totals.loads} loads, {money(statementTotal(g.totals))}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-rule bg-white">
        <table ref={table} className="w-full min-w-[1570px] table-fixed border-collapse">
          <colgroup>
            {[32, 116, 196, 64, 108, 176, 94, 58, 72, 66, 66, 88, 88, 76, 76, 98, 74, 56].map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {["", "Date", "Company", "Truck #", "Driver", "Customer", "Ticket", "Qty", "Unit", "Broker rate", "Carrier rate", "Carrier amt", "Broker amt", "Fee %", "Fee $", "FSC", "FSC $", ""].map((h, i) => (
                <th key={i} scope="col" className={`${head} ${i >= 7 && i !== 8 && i !== 15 ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody onKeyDown={onKeyDown}>
            {visible.map((r, i) => (
              <GridRow
                key={r.id}
                row={r}
                index={i}
                carrierOptions={carrierOptions}
                customerOptions={customerOptions}
                known={r.carrier_id ? history[r.carrier_id] : undefined}
                duplicate={duplicates.has(`${r.customer_id}|${r.ticket.trim()}`)}
                onPatch={onPatch}
                onCarrier={onCarrier}
                onCustomer={onCustomer}
                onCreateCustomer={onCreateCustomer}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
              />
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={18} className="px-4 py-10 text-center text-sm text-zinc-500">
                  {rows.length === 0 ? "This week has no loads yet. Add the first row to start." : "No rows match. Clear the search to see the whole week."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Enter moves down the column and starts the next load on the last row (same date, carrier, truck, driver and customer). Tab accepts a suggestion.
      </p>

      <div className="sticky bottom-0 z-20 -mx-4 border-t border-pine-950 bg-pine-900 px-4 py-2.5 text-white print:hidden">
        <dl className="mx-auto flex max-w-[1760px] flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
          <div className="mr-auto">
            <dt className="sr-only">Showing</dt>
            <dd className="font-medium">{filter ? carrierById.get(filter)?.name : needle ? "Matching rows" : "Whole week"}</dd>
          </div>
          {(
            [
              ["Loads", String(totals.loads)],
              ["Qty", qty(totals.quantity)],
              ["Carrier amount", money(totals.carrier_amount)],
              ["Fees", money(totals.broker_fee + totals.quick_pay_fee)],
              ["FSC", money(totals.fsc_amount)],
              ["Pay to carriers", money(statementTotal(totals))],
              ["Billing", money(billingTotal(totals))],
            ] as const
          ).map(([k, v], i) => (
            <div key={k} className={`items-baseline gap-1.5 ${i >= 5 ? "flex" : "hidden md:flex"}`}>
              <dt className="text-xs text-pine-200">{k}</dt>
              <dd className={`tabular-nums ${i >= 5 ? "text-base font-semibold" : ""}`}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {undo && (
        <div role="status" className="fixed bottom-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-lg">
          Row deleted{undo.row.ticket ? ` (ticket ${undo.row.ticket})` : ""}
          <button type="button" onClick={restore} className="font-semibold text-amber-300 underline">
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
