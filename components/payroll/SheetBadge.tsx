import type { SheetState } from "@/lib/payroll/status";

const STYLES: Record<SheetState, { label: string; cls: string }> = {
  current: { label: "Active", cls: "bg-green-100 text-green-800" },
  finished: { label: "Finished", cls: "bg-zinc-200 text-zinc-700" },
  void: { label: "VOID", cls: "bg-red-100 font-semibold text-red-700" },
};

export function SheetBadge({ state }: { state: SheetState }) {
  const { label, cls } = STYLES[state];
  return <span className={`rounded px-1.5 py-0.5 text-xs ${cls}`}>{label}</span>;
}
