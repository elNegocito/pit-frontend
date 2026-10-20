import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import type { Role } from "@/lib/types";

const link = "rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-zinc-50";

export function PayrollHeader({ title, subtitle, role }: { title: string; subtitle?: string; role: Role }) {
  return (
    <div className="mx-auto mb-4 flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 print:hidden">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-zinc-500">{subtitle ?? "ASG Operations — Driver payroll"}</p>
      </div>
      <nav className="flex flex-wrap gap-2">
        <Link href="/payroll" className={link}>
          Pay sheets
        </Link>
        <Link href="/payroll/new" className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white">
          + New pay sheet
        </Link>
        <Link href="/payroll/drivers" className={link}>
          Drivers
        </Link>
        {role === "admin" && (
          <Link href="/dashboard" className={link}>
            Dashboard
          </Link>
        )}
        <SignOutButton />
      </nav>
    </div>
  );
}
