"use client";

import Link from "next/link";
import {
  filtersToParams,
  type OrderFilters,
  type SortDir,
  type SortKey,
} from "@/lib/orders/query";
import type { OrderRow } from "@/lib/types";

interface Props {
  rows: OrderRow[];
  filters: OrderFilters;
  sort: SortKey;
  dir: SortDir;
  page: number;
  totalPages: number;
  total: number;
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "customer", label: "Customer" },
  { key: "material", label: "Material" },
  { key: "truck_number", label: "Truck #" },
  { key: "ticket_number", label: "Ticket" },
  { key: "tons", label: "Tons" },
  { key: "payment", label: "Payment" },
  { key: "gross", label: "Gross $" },
];

function sortHref(filters: OrderFilters, sort: SortKey, dir: SortDir, page: number, col: SortKey) {
  const nextDir: SortDir = sort === col && dir === "desc" ? "asc" : "desc";
  return `/dashboard?${filtersToParams(filters, col, nextDir, page).toString()}`;
}

export function OrdersTable({ rows, filters, sort, dir, page, totalPages, total }: Props) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead>
          <tr className="border-b bg-zinc-50">
            {COLUMNS.map((c) => (
              <th key={c.key} className="px-3 py-2 font-medium">
                <Link
                  href={sortHref(filters, sort, dir, page, c.key)}
                  className="hover:underline"
                  title="Sort"
                >
                  {c.label} {sort === c.key ? (dir === "desc" ? "▼" : "▲") : ""}
                </Link>
              </th>
            ))}
            <th className="px-3 py-2 font-medium">COD method</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-zinc-50">
              <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
              <td className="px-3 py-2">{r.customers?.name ?? "—"}</td>
              <td className="px-3 py-2">{r.materials?.name ?? "—"}</td>
              <td className="px-3 py-2">{r.truck_number}</td>
              <td className="px-3 py-2">{r.ticket_number}</td>
              <td className="px-3 py-2 text-right">{Number(r.tons).toFixed(2)}</td>
              <td className="px-3 py-2">{r.payment}</td>
              <td className="px-3 py-2 text-right">{Number(r.gross).toFixed(2)}</td>
              <td className="px-3 py-2">{r.cod_method ?? "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-3 py-8 text-center text-zinc-500">
                No records match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <span className="text-zinc-500">
          {total} record{total === 1 ? "" : "s"} — page {page} of {Math.max(totalPages, 1)}
        </span>
        <span className="flex gap-2">
          <Link
            href={`/dashboard?${filtersToParams(filters, sort, dir, Math.max(1, page - 1)).toString()}`}
            aria-disabled={page <= 1}
            className={`rounded-lg border px-3 py-1 ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-zinc-100"}`}
          >
            ← Prev
          </Link>
          <Link
            href={`/dashboard?${filtersToParams(filters, sort, dir, page + 1).toString()}`}
            aria-disabled={page >= totalPages}
            className={`rounded-lg border px-3 py-1 ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-zinc-100"}`}
          >
            Next →
          </Link>
        </span>
      </div>
    </div>
  );
}
