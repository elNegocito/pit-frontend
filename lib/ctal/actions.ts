"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { payDateOf, weekStartOf } from "./compute";
import {
  BILL_TO,
  CUSTOMER_SELECT,
  DOC_KINDS,
  DOC_MIME,
  DOCS_BUCKET,
  LOAD_SELECT,
  MAX_DOC_BYTES,
  toCustomer,
  toLoad,
  UNITS,
  type BillTo,
  type CtalCustomer,
  type DocKind,
  type Load,
  type LoadFields,
  type Unit,
} from "./types";

/** useActionState contract: an error message, or null on success. */
export type FormState = string | null;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v: unknown, max: number) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const orNull = (s: string) => s || null;
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function cleanUrl(v: unknown): string | null | "invalid" {
  const s = String(v ?? "").trim().slice(0, 500);
  if (!s) return null;
  // Only web links: never store something a click could run (javascript:...).
  return /^https?:\/\/\S+$/i.test(s) ? s : "invalid";
}

// ---------------------------------------------------------------- carriers

export interface CarrierInput {
  carrier_number?: number | null;
  name: string;
  pay_term?: string;
  dispatch_contact?: string;
  owner?: string;
  equipment?: string;
  ins_exp?: string;
  ins_note?: string;
  hub_city?: string;
  usdot?: string;
  email?: string;
  phone?: string;
  tickets_url?: string;
  notes?: string;
}

function cleanCarrier(i: CarrierInput) {
  const name = text(i.name, 120).toUpperCase();
  if (!name) return "Carrier name is required.";
  const email = text(i.email, 120).toLowerCase();
  if (email && !EMAIL.test(email)) return `${name}: the email address is not valid.`;
  const ins_exp = text(i.ins_exp, 10);
  if (ins_exp && !ISO_DATE.test(ins_exp)) return `${name}: the insurance date is not valid.`;
  const url = cleanUrl(i.tickets_url);
  if (url === "invalid") return `${name}: the tickets link must start with http:// or https://.`;
  const number = i.carrier_number;
  if (number != null && (!Number.isInteger(number) || number < 1 || number > 999999)) return `${name}: the carrier number is not valid.`;
  return {
    ...(number != null ? { carrier_number: number } : {}),
    name,
    pay_term: text(i.pay_term, 4) === "28" ? "28" : "QP",
    dispatch_contact: orNull(text(i.dispatch_contact, 120)),
    owner: orNull(text(i.owner, 120)),
    equipment: orNull(text(i.equipment, 200)),
    ins_exp: orNull(ins_exp),
    ins_note: orNull(text(i.ins_note, 60).toUpperCase()),
    hub_city: orNull(text(i.hub_city, 80)),
    usdot: orNull(text(i.usdot, 20)),
    email: orNull(email),
    phone: orNull(text(i.phone, 30)),
    tickets_url: url,
    notes: orNull(String(i.notes ?? "").trim().slice(0, 1000)),
  };
}

function carrierError(error: { code?: string; message?: string }, name: string): string {
  if (error.code === "23505") {
    return error.message?.includes("carrier_number") ? "That carrier number is already used." : `Carrier "${name}" is already in the list.`;
  }
  return "The carrier could not be saved. Try again.";
}

export async function saveCarrier(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const numberRaw = String(form.get("carrier_number") ?? "").trim();
  const parsed = cleanCarrier({
    ...(Object.fromEntries(form) as unknown as CarrierInput),
    carrier_number: numberRaw ? Number(numberRaw) : null,
  });
  if (typeof parsed === "string") return parsed;

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase
      .from("ctal_carriers")
      .update({ ...parsed, active: form.get("active") === "on" })
      .eq("id", id);
    if (error) return carrierError(error, parsed.name);
    revalidatePath("/ctal", "layout");
    return null;
  }
  const { data, error } = await supabase.from("ctal_carriers").insert(parsed).select("id").single();
  if (error) return carrierError(error, parsed.name);
  revalidatePath("/ctal", "layout");
  redirect(`/ctal/carriers/${data.id}?created=1`);
}

/** Carriers pasted from the Google Sheet. Names already in the list are skipped. */
export async function importCarriers(rows: CarrierInput[]): Promise<{ ok: true; created: number; skipped: number } | { ok: false; message: string }> {
  await requireAdmin();
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, message: "There is nothing to import." };
  if (rows.length > 500) return { ok: false, message: "Import at most 500 carriers at a time." };

  const cleaned = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const c = cleanCarrier(r);
    if (typeof c === "string") return { ok: false, message: c };
    if (seen.has(c.name)) continue;
    seen.add(c.name);
    cleaned.push(c);
  }

  const supabase = await createClient();
  const { data: existing } = await supabase.from("ctal_carriers").select("name_key, carrier_number");
  const names = new Set((existing ?? []).map((e) => e.name_key as string));
  const numbers = new Set((existing ?? []).map((e) => e.carrier_number as number));
  let next = Math.max(3000, ...numbers) + 1;

  const fresh = cleaned
    .filter((c) => !names.has(c.name))
    .map((c) => {
      // Keep the sheet's number when it is free, else continue the sequence.
      let n = c.carrier_number;
      if (n == null || numbers.has(n)) {
        while (numbers.has(next)) next += 1;
        n = next;
      }
      numbers.add(n);
      return { ...c, carrier_number: n };
    });

  if (fresh.length > 0) {
    const { error } = await supabase.from("ctal_carriers").insert(fresh);
    if (error) return { ok: false, message: "The carriers could not be imported. Nothing was saved." };
  }
  revalidatePath("/ctal", "layout");
  return { ok: true, created: fresh.length, skipped: rows.length - fresh.length };
}

// ---------------------------------------------------------------- documents

export async function addCarrierDocument(input: {
  carrierId: string;
  kind: string;
  label: string;
  storagePath: string;
  fileName: string;
  mime: string;
  size: number;
  expiresOn: string;
}): Promise<FormState> {
  await requireAdmin();
  if (!UUID.test(input.carrierId)) return "Carrier not found.";
  // The object must sit in that carrier's own folder.
  if (!input.storagePath.startsWith(`${input.carrierId}/`) || input.storagePath.includes("..")) return "The file was not uploaded correctly.";
  if (!DOC_MIME.includes(input.mime)) return "Only PDF files and photos can be saved.";
  if (!finite(input.size) || input.size < 0 || input.size > MAX_DOC_BYTES) return "The file is larger than 20 MB.";
  if (input.expiresOn && !ISO_DATE.test(input.expiresOn)) return "The expiry date is not valid.";

  const supabase = await createClient();
  const { error } = await supabase.from("ctal_carrier_documents").insert({
    carrier_id: input.carrierId,
    kind: (DOC_KINDS as string[]).includes(input.kind) ? (input.kind as DocKind) : "other",
    label: orNull(text(input.label, 120)),
    storage_path: input.storagePath,
    file_name: text(input.fileName, 200) || "file",
    mime: input.mime,
    size_bytes: Math.round(input.size),
    expires_on: orNull(input.expiresOn),
  });
  if (error) {
    await supabase.storage.from(DOCS_BUCKET).remove([input.storagePath]);
    return "The document could not be saved. Try again.";
  }
  revalidatePath(`/ctal/carriers/${input.carrierId}`);
  revalidatePath("/ctal/carriers");
  return null;
}

export async function deleteCarrierDocument(id: string): Promise<FormState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: doc } = await supabase.from("ctal_carrier_documents").select("id, carrier_id, storage_path").eq("id", id).maybeSingle();
  if (!doc) return "Document not found.";
  const { error: fileError } = await supabase.storage.from(DOCS_BUCKET).remove([doc.storage_path]);
  if (fileError) return "The file could not be deleted. Try again.";
  const { error } = await supabase.from("ctal_carrier_documents").delete().eq("id", id);
  if (error) return "The document could not be deleted. Try again.";
  revalidatePath(`/ctal/carriers/${doc.carrier_id}`);
  revalidatePath("/ctal/carriers");
  return null;
}

// ---------------------------------------------------------------- customers

function parseCustomer(form: FormData) {
  const name = text(form.get("name"), 120).toUpperCase();
  if (!name) return "Customer name is required.";
  const bill_to = String(form.get("bill_to") ?? "");
  const unit = String(form.get("default_unit") ?? "");
  const fee_kind = String(form.get("fee_kind") ?? "");
  const fsc_mode = String(form.get("fsc_mode") ?? "");
  const n = (k: string) => Number(form.get(k) || 0);
  const row = {
    name,
    bill_to: (BILL_TO as string[]).includes(bill_to) ? bill_to : "asg",
    default_unit: (UNITS as string[]).includes(unit) ? unit : "TON",
    broker_rate: n("broker_rate"),
    carrier_rate: n("carrier_rate"),
    fee_kind: fee_kind === "broker_fee" ? "broker_fee" : "quick_pay",
    fee_pct: n("fee_pct"),
    fsc_mode: fsc_mode === "percent" || fsc_mode === "fixed" ? fsc_mode : "none",
    fsc_value: n("fsc_value"),
  };
  if (![row.broker_rate, row.carrier_rate, row.fee_pct, row.fsc_value].every((v) => Number.isFinite(v) && v >= 0)) return "Rates and percentages must be 0 or more.";
  if (row.fee_pct > 100) return "The fee cannot be more than 100%.";
  if (row.fsc_mode === "none") row.fsc_value = 0;
  return row;
}

export async function saveCustomer(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const parsed = parseCustomer(form);
  if (typeof parsed === "string") return parsed;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("ctal_customers").update({ ...parsed, active: form.get("active") === "on" }).eq("id", id)
    : await supabase.from("ctal_customers").insert(parsed);
  if (error) return error.code === "23505" ? `Customer "${parsed.name}" is already in the list.` : "The customer could not be saved. Try again.";
  revalidatePath("/ctal", "layout");
  return null;
}

/** Created from the log when a customer is typed for the first time. */
export async function quickCreateCustomer(name: string): Promise<{ ok: true; customer: CtalCustomer } | { ok: false; message: string }> {
  await requireAdmin();
  const clean = text(name, 120).toUpperCase();
  if (!clean) return { ok: false, message: "Customer name is required." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("ctal_customers").insert({ name: clean }).select(CUSTOMER_SELECT).single();
  if (error?.code === "23505") {
    const { data: existing } = await supabase.from("ctal_customers").select(CUSTOMER_SELECT).eq("name_key", clean).maybeSingle();
    if (existing) return { ok: true, customer: toCustomer(existing) };
  }
  if (error || !data) return { ok: false, message: "The customer could not be created." };
  revalidatePath("/ctal/customers");
  return { ok: true, customer: toCustomer(data) };
}

// ---------------------------------------------------------------- weeks

export async function createWeek(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const day = String(form.get("day") ?? "");
  if (!ISO_DATE.test(day)) return "Pick any day of the week you want to start.";
  const week_start = weekStartOf(day);
  const supabase = await createClient();
  const { data: existing } = await supabase.from("ctal_weeks").select("id").eq("week_start", week_start).maybeSingle();
  let id = existing?.id as string | undefined;
  if (!id) {
    const { data, error } = await supabase.from("ctal_weeks").insert({ week_start, pay_date: payDateOf(week_start) }).select("id").single();
    if (error) return "The week could not be created. Try again.";
    id = data.id;
    revalidatePath("/ctal", "layout");
  }
  // An existing week is simply opened.
  redirect(`/ctal/weeks/${id}`);
}

export async function updateWeek(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const pay_date = String(form.get("pay_date") ?? "");
  if (!ISO_DATE.test(pay_date)) return "Pay date is required.";
  const supabase = await createClient();
  const { error } = await supabase
    .from("ctal_weeks")
    .update({ pay_date, notes: orNull(String(form.get("notes") ?? "").trim().slice(0, 1000)) })
    .eq("id", id);
  if (error) return "The week could not be saved. Try again.";
  revalidatePath("/ctal", "layout");
  return null;
}

export async function deleteWeek(id: string): Promise<FormState> {
  await requireAdmin();
  const supabase = await createClient();
  const { count } = await supabase.from("ctal_loads").select("id", { count: "exact", head: true }).eq("week_id", id);
  if ((count ?? 0) > 0) return "This week has loads. Delete its rows first.";
  const { error } = await supabase.from("ctal_weeks").delete().eq("id", id);
  if (error) return "The week could not be deleted. Try again.";
  revalidatePath("/ctal", "layout");
  redirect("/ctal/weeks");
}

// ---------------------------------------------------------------- loads

const MAX_ROWS = 600;

export type SaveLoadsResult = { ok: true; loads: Load[] } | { ok: false; message: string };

/**
 * Saves the changed rows of a week's log and removes the deleted ones. Names
 * and bill-to are read from the catalogs (never trusted from the browser) and
 * the database recomputes every amount.
 */
export async function saveLoads(weekId: string, rows: LoadFields[], deletedIds: string[]): Promise<SaveLoadsResult> {
  await requireAdmin();
  if (!UUID.test(weekId)) return { ok: false, message: "Week not found." };
  if (rows.length > MAX_ROWS || deletedIds.length > MAX_ROWS) return { ok: false, message: "Too many rows in one save." };
  if (![...rows.map((r) => r.id), ...deletedIds].every((id) => UUID.test(id))) return { ok: false, message: "A row has an invalid id." };

  const supabase = await createClient();
  const [{ data: week }, { data: carriers }, { data: customers }] = await Promise.all([
    supabase.from("ctal_weeks").select("id").eq("id", weekId).maybeSingle(),
    supabase.from("ctal_carriers").select("id, name"),
    supabase.from("ctal_customers").select("id, name, bill_to"),
  ]);
  if (!week) return { ok: false, message: "Week not found." };
  const carrierName = new Map((carriers ?? []).map((c) => [c.id as string, c.name as string]));
  const customerById = new Map((customers ?? []).map((c) => [c.id as string, c as { name: string; bill_to: BillTo }]));

  const payload = [];
  for (const r of rows) {
    const where = `Row ${r.position + 1}`;
    if (!ISO_DATE.test(r.load_date)) return { ok: false, message: `${where}: the date is not valid.` };
    const carrier = r.carrier_id ? carrierName.get(r.carrier_id) : undefined;
    if (!carrier) return { ok: false, message: `${where}: pick a carrier from the list.` };
    const customer = r.customer_id ? customerById.get(r.customer_id) : undefined;
    if (!customer) return { ok: false, message: `${where}: pick a customer from the list.` };
    if (!(UNITS as string[]).includes(r.unit)) return { ok: false, message: `${where}: the unit is not valid.` };
    const numbers = [r.quantity, r.broker_rate, r.carrier_rate, r.fee_pct, r.fsc_value];
    if (!numbers.every((v) => finite(v) && v >= 0)) return { ok: false, message: `${where}: amounts must be 0 or more.` };
    if (r.fee_pct > 100) return { ok: false, message: `${where}: the fee cannot be more than 100%.` };
    payload.push({
      id: r.id,
      week_id: weekId,
      position: Math.max(0, Math.round(r.position) || 0),
      load_date: r.load_date,
      carrier_id: r.carrier_id,
      carrier_name: carrier,
      customer_id: r.customer_id,
      customer_name: customer.name,
      bill_to: customer.bill_to,
      truck: orNull(text(r.truck, 40)),
      driver: orNull(text(r.driver, 80).toUpperCase()),
      ticket: orNull(text(r.ticket, 40)),
      quantity: Math.round(r.quantity * 100) / 100,
      unit: r.unit as Unit,
      broker_rate: r.broker_rate,
      carrier_rate: r.carrier_rate,
      fee_kind: r.fee_kind === "broker_fee" ? "broker_fee" : "quick_pay",
      fee_pct: r.fee_pct,
      fsc_mode: r.fsc_mode === "percent" || r.fsc_mode === "fixed" ? r.fsc_mode : "none",
      fsc_value: r.fsc_mode === "none" ? 0 : r.fsc_value,
    });
  }

  if (deletedIds.length > 0) {
    const { error } = await supabase.from("ctal_loads").delete().eq("week_id", weekId).in("id", deletedIds);
    if (error) return { ok: false, message: "The deleted rows could not be removed. Try again." };
  }
  let saved: Load[] = [];
  if (payload.length > 0) {
    // A row id that already belongs to another week is refused by the week filter below.
    const { data: foreign } = await supabase.from("ctal_loads").select("id").in("id", payload.map((p) => p.id)).neq("week_id", weekId).limit(1);
    if (foreign && foreign.length > 0) return { ok: false, message: "A row belongs to another week." };
    const { data, error } = await supabase.from("ctal_loads").upsert(payload).select(LOAD_SELECT);
    if (error) return { ok: false, message: "The rows could not be saved. Try again." };
    saved = (data ?? []).map(toLoad);
  }
  revalidatePath("/ctal", "layout");
  return { ok: true, loads: saved };
}

// ---------------------------------------------------------------- statements

export async function saveStatementLink(weekId: string, carrierId: string, url: string): Promise<FormState> {
  await requireAdmin();
  const clean = cleanUrl(url);
  if (clean === "invalid") return "The link must start with http:// or https://.";
  const supabase = await createClient();
  const { error } = await supabase
    .from("ctal_statements")
    .upsert({ week_id: weekId, carrier_id: carrierId, tickets_url: clean }, { onConflict: "week_id,carrier_id" });
  if (error) return "The link could not be saved. Try again.";
  revalidatePath(`/ctal/weeks/${weekId}/statements`);
  return null;
}

// ---------------------------------------------------------------- search

export interface TicketHit {
  id: string;
  week_id: string;
  ticket: string;
  load_date: string;
  carrier_name: string;
  customer_name: string;
}

/** Tickets whose number contains `q` (the home search; carriers are matched in the browser). */
export async function searchTickets(q: string): Promise<TicketHit[]> {
  await requireAdmin();
  const term = text(q, 40).replace(/[%_\\]/g, "");
  if (term.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("ctal_loads")
    .select("id, week_id, ticket, load_date, carrier_name, customer_name")
    .ilike("ticket", `%${term}%`)
    .order("load_date", { ascending: false })
    .limit(8);
  return (data ?? []) as TicketHit[];
}
