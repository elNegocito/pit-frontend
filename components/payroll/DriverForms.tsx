"use client";

import { useActionState } from "react";
import { createDriver, updateDriver, type FormState } from "@/lib/payroll/actions";
import { PAY_MODEL_KEYS, PAY_MODELS } from "@/lib/payroll/models";
import type { Driver } from "@/lib/payroll/types";

function ErrorLine({ state }: { state: FormState }) {
  if (!state) return null;
  return <p className="mt-2 text-sm text-red-600">{state}</p>;
}

function Fields({ driver }: { driver?: Driver }) {
  return (
    <>
      <label className="min-w-48 flex-1 text-sm font-medium">
        {driver ? "Name" : "New driver"}
        <input name="name" defaultValue={driver?.name} required maxLength={120} placeholder="FULL NAME" className="mt-1 w-full rounded-lg border px-3 py-2 uppercase" />
      </label>
      <label className="text-sm font-medium">
        Drives
        <select name="payModel" required defaultValue={driver?.pay_model ?? ""} className="mt-1 w-full rounded-lg border px-3 py-2">
          <option value="" disabled>
            Select…
          </option>
          {PAY_MODEL_KEYS.map((k) => (
            <option key={k} value={k}>
              {PAY_MODELS[k].label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium">
        Truck #
        <input name="truck" defaultValue={driver?.truck_number ?? ""} maxLength={40} className="mt-1 w-24 rounded-lg border px-3 py-2" />
      </label>
      <label className="text-sm font-medium">
        Phone (WhatsApp)
        <input name="phone" type="tel" defaultValue={driver?.phone ?? ""} maxLength={30} placeholder="817-555-0100" className="mt-1 w-40 rounded-lg border px-3 py-2" />
      </label>
      <label className="text-sm font-medium">
        Email
        <input name="email" type="email" defaultValue={driver?.email ?? ""} maxLength={120} className="mt-1 w-52 rounded-lg border px-3 py-2" />
      </label>
    </>
  );
}

export function DriverCreateForm() {
  const [state, action, pending] = useActionState(createDriver, null);
  return (
    <form action={action} className="rounded-2xl bg-white p-4 shadow">
      <div className="flex flex-wrap items-end gap-3">
        <Fields />
        <button disabled={pending} className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
          Add
        </button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

export function DriverRowForm({ driver }: { driver: Driver }) {
  const [state, action, pending] = useActionState(updateDriver, null);
  return (
    <form action={action} className="rounded-2xl bg-white p-4 shadow">
      <div className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={driver.id} />
        <Fields driver={driver} />
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={driver.active} className="h-4 w-4" />
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
