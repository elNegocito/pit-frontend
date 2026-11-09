"use client";

import { billingCsv, billingsCsv } from "@/lib/ctal/csv";
import { profitRows } from "@/lib/ctal/compute";
import { billingFileName, buildBillingPdf, buildProfitPdf, downloadBlob, downloadPdf, printPdf, profitFileName } from "@/lib/ctal/pdf";
import type { BillTo, Load, Week } from "@/lib/ctal/types";
import { btn } from "@/lib/ctal/ui";

export function BillingActions({ week, billTo, rows }: { week: Week; billTo: BillTo; rows: Load[] }) {
  const pdf = () => buildBillingPdf(week, billTo, rows);
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={btn} onClick={() => printPdf(pdf())}>Print</button>
      <button type="button" className={btn} onClick={() => downloadPdf(pdf(), billingFileName(week, billTo))}>Download PDF</button>
      <button type="button" className={btn} onClick={() => downloadBlob(billingCsv(rows), billingFileName(week, billTo).replace(/\.pdf$/, ".csv"))}>Download Excel (CSV)</button>
    </div>
  );
}

export function BillingsExport({ week, rows }: { week: Week; rows: Load[] }) {
  return (
    <button type="button" className={btn} disabled={rows.length === 0} onClick={() => downloadBlob(billingsCsv(rows), `CTAL_Billings_${week.week_start}.csv`)}>
      Download Billings (CSV)
    </button>
  );
}

export function ProfitActions({ week, rows }: { week: Week; rows: Load[] }) {
  const pdf = () => buildProfitPdf(week, profitRows(rows));
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={btn} disabled={rows.length === 0} onClick={() => printPdf(pdf())}>Print</button>
      <button type="button" className={btn} disabled={rows.length === 0} onClick={() => downloadPdf(pdf(), profitFileName(week))}>Download PDF</button>
    </div>
  );
}
