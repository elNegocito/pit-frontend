"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { insuranceState } from "@/lib/ctal/compute";
import type { Carrier } from "@/lib/ctal/types";
import { card, input, td, th } from "@/lib/ctal/ui";
import { fold, Highlight } from "./Combobox";
import { InsuranceBadge } from "./InsuranceBadge";

type Row = Carrier & { documents: number };
type Chip = "expired" | "soon" | "qp" | "28" | "nodocs" | "inactive";

const CHIPS: { key: Chip; label: string }[] = [
  { key: "expired", label: "Insurance expired" },
  { key: "soon", label: "Expiring in 30 days" },
  { key: "nodocs", label: "No documents" },
  { key: "qp", label: "Quick pay" },
  { key: "28", label: "28 days" },
  { key: "inactive", label: "Inactive" },
];

export function CarrierList({ carriers, today }: { carriers: Row[]; today: string }) {
  const [find, setFind] = useState("");
  const [chip, setChip] = useState<Chip | null>(null);

  const tests = useMemo<Record<Chip, (c: Row) => boolean>>(
    () => ({
      expired: (c) => c.active && insuranceState(c, today) === "expired",
      soon: (c) => c.active && insuranceState(c, today) === "soon",
      nodocs: (c) => c.active && c.documents === 0,
      qp: (c) => c.active && c.pay_term === "QP",
      "28": (c) => c.active && c.pay_term === "28",
      inactive: (c) => !c.active,
    }),
    [today],
  );
  const q = fold(find.trim());
  const shown = carriers.filter(
    (c) =>
      (chip ? tests[chip](c) : c.active) &&
      (!q || fold(`${c.name} ${c.carrier_number} ${c.owner ?? ""} ${c.dispatch_contact ?? ""} ${c.equipment ?? ""} ${c.hub_city ?? ""} ${c.usdot ?? ""}`).includes(q)),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={find}
          onChange={(e) => setFind(e.target.value)}
          type="search"
          placeholder="Search by name, #, owner, phone, city, USDOT…"
          aria-label="Search carriers"
          className={`${input} max-w-sm`}
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filters">
          {CHIPS.map(({ key, label }) => {
            const n = carriers.filter(tests[key]).length;
            if (n === 0 && chip !== key) return null;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={chip === key}
                onClick={() => setChip(chip === key ? null : key)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                  chip === key ? "border-pine-900 bg-pine-900 text-white" : key === "expired" ? "border-red-200 bg-red-50 text-red-800 hover:bg-red-100" : "border-rule bg-white text-zinc-700 hover:bg-pine-50"
                }`}
              >
                {label} <span className="tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
        <p className="ml-auto text-sm text-zinc-600 tabular-nums">
          {shown.length} of {carriers.length}
        </p>
      </div>

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr className="border-b border-rule bg-pine-50">
              <th className={th}>#</th>
              <th className={th}>Carrier name</th>
              <th className={th}>Pay term</th>
              <th className={th}>Dispatch contact</th>
              <th className={th}>Owner</th>
              <th className={th}>Driver, truck, equipment</th>
              <th className={th}>Ins exp</th>
              <th className={th}>Hub city</th>
              <th className={th}>USDOT #</th>
              <th className={th}>Files</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id} className={`border-b border-rule last:border-0 hover:bg-pine-50/50 ${c.active ? "" : "text-zinc-400"}`}>
                <td className={`${td} tabular-nums text-zinc-500`}><Highlight text={String(c.carrier_number)} query={find} /></td>
                <td className={`${td} font-medium`}>
                  <Link href={`/ctal/carriers/${c.id}`} className="text-pine-900 hover:underline">
                    <Highlight text={c.name} query={find} />
                  </Link>
                </td>
                <td className={td}>{c.pay_term === "28" ? "28 days" : "QP"}</td>
                <td className={td}><Highlight text={c.dispatch_contact ?? ""} query={find} /></td>
                <td className={td}><Highlight text={c.owner ?? ""} query={find} /></td>
                <td className={td}><Highlight text={c.equipment ?? ""} query={find} /></td>
                <td className={td}><InsuranceBadge carrier={c} today={today} /></td>
                <td className={td}><Highlight text={c.hub_city ?? ""} query={find} /></td>
                <td className={`${td} tabular-nums`}><Highlight text={c.usdot ?? ""} query={find} /></td>
                <td className={td}>
                  <Link href={`/ctal/carriers/${c.id}#documents`} className={c.documents ? "text-pine-900 hover:underline" : "text-zinc-400 hover:underline"}>
                    {c.documents ? `${c.documents} file${c.documents === 1 ? "" : "s"}` : "Add files"}
                  </Link>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-zinc-600">
                  {carriers.length === 0 ? "No carriers yet. Add one, or import the whole Google Sheet at once." : "No carrier matches. Clear the search or the filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
