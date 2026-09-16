"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@/lib/supabase/client";
import type { OrderFilters, SortDir, SortKey } from "@/lib/orders/query";
import { PIT_TIME_ZONE } from "@/lib/timezone";

interface Props {
  filters: OrderFilters;
  sort: SortKey;
  dir: SortDir;
}

interface ExportRow {
  date: string;
  customer: string;
  material: string;
  truck_number: string;
  ticket_number: string;
  tons: number;
  payment: string;
  cod_method: string;
  gross: number;
}

const SELECT =
  "date, truck_number, ticket_number, tons, payment, cod_method, gross, materials(name), customers(name)";

function stamp(): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: PIT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(/[/, :]/g, "");
  return p;
}

export function ExportButtons({ filters, sort, dir }: Props) {
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);

  async function fetchAll(): Promise<ExportRow[]> {
    const supabase = createClient();
    const ascending = dir === "asc";
    const out: ExportRow[] = [];
    const PAGE = 1000;
    for (let page = 0; ; page++) {
      let q = supabase.from("orders").select(SELECT);
      if (filters.truck) q = q.ilike("truck_number", `%${filters.truck.replace(/[%_\\]/g, "")}%`);
      if (filters.ticket) q = q.ilike("ticket_number", `%${filters.ticket.replace(/[%_\\]/g, "")}%`);
      if (filters.customerId) q = q.eq("customer_id", filters.customerId);
      if (filters.materialId) q = q.eq("material_id", filters.materialId);
      if (filters.payment) q = q.eq("payment", filters.payment);
      if (filters.codMethod) q = q.eq("cod_method", filters.codMethod);
      if (filters.dateFrom) q = q.gte("date", filters.dateFrom);
      if (filters.dateTo) q = q.lte("date", filters.dateTo);
      if (sort === "customer") q = q.order("name", { referencedTable: "customers", ascending });
      else if (sort === "material") q = q.order("name", { referencedTable: "materials", ascending });
      else q = q.order(sort, { ascending });
      // Unique tiebreaker: without it, rows sharing the sort value can be
      // duplicated or skipped across pages.
      q = q.order("id", { ascending: true });
      const { data, error } = await q.range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw error;
      const rows = ((data ?? []) as unknown as Array<{
        date: string;
        truck_number: string;
        ticket_number: string;
        tons: number;
        payment: string;
        cod_method: string | null;
        gross: number;
        materials: { name: string } | { name: string }[] | null;
        customers: { name: string } | { name: string }[] | null;
      }>).map((r) => ({
        ...r,
        materials: Array.isArray(r.materials) ? (r.materials[0] ?? null) : r.materials,
        customers: Array.isArray(r.customers) ? (r.customers[0] ?? null) : r.customers,
      }));
      type Flat = Omit<(typeof rows)[number], "materials" | "customers"> & {
        materials: { name: string } | null;
        customers: { name: string } | null;
      };
      out.push(
        ...(rows as Flat[]).map((r) => ({
          date: r.date,
          customer: r.customers?.name ?? "",
          material: r.materials?.name ?? "",
          truck_number: r.truck_number,
          ticket_number: r.ticket_number,
          tons: Number(r.tons),
          payment: r.payment,
          cod_method: r.cod_method ?? "",
          gross: Number(r.gross),
        })),
      );
      if (rows.length < PAGE) break;
    }
    return out;
  }

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportCsv() {
    setBusy("csv");
    try {
      const rows = await fetchAll();
      const header = "date,customer,material,truck,ticket,tons,payment,cod_method,gross";
      const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
      const lines = rows.map((r) =>
        [r.date, esc(r.customer), esc(r.material), esc(r.truck_number), esc(r.ticket_number), r.tons.toFixed(2), r.payment, r.cod_method, r.gross.toFixed(2)].join(","),
      );
      download(new Blob([[header, ...lines].join("\n")], { type: "text/csv" }), `ASG_Orders_${stamp()}.csv`);
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf() {
    setBusy("pdf");
    try {
      const rows = await fetchAll();
      const doc = new jsPDF({ orientation: "landscape" });
      const totalTons = rows.reduce((s, r) => s + r.tons, 0);
      const totalGross = rows.reduce((s, r) => s + r.gross, 0);
      doc.setFontSize(14);
      doc.text("ASG Operations — PIT #2 — Orders", 14, 14);
      doc.setFontSize(9);
      doc.text(
        `Generated ${new Intl.DateTimeFormat("en-US", { timeZone: PIT_TIME_ZONE, dateStyle: "medium", timeStyle: "short" }).format(new Date())} (${PIT_TIME_ZONE}) — ${rows.length} records — Tons ${totalTons.toFixed(2)} — Gross $${totalGross.toFixed(2)}`,
        14,
        20,
      );
      autoTable(doc, {
        startY: 24,
        head: [["Date", "Customer", "Material", "Truck #", "Ticket", "Tons", "Payment", "COD", "Gross $"]],
        body: rows.map((r) => [
          r.date,
          r.customer,
          r.material,
          r.truck_number,
          r.ticket_number,
          r.tons.toFixed(2),
          r.payment,
          r.cod_method,
          r.gross.toFixed(2),
        ]),
        styles: { fontSize: 8 },
      });
      doc.save(`ASG_Orders_${stamp()}.pdf`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <span className="flex gap-2">
      <button
        type="button"
        onClick={exportCsv}
        disabled={busy !== null}
        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50"
      >
        {busy === "csv" ? "Exporting…" : "Export CSV"}
      </button>
      <button
        type="button"
        onClick={exportPdf}
        disabled={busy !== null}
        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50"
      >
        {busy === "pdf" ? "Exporting…" : "Export PDF"}
      </button>
    </span>
  );
}
