"use client";

import { startTransition, useActionState, useState, type ComponentProps } from "react";
import { saveRollOffAsset, saveRollOffOrder } from "@/lib/roll-off/actions";
import { catalogs, dispatchStatuses, services, sizes, type Asset, type Catalog, type DispatchOrder } from "@/lib/roll-off/types";

const input = "block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2";
const button = "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50";

function Input({ label, ...props }: ComponentProps<"input"> & { label: string }) {
  return <label>{label}<input {...props} className={input} /></label>;
}

function Pick({ label, children, ...props }: ComponentProps<"select"> & { label: string }) {
  return <label>{label}<select {...props} className={input}>{children}</select></label>;
}

function Feedback({ error, saved }: { error: string; saved?: number }) {
  if (error) return <p role="alert" className="text-red-700">{error}</p>;
  if (saved) return <p role="status" className="text-green-800">Saved.</p>;
  return null;
}

export function OrderForm({ order, assets, today }: {
  order?: DispatchOrder;
  assets: Record<Catalog, Asset[]>;
  today: string;
}) {
  const [state, action, pending] = useActionState(saveRollOffOrder, { error: "" });
  const [size, setSize] = useState(String(order?.size_yards ?? ""));
  const containers = assets.containers.filter((item) => item.id === order?.container_id || (item.active && item.availability === "Available"));
  return (
    <form action={action} onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      startTransition(() => action(data));
    }} className="space-y-4 rounded-xl border bg-white p-4 text-sm">
      {order && <input type="hidden" name="id" value={order.id} />}
      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-2 font-semibold">Order and job site</legend>
        <Input label="Order #" name="order_number" maxLength={80} defaultValue={order?.order_number} required />
        <Input label="Order date" name="order_date" type="date" defaultValue={order?.order_date ?? today} required />
        <Pick label="Service" name="service" defaultValue={order?.service ?? services[0]}>{services.map((item) => <option key={item}>{item}</option>)}</Pick>
        <Input label="Customer" name="customer" maxLength={120} defaultValue={order?.customer} required />
        <Input label="Phone" name="phone" type="tel" maxLength={40} defaultValue={order?.phone} />
        <Input label="Job address" name="address" maxLength={300} defaultValue={order?.address} required />
        <Input label="Reference / PO" name="reference" maxLength={120} defaultValue={order?.reference} />
        <Input label="Charge ($)" name="charge" type="number" min="0" max="9999999999.99" step=".01" defaultValue={order?.charge ?? ""} />
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-2 font-semibold">Dispatch and assignment</legend>
        <Input label="Scheduled service date" name="scheduled_date" type="date" defaultValue={order?.scheduled_date ?? ""} />
        <Pick label="Truck" name="truck_id" defaultValue={order?.truck_id ?? ""}>
          <option value="">Not assigned</option>{assets.trucks.filter((item) => item.active || item.id === order?.truck_id).map((item) => <option key={item.id} value={item.id}>{item.truck_number}{!item.active && " (inactive)"}</option>)}
        </Pick>
        <Pick label="Driver" name="driver_id" defaultValue={order?.driver_id ?? ""}>
          <option value="">Not assigned</option>{assets.drivers.filter((item) => item.active || item.id === order?.driver_id).map((item) => <option key={item.id} value={item.id}>{item.name}{!item.active && " (inactive)"}</option>)}
        </Pick>
        <Pick label="Dispatch status" name="dispatch_status" defaultValue={order?.dispatch_status ?? dispatchStatuses[0]}>{dispatchStatuses.map((item) => <option key={item}>{item}</option>)}</Pick>
        <label className="sm:col-span-2">Driver instructions<textarea className={input} rows={2} name="instructions" maxLength={2000} defaultValue={order?.instructions} /></label>
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-2 font-semibold">Container and rental tracking</legend>
        <Pick label="Container" name="container_id" defaultValue={order?.container_id ?? ""} onChange={(event) => {
          const selected = containers.find((item) => item.id === event.target.value);
          if (selected?.size_yards) setSize(String(selected.size_yards));
        }}>
          <option value="">Not assigned</option>{containers.map((item) => <option key={item.id} value={item.id}>{item.container_number} · {item.size_yards} yd³{!item.active && " (inactive)"}</option>)}
        </Pick>
        <Pick label="Size (yd³)" name="size_yards" value={size} onChange={(event) => setSize(event.target.value)} required>
          <option value="">Choose a size</option>{sizes.map((item) => <option key={item} value={item}>{item}</option>)}
        </Pick>
        <Input label="Contracted days" name="rental_days" type="number" min="1" max="3650" defaultValue={order?.rental_days ?? ""} />
        <Input label="Actual delivery date" name="delivered_on" type="date" defaultValue={order?.delivered_on ?? ""} />
        <Input label="Actual pickup date" name="picked_up_on" type="date" defaultValue={order?.picked_up_on ?? ""} />
        <div className="self-center text-zinc-600">Pickup due = actual delivery + contracted days.</div>
      </fieldset>
      <label className="block">Internal notes (not printed)<textarea className={input} name="notes" rows={2} maxLength={2000} defaultValue={order?.notes} /></label>
      <Feedback error={state.error} />
      <button className={button} disabled={pending}>{pending ? "Saving…" : order ? "Save work order" : "Create work order"}</button>
    </form>
  );
}

export function AssetForm({ kind, asset }: { kind: Catalog; asset?: Asset }) {
  const [state, action, pending] = useActionState(saveRollOffAsset, { error: "" });
  const config = catalogs[kind];
  return (
    <form action={action} key={asset ? asset.id : state.saved} onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      startTransition(() => action(data));
    }} className="space-y-3 pt-3 text-sm">
      <input type="hidden" name="kind" value={kind} />
      {asset && <input type="hidden" name="id" value={asset.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input label={config.name} name={config.key} maxLength={kind === "drivers" ? 120 : 80} defaultValue={asset?.[config.key]} required />
        <Input label={config.detailLabel} name={config.detail} maxLength={120} defaultValue={asset?.[config.detail]} />
        {kind === "containers" && <Pick label="Size (yd³)" name="size_yards" defaultValue={asset?.size_yards ?? ""} required>
          <option value="">Choose a size</option>{sizes.map((size) => <option key={size}>{size}</option>)}
        </Pick>}
        <Input label={kind === "drivers" ? "License / notes" : kind === "trucks" ? "Type / capacity / notes" : "Notes"} name="notes" maxLength={1000} defaultValue={asset?.notes} />
      </div>
      <label className="flex items-center gap-2"><input name="active" type="checkbox" defaultChecked={asset?.active ?? true} />Active</label>
      <Feedback error={state.error} saved={state.saved} />
      <button className={button} disabled={pending}>{pending ? "Saving…" : asset ? "Save asset" : "Add asset"}</button>
    </form>
  );
}
