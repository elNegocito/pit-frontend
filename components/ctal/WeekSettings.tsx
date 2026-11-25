"use client";

import { useActionState } from "react";
import { updateWeek } from "@/lib/ctal/actions";
import type { Week } from "@/lib/ctal/types";
import { btn, input } from "@/lib/ctal/ui";

/** Pay date (when the Friday moves for a holiday). */
export function WeekSettings({ week }: { week: Week }) {
  const [state, action, pending] = useActionState(updateWeek, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={week.id} />
      <input type="hidden" name="notes" value={week.notes ?? ""} />
      <label className="text-xs font-medium text-zinc-600">
        Pay date
        <input type="date" name="pay_date" defaultValue={week.pay_date} required className={`${input} mt-1 py-1.5`} />
      </label>
      <button disabled={pending} className={btn}>
        Save pay date
      </button>
      {state && <p className="w-full text-sm text-red-700">{state}</p>}
    </form>
  );
}
