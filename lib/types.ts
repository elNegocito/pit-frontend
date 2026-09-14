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
  materials: { name: string } | null;
  customers: { name: string } | null;
}
