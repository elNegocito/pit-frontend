"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePayroll } from "@/lib/auth";
import { DAYS, isPayModel } from "./models";
import { isFilledLoad, type SheetInput } from "./compute";

/** useActionState contract: returns an error message, or null on success. */
export type FormState = string | null;

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; message: string; duplicateOf?: { id: string; number: number } };

const MAX_LOADS = 60;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** Validates + cleans the form payload. The DB recomputes every total. */
function clean(input: SheetInput) {
  if (!input.driverId) return "Select a driver.";
  if (!isPayModel(input.payModel)) return "Select a pay model.";
  if (!ISO_DATE.test(input.payDate)) return "Pay date is required.";
  if (!finite(input.revenuePct) || input.revenuePct < 0 || input.revenuePct > 100) return "Revenue % must be between 0 and 100.";
  if (!finite(input.hourlyRate) || input.hourlyRate < 0) return "Hourly rate must be 0 or more.";
  if (input.otRate !== null && (!finite(input.otRate) || input.otRate < 0)) return "Overtime rate must be 0 or more.";
  if (!finite(input.otThreshold) || input.otThreshold < 0) return "Overtime threshold must be 0 or more.";

  const loads = input.loads.filter(isFilledLoad);
  if (loads.length > MAX_LOADS) return `At most ${MAX_LOADS} loads per sheet.`;
  for (const [i, l] of loads.entries()) {
    if (l.date && !ISO_DATE.test(l.date)) return `Load ${i + 1}: invalid date.`;
    if (!finite(l.revenue) || l.revenue < 0) return `Load ${i + 1}: revenue must be 0 or more.`;
  }
  const hours = input.hours.filter((h) => DAYS.includes(h.day));
  for (const h of hours) {
    if (!finite(h.hours) || h.hours < 0 || h.hours > 24) return `${h.day}: hours must be between 0 and 24.`;
  }
  const adjustments = input.adjustments.filter((a) => a.label.trim() || a.amount);
  for (const a of adjustments) {
    if (!finite(a.amount)) return `"${a.label}": invalid amount.`;
  }

  return {
    truck_number: text(input.truckNumber, 40) || null,
    pay_model: input.payModel,
    pay_date: input.payDate,
    notes: text(input.notes, 1000) || null,
    revenue_pct: input.revenuePct,
    hourly_rate: input.hourlyRate,
    ot_rate: input.otRate,
    ot_threshold: input.otThreshold,
    loads: loads.map((l) => ({
      date: l.date,
      // 4 decimals like the Excel cell (formula revenue); totals round to cents.
      revenue: Math.round(l.revenue * 10000) / 10000,
      load_number: text(l.load_number, 40),
      company: text(l.company, 120),
      extra: text(l.extra, 40),
    })),
    hours: hours.map((h) => ({ day: h.day, hours: h.hours, note: text(h.note, 120) })),
    adjustments: adjustments.map((a) => ({
      label: text(a.label, 80).toUpperCase(),
      amount: Math.round(a.amount * 100) / 100,
      deduction: Boolean(a.deduction),
    })),
  };
}

/**
 * Creates (id = null) or updates a pay sheet. `expectedUpdatedAt` guards
 * against two payroll users overwriting each other: the update only applies
 * when the sheet was not saved by someone else since it was opened.
 * A second active sheet for the same driver + pay date is refused unless
 * `force` (the usual mistake is paying the same week twice).
 */
export async function savePaySheet(
  id: string | null,
  input: SheetInput,
  expectedUpdatedAt: string | null,
  force = false,
): Promise<SaveResult> {
  await requirePayroll();
  const row = clean(input);
  if (typeof row === "string") return { ok: false, message: row };

  const supabase = await createClient();
  const { data: driver } = await supabase
    .from("drivers")
    .select("id, name")
    .eq("id", input.driverId)
    .maybeSingle();
  if (!driver) return { ok: false, message: "Driver not found." };
  const payload = { ...row, driver_id: driver.id, driver_name: driver.name };

  if (!force) {
    let dup = supabase
      .from("pay_sheets")
      .select("id, sheet_number")
      .eq("driver_id", driver.id)
      .eq("pay_date", row.pay_date)
      .eq("status", "active")
      .limit(1);
    if (id) dup = dup.neq("id", id);
    const { data: existing } = await dup.maybeSingle();
    if (existing) {
      return {
        ok: false,
        message: "Duplicate pay date.",
        duplicateOf: { id: existing.id, number: Number(existing.sheet_number) },
      };
    }
  }

  if (id === null) {
    const { data, error } = await supabase.from("pay_sheets").insert(payload).select("id").single();
    if (error) return { ok: false, message: `Could not save the pay sheet: ${error.message}` };
    revalidatePath("/payroll");
    return { ok: true, id: data.id };
  }

  let q = supabase.from("pay_sheets").update(payload).eq("id", id).eq("status", "active");
  if (expectedUpdatedAt) q = q.eq("updated_at", expectedUpdatedAt);
  const { data, error } = await q.select("id");
  if (error) return { ok: false, message: `Could not save the pay sheet: ${error.message}` };
  if (!data || data.length === 0) {
    const { data: now } = await supabase
      .from("pay_sheets")
      .select("status, updated_by_name")
      .eq("id", id)
      .maybeSingle();
    if (!now) return { ok: false, message: "Pay sheet not found." };
    if (now.status === "void") return { ok: false, message: "This pay sheet is void and cannot be edited." };
    return {
      ok: false,
      message: `${now.updated_by_name ?? "Someone"} saved this sheet while you were editing. Reload the page to see their changes, then edit again.`,
    };
  }
  revalidatePath("/payroll");
  revalidatePath(`/payroll/${id}`);
  return { ok: true, id };
}

/** Void instead of delete: the sheet stays (marked VOID) with its history. */
export async function voidPaySheet(id: string): Promise<SaveResult> {
  await requirePayroll();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pay_sheets")
    .update({ status: "void" })
    .eq("id", id)
    .eq("status", "active")
    .select("id");
  if (error) return { ok: false, message: `Could not void the pay sheet: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, message: "Pay sheet not found or already void." };
  revalidatePath("/payroll");
  revalidatePath(`/payroll/${id}`);
  return { ok: true, id };
}

// ---------------------------------------------------------------- drivers

function parseDriver(form: FormData) {
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  const payModel = String(form.get("payModel") ?? "");
  const truck = text(form.get("truck"), 40);
  const phone = text(form.get("phone"), 30);
  const email = text(form.get("email"), 120).toLowerCase();
  if (name.length < 1 || name.length > 120) return "Driver name required (max 120).";
  if (!isPayModel(payModel)) return "Select what the driver drives.";
  if (phone && phone.replace(/\D/g, "").length < 10) return "Phone needs at least 10 digits.";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email.";
  return { name, pay_model: payModel, truck_number: truck || null, phone: phone || null, email: email || null };
}

function driverError(error: { code?: string }, name: string): string {
  if (error.code === "23505") return `Driver "${name}" already exists.`;
  return "Could not save driver.";
}

export async function createDriver(_prev: FormState, form: FormData): Promise<FormState> {
  await requirePayroll();
  const parsed = parseDriver(form);
  if (typeof parsed === "string") return parsed;
  const supabase = await createClient();
  const { error } = await supabase.from("drivers").insert(parsed);
  if (error) return driverError(error, parsed.name);
  revalidatePath("/payroll/drivers");
  return null;
}

export async function updateDriver(_prev: FormState, form: FormData): Promise<FormState> {
  await requirePayroll();
  const id = String(form.get("id") ?? "");
  if (!id) return "Missing id.";
  const parsed = parseDriver(form);
  if (typeof parsed === "string") return parsed;
  const supabase = await createClient();
  // Saved sheets keep the name / truck they were made with.
  const { error } = await supabase
    .from("drivers")
    .update({ ...parsed, active: form.get("active") === "on" })
    .eq("id", id);
  if (error) return driverError(error, parsed.name);
  revalidatePath("/payroll/drivers");
  return null;
}
