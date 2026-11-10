import { requireAdmin } from "@/lib/auth";
import { clock, TUTORIALS } from "@/lib/ctal/tutorials";
import { card } from "@/lib/ctal/ui";
import { TutorialPlayer } from "@/components/ctal/TutorialPlayer";

export default async function CtalHelpPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  await requireAdmin();
  const { v } = await searchParams;
  const total = TUTORIALS.reduce((s, t) => s + t.duration, 0);
  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Tutorials</h1>
        <p className="max-w-2xl text-sm text-zinc-600">
          Short videos of every part of CTAL, recorded on these same screens with sample data. No sound needed.
          {TUTORIALS.length > 0 && ` ${TUTORIALS.length} videos, ${clock(total)} minutes in all.`}
        </p>
      </div>
      {TUTORIALS.length === 0 ? (
        <p className={`${card} px-4 py-10 text-center text-sm text-zinc-600`}>The videos are being prepared.</p>
      ) : (
        <TutorialPlayer tutorials={TUTORIALS} initial={v} />
      )}
    </>
  );
}
