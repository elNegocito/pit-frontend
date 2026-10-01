export type Role = "admin" | "operator";
export type Payment = "ACCOUNT" | "COD";
export type CodMethod = "CASH" | "CARD" | "CHECK";

export interface Profile {
  id: string;
  role: Role;
}

export interface Material {
  id: string;
  name: string;
  price_per_ton: number;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
}

export interface OrderRow {
  id: string;
  date: string;
  material_id: string;
  truck_number: string;
  ticket_number: string;
  tons: number;
  customer_id: string;
  payment: Payment;
  cod_method: CodMethod | null;
  gross: number;
  created_at: string;
  status: TicketStatus;
  edited_at: string | null;
  edit_count: number;
  job_order_code: string | null;
  truck_gross_tons: number | null;
  materials: { name: string } | null;
  customers: { name: string } | null;
}

export type TicketStatus = "active" | "void";

export interface Truck {
  id: string;
  truck_number: string;
  gross_tons: number;
  active: boolean;
}

export interface JobOrder {
  id: string;
  code: string;
  customer_id: string;
  active: boolean;
  customers: { name: string } | null;
}

export interface TicketEvent {
  id: string;
  order_id: string;
  ticket_number: string;
  action: "edit" | "void";
  changes: Record<string, { from: unknown; to: unknown }>;
  created_at: string;
}

/** Everything printed on a ticket (also used for the live preview). */
export interface TicketPrintData {
  id: string | null; // null while previewing an unsaved ticket
  ticketNumber: string | null;
  createdAt: string | null; // ISO timestamp; null = "now" in preview
  date: string; // yyyy-MM-dd (pit day)
  status: TicketStatus;
  truckNumber: string;
  orderCode: string | null;
  customer: string;
  materialId: string;
  product: string;
  poNumber: string;
  jobNumber: string;
  netTons: number | null;
  truckGrossTons: number | null; // from the truck registry; null = not registered
  payment: Payment;
  codMethod: CodMethod | null;
  customerLoads: number | null;
  truckLoads: number | null;
  weighmaster: string;
  edited: boolean;
}
