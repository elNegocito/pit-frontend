"use client";

import { useActionState } from "react";
import {
  createMaterial,
  mergeCustomers,
  renameCustomer,
  updateMaterial,
  type FormState,
} from "@/lib/catalogs/actions";
import type { Customer, Material } from "@/lib/types";

function ErrorLine({ state }: { state: FormState }) {
  if (!state) return null;
  return <p className="mt-2 text-sm text-red-600">{state}</p>;
}

export function MaterialCreateForm() {
  const [state, action, pending] = useActionState(createMaterial, null);
  return (
    <form action={action} className="rounded-2xl bg-white p-4 shadow">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 text-sm font-medium">
          New material
          <input name="name" required maxLength={120} placeholder="e.g. ROAD BASE" className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="text-sm font-medium">
          $ / ton
          <input name="price" required type="number" min="0" step="0.01" placeholder="0.00" className="mt-1 w-32 rounded-lg border px-3 py-2" />
        </label>
        <button disabled={pending} className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
          Add
        </button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

export function MaterialRowForm({ material }: { material: Material }) {
  const [state, action, pending] = useActionState(updateMaterial, null);
  return (
    <form action={action} className="rounded-2xl bg-white p-4 shadow">
      <div className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={material.id} />
        <label className="flex-1 text-sm font-medium">
          Name
          <input name="name" defaultValue={material.name} required maxLength={120} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="text-sm font-medium">
          $ / ton
          <input name="price" type="number" min="0" step="0.01" defaultValue={Number(material.price_per_ton)} className="mt-1 w-32 rounded-lg border px-3 py-2" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={material.active} className="h-4 w-4" />
          Active
        </label>
        <button disabled={pending} className="rounded-lg border px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50">
          Save
        </button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

export function CustomerMergeForm({ customers }: { customers: Customer[] }) {
  const [state, action, pending] = useActionState(mergeCustomers, null);
  return (
    <form action={action} className="rounded-2xl bg-white p-4 shadow">
      <h2 className="text-sm font-semibold">Merge duplicates</h2>
      <p className="text-xs text-zinc-500">Moves all orders from source into target, then deletes source.</p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <label className="flex-1 text-sm">
          Source (duplicate)
          <select name="sourceId" required defaultValue="" className="mt-1 w-full rounded-lg border px-3 py-2">
            <option value="" disabled>Select…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="flex-1 text-sm">
          Target (keep)
          <select name="targetId" required defaultValue="" className="mt-1 w-full rounded-lg border px-3 py-2">
            <option value="" disabled>Select…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <button disabled={pending} className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
          Merge
        </button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

export function CustomerRenameForm({ customer }: { customer: Customer }) {
  const [state, action, pending] = useActionState(renameCustomer, null);
  return (
    <form action={action} className="flex items-end gap-3 rounded-2xl bg-white p-4 shadow">
      <input type="hidden" name="id" value={customer.id} />
      <label className="flex-1 text-sm font-medium">
        <input name="name" defaultValue={customer.name} required maxLength={120} className="w-full rounded-lg border px-3 py-2" />
      </label>
      <button disabled={pending} className="rounded-lg border px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50">
        Rename
      </button>
      <ErrorLine state={state} />
    </form>
  );
}
