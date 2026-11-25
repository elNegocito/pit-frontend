import { requireCtalReader } from "@/lib/auth";
import { buildLogPdf, logFileName } from "@/lib/ctal/pdf";
import { loadWeek } from "@/lib/ctal/queries";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireCtalReader();
  const { id } = await params;
  const { week, loads } = await loadWeek(await createClient(), id);
  return new Response(buildLogPdf(week, loads).output("arraybuffer"), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${logFileName(week)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
