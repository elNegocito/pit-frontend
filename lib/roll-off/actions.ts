"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { catalogs, dispatchStatuses, services, sizes, uuid, validDate, type Catalog } from "./types";

type Result = { error: string; saved?: number };

function field(form: FormData, key: string, max = 120) {
  const value = form.get(key);
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > max) throw new Error(`${key.replaceAll("_", " ")} is too long.`);
  return text;
}

function required(form: FormData, key: string, max?: number) {
  const value = field(form, key, max);
  if (!value) throw new Error(`${key.replaceAll("_", " ")} is required.`);
  return value;
}

function date(form: FormData, key: string, mandatory = false) {
  const value = field(form, key);
  if (!value && !mandatory) return null;
  if (!validDate(value)) throw new Error(`Choose a valid ${key.replaceAll("_", " ")}.`);
  return value;
}

function idField(form: FormData, key: string) {
  const value = field(form, key);
  if (value && !uuid.test(value)) throw new Error(`Invalid ${key.replaceAll("_id", " selection")}.`);
  return value || null;
}

function choice<T extends string | number>(choices: readonly T[], value: unknown, label: string): T {
  const matched = choices.find((item) => item === value);
  if (matched === undefined) throw new Error(`Choose a valid ${label}.`);
  return matched;
}

export async function saveRollOffOrder(_: Result, form: FormData): Promise<Result> {
  await requireAdmin();
  let id: string | null;
  try {
    id = idField(form, "id");
    const rentalDays = field(form, "rental_days");
    if (rentalDays && (!/^\d{1,4}$/.test(rentalDays) || +rentalDays < 1 || +rentalDays > 3650)) {
      throw new Error("Rental days must be between 1 and 3650.");
    }
    const charge = field(form, "charge");
    if (charge && !/^\d{1,10}(\.\d{1,2})?$/.test(charge)) throw new Error("Enter a valid charge.");
    const delivered = date(form, "delivered_on");
    const pickedUp = date(form, "picked_up_on");
    if (pickedUp && delivered && pickedUp < delivered) throw new Error("Pickup cannot be before delivery.");
    const truck = idField(form, "truck_id");
    const driver = idField(form, "driver_id");
    const status = choice(dispatchStatuses, field(form, "dispatch_status"), "dispatch status");
    if ((status === "Assigned" || status === "En route") && (!truck || !driver)) {
      throw new Error("Assign both a truck and driver before marking the order assigned or en route.");
    }
    const container = idField(form, "container_id");
    const db = await createClient();
    const table = db.from("roll_off_orders");
    if (container || truck || driver) {
      const old = id ? await table.select("container_id, truck_id, driver_id").eq("id", id).single() : undefined;
      if (old?.error) return { error: "This order could not be found." };
      const selections = [
        ["roll_off_containers", container, old?.data?.container_id, "container"],
        ["roll_off_trucks", truck, old?.data?.truck_id, "truck"],
        ["roll_off_drivers", driver, old?.data?.driver_id, "driver"],
      ] as const;
      const checks = await Promise.all(selections.map(async ([name, selection, previous, label]) => {
        if (!selection || selection === previous) return null;
        const asset = await db.from(name).select("id").eq("id", selection).eq("active", true).maybeSingle();
        return asset.data ? null : label;
      }));
      const invalid = checks.find(Boolean);
      if (invalid) return { error: `Select an active ${invalid}.` };
    }
    const payload = {
      order_number: required(form, "order_number", 80),
      order_date: date(form, "order_date", true),
      scheduled_date: date(form, "scheduled_date"),
      customer: required(form, "customer"),
      phone: field(form, "phone", 40),
      address: required(form, "address", 300),
      service: choice(services, field(form, "service"), "service"),
      container_id: container,
      size_yards: choice(sizes, Number(field(form, "size_yards")), "container size"),
      delivered_on: delivered,
      picked_up_on: pickedUp,
      rental_days: rentalDays ? Number(rentalDays) : null,
      truck_id: truck,
      driver_id: driver,
      instructions: field(form, "instructions", 2000),
      dispatch_status: status,
      notes: field(form, "notes", 2000),
      charge: charge || null,
      reference: field(form, "reference"),
    };
    const write = id ? table.update(payload).eq("id", id) : table.insert(payload);
    const { data, error } = await write.select("id").single();
    if (error?.code === "23505") {
      return { error: error.message.includes("roll_off_one_open_order_per_container") ?
        "This container already has an open order. Record its pickup or cancel that order before reassigning it." :
        "This order number already exists." };
    }
    if (error?.code === "23503") return { error: "Check the selected assets and that the container size matches the inventory." };
    if (error || !data) return { error: "Could not save the order. Refresh and try again." };
    id = data.id;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the order." };
  }
  revalidatePath("/roll-off");
  revalidatePath(`/roll-off/orders/${id}`);
  revalidatePath(`/roll-off/orders/${id}/ticket`);
  revalidatePath("/roll-off/catalogs");
  redirect(`/roll-off/orders/${id}?saved=1`);
}

export async function saveRollOffAsset(_: Result, form: FormData): Promise<Result> {
  await requireAdmin();
  try {
    const id = idField(form, "id");
    const kind = choice(Object.keys(catalogs) as Catalog[], field(form, "kind"), "catalog");
    const config = catalogs[kind];
    const payload = {
      [config.key]: required(form, config.key, kind === "drivers" ? 120 : 80),
      [config.detail]: field(form, config.detail, 120),
      notes: field(form, "notes", 1000),
      active: form.get("active") === "on",
      ...(kind === "containers" ? { size_yards: choice(sizes, Number(field(form, "size_yards")), "container size") } : {}),
    };
    const db = await createClient();
    const table = db.from(config.table);
    const { data, error } = await (id ? table.update(payload).eq("id", id) : table.insert(payload)).select("id").single();
    if (error?.code === "23505") return { error: "That asset number already exists." };
    if (error?.code === "23503") return { error: "Container size cannot change while an order references it." };
    if (error || !data) return { error: "Could not save this catalog entry." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the asset." };
  }
  revalidatePath("/roll-off", "layout");
  return { error: "", saved: Date.now() };
}
