import { formatTicketDate } from "@/lib/timezone";
import type { CarrierInput } from "./actions";
import type { Load } from "./types";

// A leading = + - @ would run as a formula when the file is opened in Excel.
const cell = (v: string | number) => {
  let s = String(v ?? "");
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(head: string[], rows: (string | number)[][]): Blob {
  const body = [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  // BOM so Excel reads accents correctly.
  return new Blob(["﻿", body], { type: "text/csv;charset=utf-8" });
}

const fscPct = (r: Load) => (r.fsc_mode === "percent" ? r.fsc_value / 100 : "N/A");

/** The Excel "Billins" sheet: the log without the amounts. */
export function billingsCsv(rows: Load[]): Blob {
  return toCsv(
    ["Date", "Company", "Truck #", "Driver", "Customer", "Ticket", "Qty", "Unit", "Broker Rate", "Carrier Rate", "FSC %"],
    rows.map((r) => [formatTicketDate(r.load_date), r.carrier_name, r.truck, r.driver, r.customer_name, r.ticket, r.quantity, r.unit, r.broker_rate, r.carrier_rate, fscPct(r)]),
  );
}

/** One company's billing sheet (ASG / Ready Mix / Excavation). */
export function billingCsv(rows: Load[]): Blob {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return toCsv(
    ["Date", "Company", "Truck #", "Driver", "Customer", "Ticket", "Qty", "Unit", "Broker Rate", "Broker Amount", "FSC $", "FSC %"],
    rows.map((r) => [formatTicketDate(r.load_date), r.carrier_name, r.truck, r.driver, r.customer_name, r.ticket, r.quantity, r.unit, r.broker_rate, r2(r.broker_amount), r2(r.fsc_amount), fscPct(r)]),
  );
}

// ---------------------------------------------------------------- import

/** Splits pasted spreadsheet text: tabs (copied cells) or commas (CSV file), quotes honored. */
export function parseTable(input: string): string[][] {
  const src = input.replace(/^﻿/, "");
  const sep = src.split(/\r?\n/, 1)[0].includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === sep) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

type Field = keyof CarrierInput;

// Column titles of the client's Google Sheet (and close variants).
const HEADERS: [RegExp, Field][] = [
  [/carrier\s*name|^name$|^company$/i, "name"],
  [/pay\s*term/i, "pay_term"],
  [/dispatch/i, "dispatch_contact"],
  [/^owner/i, "owner"],
  [/driver|truck|equipment/i, "equipment"],
  [/ins/i, "ins_exp"],
  [/hub|city/i, "hub_city"],
  [/usdot|dot/i, "usdot"],
  [/e-?mail/i, "email"],
  [/phone/i, "phone"],
  [/^(#|no\.?|number|column\s*1|carrier\s*#)$/i, "carrier_number"],
];

/** "8/4/2026" or "2026-08-04" as yyyy-MM-dd; anything else is not a date. */
function toIsoDate(s: string): string | null {
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  const [y, m, d] = us ? [us[3].length === 2 ? `20${us[3]}` : us[3], us[1], us[2]] : iso ? [iso[1], iso[2], iso[3]] : ["", "", ""];
  if (!y) return null;
  const out = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return Number.isNaN(Date.parse(out)) ? null : out;
}

export interface ParsedImport {
  carriers: CarrierInput[];
  /** Sheet columns that were recognized, in order. */
  columns: string[];
  error: string | null;
}

export function parseCarrierImport(input: string): ParsedImport {
  const table = parseTable(input);
  if (table.length === 0) return { carriers: [], columns: [], error: null };
  const headRow = table.findIndex((r) => r.some((c) => /carrier\s*name|^name$/i.test(c)));
  if (headRow < 0) return { carriers: [], columns: [], error: 'Include the header row: one column must be called "Carrier Name".' };

  const map = new Map<number, Field>();
  table[headRow].forEach((title, i) => {
    const hit = HEADERS.find(([re, f]) => re.test(title) && ![...map.values()].includes(f));
    if (hit) map.set(i, hit[1]);
  });

  const carriers: CarrierInput[] = [];
  for (const r of table.slice(headRow + 1)) {
    const c: CarrierInput = { name: "" };
    for (const [i, f] of map) {
      const v = r[i] ?? "";
      if (!v) continue;
      if (f === "carrier_number") {
        const n = Number(v.replace(/\D/g, ""));
        if (n > 0) c.carrier_number = n;
      } else if (f === "ins_exp") {
        const date = toIsoDate(v);
        if (date) c.ins_exp = date;
        else c.ins_note = v; // EXPIRED, CONTACTED...
      } else if (f === "pay_term") c.pay_term = /28/.test(v) ? "28" : "QP";
      else c[f] = v as never;
    }
    if (c.name) carriers.push(c);
  }
  return { carriers, columns: [...map.keys()].map((i) => table[headRow][i]), error: carriers.length === 0 ? "No carriers were found under the header row." : null };
}
