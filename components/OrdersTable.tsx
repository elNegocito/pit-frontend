"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteOrder } from "@/lib/orders/actions";
import { describeChanges, formatEventTime } from "@/lib/ticket/events";
import {
  filtersToParams,
  type OrderFilters,
  type SortDir,
  type SortKey,
} from "@/lib/orders/query";
import type { OrderRow, TicketEvent } from "@/lib/types";

interface Props {
  rows: OrderRow[];
  filters: OrderFilters;
  sort: SortKey;
  dir: SortDir;
  page: number;
  totalPages: number;
  total: number;
  eventsByOrder: Record<string, TicketEvent[]>;
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

export function OrdersTable({ rows, filters, sort, dir, page, totalPages, total, eventsByOrder }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDelete(r: OrderRow) {
    setError(null);
    if (!window.confirm(`Delete ticket ${r.ticket_number} permanently?\nThis cannot be undone (use the operator's Void to keep a record).`)) return;
    const res = await deleteOrder(r.id);
    if (!res.ok) return setError(res.message);
    router.refresh();
  }

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
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isVoid = r.status === "void";
            const events = eventsByOrder[r.id] ?? [];
            return (
              <Fragment key={r.id}>
                <tr className={`border-b last:border-0 hover:bg-zinc-50 ${isVoid ? "text-zinc-400 line-through" : ""}`}>
                  <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2">{r.customers?.name ?? "—"}</td>
                  <td className="px-3 py-2">{r.materials?.name ?? "—"}</td>
                  <td className="px-3 py-2">{r.truck_number}</td>
                  <td className="px-3 py-2">{r.ticket_number}</td>
                  <td className="px-3 py-2 text-right">{Number(r.tons).toFixed(2)}</td>
                  <td className="px-3 py-2">{r.payment}</td>
                  <td className="px-3 py-2 text-right">{Number(r.gross).toFixed(2)}</td>
                  <td className="px-3 py-2">{r.cod_method ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap no-underline">
                    {isVoid && (
                      <span className="inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">VOID</span>
                    )}{" "}
                    {r.edited_at && (
                      <span
                        className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800"
                        title={`Last edit ${formatEventTime(r.edited_at)}`}
                      >
                        Modified{r.edit_count > 1 ? ` ×${r.edit_count}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {events.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setOpen(open === r.id ? null : r.id)}
                        className="mr-2 text-xs text-zinc-600 underline"
                      >
                        {open === r.id ? "Hide" : "History"}
                      </button>
                    )}
                    <button type="button" onClick={() => onDelete(r)} className="text-xs text-red-700 underline">
                      Delete
                    </button>
                  </td>
                </tr>
                {open === r.id && (
                  <tr className="border-b bg-amber-50/60">
                    <td colSpan={11} className="px-6 py-2">
                      <ul className="space-y-1 text-xs">
                        {events.map((e) => (
                          <li key={e.id}>
                            <span className="text-zinc-500">{formatEventTime(e.created_at)}</span>{" "}
                            {e.action === "void" ? (
                              <span className="font-semibold text-red-700">Voided</span>
                            ) : (
                              <span>Edited — {describeChanges(e)}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={11} className="px-3 py-8 text-center text-zinc-500">
                No records match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {error && <p className="px-4 pt-3 text-sm text-red-600">{error}</p>}
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
