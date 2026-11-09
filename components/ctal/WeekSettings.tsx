"use client";

import { useActionState, useTransition } from "react";
import { deleteWeek, updateWeek } from "@/lib/ctal/actions";
import type { Week } from "@/lib/ctal/types";
import { btn, btnDanger, input } from "@/lib/ctal/ui";

/** Pay date (when the Friday moves for a holiday) and removing an empty week. */
export function WeekSettings({ week, empty }: { week: Week; empty: boolean }) {
  const [state, action, pending] = useActionState(updateWeek, null);
  const [deleting, start] = useTransition();
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
      {empty && (
        <button
          type="button"
          disabled={deleting}
          className={btnDanger}
          onClick={() => {
            if (confirm("Delete this empty week?")) start(async () => void (await deleteWeek(week.id)));
          }}
        >
          Delete week
        </button>
      )}
      {state && <p className="w-full text-sm text-red-700">{state}</p>}
    </form>
  );
}
