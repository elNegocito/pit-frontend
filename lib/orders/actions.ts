"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { normalizeName, normalizeTicket } from "@/lib/normalize";
import { todayInPit } from "@/lib/timezone";
import type { CodMethod, Payment, TicketPrintData, TicketStatus } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface EntryInput {
  date: string;
  materialId: string;
  truckNumber: string;
  tons: number;
  customerName: string;
  payment: Payment;
  codMethod: CodMethod | null;
  poNumber: string;
  jobNumber: string;
}

export type EntryResult =
  | { ok: true; ticket: TicketPrintData }
  | { ok: false; field: string; message: string; detail?: string };

export type ActionResult = { ok: true } | { ok: false; message: string };

function fail(field: string, message: string, detail?: string): EntryResult & { ok: false } {
  // Never silently swallow the backend error: the detail (Supabase message +
  // code) is shown verbatim in the form so failures are diagnosable.
  if (detail) console.error(`[orders:${field}]`, detail);
  return { ok: false, field, message, detail };
}

interface Clean {
  truck: string;
  customerName: string;
  poNumber: string | null;
  jobNumber: string | null;
}

/** Server-side validation shared by create and update (client checks are UX only). */
function validate(input: EntryInput): Clean | (EntryResult & { ok: false }) {
  const truck = input.truckNumber.trim();
  if (truck.length < 1 || truck.length > 40) {
    return fail("truckNumber", "Truck # is required (max 40 characters).");
  }
  if (!Number.isFinite(input.tons) || input.tons <= 0 || input.tons > 200) {
    return fail("tons", "Tons must be between 0 and 200.");
  }
  const customerName = input.customerName.trim().replace(/\s+/g, " ");
  if (customerName.length < 1 || customerName.length > 120) {
    return fail("customerName", "Customer is required (max 120 characters).");
  }
  if (input.payment !== "ACCOUNT" && input.payment !== "COD") {
    return fail("payment", "Payment must be ACCOUNT or COD.");
  }
  if (input.payment === "COD") {
    if (input.codMethod !== "CASH" && input.codMethod !== "CARD" && input.codMethod !== "CHECK") {
      return fail("codMethod", "COD requires CASH, CARD or CHECK.");
    }
  }
  const poNumber = input.poNumber.trim();
  const jobNumber = input.jobNumber.trim();
  if (poNumber.length > 40) return fail("poNumber", "PO # max 40 characters.");
  if (jobNumber.length > 40) return fail("jobNumber", "Job # max 40 characters.");
  return { truck, customerName, poNumber: poNumber || null, jobNumber: jobNumber || null };
}

/** Resolve-or-create the customer on its normalized key. */
async function resolveCustomer(
  supabase: Supabase,
  customerName: string,
): Promise<{ id: string } | (EntryResult & { ok: false })> {
  const key = normalizeName(customerName);
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("name_key", key)
    .maybeSingle();
  if (existing) return { id: existing.id };

  const { data: created, error: createError } = await supabase
    .from("customers")
    .insert({ name: customerName })
    .select("id")
    .single();
  if (!createError) return { id: created.id };

  // Lost race with another session creating the same customer:
  // re-read instead of failing.
  const { data: raced } = await supabase
    .from("customers")
    .select("id")
    .eq("name_key", key)
    .maybeSingle();
  if (raced) return { id: raced.id };
  return fail(
    "customerName",
    "Could not save customer.",
    `${createError.message} (code ${createError.code ?? "?"})`,
  );
}

/**
 * Catalog values frozen on the ticket: the truck tare (truck registry) and
 * the customer's project order code. Unregistered trucks / customers without
 * an order simply print without them.
 */
async function resolveSnapshots(supabase: Supabase, truck: string, customerId: string) {
  const [{ data: truckRow }, { data: orderRow }] = await Promise.all([
    supabase
      .from("trucks")
      .select("tare_tons")
      .eq("truck_key", normalizeTicket(truck))
      .eq("active", true)
      .maybeSingle(),
    supabase
      .from("job_orders")
      .select("code")
      .eq("customer_id", customerId)
      .eq("active", true)
      .maybeSingle(),
  ]);
  return {
    truck_tare_tons: truckRow ? Number(truckRow.tare_tons) : null,
    job_order_code: orderRow?.code ?? null,
  };
}

async function activeMaterial(supabase: Supabase, materialId: string) {
  const { data } = await supabase
    .from("materials")
    .select("id")
    .eq("id", materialId)
    .eq("active", true)
    .maybeSingle();
  return !!data;
}

const TICKET_SELECT =
  "id, date, created_at, status, edited_at, ticket_number, truck_number, tons, payment, cod_method, material_id, po_number, job_number, job_order_code, truck_tare_tons, weighmaster, materials(name), customers(name)";

type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** Full ticket (with "loads today") as printed. Null when not readable. */
async function loadTicket(supabase: Supabase, id: string): Promise<TicketPrintData | null> {
  const [{ data: r }, { data: loads }] = await Promise.all([
    supabase.from("orders").select(TICKET_SELECT).eq("id", id).maybeSingle(),
    supabase
      .rpc("ticket_loads", { p_order_id: id })
      .maybeSingle<{ customer_loads: number; truck_loads: number }>(),
  ]);
  if (!r) return null;
  return {
    id: r.id,
    ticketNumber: r.ticket_number,
    createdAt: r.created_at,
    date: r.date,
    status: r.status as TicketStatus,
    truckNumber: r.truck_number,
    orderCode: r.job_order_code,
    customer: one(r.customers as One<{ name: string }>)?.name ?? "",
    materialId: r.material_id,
    product: one(r.materials as One<{ name: string }>)?.name ?? "",
    poNumber: r.po_number ?? "",
    jobNumber: r.job_number ?? "",
    netTons: Number(r.tons),
    truckTareTons: r.truck_tare_tons === null ? null : Number(r.truck_tare_tons),
    payment: r.payment as Payment,
    codMethod: r.cod_method as CodMethod | null,
    customerLoads: loads?.customer_loads ?? null,
    truckLoads: loads?.truck_loads ?? null,
    weighmaster: r.weighmaster ?? "",
    edited: r.edited_at !== null,
  };
}

/**
 * Single write path for new tickets (operator + admin).
 * - Ticket number is generated by the database (sequence, 5+ digits).
 * - Resolves the customer by normalized key, creating it when new.
 * - Freezes truck tare / order code / weighmaster on the ticket.
 * - The DB trigger computes the frozen $ gross (R1/R2/R4).
 * Returns the stored ticket, ready to print.
 */
export async function createOrder(input: EntryInput): Promise<EntryResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return fail("date", "Invalid date.");
  }
  if (input.date > todayInPit()) {
    return fail("date", "Date cannot be in the future.");
  }
  const clean = validate(input);
  if ("ok" in clean) return clean;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("form", "Session expired. Sign in again.");

  // Material must exist and be active (price is read by the DB trigger).
  if (!(await activeMaterial(supabase, input.materialId))) {
    return fail("materialId", "Select a valid material.");
  }

  const customer = await resolveCustomer(supabase, clean.customerName);
  if ("ok" in customer) return customer;

  const [snapshots, { data: profile }] = await Promise.all([
    resolveSnapshots(supabase, clean.truck, customer.id),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);
  const weighmaster = profile?.display_name || user.email?.split("@")[0] || null;

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      date: input.date,
      material_id: input.materialId,
      truck_number: clean.truck,
      tons: input.tons,
      customer_id: customer.id,
      payment: input.payment,
      cod_method: input.payment === "COD" ? input.codMethod : null,
      po_number: clean.poNumber,
      job_number: clean.jobNumber,
      weighmaster,
      ...snapshots,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return fail(
      "form",
      "Could not save the ticket.",
      `${error.message} (code ${error.code ?? "?"})`,
    );
  }

  const ticket = await loadTicket(supabase, order.id);
  if (!ticket) return fail("form", "Saved, but the ticket could not be re-read.");
  revalidatePath("/entry");
  return { ok: true, ticket };
}

/**
 * Correct a saved ticket (wrong customer, truck, tons…). RLS limits the
 * operator to today's tickets; the DB trigger records the change history the
 * admin sees. Ticket number, date and time never change.
 */
export async function updateOrder(id: string, input: EntryInput): Promise<EntryResult> {
  const clean = validate(input);
  if ("ok" in clean) return clean;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("form", "Session expired. Sign in again.");

  const { data: current } = await supabase
    .from("orders")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!current) return fail("form", "Ticket not found (only today's tickets can be edited).");
  if (current.status === "void") return fail("form", "A void ticket cannot be edited.");

  if (!(await activeMaterial(supabase, input.materialId))) {
    return fail("materialId", "Select a valid material.");
  }
  const customer = await resolveCustomer(supabase, clean.customerName);
  if ("ok" in customer) return customer;
  const snapshots = await resolveSnapshots(supabase, clean.truck, customer.id);

  const { data: updated, error } = await supabase
    .from("orders")
    .update({
      material_id: input.materialId,
      truck_number: clean.truck,
      tons: input.tons,
      customer_id: customer.id,
      payment: input.payment,
      cod_method: input.payment === "COD" ? input.codMethod : null,
      po_number: clean.poNumber,
      job_number: clean.jobNumber,
      ...snapshots,
    })
    .eq("id", id)
    .select("id");

  if (error) {
    return fail("form", "Could not update the ticket.", `${error.message} (code ${error.code ?? "?"})`);
  }
  if (!updated || updated.length === 0) {
    return fail("form", "Only today's tickets can be edited.");
  }

  const ticket = await loadTicket(supabase, id);
  if (!ticket) return fail("form", "Updated, but the ticket could not be re-read.");
  revalidatePath("/entry");
  revalidatePath("/dashboard");
  return { ok: true, ticket };
}

/** Cancel a ticket: it stays in the ledger marked VOID and stops counting. */
export async function voidOrder(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "void" })
    .eq("id", id)
    .eq("status", "active")
    .select("id");
  if (error) {
    console.error("[voidOrder]", error);
    return { ok: false, message: `Could not void the ticket: ${error.message}` };
  }
  if (!data || data.length === 0) {
    return { ok: false, message: "Only today's active tickets can be voided." };
  }
  revalidatePath("/entry");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Admin only: remove a ticket for good. */
export async function deleteOrder(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("orders").delete().eq("id", id).select("id");
  if (error) {
    console.error("[deleteOrder]", error);
    return { ok: false, message: `Could not delete the ticket: ${error.message}` };
  }
  if (!data || data.length === 0) return { ok: false, message: "Ticket not found." };
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Ticket for reprint / edit. */
export async function getTicket(id: string): Promise<TicketPrintData | null> {
  const supabase = await createClient();
  return loadTicket(supabase, id);
}
