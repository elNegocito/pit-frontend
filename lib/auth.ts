import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/roles";
import type { Role } from "@/lib/types";

/** Session user + role. Redirects to /login when signed out. */
export async function requireUser(): Promise<{ id: string; role: Role }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  return { id: user.id, role: profile.role as Role };
}

export async function requireAdmin(): Promise<{ id: string }> {
  const u = await requireUser();
  if (u.role !== "admin") redirect(homeFor(u.role));
  return u;
}

/** Ticket screens (operator + admin). Payroll users never see tickets. */
export async function requireTicketUser(): Promise<{ id: string; role: Role }> {
  const u = await requireUser();
  if (u.role === "payroll") redirect(homeFor(u.role));
  return u;
}

/** Driver payroll screens (payroll + admin). */
export async function requirePayroll(): Promise<{ id: string; role: Role }> {
  const u = await requireUser();
  if (u.role !== "payroll" && u.role !== "admin") redirect(homeFor(u.role));
  return u;
}
