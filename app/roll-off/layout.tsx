import Link from "next/link";

export default function RollOffLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-full bg-zinc-100 px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-6xl space-y-5">
        <nav aria-label="Roll-off" className="flex flex-wrap gap-3 text-sm print:hidden">
          <Link className="text-blue-700 underline" href="/dashboard">Admin dashboard</Link>
          <Link className="text-blue-700 underline" href="/roll-off">Dispatch board</Link>
          <Link className="text-blue-700 underline" href="/roll-off/orders/new">New order</Link>
          <Link className="text-blue-700 underline" href="/roll-off/catalogs">Inventory and catalogs</Link>
        </nav>
        {children}
      </div>
    </main>
  );
}
