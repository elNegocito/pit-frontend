"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeName } from "@/lib/normalize";
import { todayInPit } from "@/lib/timezone";
import type { CodMethod, Payment } from "@/lib/types";

export interface EntryInput {
  date: string;
  materialId: string;
  truckNumber: string;
  ticketNumber: string;
  tons: number;
  customerName: string;
  payment: Payment;
  codMethod: CodMethod | null;
}

export type EntryResult =
  | { ok: true; ticket: string; gross: number }
  | { ok: false; field: string; message: string };

function fail(field: string, message: string): EntryResult {
  return { ok: false, field, message };
}

/**
 * Single write path for dispatches (operator + admin corrections use it).
 * - Validates every field server-side (client validation is UX only).
 * - Resolves the customer by normalized key, creating it when new.
 * - Lets the DB trigger compute the frozen gross (R1/R2/R4); the value
 *   returned comes from a re-read so the operator sees the stored truth.
 */
export async function createOrder(input: EntryInput): Promise<EntryResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return fail("date", "Invalid date.");
  }
  if (input.date > todayInPit()) {
    return fail("date", "Date cannot be in the future.");
  }
  const truck = input.truckNumber.trim();
  if (truck.length < 1 || truck.length > 40) {
    return fail("truckNumber", "Truck # is required (max 40 characters).");
  }
  const ticket = input.ticketNumber.trim();
  if (ticket.length < 1 || ticket.length > 40) {
    return fail("ticketNumber", "Ticket # is required (max 40 characters).");
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("form", "Session expired. Sign in again.");

  // Material must exist and be active (price is read by the DB trigger).
  const { data: material } = await supabase
    .from("materials")
    .select("id")
    .eq("id", input.materialId)
    .eq("active", true)
    .single();
  if (!material) return fail("materialId", "Select a valid material.");

  // Resolve-or-create customer on the normalized key.
  const key = normalizeName(customerName);
  let customerId: string | null = null;
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("name_key", key)
    .maybeSingle();
  if (existing) {
    customerId = existing.id;
  } else {
    const { data: created, error: createError } = await supabase
      .from("customers")
      .insert({ name: customerName })
      .select("id")
      .single();
    if (createError) {
      // Lost race with another session creating the same customer:
      // re-read instead of failing.
      const { data: raced } = await supabase
        .from("customers")
        .select("id")
        .eq("name_key", key)
        .maybeSingle();
      if (!raced) return fail("customerName", "Could not save customer. Try again.");
      customerId = raced.id;
    } else {
      customerId = created.id;
    }
  }

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      date: input.date,
      material_id: input.materialId,
      truck_number: truck,
      ticket_number: ticket,
      tons: input.tons,
      customer_id: customerId,
      payment: input.payment,
      cod_method: input.payment === "COD" ? input.codMethod : null,
      created_by: user.id,
    })
    .select("ticket_number, gross")
    .single();

  if (error) {
    // 23505 on orders_ticket_key_uidx (or customers_name_key): the ticket
    // transcription already exists — never silently double-count a load.
    if (error.code === "23505") {
      return fail("ticketNumber", `Ticket ${ticket} is already registered.`);
    }
    return fail("form", "Could not save the ticket. Try again.");
  }

  return { ok: true, ticket: order.ticket_number, gross: Number(order.gross) };
}
