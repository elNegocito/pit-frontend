export const services = ["Delivery", "Pick Up", "Swap Out", "Relocation"] as const;
export const dispatchStatuses = ["Unassigned", "Assigned", "En route", "Completed", "Canceled"] as const;
export const trackingStatuses = ["Pending delivery", "Active", "Pick up today", "Overdue", "No pickup date", "Completed", "Canceled"] as const;
export const sizes = [10, 15, 20, 30, 40] as const;
export const catalogs = {
  containers: { table: "roll_off_containers", label: "Containers", key: "container_number", name: "Container #", detail: "location", detailLabel: "Yard location" },
  trucks: { table: "roll_off_trucks", label: "Trucks", key: "truck_number", name: "Truck #", detail: "plate", detailLabel: "Plate" },
  drivers: { table: "roll_off_drivers", label: "Drivers", key: "name", name: "Driver", detail: "phone", detailLabel: "Phone" },
} as const;
export type Catalog = keyof typeof catalogs;
export type Asset = {
  id: string;
  active: boolean;
  notes: string;
  container_number?: string;
  truck_number?: string;
  name?: string;
  size_yards?: number;
  location?: string;
  plate?: string;
  phone?: string;
  current_location?: string;
  availability?: string;
  expected_available_on?: string | null;
  last_return_on?: string | null;
  order_number?: string | null;
  order_id?: string | null;
};

export type DispatchOrder = {
  id: string;
  order_number: string;
  order_date: string;
  scheduled_date: string | null;
  customer: string;
  phone: string;
  address: string;
  service: (typeof services)[number];
  container_id: string | null;
  container_number: string | null;
  size_yards: number;
  delivered_on: string | null;
  picked_up_on: string | null;
  rental_days: number | null;
  due_on: string | null;
  elapsed_days: number | null;
  truck_id: string | null;
  truck_number: string | null;
  driver_id: string | null;
  driver_name: string | null;
  instructions: string;
  notes: string;
  charge: number | null;
  reference: string;
  dispatch_status: (typeof dispatchStatuses)[number];
  tracking_status: (typeof trackingStatuses)[number];
};

export const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^[1-8]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value);
}
