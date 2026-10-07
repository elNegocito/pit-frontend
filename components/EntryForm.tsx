"use client";

import { useMemo, useRef, useState } from "react";
import { createOrder, updateOrder } from "@/lib/orders/actions";
import { formatPitDate } from "@/lib/timezone";
import type { CodMethod, Material, Payment, TicketPrintData } from "@/lib/types";
import { CustomerCombobox } from "./CustomerCombobox";

export interface EntryValues {
  materialId: string;
  truck: string;
  tons: string;
  customer: string;
  payment: Payment;
  codMethod: CodMethod;
  poNumber: string;
  jobNumber: string;
}

export function emptyValues(materials: Material[]): EntryValues {
  return {
    materialId: materials[0]?.id ?? "",
    truck: "",
    tons: "",
    customer: "",
    payment: "COD",
    codMethod: "CASH",
    poNumber: "",
    jobNumber: "",
  };
}

export function parseTons(tons: string): number | null {
  const n = Number(tons);
  return tons.trim() === "" || !Number.isFinite(n) ? null : n;
}

interface Props {
  materials: Material[];
  truckNumbers: string[];
  today: string;
  values: EntryValues;
  onChange: (v: EntryValues) => void;
  /** Tare (empty weight) of the typed truck when it is registered (for hints). */
  truckTare: number | null;
  /** Ticket being corrected; null = new ticket. */
  editing: TicketPrintData | null;
  onSaved: (ticket: TicketPrintData, print: boolean) => void;
  onCancelEdit: () => void;
}

// Operator theme (desing/stitch_hello_kitty_form_redesign).
const inputCls = (invalid?: boolean) =>
  `mt-1 w-full rounded-xl border-2 bg-white px-3.5 py-2.5 text-sm font-extrabold text-slate-900 shadow-sm transition placeholder:text-slate-300 focus:border-pink-500 focus:ring-4 focus:ring-pink-100 focus:outline-none ${invalid ? "border-red-400" : "border-pink-200 hover:border-pink-300"}`;
const labelCls = "block text-xs font-black text-pink-900";
const hintCls = "text-[11px] font-bold text-pink-600";
const errCls = "mt-1 text-xs font-bold text-red-600";

export function EntryForm({
  materials,
  truckNumbers,
  today,
  values,
  onChange,
  truckTare,
  editing,
  onSaved,
  onCancelEdit,
}: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const truckRef = useRef<HTMLInputElement>(null);
  const printRef = useRef(true);

  const { materialId, truck, tons, customer, payment, codMethod, poNumber, jobNumber } = values;
  const set = <K extends keyof EntryValues>(k: K, v: EntryValues[K]) => onChange({ ...values, [k]: v });

  const tonsNum = useMemo(() => parseTons(tons), [tons]);

  const unitPrice = useMemo(
    () => materials.find((m) => m.id === materialId)?.price_per_ton ?? 0,
    [materials, materialId],
  );

  // Live preview of the Excel B11 rule: ACCOUNT => 0, COD => tons x price.
  const previewAmount =
    payment === "COD" && tonsNum !== null && tonsNum > 0
      ? Math.round(tonsNum * unitPrice * 100) / 100
      : 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setErrorDetail(null);
    setNotice(null);
    const local: Record<string, string> = {};
    if (!materialId) local.materialId = "Select a material.";
    if (truck.trim().length === 0) local.truckNumber = "Truck # is required.";
    if (tonsNum === null || tonsNum <= 0 || tonsNum > 200)
      local.tons = "Tons must be between 0 and 200.";
    if (customer.trim().length === 0) local.customerName = "Customer is required.";
    if (payment === "COD" && !codMethod) local.codMethod = "Required for COD.";
    if (Object.keys(local).length > 0) {
      setErrors(local);
      return;
    }

    setSaving(true);
    try {
      const input = {
        date: today,
        materialId,
        truckNumber: truck,
        tons: tonsNum!,
        // Display name keeps the operator's typing (trimmed); uniqueness is
        // enforced on the normalized key server-side.
        customerName: customer.trim().replace(/\s+/g, " "),
        payment,
        codMethod: payment === "COD" ? codMethod : null,
        poNumber,
        jobNumber,
      };
      const res = editing?.id ? await updateOrder(editing.id, input) : await createOrder(input);
      if (!res.ok) {
        setErrors({ [res.field]: res.message });
        setErrorDetail(res.detail ?? null);
        return;
      }
      setNotice(
        editing
          ? `Ticket ${res.ticket.ticketNumber} updated.`
          : `Saved ticket ${res.ticket.ticketNumber}.`,
      );
      onSaved(res.ticket, printRef.current);
      truckRef.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  function clear() {
    onChange({ ...emptyValues(materials), materialId, payment, codMethod });
    setErrors({});
    setErrorDetail(null);
    setNotice(null);
    truckRef.current?.focus();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="relative w-full overflow-hidden rounded-3xl border-2 border-pink-200/90 bg-white/95 p-5 shadow-cute sm:p-7"
    >
      <div className="absolute -top-1 -right-1">
        <div className="flex items-center gap-1 rounded-bl-2xl bg-gradient-to-br from-pink-500 to-rose-400 px-4 py-1 text-[10px] font-black text-white uppercase shadow-sm">
          PIT #2 🎀
        </div>
      </div>

      <div className="mb-5 flex items-center justify-between border-b border-pink-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-100 text-sm font-black text-pink-600">
              ✎
            </span>
            <h2 className="font-cute text-xl font-extrabold tracking-tight text-pink-900">Material Entry Form</h2>
          </div>
          <p className="mt-0.5 text-xs text-pink-700/80">Weigh-scale ticketing &amp; automated rate calculation</p>
        </div>
      </div>

      {editing ? (
        <div className="flex items-center justify-between rounded-xl border-2 border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
          <span>
            <span className="font-black">Editing ticket {editing.ticketNumber}</span> — the admin will see this change.
          </span>
          <button type="button" onClick={onCancelEdit} className="font-bold underline">
            Cancel
          </button>
        </div>
      ) : (
        <div>
          <span className={`${labelCls} flex items-center justify-between`}>
            <span>Date &amp; Scale Zone</span>
            <span className="text-[11px] font-normal text-pink-600">Ticket # is assigned automatically on save</span>
          </span>
          <div className="mt-1 flex items-center rounded-xl border border-pink-200 bg-pink-50/80 px-3.5 py-2.5 text-sm font-semibold text-slate-800 shadow-inner">
            <span className="mr-2.5 text-pink-500">📅</span>
            {formatPitDate(today)}
          </div>
        </div>
      )}

      <label className={`${labelCls} mt-4`}>
        <span className="flex items-center justify-between">
          <span>Material *</span>
          <span className={hintCls}>Rate: ${unitPrice.toFixed(2)} / ton</span>
        </span>
        <select
          value={materialId}
          onChange={(e) => set("materialId", e.target.value)}
          className={inputCls(!!errors.materialId)}
        >
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — ${Number(m.price_per_ton).toFixed(2)}/ton
            </option>
          ))}
        </select>
      </label>
      {errors.materialId && <p className={errCls}>{errors.materialId}</p>}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          Truck # *
          <input
            ref={truckRef}
            value={truck}
            onChange={(e) => set("truck", e.target.value)}
            maxLength={40}
            autoComplete="off"
            list="truck-numbers"
            className={inputCls(!!errors.truckNumber)}
          />
          <datalist id="truck-numbers">
            {truckNumbers.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>
        <label className={labelCls}>
          <span className="flex items-center justify-between">
            <span>Tons *</span>
            <span className="text-[10px] font-bold text-pink-500">Net Ton</span>
          </span>
          <span className="relative block">
            <input
              value={tons}
              onChange={(e) => set("tons", e.target.value)}
              inputMode="decimal"
              type="number"
              min="0"
              max="200"
              step="0.01"
              autoComplete="off"
              className={inputCls(!!errors.tons) + " pr-8 font-black"}
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 pt-1 text-xs font-bold text-pink-500">t</span>
          </span>
        </label>
      </div>
      {(errors.truckNumber || errors.tons) && (
        <p className={errCls}>{[errors.truckNumber, errors.tons].filter(Boolean).join(" ")}</p>
      )}
      {truck.trim() !== "" && (
        <p className="mt-1 text-xs font-semibold text-pink-700/80">
          {truckTare !== null
            ? `Registered truck — tare ${truckTare.toFixed(2)} t (ticket shows Gross / Tare / Net, Gross = Tare + Net).`
            : "Truck not registered — ticket shows Net only."}
        </p>
      )}
      {!errors.tons && tonsNum !== null && tonsNum > 50 && (
        <p className="mt-1 text-xs font-bold text-amber-700">
          Unusually large load ({tonsNum} t — typical pit trucks haul 15–40 t). Please verify before saving.
        </p>
      )}

      <div className={`${labelCls} mt-4`}>
        Customer *
        <CustomerCombobox value={customer} onChange={(v) => set("customer", v)} invalid={!!errors.customerName} />
      </div>
      {errors.customerName && <p className={errCls}>{errors.customerName}</p>}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          PO # <span className="font-semibold text-pink-500">(optional)</span>
          <input
            value={poNumber}
            onChange={(e) => set("poNumber", e.target.value)}
            maxLength={40}
            autoComplete="off"
            className={inputCls(!!errors.poNumber)}
          />
        </label>
        <label className={labelCls}>
          Job # <span className="font-semibold text-pink-500">(optional)</span>
          <input
            value={jobNumber}
            onChange={(e) => set("jobNumber", e.target.value)}
            maxLength={40}
            autoComplete="off"
            className={inputCls(!!errors.jobNumber)}
          />
        </label>
      </div>
      {(errors.poNumber || errors.jobNumber) && (
        <p className={errCls}>{[errors.poNumber, errors.jobNumber].filter(Boolean).join(" ")}</p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          Payment *
          <select
            value={payment}
            onChange={(e) => set("payment", e.target.value as Payment)}
            className={inputCls() + " font-bold"}
          >
            <option value="COD">COD (cash on delivery)</option>
            <option value="ACCOUNT">ACCOUNT (on account)</option>
          </select>
        </label>
        <label className={labelCls}>
          COD method {payment === "COD" ? "*" : "(n/a for ACCOUNT)"}
          <select
            value={codMethod}
            disabled={payment !== "COD"}
            onChange={(e) => set("codMethod", e.target.value as CodMethod)}
            className={inputCls(!!errors.codMethod) + " font-bold" + (payment !== "COD" ? " bg-pink-50 text-slate-400" : "")}
          >
            <option value="CASH">CASH</option>
            <option value="CARD">CARD</option>
            <option value="CHECK">CHECK</option>
          </select>
        </label>
      </div>
      {errors.codMethod && <p className={errCls}>{errors.codMethod}</p>}

      <div className="mt-5 flex items-center justify-between rounded-2xl border-2 border-pink-500/30 bg-gradient-to-r from-slate-900 via-[#1e1e24] to-pink-950 p-4 text-white shadow-cute">
        <div className="space-y-0.5">
          <span className="block text-[11px] font-bold tracking-widest text-pink-300 uppercase">Calculated Billing</span>
          <p className="font-mono text-sm font-medium text-pink-100">
            {payment === "ACCOUNT" ? "ACCOUNT → billed outside the system" : `COD → ${tonsNum ?? 0} t × $${unitPrice.toFixed(2)}`}
          </p>
        </div>
        <div className="text-right">
          <span className="block text-[10px] font-bold tracking-wider text-pink-200/80 uppercase">Gross Amount</span>
          <span className="font-mono text-2xl font-black tracking-tight text-white sm:text-3xl">${previewAmount.toFixed(2)}</span>
        </div>
      </div>

      {errors.form && <p className="mt-3 text-sm font-bold text-red-600">{errors.form}</p>}
      {errorDetail && (
        <p className="mt-1 rounded-xl bg-red-50 px-3 py-2 font-mono text-xs break-all text-red-700">
          Detail: {errorDetail}
        </p>
      )}
      {notice && (
        <p className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-bold text-green-800">{notice}</p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          onClick={() => (printRef.current = true)}
          className="flex-1 rounded-2xl border border-pink-300/40 bg-gradient-to-r from-[#ff1493] via-[#ff2d75] to-[#f43f5e] px-6 py-3.5 text-sm font-black text-white shadow-cute transition-all duration-200 hover:from-[#e00d7f] hover:to-[#e11d48] hover:shadow-lg active:scale-[0.99] disabled:opacity-50 sm:text-base"
        >
          {saving ? "Saving…" : editing ? "Update & Print" : "Save & Print"}
        </button>
        <button
          type="submit"
          disabled={saving}
          onClick={() => (printRef.current = false)}
          className="rounded-2xl border-2 border-pink-300 bg-white px-5 py-3.5 text-sm font-extrabold text-pink-700 shadow-sm transition hover:bg-pink-50 hover:text-pink-900 disabled:opacity-50"
        >
          {editing ? "Update" : "Save"}
        </button>
        {!editing && (
          <button
            type="button"
            onClick={clear}
            className="rounded-2xl border-2 border-pink-300 bg-white px-5 py-3.5 text-sm font-extrabold text-pink-700 shadow-sm transition hover:bg-pink-50 hover:text-pink-900"
          >
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
