import Link from "next/link";
import { describeChanges, formatEventTime } from "@/lib/ticket/events";
import type { TicketEvent } from "@/lib/types";

/** Admin notification: tickets the operator edited or voided today. */
export function ChangesBanner({ events }: { events: TicketEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-amber-900">
          {events.length} ticket change{events.length === 1 ? "" : "s"} by the operator today
        </h2>
        <Link href="/dashboard?status=modified" className="text-xs text-amber-900 underline">
          Show modified tickets
        </Link>
      </div>
      <ul className="mt-2 space-y-1 text-sm text-amber-950">
        {events.map((e) => (
          <li key={e.id}>
            <span className="font-medium">Ticket {e.ticket_number}</span>{" "}
            {e.action === "void" ? (
              <span className="font-semibold text-red-700">voided</span>
            ) : (
              <span>edited — {describeChanges(e)}</span>
            )}{" "}
            <span className="text-xs text-amber-800">({formatEventTime(e.created_at)})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
