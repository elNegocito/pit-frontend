"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { saveProductionDay, saveProductionEntry } from "@/lib/trucking-production/actions";
import { descriptions, quantities, type ProductionDay, type ProductionEntry } from "@/lib/trucking-production/fields";

const input = "block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2";
const button = "rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50";

function submit(event: FormEvent<HTMLFormElement>, action: (data: FormData) => void) {
  event.preventDefault();
  const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
  startTransition(() => action(data));
}

export function DayForm({ date, day }: { date: string; day?: ProductionDay }) {
  const [state, action, pending] = useActionState(saveProductionDay, { error: "" });
  return (
    <form action={action} onSubmit={(event) => submit(event, action)} className="space-y-3 rounded-xl border bg-white p-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label>Work date<input className={input} type="date" name="work_date" defaultValue={date} readOnly required /></label>
        <label>Revenue goal ($)<input className={input} type="number" name="revenue_goal" min="0" step=".01" defaultValue={day?.revenue_goal ?? (new Date(`${date}T00:00:00Z`).getUTCDay() === 6 ? 0 : 22702)} required /></label>
        <label>Ashgrove ($/ton)<input className={input} type="number" name="ashgrove_rate" min="0" step=".0001" defaultValue={day?.ashgrove_rate ?? 10.5} required /></label>
        <label>GP/ASG R.M. ($/ton)<input className={input} type="number" name="gp_rate" min="0" step=".0001" defaultValue={day?.gp_rate ?? 12} required /></label>
        <label>Alumina / Silica ($/ton)<input className={input} type="number" name="shale_rate" min="0" step=".0001" defaultValue={day?.shale_rate ?? 5.95} required /></label>
      </div>
      <p className="text-zinc-600">Defaults follow the workbook. Changing rates does not change entries with a gross override.</p>
      {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
      <button className={button} disabled={pending}>{day ? "Save rates and goal" : "Create production day"}</button>
    </form>
  );
}

export function EntryForm({ date, entry }: { date: string; entry?: ProductionEntry }) {
  const [state, action, pending] = useActionState(saveProductionEntry, { error: "" });
  return (
    <form action={action} onSubmit={(event) => submit(event, action)} className="mt-3 space-y-3 text-sm">
      <input type="hidden" name="work_date" value={date} />
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {descriptions.map(([name, label, max]) => (
          <label key={name}>{label}<input className={input} name={name} maxLength={max} defaultValue={entry?.[name]} required={name === "truck"} /></label>
        ))}
        {quantities.map(([name, label, step]) => (
          <label key={name}>{label}<input className={input} name={name} type="number" min="0" step={step} defaultValue={entry?.[name]} placeholder="0" /></label>
        ))}
        <label>Gross adjustment ($)<input className={input} name="adjustment" type="number" step=".000001" defaultValue={entry?.adjustment} placeholder="0" /></label>
        <label>Gross override ($)<input className={input} name="gross_override" type="number" step=".000001" defaultValue={entry?.gross_override ?? ""} placeholder="Use calculated gross" /></label>
        <label>Driver pay ($)<input className={input} name="driver_pay" type="number" min="0" step=".01" defaultValue={entry?.driver_pay ?? ""} /></label>
      </div>
      <p className="text-zinc-600">Use the adjustment for other charges or credits. A gross override replaces the full calculation.</p>
      {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
      <div className="flex gap-3">
        <button className={button} disabled={pending}>{entry ? "Save entry" : "Add entry"}</button>
        {entry && (
          <button className="rounded-lg border border-red-300 px-3 py-2 text-red-700 disabled:opacity-50" name="intent" value="delete" formNoValidate disabled={pending}
            onClick={(event) => { if (!window.confirm(`Remove the entry for truck ${entry.truck}?`)) event.preventDefault(); }}>
            Remove
          </button>
        )}
      </div>
    </form>
  );
}
