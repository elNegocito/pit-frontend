"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { descriptions, quantities, validDate } from "./fields";

type Result = { error: string };
const path = "/trucking-production";
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function number(form: FormData, key: string, places: number, max: number, fallback: number | null, signed = false) {
  const value = text(form, key);
  if (!value) return fallback;
  const pattern = places ? `^${signed ? "-?" : ""}\\d+(?:\\.\\d{1,${places}})?$` : "^\\d+$";
  if (!new RegExp(pattern).test(value) || Math.abs(Number(value)) > max) {
    throw new Error(`Invalid value for ${key.replaceAll("_", " ")}.`);
  }
  return Number(value);
}

export async function saveProductionDay(_: Result, form: FormData): Promise<Result> {
  await requireAdmin();
  const work_date = text(form, "work_date");
  if (!validDate(work_date)) return { error: "Choose a valid work date." };
  try {
    const payload = {
      work_date,
      revenue_goal: number(form, "revenue_goal", 2, 9999999999, 0),
      ashgrove_rate: number(form, "ashgrove_rate", 4, 99999, 0),
      gp_rate: number(form, "gp_rate", 4, 99999, 0),
      shale_rate: number(form, "shale_rate", 4, 99999, 0),
    };
    const supabase = await createClient();
    const { error, data } = await supabase.from("trucking_production_days").upsert(payload).select("work_date").single();
    if (error || !data) return { error: "Could not save the production day." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the production day." };
  }
  revalidatePath(path);
  redirect(`${path}?month=${work_date.slice(0, 7)}&day=${work_date}`);
}

export async function saveProductionEntry(_: Result, form: FormData): Promise<Result> {
  await requireAdmin();
  const id = text(form, "id");
  const work_date = text(form, "work_date");
  if (!validDate(work_date) || (id && !uuid.test(id))) return { error: "Invalid production entry." };
  try {
    const supabase = await createClient();
    const table = supabase.from("trucking_production_entries");
    if (form.get("intent") === "delete") {
      if (!id) return { error: "Invalid production entry." };
      const { data, error } = await table.delete().eq("id", id).eq("work_date", work_date).select("id").single();
      if (error || !data) return { error: "Could not remove this entry." };
    } else {
      const labels = Object.fromEntries(descriptions.map(([key, label, max]) => {
        const value = text(form, key);
        if (value.length > max || (key === "truck" && !value)) throw new Error(`Check the ${label} field.`);
        return [key, value];
      }));
      const counts = Object.fromEntries(quantities.map(([key, , step]) =>
        [key, number(form, key, step === "1" ? 0 : 4, 9999999, 0)],
      ));
      const payload = {
        ...labels, ...counts, work_date,
        adjustment: number(form, "adjustment", 6, 9999999, 0, true),
        gross_override: number(form, "gross_override", 6, 9999999, null, true),
        driver_pay: number(form, "driver_pay", 2, 9999999, null),
      };
      const write = id ? table.update(payload).eq("id", id).eq("work_date", work_date) : table.insert(payload);
      const { data, error } = await write.select("id").single();
      if (error || !data) return { error: "Could not save this entry. Check that the production day exists." };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the entry." };
  }
  revalidatePath(path);
  redirect(`${path}?month=${work_date.slice(0, 7)}&day=${work_date}`);
}
