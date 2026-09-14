"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  EMPTY_FILTERS,
  filtersToParams,
  type OrderFilters,
  type SortDir,
  type SortKey,
} from "@/lib/orders/query";
import { todayInPit } from "@/lib/timezone";
import type { Customer, Material } from "@/lib/types";

interface Props {
  initial: OrderFilters;
  sort: SortKey;
  dir: SortDir;
  customers: Customer[];
  materials: Material[];
}

const cls = "w-full rounded-lg border px-3 py-2 text-sm";

export function OrdersFilters({ initial, sort, dir, customers, materials }: Props) {
  const router = useRouter();
  const [f, setF] = useState<OrderFilters>(initial);

  function set<K extends keyof OrderFilters>(k: K, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function apply(next: OrderFilters) {
    router.push(`/dashboard?${filtersToParams(next, sort, dir, 1).toString()}`);
  }

  function setDay(day: string) {
    const next = { ...f, dateFrom: day, dateTo: day };
    setF(next);
    apply(next);
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="text-xs font-medium">
          Day
          <input
            type="date"
            value={f.dateFrom === f.dateTo ? f.dateFrom : ""}
            onChange={(e) => {
              const v = e.target.value;
              const next = { ...f, dateFrom: v, dateTo: v };
              setF(next);
            }}
            className={cls}
          />
        </label>
        <label className="text-xs font-medium">
          From
          <input
            type="date"
            value={f.dateFrom}
            onChange={(e) => set("dateFrom", e.target.value)}
            className={cls}
          />
        </label>
        <label className="text-xs font-medium">
          To
          <input
            type="date"
            value={f.dateTo}
            onChange={(e) => set("dateTo", e.target.value)}
            className={cls}
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setDay(todayInPit())}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-zinc-100"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              const next = { ...f, dateFrom: "", dateTo: "" };
              setF(next);
              apply(next);
            }}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-zinc-100"
          >
            All dates
          </button>
        </div>
        <label className="text-xs font-medium">
          Truck #
          <input
            value={f.truck}
            onChange={(e) => set("truck", e.target.value)}
            placeholder="contains…"
            className={cls}
          />
        </label>
        <label className="text-xs font-medium">
          Ticket #
          <input
            value={f.ticket}
            onChange={(e) => set("ticket", e.target.value)}
            placeholder="contains…"
            className={cls}
          />
        </label>
        <label className="text-xs font-medium">
          Customer
          <select value={f.customerId} onChange={(e) => set("customerId", e.target.value)} className={cls}>
            <option value="">All</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Material
          <select value={f.materialId} onChange={(e) => set("materialId", e.target.value)} className={cls}>
            <option value="">All</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Payment
          <select value={f.payment} onChange={(e) => set("payment", e.target.value)} className={cls}>
            <option value="">All</option>
            <option value="COD">COD</option>
            <option value="ACCOUNT">ACCOUNT</option>
          </select>
        </label>
        <label className="text-xs font-medium">
          COD method
          <select value={f.codMethod} onChange={(e) => set("codMethod", e.target.value)} className={cls}>
            <option value="">All</option>
            <option value="CASH">CASH</option>
            <option value="CARD">CARD</option>
            <option value="CHECK">CHECK</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => apply(f)}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white"
        >
          Apply filters
        </button>
        <button
          type="button"
          onClick={() => {
            setF(EMPTY_FILTERS);
            router.push("/dashboard");
          }}
          className="rounded-lg border px-5 py-2 text-sm hover:bg-zinc-100"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
