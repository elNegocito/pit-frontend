export type Unit = "TON" | "YDS" | "LOAD" | "HR";
export type FeeKind = "quick_pay" | "broker_fee";
export type FscMode = "none" | "percent" | "fixed";
export type BillTo = "asg" | "ready_mix" | "excavation";
export type PayTerm = "QP" | "28";
export type DocKind = "insurance" | "contract" | "cdl" | "w9" | "other";

export const UNITS: Unit[] = ["TON", "YDS", "LOAD", "HR"];
export const BILL_TO: BillTo[] = ["asg", "ready_mix", "excavation"];
export const BILL_TO_LABEL: Record<BillTo, string> = {
  asg: "ASG",
  ready_mix: "Ready Mix",
  excavation: "Excavation",
};
export const DOC_KINDS: DocKind[] = ["insurance", "contract", "cdl", "w9", "other"];
export const DOC_KIND_LABEL: Record<DocKind, string> = {
  insurance: "Insurance",
  contract: "Contract",
  cdl: "CDL",
  w9: "W-9",
  other: "Other",
};

export const DOCS_BUCKET = "ctal-docs";
export const MAX_DOC_BYTES = 20 * 1024 * 1024;
export const DOC_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export interface Carrier {
  id: string;
  carrier_number: number;
  name: string;
  pay_term: PayTerm;
  dispatch_contact: string | null;
  owner: string | null;
  equipment: string | null;
  ins_exp: string | null;
  ins_note: string | null;
  hub_city: string | null;
  usdot: string | null;
  email: string | null;
  phone: string | null;
  tickets_url: string | null;
  notes: string | null;
  active: boolean;
}

export const CARRIER_SELECT =
  "id, carrier_number, name, pay_term, dispatch_contact, owner, equipment, ins_exp, ins_note, hub_city, usdot, email, phone, tickets_url, notes, active";

export interface CarrierDocument {
  id: string;
  carrier_id: string;
  kind: DocKind;
  label: string | null;
  storage_path: string;
  file_name: string;
  mime: string;
  size_bytes: number;
  expires_on: string | null;
  uploaded_at: string;
}

export const DOCUMENT_SELECT = "id, carrier_id, kind, label, storage_path, file_name, mime, size_bytes, expires_on, uploaded_at";

export interface CtalCustomer {
  id: string;
  name: string;
  bill_to: BillTo;
  default_unit: Unit;
  broker_rate: number;
  carrier_rate: number;
  fee_kind: FeeKind;
  fee_pct: number;
  fsc_mode: FscMode;
  fsc_value: number;
  active: boolean;
}

export const CUSTOMER_SELECT =
  "id, name, bill_to, default_unit, broker_rate, carrier_rate, fee_kind, fee_pct, fsc_mode, fsc_value, active";

type Raw = Record<string, unknown>;

export function toCustomer(r: Raw): CtalCustomer {
  return {
    ...(r as unknown as CtalCustomer),
    broker_rate: Number(r.broker_rate),
    carrier_rate: Number(r.carrier_rate),
    fee_pct: Number(r.fee_pct),
    fsc_value: Number(r.fsc_value),
  };
}

export interface Week {
  id: string;
  week_start: string;
  pay_date: string;
  notes: string | null;
}

export const WEEK_SELECT = "id, week_start, pay_date, notes";

/** What the owner types on a log row. */
export interface LoadFields {
  id: string;
  position: number;
  load_date: string;
  carrier_id: string | null;
  carrier_name: string;
  customer_id: string | null;
  customer_name: string;
  bill_to: BillTo;
  truck: string;
  driver: string;
  ticket: string;
  quantity: number;
  unit: Unit;
  broker_rate: number;
  carrier_rate: number;
  fee_kind: FeeKind;
  fee_pct: number;
  fsc_mode: FscMode;
  fsc_value: number;
}

export interface LoadAmounts {
  carrier_amount: number;
  broker_amount: number;
  broker_fee: number;
  quick_pay_fee: number;
  fsc_amount: number;
}

/** A saved log row (amounts as frozen by the database). */
export type Load = LoadFields & LoadAmounts & { carrier_id: string; customer_id: string };

export const LOAD_SELECT =
  "id, position, load_date, carrier_id, carrier_name, customer_id, customer_name, bill_to, truck, driver, ticket, quantity, unit, broker_rate, carrier_rate, fee_kind, fee_pct, fsc_mode, fsc_value, carrier_amount, broker_amount, broker_fee, quick_pay_fee, fsc_amount";

export function toLoad(r: Raw): Load {
  const n = (k: string) => Number(r[k] ?? 0);
  return {
    ...(r as unknown as Load),
    truck: (r.truck as string | null) ?? "",
    driver: (r.driver as string | null) ?? "",
    ticket: (r.ticket as string | null) ?? "",
    quantity: n("quantity"),
    broker_rate: n("broker_rate"),
    carrier_rate: n("carrier_rate"),
    fee_pct: n("fee_pct"),
    fsc_value: n("fsc_value"),
    carrier_amount: n("carrier_amount"),
    broker_amount: n("broker_amount"),
    broker_fee: n("broker_fee"),
    quick_pay_fee: n("quick_pay_fee"),
    fsc_amount: n("fsc_amount"),
  };
}

export interface StatementMeta {
  week_id: string;
  carrier_id: string;
  tickets_url: string | null;
  emailed_at: string | null;
  emailed_to: string | null;
}
