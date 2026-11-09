"use client";

import { useActionState, useState } from "react";
import { saveCarrier } from "@/lib/ctal/actions";
import type { Carrier } from "@/lib/ctal/types";
import { btnPrimary, input, label } from "@/lib/ctal/ui";
import { Combobox } from "./Combobox";

export function CarrierForm({ carrier, cities, nextNumber }: { carrier?: Carrier; cities: string[]; nextNumber?: number }) {
  const [savedAt, setSavedAt] = useState(0);
  const [state, action, pending] = useActionState(async (prev: string | null, form: FormData) => {
    const res = await saveCarrier(prev, form);
    setSavedAt(res === null ? Date.now() : 0);
    return res;
  }, null);
  const [city, setCity] = useState(carrier?.hub_city ?? "");
  const f = (name: keyof Carrier) => ({ name, defaultValue: (carrier?.[name] as string | null) ?? "", className: `${input} mt-1` });

  return (
    <form action={action} className="space-y-5" onChange={() => setSavedAt(0)}>
      {carrier && <input type="hidden" name="id" value={carrier.id} />}
      <div className="grid gap-4 sm:grid-cols-6">
        <label className={`${label} sm:col-span-1`}>
          Carrier #
          <input name="carrier_number" type="number" min="1" max="999999" defaultValue={carrier?.carrier_number} placeholder={nextNumber ? String(nextNumber) : undefined} className={`${input} mt-1 tabular-nums`} />
        </label>
        <label className={`${label} sm:col-span-3`}>
          Carrier name
          <input {...f("name")} required maxLength={120} className={`${input} mt-1 uppercase`} autoFocus={!carrier} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Pay term
          <select name="pay_term" defaultValue={carrier?.pay_term ?? "QP"} className={`${input} mt-1`}>
            <option value="QP">QP: quick pay, 3.5% fee</option>
            <option value="28">28 days, no quick pay fee</option>
          </select>
        </label>

        <label className={`${label} sm:col-span-3`}>
          Dispatch contact
          <input {...f("dispatch_contact")} maxLength={120} placeholder="Name and phone" />
        </label>
        <label className={`${label} sm:col-span-3`}>
          Owner
          <input {...f("owner")} maxLength={120} placeholder="Name and phone" />
        </label>
        <label className={`${label} sm:col-span-6`}>
          Driver, truck, equipment
          <input {...f("equipment")} maxLength={200} placeholder="Driver, truck number, trailer type" />
        </label>

        <label className={`${label} sm:col-span-2`}>
          Insurance expires
          <input {...f("ins_exp")} type="date" />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Insurance note
          <input {...f("ins_note")} maxLength={60} placeholder="CONTACTED" />
        </label>
        <label className={`${label} sm:col-span-2`}>
          USDOT #
          <input {...f("usdot")} maxLength={20} inputMode="numeric" className={`${input} mt-1 tabular-nums`} />
        </label>

        <label className={`${label} sm:col-span-2`}>
          Hub city
          <span className="mt-1 block">
            <Combobox name="hub_city" value={city} options={cities.map((c) => ({ value: c, label: c }))} onChange={(text) => setCity(text)} emptyText="New city" className={input} />
          </span>
        </label>
        <label className={`${label} sm:col-span-2`}>
          Email for statements
          <input {...f("email")} type="email" maxLength={120} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Phone
          <input {...f("phone")} type="tel" maxLength={30} />
        </label>

        <label className={`${label} sm:col-span-6`}>
          Tickets link
          <input {...f("tickets_url")} type="url" maxLength={500} placeholder="https://your-server/tickets/carrier-folder" />
          <span className="mt-1 block text-xs font-normal text-zinc-500">Opens this carrier&apos;s tickets folder on your own server. Nothing is uploaded here.</span>
        </label>
        <label className={`${label} sm:col-span-6`}>
          Notes
          <textarea name="notes" defaultValue={carrier?.notes ?? ""} maxLength={1000} rows={2} className={`${input} mt-1`} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button disabled={pending} className={btnPrimary}>
          {carrier ? "Save changes" : "Add carrier"}
        </button>
        {carrier && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={carrier.active} className="h-4 w-4 accent-pine-900" />
            Active (shown when picking a carrier in the log)
          </label>
        )}
        <p role="status" className={`text-sm ${state ? "text-red-700" : "text-pine-700"}`}>{state ?? (savedAt ? "Changes saved." : "")}</p>
      </div>
    </form>
  );
}
