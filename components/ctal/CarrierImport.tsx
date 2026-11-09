"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { importCarriers } from "@/lib/ctal/actions";
import { parseCarrierImport } from "@/lib/ctal/csv";
import { formatTicketDate } from "@/lib/timezone";
import { btn, btnPrimary, card, input, td, th } from "@/lib/ctal/ui";

export function CarrierImport({ existing }: { existing: string[] }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const parsed = useMemo(() => parseCarrierImport(text), [text]);
  const have = useMemo(() => new Set(existing), [existing]);
  const key = (name: string) => name.trim().replace(/\s+/g, " ").toUpperCase();
  const fresh = parsed.carriers.filter((c) => !have.has(key(c.name)));

  function run() {
    setError(null);
    start(async () => {
      const res = await importCarriers(parsed.carriers);
      if (!res.ok) return setError(res.message);
      setResult(`${res.created} carrier${res.created === 1 ? "" : "s"} imported${res.skipped ? `, ${res.skipped} already in the list` : ""}.`);
      setText("");
    });
  }

  return (
    <div className="space-y-4">
      <div className={`${card} p-5`}>
        <label className="block text-sm font-medium text-zinc-700">
          Carrier rows from Google Sheets
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setResult(null); }}
            rows={8}
            spellCheck={false}
            placeholder={"Column 1\tCarrier Name\tPAY TERM\tDispatch Contact\tOwner\tDriver, Truck, Equipment\tINS EXP\tHUB CITY\tUSDOT #\n3001\tExample Trucking\tQP\t…"}
            className={`${input} mt-1 font-mono text-xs`}
          />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className={`${btn} cursor-pointer`}>
            Or choose a CSV file
            <input type="file" accept=".csv,.tsv,.txt,text/csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); e.target.value = ""; }} />
          </label>
          <p className="text-sm text-zinc-600">In the sheet, select the table with its header row, copy, and paste here.</p>
        </div>
      </div>

      {result && (
        <p role="status" className="rounded-md bg-pine-100 px-3 py-2 text-sm text-pine-950">
          {result} <Link href="/ctal/carriers" className="font-medium underline">See the carriers</Link>
        </p>
      )}
      {(parsed.error || error) && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error ?? parsed.error}</p>}

      {parsed.carriers.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={run} disabled={pending || fresh.length === 0} className={btnPrimary}>
              {pending ? "Importing…" : `Import ${fresh.length} carrier${fresh.length === 1 ? "" : "s"}`}
            </button>
            <p className="text-sm text-zinc-600">
              Columns read: {parsed.columns.join(", ")}.
              {parsed.carriers.length - fresh.length > 0 && ` ${parsed.carriers.length - fresh.length} already in the list will be skipped.`}
            </p>
          </div>
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="border-b border-rule bg-pine-50">
                  {["#", "Carrier name", "Pay term", "Dispatch contact", "Owner", "Driver, truck, equipment", "Ins exp", "Hub city", "USDOT #"].map((h) => (
                    <th key={h} className={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.carriers.map((c, i) => {
                  const skip = have.has(key(c.name));
                  return (
                    <tr key={i} className={`border-b border-rule last:border-0 ${skip ? "text-zinc-400" : ""}`}>
                      <td className={`${td} tabular-nums`}>{c.carrier_number ?? ""}</td>
                      <td className={`${td} font-medium`}>{c.name}{skip && <span className="ml-2 text-xs font-normal">already in the list</span>}</td>
                      <td className={td}>{c.pay_term ?? "QP"}</td>
                      <td className={td}>{c.dispatch_contact}</td>
                      <td className={td}>{c.owner}</td>
                      <td className={td}>{c.equipment}</td>
                      <td className={`${td} tabular-nums`}>{c.ins_exp ? formatTicketDate(c.ins_exp) : c.ins_note}</td>
                      <td className={td}>{c.hub_city}</td>
                      <td className={`${td} tabular-nums`}>{c.usdot}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
