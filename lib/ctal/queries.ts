import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CARRIER_SELECT, CUSTOMER_SELECT, LOAD_SELECT, toCustomer, toLoad, WEEK_SELECT, type Carrier, type Load, type Week } from "./types";

type Client = Awaited<ReturnType<typeof createClient>>;

/** A week and its log rows in sheet order. 404 when the week does not exist. */
export async function loadWeek(supabase: Client, id: string): Promise<{ week: Week; loads: Load[] }> {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) notFound();
  const { data: week, error: weekError } = await supabase.from("ctal_weeks").select(WEEK_SELECT).eq("id", id).maybeSingle();
  if (weekError) throw new Error("The CTAL week could not be loaded.", { cause: weekError });
  if (!week) notFound();
  const loads: Load[] = [];
  // The API caps each response. Stop only at an empty page, even if that cap
  // is lower on another environment.
  for (const pageSize = 1000; ;) {
    const { data, error } = await supabase.from("ctal_loads").select(LOAD_SELECT).eq("week_id", id)
      .order("position").order("created_at").order("id").range(loads.length, loads.length + pageSize - 1);
    if (error) throw new Error("The CTAL log could not be loaded.", { cause: error });
    if (!data.length) break;
    loads.push(...data.map(toLoad));
  }
  return { week: week as Week, loads };
}

export async function loadCarriers(supabase: Client): Promise<Carrier[]> {
  const { data } = await supabase.from("ctal_carriers").select(CARRIER_SELECT).order("name");
  return (data ?? []) as Carrier[];
}

export async function loadCustomers(supabase: Client) {
  const { data } = await supabase.from("ctal_customers").select(CUSTOMER_SELECT).order("name");
  return (data ?? []).map(toCustomer);
}
