export const quantities = [
  ["loads", "Loads", "1"],
  ["ashgrove_tons", "Ashgrove tons", "0.0001"],
  ["alumina_tons", "Alumina shale tons", "0.0001"],
  ["silica_tons", "Silica shale tons", "0.0001"],
  ["gp_tons", "GP/ASG R.M. tons", "0.0001"],
  ["other_quantity", "Other material quantity", "0.0001"],
  ["customer_tons", "Customer tons", "0.0001"],
  ["customer_loads", "Customer loads", "1"],
] as const;

export const descriptions = [
  ["truck", "Truck #", 80],
  ["equipment", "Equipment", 80],
  ["driver", "Driver", 120],
  ["work_notes", "Work notes (e.g. 8HR)", 250],
  ["other_material", "Other material (e.g. Sand)", 80],
  ["excavation", "Excavation", 120],
] as const;

export type ProductionEntry = Record<(typeof descriptions)[number][0], string> &
  Record<(typeof quantities)[number][0], number> & {
    id: string;
    adjustment: number;
    gross_override: number | null;
    driver_pay: number | null;
    gross: number;
    load_goal: number;
  };

export type ProductionDay = {
  work_date: string;
  revenue_goal: number;
  ashgrove_rate: number;
  gp_rate: number;
  shale_rate: number;
  gross: number;
  loads: number;
  target_rows: number;
  met_rows: number;
  missing_loads: number;
};

export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^[1-8]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value);
}
