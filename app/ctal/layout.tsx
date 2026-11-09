import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { CtalNav } from "@/components/ctal/CtalNav";

export const metadata: Metadata = { title: "CTAL — ASG Operations" };

export default async function CtalLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="ctal flex min-h-full flex-1 flex-col bg-paper font-sans text-zinc-900">
      <CtalNav />
      <main className="mx-auto w-full max-w-[1760px] flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
