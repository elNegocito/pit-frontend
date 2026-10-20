import type { Role } from "@/lib/types";

/** Landing page of each role after sign-in (shared by server and client code). */
export function homeFor(role: Role | null | undefined): string {
  if (role === "operator") return "/entry";
  if (role === "payroll") return "/payroll";
  return "/dashboard";
}
