import { formatTicketDate } from "@/lib/timezone";
import { insuranceState } from "@/lib/ctal/compute";
import type { Carrier } from "@/lib/ctal/types";

const TONE = {
  ok: "bg-pine-100 text-pine-900",
  soon: "bg-amber-100 text-amber-900",
  expired: "bg-red-100 text-red-800",
  unknown: "bg-zinc-100 text-zinc-600",
};

/** Insurance expiry with the colors of the owner's sheet: red expired, amber within 30 days. */
export function InsuranceBadge({ carrier, today }: { carrier: Pick<Carrier, "ins_exp" | "ins_note">; today: string }) {
  const state = insuranceState(carrier, today);
  const text = carrier.ins_exp ? formatTicketDate(carrier.ins_exp) : (carrier.ins_note ?? "No date");
  const word = state === "expired" && carrier.ins_exp ? "Expired " : state === "soon" ? "Expires " : "";
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums ${TONE[state]}`}>{word}{text}</span>;
}
