// Week state of a pay sheet. Derived from its pay date (never stored): a sheet
// is being worked on through its pay day and is Finished from the next
// Chicago day on, with no job needed to flip it. pay_sheets.status stays
// 'active', so finished sheets keep counting wherever active sheets do.
export type SheetState = "current" | "finished" | "void";

export function sheetState(status: "active" | "void", payDate: string, today: string): SheetState {
  if (status === "void") return "void";
  return payDate < today ? "finished" : "current";
}
