"use client";

import Link from "next/link";
import { useState } from "react";

export interface TodayRow {
  id: string;
  truck_number: string;
  ticket_number: string;
  tons: number;
  payment: string;
  cod_method: string | null;
  gross: number;
  status: "active" | "void";
  edited_at: string | null;
  material: string;
  customer: string;
}

interface Props {
  rows: TodayRow[];
  total: number;
  page: number;
  pageSize: number;
  editingId: string | null;
  onReprint: (id: string) => Promise<void>;
  onEdit: (id: string) => Promise<void>;
  onVoid: (row: TodayRow) => Promise<void>;
}

// Operator theme (desing/stitch_hello_kitty_form_redesign).
const btn =
  "rounded-lg border border-pink-200 bg-white px-2 py-1 text-xs font-bold text-pink-700 transition hover:bg-pink-100 hover:text-pink-900 disabled:opacity-40";

export function TodaysTickets({ rows, total, page, pageSize, editingId, onReprint, onEdit, onVoid }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const dayTons = rows.filter((r) => r.status === "active").reduce((s, r) => s + Number(r.tons), 0);

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="w-full rounded-3xl border-2 border-pink-200/90 bg-white/95 p-5 shadow-cute sm:p-7">
      <div className="mb-4 flex items-center justify-between border-b border-pink-100 pb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-100 text-sm font-black text-pink-600">
            🎟
          </span>
          <h2 className="font-cute flex items-center gap-2 text-lg font-extrabold text-pink-950 sm:text-xl">
            Today&apos;s tickets
            <span className="rounded-full border border-pink-200 bg-pink-100 px-2.5 py-0.5 text-xs font-black text-pink-700">
              {total}
            </span>
          </h2>
        </div>
        <div className="text-right">
          <span className="block text-[11px] font-bold tracking-wide text-pink-600 uppercase">Weight logged</span>
          <span className="rounded-xl border border-pink-200 bg-pink-50 px-3 py-1 font-mono text-xs font-black whitespace-nowrap text-pink-800 shadow-inner sm:text-sm">
            {dayTons.toFixed(2)} t this page
          </span>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm font-semibold text-pink-700/80">No tickets saved today yet.</p>
      ) : (
        <ul className="custom-scrollbar max-h-[500px] space-y-2.5 overflow-y-auto pr-1.5 text-sm">
          {rows.map((r) => {
            const isVoid = r.status === "void";
            return (
              <li
                key={r.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5 shadow-sm transition-all duration-150 ${
                  editingId === r.id
                    ? "border-amber-300 bg-amber-50"
                    : "border-pink-100 bg-pink-50/40 hover:border-pink-300 hover:bg-pink-50"
                }`}
              >
                <div className={`min-w-0 space-y-1 ${isVoid ? "line-through opacity-50" : ""}`}>
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-extrabold text-slate-900">{r.customer}</span>
                    <span className="text-pink-400">•</span>
                    <span className="text-xs font-bold tracking-wide text-pink-600">{r.material}</span>
                  </p>
                  <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                    <span className="rounded border border-pink-100 bg-white px-2 py-0.5 font-bold text-slate-700">
                      Truck {r.truck_number}
                    </span>
                    <span>•</span>
                    <span>Tkt {r.ticket_number}</span>
                    <span>•</span>
                    <span className="font-bold text-slate-800">{Number(r.tons).toFixed(2)} t</span>
                    <span>•</span>
                    <span className="font-semibold text-pink-700">
                      {r.payment}
                      {r.cod_method ? `/${r.cod_method}` : ""}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isVoid && (
                    <span className="rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">VOID</span>
                  )}
                  {!isVoid && r.edited_at && (
                    <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">Edited</span>
                  )}
                  <span className={`w-20 text-right font-mono text-base font-black text-slate-900 ${isVoid ? "line-through opacity-50" : ""}`}>
                    ${Number(r.gross).toFixed(2)}
                  </span>
                  <button type="button" className={btn} disabled={busy !== null} onClick={() => run(r.id, () => onReprint(r.id))}>
                    Print
                  </button>
                  <button
                    type="button"
                    className={btn}
                    disabled={busy !== null || isVoid}
                    onClick={() => run(r.id, () => onEdit(r.id))}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={`${btn} border-rose-200 text-rose-700 hover:bg-rose-50`}
                    disabled={busy !== null || isVoid}
                    onClick={() => run(r.id, () => onVoid(r))}
                  >
                    Void
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-pink-100 pt-4 text-sm">
          <span className="font-semibold text-pink-700">
            Page {page} of {totalPages}
          </span>
          <span className="flex gap-2">
            <Link
              href={`/entry?tpage=${Math.max(1, page - 1)}`}
              aria-disabled={page <= 1}
              className={`rounded-xl border border-pink-200 bg-white px-3 py-1 font-bold text-pink-700 ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-pink-50"}`}
            >
              ← Prev
            </Link>
            <Link
              href={`/entry?tpage=${page + 1}`}
              aria-disabled={page >= totalPages}
              className={`rounded-xl border border-pink-200 bg-white px-3 py-1 font-bold text-pink-700 ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-pink-50"}`}
            >
              Next →
            </Link>
          </span>
        </div>
      )}
    </section>
  );
}
