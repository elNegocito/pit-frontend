import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listAssets } from "@/lib/roll-off/queries";
import { catalogs, type Catalog } from "@/lib/roll-off/types";
import { AssetForm } from "../forms";

export default async function RollOffCatalogPage({ searchParams }: PageProps<"/roll-off/catalogs">) {
  await requireAdmin();
  const { catalog } = await searchParams;
  const kind = (Object.keys(catalogs) as Catalog[]).find((item) => item === catalog) ?? "containers";
  const config = catalogs[kind];
  const db = await createClient();
  const assets = await listAssets(db, kind);

  return (
    <>
      <h1 className="text-2xl font-semibold">Roll-off inventory and catalogs</h1>
      <nav className="flex flex-wrap gap-3 text-sm" aria-label="Catalogs">
        {Object.entries(catalogs).map(([key, item]) => <Link key={key} aria-current={key === kind ? "page" : undefined} className={`rounded-lg border px-3 py-2 ${key === kind ? "bg-zinc-900 text-white" : "bg-white"}`} href={`?catalog=${key}`}>{item.label}</Link>)}
      </nav>
      <details className="rounded-xl border bg-white p-4" key={kind}>
        <summary className="cursor-pointer font-semibold">Add {config.name.replace(" #", "").toLowerCase()}</summary>
        <AssetForm kind={kind} />
      </details>
      {!assets.length && <p className="rounded-xl border bg-white p-4 text-sm">No {config.label.toLowerCase()} registered yet.</p>}
      {assets.map((asset) => (
        <details key={asset.id} className="rounded-xl border bg-white p-4">
          <summary className="cursor-pointer text-sm">
            <strong>{asset[config.key]}</strong> · {asset.availability ?? (asset.active ? "Active" : "Inactive")}
            {asset.size_yards && ` · ${asset.size_yards} yd³`}
            {(asset.current_location || asset[config.detail]) && ` · ${asset.current_location || asset[config.detail]}`}
            {asset.expected_available_on && ` · Expected back ${asset.expected_available_on}`}
            {asset.last_return_on && ` · Last return ${asset.last_return_on}`}
          </summary>
          {asset.order_id && <p className="mt-2 text-sm">Linked order: <Link href={`/roll-off/orders/${asset.order_id}`} className="text-blue-700 underline">{asset.order_number}</Link></p>}
          <AssetForm kind={kind} asset={asset} />
        </details>
      ))}
    </>
  );
}
