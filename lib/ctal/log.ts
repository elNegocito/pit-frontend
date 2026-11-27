import { formatTicketDate } from "@/lib/timezone";
import { money, pct, qty, rate } from "./compute";
import type { Load } from "./types";

// The data columns of the editable log, without row controls. Shared by the
// viewer table and the PDF so both show the same saved values.
export const LOG_COLUMNS = [
  { label: "#", width: 27, value: (_: Load, index: number) => String(index + 1) },
  { label: "Date", width: 59, value: (r: Load) => formatTicketDate(r.load_date) },
  { label: "Company", width: 112, value: (r: Load) => r.carrier_name },
  { label: "Truck #", width: 59, value: (r: Load) => r.truck },
  { label: "Driver", width: 90, value: (r: Load) => r.driver },
  { label: "Customer", width: 112, value: (r: Load) => r.customer_name },
  { label: "Ticket", width: 62, value: (r: Load) => r.ticket },
  { label: "Qty", width: 56, numeric: true, value: (r: Load) => qty(r.quantity) },
  { label: "Unit", width: 33, value: (r: Load) => r.unit },
  { label: "Broker rate", width: 65, numeric: true, value: (r: Load) => rate(r.broker_rate) },
  { label: "Carrier rate", width: 65, numeric: true, value: (r: Load) => rate(r.carrier_rate) },
  { label: "Carrier amt", width: 70, numeric: true, value: (r: Load) => money(r.carrier_amount) },
  { label: "Broker amt", width: 70, numeric: true, value: (r: Load) => money(r.broker_amount) },
  { label: "Fee %", width: 61, numeric: true, value: (r: Load) => `${r.fee_kind === "broker_fee" ? "BF" : "QP"} ${pct(r.fee_pct)}` },
  { label: "Fee $", width: 67, numeric: true, value: (r: Load) => money(r.broker_fee + r.quick_pay_fee) },
  { label: "FSC", width: 65, numeric: true, value: (r: Load) => r.fsc_mode === "none" ? "N/A" : r.fsc_mode === "percent" ? pct(r.fsc_value) : money(r.fsc_value) },
  { label: "FSC $", width: 67, numeric: true, value: (r: Load) => money(r.fsc_amount) },
] satisfies { label: string; width: number; numeric?: boolean; value: (load: Load, index: number) => string }[];
