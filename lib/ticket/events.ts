import { PIT_TIME_ZONE } from "@/lib/timezone";
import type { TicketEvent } from "@/lib/types";

const LABELS: Record<string, string> = {
  customer: "Customer",
  material: "Material",
  truck: "Truck",
  tons: "Tons",
  payment: "Payment",
  cod_method: "COD method",
  po_number: "PO #",
  job_number: "Job #",
};

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

/** "Customer: A → B · Tons: 20 → 25" */
export function describeChanges(e: TicketEvent): string {
  return Object.entries(e.changes)
    .map(([k, v]) => `${LABELS[k] ?? k}: ${show(v.from)} → ${show(v.to)}`)
    .join(" · ");
}

export function formatEventTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PIT_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
