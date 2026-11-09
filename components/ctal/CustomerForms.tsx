"use client";

import { useActionState, useState } from "react";
import { saveCustomer } from "@/lib/ctal/actions";
import { BILL_TO, BILL_TO_LABEL, UNITS, type CtalCustomer, type FeeKind, type FscMode } from "@/lib/ctal/types";
import { btn, btnPrimary, card, input } from "@/lib/ctal/ui";

const lab = "block text-xs font-medium text-zinc-600";

function Fields({ customer }: { customer?: CtalCustomer }) {
  const [fee, setFee] = useState<FeeKind>(customer?.fee_kind ?? "quick_pay");
  const [feePct, setFeePct] = useState(String(customer?.fee_pct ?? 3.5));
  const [fsc, setFsc] = useState<FscMode>(customer?.fsc_mode ?? "none");
  return (
    <>
      <label className={`${lab} min-w-52 flex-[2]`}>
        {customer ? "Customer" : "New customer"}
        <input name="name" defaultValue={customer?.name} required maxLength={120} placeholder="CUSTOMER / MATERIAL" className={`${input} mt-1 uppercase`} />
      </label>
      <label className={lab}>
        Billed by
        <select name="bill_to" defaultValue={customer?.bill_to ?? "asg"} className={`${input} mt-1`}>
          {BILL_TO.map((b) => (
            <option key={b} value={b}>{BILL_TO_LABEL[b]}</option>
          ))}
        </select>
      </label>
      <label className={lab}>
        Paid per
        <select name="default_unit" defaultValue={customer?.default_unit ?? "TON"} className={`${input} mt-1`}>
          {UNITS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </label>
      <label className={`${lab} w-24`}>
        Broker rate $
        <input name="broker_rate" type="number" min="0" step="any" defaultValue={customer?.broker_rate ?? ""} placeholder="0" className={`${input} mt-1 text-right tabular-nums`} />
      </label>
      <label className={`${lab} w-24`}>
        Carrier rate $
        <input name="carrier_rate" type="number" min="0" step="any" defaultValue={customer?.carrier_rate ?? ""} placeholder="0" className={`${input} mt-1 text-right tabular-nums`} />
      </label>
      <label className={lab}>
        Fee taken from the carrier
        <select
          name="fee_kind"
          value={fee}
          onChange={(e) => {
            const kind = e.target.value as FeeKind;
            setFee(kind);
            // The usual percentage of each kind; still editable.
            setFeePct(kind === "broker_fee" ? "8" : "3.5");
          }}
          className={`${input} mt-1`}
        >
          <option value="quick_pay">Quick pay fee</option>
          <option value="broker_fee">Broker fee</option>
        </select>
      </label>
      <label className={`${lab} w-20`}>
        Fee %
        <input name="fee_pct" type="number" min="0" max="100" step="any" value={feePct} onChange={(e) => setFeePct(e.target.value)} className={`${input} mt-1 text-right tabular-nums`} />
      </label>
      <label className={lab}>
        FSC
        <select name="fsc_mode" value={fsc} onChange={(e) => setFsc(e.target.value as FscMode)} className={`${input} mt-1`}>
          <option value="none">Not paid</option>
          <option value="percent">% of carrier amount</option>
          <option value="fixed">Fixed $ per load</option>
        </select>
      </label>
      {fsc !== "none" && (
        <label className={`${lab} w-24`}>
          {fsc === "percent" ? "FSC %" : "FSC $ per load"}
          <input name="fsc_value" type="number" min="0" step="any" defaultValue={customer?.fsc_value || ""} placeholder="0" className={`${input} mt-1 text-right tabular-nums`} />
        </label>
      )}
    </>
  );
}

export function CustomerCreateForm() {
  const [state, action, pending] = useActionState(saveCustomer, null);
  return (
    <form action={action} className={`${card} p-4`}>
      <div className="flex flex-wrap items-end gap-3">
        <Fields />
        <button disabled={pending} className={btnPrimary}>Add customer</button>
      </div>
      {state && <p className="mt-2 text-sm text-red-700">{state}</p>}
    </form>
  );
}

export function CustomerRowForm({ customer }: { customer: CtalCustomer }) {
  const [saved, setSaved] = useState(false);
  const [state, action, pending] = useActionState(async (prev: string | null, form: FormData) => {
    const res = await saveCustomer(prev, form);
    setSaved(res === null);
    return res;
  }, null);
  return (
    <form action={action} onChange={() => setSaved(false)} className={`${card} p-4 ${customer.active ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={customer.id} />
        <Fields customer={customer} />
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={customer.active} className="h-4 w-4 accent-pine-900" />
          Active
        </label>
        <button disabled={pending} className={btn}>Save changes</button>
      </div>
      <p role="status" className={`text-sm ${state ? "mt-2 text-red-700" : saved ? "mt-2 text-pine-700" : ""}`}>{state ?? (saved ? "Changes saved." : "")}</p>
    </form>
  );
}
