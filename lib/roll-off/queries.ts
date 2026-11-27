import type { createClient } from "@/lib/supabase/server";
import { catalogs, type Asset, type Catalog } from "./types";

export async function listAssets(db: Awaited<ReturnType<typeof createClient>>, kind: Catalog, forOrder = false) {
  const config = catalogs[kind];
  const view = kind === "containers" ? "roll_off_inventory" : config.table;
  const result: Asset[] = [];
  const batchSize = 200;
  for (let offset = 0; ; offset += batchSize) {
    const columns = !forOrder ? "*" : kind === "containers" ?
      "id, active, container_number, size_yards, availability, order_id" : `id, active, ${config.key}`;
    const { data, error } = await db.from(view).select(columns)
      .order(config.key).order("id").range(offset, offset + batchSize - 1).returns<Asset[]>();
    if (error) throw new Error(`Could not load the ${kind} catalog.`);
    result.push(...data);
    if (data.length < batchSize) return result;
  }
}
