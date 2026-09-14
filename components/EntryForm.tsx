"use client";

import { useMemo, useRef, useState } from "react";
import { createOrder } from "@/lib/orders/actions";
import { formatPitDate } from "@/lib/timezone";
import type { CodMethod, Material, Payment } from "@/lib/types";
import { CustomerCombobox } from "./CustomerCombobox";

interface Props {
  materials: Material[];
  today: string;
}

const inputCls = (invalid?: boolean) =>
  `w-full rounded-lg border px-3 py-2 text-base ${invalid ? "border-red-500" : ""}`;

export function EntryForm({ materials, today }: Props) {
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [truck, setTruck] = useState("");
  const [ticket, setTicket] = useState("");
  const [tons, setTons] = useState("");
  const [customer, setCustomer] = useState("");
  const [payment, setPayment] = useState<Payment>("COD");
  const [codMethod, setCodMethod] = useState<CodMethod>("CASH");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const truckRef = useRef<HTMLInputElement>(null);

  const tonsNum = useMemo(() => {
    const n = Number(tons);
    return tons.trim() === "" || !Number.isFinite(n) ? null : n;
  }, [tons]);

  const unitPrice = useMemo(
    () => materials.find((m) => m.id === materialId)?.price_per_ton ?? 0,
    [materials, materialId],
  );

  // Live preview of the Excel B11 rule: ACCOUNT => 0, COD => tons x price.
  const previewGross =
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
    if (ticket.trim().length === 0) local.ticketNumber = "Ticket # is required.";
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
      const res = await createOrder({
        date: today,
        materialId,
        truckNumber: truck,
        ticketNumber: ticket,
        tons: tonsNum!,
        // Display name keeps the operator's typing (trimmed); uniqueness is
        // enforced on the normalized key server-side.
        customerName: customer.trim().replace(/\s+/g, " "),
        payment,
        codMethod: payment === "COD" ? codMethod : null,
      });
      if (!res.ok) {
        setErrors({ [res.field]: res.message });
        setErrorDetail(res.detail ?? null);
        return;
      }
      setNotice(
        `Saved ticket ${res.ticket} — gross $${res.gross.toFixed(2)}.`,
      );
      // Continuous entry: keep catalog selections + customer (convoys from
      // the same customer arrive in series), clear the per-load fields.
      setTruck("");
      setTicket("");
      setTons("");
      truckRef.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  function clear() {
    setTruck("");
    setTicket("");
    setTons("");
    setCustomer("");
    setErrors({});
    setErrorDetail(null);
    setNotice(null);
    truckRef.current?.focus();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow sm:p-8">
      <div className="rounded-lg bg-zinc-100 px-4 py-3 text-sm">
        <span className="font-medium">Date: </span>
        {formatPitDate(today)}
      </div>

      <label className="mt-5 block text-sm font-medium">
        Material *
        <select
          value={materialId}
          onChange={(e) => setMaterialId(e.target.value)}
          className={inputCls(!!errors.materialId)}
        >
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — ${Number(m.price_per_ton).toFixed(2)}/ton
            </option>
          ))}
        </select>
      </label>
      {errors.materialId && <p className="mt-1 text-sm text-red-600">{errors.materialId}</p>}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium">
          Truck # *
          <input
            ref={truckRef}
            value={truck}
            onChange={(e) => setTruck(e.target.value)}
            maxLength={40}
            autoComplete="off"
            className={inputCls(!!errors.truckNumber)}
          />
        </label>
        <label className="block text-sm font-medium">
          Ticket # *
          <input
            value={ticket}
            onChange={(e) => setTicket(e.target.value)}
            maxLength={40}
            autoComplete="off"
            className={inputCls(!!errors.ticketNumber)}
          />
        </label>
        <label className="block text-sm font-medium">
          Tons *
          <input
            value={tons}
            onChange={(e) => setTons(e.target.value)}
            inputMode="decimal"
            type="number"
            min="0"
            max="200"
            step="0.01"
            autoComplete="off"
            className={inputCls(!!errors.tons)}
          />
        </label>
      </div>
      {(errors.truckNumber || errors.ticketNumber || errors.tons) && (
        <p className="mt-1 text-sm text-red-600">
          {[errors.truckNumber, errors.ticketNumber, errors.tons].filter(Boolean).join(" ")}
        </p>
      )}
      {!errors.tons && tonsNum !== null && tonsNum > 50 && (
        <p className="mt-1 text-sm text-amber-700">
          Unusually large load ({tonsNum} t — typical pit trucks haul 15–40 t). Please verify before saving.
        </p>
      )}

      <div className="mt-4 block text-sm font-medium">
        Customer *
        <CustomerCombobox value={customer} onChange={setCustomer} invalid={!!errors.customerName} />
      </div>
      {errors.customerName && <p className="mt-1 text-sm text-red-600">{errors.customerName}</p>}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Payment *
          <select
            value={payment}
            onChange={(e) => setPayment(e.target.value as Payment)}
            className={inputCls()}
          >
            <option value="COD">COD (cash on delivery)</option>
            <option value="ACCOUNT">ACCOUNT (on account)</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          COD method {payment === "COD" ? "*" : "(n/a for ACCOUNT)"}
          <select
            value={codMethod}
            disabled={payment !== "COD"}
            onChange={(e) => setCodMethod(e.target.value as CodMethod)}
            className={inputCls(!!errors.codMethod) + (payment !== "COD" ? " bg-zinc-100 text-zinc-400" : "")}
          >
            <option value="CASH">CASH</option>
            <option value="CARD">CARD</option>
            <option value="CHECK">CHECK</option>
          </select>
        </label>
      </div>
      {errors.codMethod && <p className="mt-1 text-sm text-red-600">{errors.codMethod}</p>}

      <div className="mt-5 flex items-center justify-between rounded-lg bg-zinc-900 px-4 py-3 text-white">
        <span className="text-sm text-zinc-300">
          {payment === "ACCOUNT" ? "ACCOUNT → billed outside the system" : `COD → ${tonsNum ?? 0} t × $${unitPrice.toFixed(2)}`}
        </span>
        <span className="text-lg font-semibold">Gross ${previewGross.toFixed(2)}</span>
      </div>

      {errors.form && <p className="mt-3 text-sm text-red-600">{errors.form}</p>}
      {errorDetail && (
        <p className="mt-1 rounded-lg bg-red-50 px-3 py-2 font-mono text-xs break-all text-red-700">
          Detail: {errorDetail}
        </p>
      )}
      {notice && (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-zinc-900 py-3 text-base font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save ticket"}
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-xl border px-5 py-3 text-base hover:bg-zinc-100"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
