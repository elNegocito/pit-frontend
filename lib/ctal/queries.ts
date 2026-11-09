import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CARRIER_SELECT, CUSTOMER_SELECT, LOAD_SELECT, toCustomer, toLoad, WEEK_SELECT, type Carrier, type Load, type Week } from "./types";

type Client = Awaited<ReturnType<typeof createClient>>;

/** A week and its log rows in sheet order. 404 when the week does not exist. */
export async function loadWeek(supabase: Client, id: string): Promise<{ week: Week; loads: Load[] }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: week }, { data: loads }] = await Promise.all([
    supabase.from("ctal_weeks").select(WEEK_SELECT).eq("id", id).maybeSingle(),
    supabase.from("ctal_loads").select(LOAD_SELECT).eq("week_id", id).order("position").order("created_at").limit(2000),
  ]);
  if (!week) notFound();
  return { week: week as Week, loads: (loads ?? []).map(toLoad) };
}

export async function loadCarriers(supabase: Client): Promise<Carrier[]> {
  const { data } = await supabase.from("ctal_carriers").select(CARRIER_SELECT).order("name");
  return (data ?? []) as Carrier[];
}

export async function loadCustomers(supabase: Client) {
  const { data } = await supabase.from("ctal_customers").select(CUSTOMER_SELECT).order("name");
  return (data ?? []).map(toCustomer);
}
