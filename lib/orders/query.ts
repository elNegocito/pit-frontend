export type SortKey =
  | "date"
  | "customer"
  | "material"
  | "truck_number"
  | "ticket_number"
  | "tons"
  | "payment"
  | "gross";
export type SortDir = "asc" | "desc";

export interface OrderFilters {
  truck: string;
  ticket: string;
  customerId: string;
  materialId: string;
  payment: string; // "" | ACCOUNT | COD
  codMethod: string; // "" | CASH | CARD | CHECK
  dateFrom: string; // yyyy-MM-dd
  dateTo: string;
}

export const EMPTY_FILTERS: OrderFilters = {
  truck: "",
  ticket: "",
  customerId: "",
  materialId: "",
  payment: "",
  codMethod: "",
  dateFrom: "",
  dateTo: "",
};

export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): { filters: OrderFilters; sort: SortKey; dir: SortDir; page: number } {
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : (v ?? "");
  const sortRaw = one(sp.sort);
  const validSort: SortKey[] = [
    "date",
    "customer",
    "material",
    "truck_number",
    "ticket_number",
    "tons",
    "payment",
    "gross",
  ];
  return {
    filters: {
      truck: one(sp.truck),
      ticket: one(sp.ticket),
      customerId: one(sp.customerId),
      materialId: one(sp.materialId),
      payment: one(sp.payment),
      codMethod: one(sp.codMethod),
      dateFrom: one(sp.dateFrom),
      dateTo: one(sp.dateTo),
    },
    sort: validSort.includes(sortRaw as SortKey)
      ? (sortRaw as SortKey)
      : "date",
    dir: one(sp.dir) === "asc" ? "asc" : "desc",
    page: Math.max(1, parseInt(one(sp.page) || "1", 10) || 1),
  };
}

export function filtersToParams(
  filters: OrderFilters,
  sort: SortKey,
  dir: SortDir,
  page: number,
): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) p.set(k, v);
  }
  p.set("sort", sort);
  p.set("dir", dir);
  p.set("page", String(page));
  return p;
}
