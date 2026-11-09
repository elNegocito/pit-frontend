"use client";

import { useActionState } from "react";
import { createWeek } from "@/lib/ctal/actions";
import { btnPrimary, input } from "@/lib/ctal/ui";

/** Any day works: the week always runs from that Sunday to Saturday. */
export function NewWeekForm({ suggested }: { suggested: string }) {
  const [state, action, pending] = useActionState(createWeek, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="text-sm font-medium text-zinc-700">
        Any day of the week
        <input type="date" name="day" defaultValue={suggested} required className={`${input} mt-1`} />
      </label>
      <button disabled={pending} className={btnPrimary}>
        Start week
      </button>
      {state && <p className="w-full text-sm text-red-700">{state}</p>}
    </form>
  );
}
