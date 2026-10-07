import { COMPANY } from "@/lib/ticket/company";
import { LBS_PER_TON, ticketWeights } from "@/lib/ticket/weights";
import { formatTicketDate, formatTicketTime } from "@/lib/timezone";
import type { TicketPrintData } from "@/lib/types";

// Physical size of one ticket: a Letter sheet (8.5 x 11 in) with micro-perfs
// at 3 2/3" and 7 1/3" => three 8.5 x 3.667 in tickets. Slightly under 11/3"
// so three copies never spill onto a second page.
export const TICKET_WIDTH_IN = 8.5;
export const TICKET_HEIGHT_IN = 3.66;

const fmt = (n: number | null, digits = 2) =>
  n === null ? "" : n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline gap-[6pt] border-b border-zinc-300 py-[1.5pt]">
      <span className="w-[62pt] shrink-0 text-[7.5pt] font-semibold uppercase">{label}</span>
      <span className={`min-w-0 truncate text-[8.5pt] ${strong ? "font-bold" : ""}`}>{value}</span>
    </div>
  );
}

/**
 * One ticket, laid out at real print size (inches/points). Used for the live
 * preview next to the entry form (scaled) and for the 3-up print sheet.
 */
export function TicketView({ t }: { t: TicketPrintData }) {
  const w = ticketWeights(t.truckTareTons, t.netTons);
  const time = formatTicketTime(t.createdAt ? new Date(t.createdAt) : new Date());
  const rows: { label: string; tons: number | null }[] = [
    { label: "Gross", tons: w.gross },
    { label: "Tare", tons: w.tare },
    { label: "Net", tons: w.net },
  ];
  const showWeights = t.truckTareTons !== null;

  return (
    <div
      className="relative box-border overflow-hidden bg-white text-black"
      style={{
        width: `${TICKET_WIDTH_IN}in`,
        height: `${TICKET_HEIGHT_IN}in`,
        padding: "0.22in 0.3in",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      {t.status === "void" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rotate-[-12deg] border-[3pt] border-red-600 px-[12pt] text-[44pt] font-black tracking-widest text-red-600 opacity-70">
            VOID
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-[10pt]">
        <div className="flex items-center gap-[8pt]">
          <div className="flex h-[38pt] w-[60pt] items-center justify-center border-[1.5pt] border-black text-[20pt] font-black italic">
            {COMPANY.short}
          </div>
          <div className="leading-tight">
            <div className="text-[13pt] font-bold">{COMPANY.name}</div>
            <div className="text-[8pt]">{COMPANY.addressLine}</div>
            <div className="text-[8pt]">TEL. {COMPANY.phone}</div>
          </div>
        </div>
        <div className="w-[190pt] border-[1pt] border-black px-[6pt] py-[3pt] text-[8.5pt] leading-snug">
          <div className="flex justify-between">
            <span>
              <b>Date:</b> {formatTicketDate(t.date)}
            </span>
            <span className="text-[11pt] font-bold">
              Ticket #: {t.ticketNumber ?? <span className="font-normal text-zinc-500">Auto</span>}
            </span>
          </div>
          {/* Preview shows "now": server and client clocks can differ by a minute. */}
          <div suppressHydrationWarning>
            <b>Time:</b> {time}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mt-[6pt] grid grid-cols-[1fr_190pt] gap-[12pt]">
        <div>
          <Field label="Truck #" value={t.truckNumber} strong />
          <Field label="Order" value={t.orderCode ?? ""} />
          <Field label="Customer" value={t.customer} strong />
          <Field label="Product" value={t.product} />
          <div className="grid grid-cols-2 gap-x-[8pt]">
            <Field label="PO #" value={t.poNumber} />
            <Field label="Job #" value={t.jobNumber} />
          </div>

          <table className="mt-[4pt] w-full border-collapse text-[8.5pt]">
            <thead>
              <tr className="border-b border-black">
                <th className="w-[62pt] text-left" />
                <th className="text-right font-semibold">Tons</th>
                <th className="text-right font-semibold">Pounds</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => showWeights || r.label === "Net")
                .map((r) => (
                  <tr key={r.label}>
                    <td className="font-semibold uppercase">{r.label}:</td>
                    <td className="text-right font-bold">{fmt(r.tons)}</td>
                    <td className="text-right">{r.tons === null ? "" : fmt(r.tons * LBS_PER_TON, 0)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="text-[8pt] leading-snug">
          <div className="flex justify-between">
            <b>Loads today (customer):</b>
            <span>{t.customerLoads ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <b>Loads today (truck):</b>
            <span>{t.truckLoads ?? "—"}</span>
          </div>
          <div className="mt-[4pt] text-[7.5pt] font-bold underline">Company Message</div>
          <p className="text-[6.5pt] leading-tight">{COMPANY.message}</p>
        </div>
      </div>

      {/* Signatures */}
      <div className="absolute right-[0.3in] bottom-[0.2in] left-[0.3in] grid grid-cols-3 gap-[14pt] text-[7.5pt]">
        <div>
          <div className="h-[12pt] border-b border-black text-[9pt]">{t.weighmaster}</div>
          <div className="font-semibold">WEIGHMASTER</div>
        </div>
        <div>
          <div className="h-[12pt] border-b border-black" />
          <div className="font-semibold">DRIVER SIGNATURE</div>
        </div>
        <div>
          <div className="h-[12pt] border-b border-black" />
          <div className="font-semibold">JOB SITE SIGNATURE</div>
        </div>
      </div>
    </div>
  );
}
