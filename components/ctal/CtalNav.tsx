"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";

const TABS = [
  { href: "/ctal", label: "Overview", exact: true },
  { href: "/ctal/weeks", label: "Weeks" },
  { href: "/ctal/carriers", label: "Carriers" },
  { href: "/ctal/customers", label: "Customers" },
];

export function CtalNav() {
  const path = usePathname();
  return (
    <header className="border-b border-pine-950 bg-pine-900 text-white print:hidden">
      <div className="mx-auto flex w-full max-w-[1760px] flex-wrap items-center gap-x-6 gap-y-1 px-4">
        <Link href="/ctal" className="py-3 text-lg font-semibold tracking-tight">
          CTAL
        </Link>
        <nav aria-label="CTAL sections" className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
          {TABS.map((t) => {
            const on = t.exact ? path === t.href : path.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`border-b-2 px-3 py-3 text-sm whitespace-nowrap outline-none focus-visible:bg-pine-700 ${
                  on ? "border-white font-medium text-white" : "border-transparent text-pine-200 hover:text-white"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 py-2">
          <Link href="/dashboard" className="rounded-md px-2.5 py-1.5 text-sm text-pine-200 hover:bg-pine-700 hover:text-white">
            PIT #2 dashboard
          </Link>
          <SignOutButton className="rounded-md border border-pine-700 px-2.5 py-1.5 text-sm text-pine-200 hover:bg-pine-700 hover:text-white" />
        </div>
      </div>
    </header>
  );
}
