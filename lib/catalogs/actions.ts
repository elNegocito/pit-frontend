"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

/** useActionState contract: returns an error message, or null on success. */
export type FormState = string | null;

async function admin() {
  await requireAdmin();
  return createClient();
}

export async function createMaterial(_prev: FormState, form: FormData): Promise<FormState> {
  const supabase = await admin();
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  const price = Number(form.get("price"));
  if (name.length < 1 || name.length > 120) return "Name required (max 120).";
  if (!Number.isFinite(price) || price < 0) return "Price must be >= 0.";
  const { error } = await supabase.from("materials").insert({ name, price_per_ton: Math.round(price * 100) / 100 });
  if (error) {
    if (error.code === "23505") return `Material "${name}" already exists.`;
    return "Could not create material.";
  }
  revalidatePath("/materials");
  return null;
}

export async function updateMaterial(_prev: FormState, form: FormData): Promise<FormState> {
  const supabase = await admin();
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  const price = Number(form.get("price"));
  const active = form.get("active") === "on";
  if (!id) return "Missing id.";
  if (name.length < 1 || name.length > 120) return "Name required (max 120).";
  if (!Number.isFinite(price) || price < 0) return "Price must be >= 0.";
  // Note: price changes apply to future dispatches only (orders freeze gross).
  const { error } = await supabase
    .from("materials")
    .update({ name, price_per_ton: Math.round(price * 100) / 100, active })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return `Material "${name}" already exists.`;
    return "Could not update material.";
  }
  revalidatePath("/materials");
  return null;
}

export async function renameCustomer(_prev: FormState, form: FormData): Promise<FormState> {
  const supabase = await admin();
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (!id) return "Missing id.";
  if (name.length < 1 || name.length > 120) return "Name required (max 120).";
  const { error } = await supabase.from("customers").update({ name }).eq("id", id);
  if (error) {
    if (error.code === "23505") return "That name already exists — use Merge instead.";
    return "Could not rename customer.";
  }
  revalidatePath("/customers");
  return null;
}

export async function mergeCustomers(_prev: FormState, form: FormData): Promise<FormState> {
  const supabase = await admin();
  const sourceId = String(form.get("sourceId") ?? "");
  const targetId = String(form.get("targetId") ?? "");
  if (!sourceId || !targetId || sourceId === targetId) {
    return "Pick two different customers.";
  }
  // Move history first, then remove the duplicate. Orders keep correct totals
  // because they reference the surviving customer id.
  const { error: moveError } = await supabase
    .from("orders")
    .update({ customer_id: targetId })
    .eq("customer_id", sourceId);
  if (moveError) return "Could not move orders.";
  const { error: delError } = await supabase.from("customers").delete().eq("id", sourceId);
  if (delError) return "Could not remove duplicate.";
  revalidatePath("/customers");
  return null;
}
