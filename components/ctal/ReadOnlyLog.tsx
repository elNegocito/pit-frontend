"use client";

import { useState } from "react";
import { LOG_COLUMNS } from "@/lib/ctal/log";
import type { Load } from "@/lib/ctal/types";
import { btn, input, td, th } from "@/lib/ctal/ui";
import { fold } from "./Combobox";

export function ReadOnlyLog({ loads, focusTicket }: { loads: Load[]; focusTicket?: string }) {
  const [query, setQuery] = useState(focusTicket ?? "");
  const term = fold(query.trim());
  const rows = loads.map((load, index) => ({ load, index })).filter(({ load }) =>
    !term || fold(`${load.carrier_name} ${load.customer_name} ${load.ticket} ${load.truck} ${load.driver}`).includes(term),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label="Find in this week"
          placeholder="Find a carrier, ticket, driver…"
          className={`${input} max-w-xs`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && <button type="button" className={btn} onClick={() => setQuery("")}>Show all rows</button>}
        <p role="status" className="text-sm text-zinc-600">{rows.length} of {loads.length} loads</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-rule bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-pine-50">
            <tr>
              {LOG_COLUMNS.map((col) => <th key={col.label} scope="col" className={`${th} ${col.numeric ? "text-right" : ""}`}>{col.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ load, index }) => (
              <tr key={load.id} className="border-t border-rule">
                {LOG_COLUMNS.map((col) => <td key={col.label} className={`${td} ${col.numeric ? "text-right tabular-nums" : ""}`}>{col.value(load, index)}</td>)}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={LOG_COLUMNS.length} className="px-4 py-10 text-center text-sm text-zinc-600">
                {loads.length ? "No rows match your search." : "No loads logged for this week."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
