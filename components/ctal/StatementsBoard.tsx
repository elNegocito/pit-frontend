"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStatementLink } from "@/lib/ctal/actions";
import { byCarrier, money, statementTotal } from "@/lib/ctal/compute";
import { buildStatementPdf, downloadPdf, printPdf, statementFileName } from "@/lib/ctal/pdf";
import { createClient } from "@/lib/supabase/client";
import type { Carrier, Load, StatementMeta, Week } from "@/lib/ctal/types";
import { btn, btnPrimary, card, input } from "@/lib/ctal/ui";
import { fold, Highlight } from "./Combobox";
import { LoadsTable, TotalsBox } from "./LoadsTable";

// Why the email could not go out by itself (send-carrier-statement results).
const WHY: Record<string, string> = {
  not_configured: "Automatic email is not set up yet.",
  invalid_credentials: "The Gmail account was rejected: check GMAIL_USER and GMAIL_APP_PASSWORD.",
  send_failed: "Gmail could not send it.",
  no_email: "This carrier has no email address.",
};

const when = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

export function StatementsBoard({ week, loads, carriers, meta, initial }: { week: Week; loads: Load[]; carriers: Carrier[]; meta: StatementMeta[]; initial?: string }) {
  const router = useRouter();
  const groups = useMemo(() => byCarrier(loads), [loads]);
  const carrierById = useMemo(() => new Map(carriers.map((c) => [c.id, c])), [carriers]);
  const [selected, setSelected] = useState(groups.some((g) => g.carrierId === initial) ? initial! : (groups[0]?.carrierId ?? ""));
  const [find, setFind] = useState("");
  const [sent, setSent] = useState<Record<string, { at: string; to: string }>>(() =>
    Object.fromEntries(meta.filter((m) => m.emailed_at).map((m) => [m.carrier_id, { at: m.emailed_at!, to: m.emailed_to ?? "" }])),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const group = groups.find((g) => g.carrierId === selected);
  const carrier = group ? carrierById.get(group.carrierId) : undefined;
  const saved = meta.find((m) => m.carrier_id === selected);
  const ticketsUrl = saved?.tickets_url ?? carrier?.tickets_url ?? "";
  const shown = groups.filter((g) => fold(g.name).includes(fold(find.trim())));

  if (groups.length === 0) {
    return <p className={`${card} px-4 py-10 text-center text-sm text-zinc-600`}>No loads in this week yet. Statements appear here as soon as the log has rows.</p>;
  }

  const pdf = (g: (typeof groups)[number]) => buildStatementPdf(week, g.name, g.rows);

  /** Sends one statement; returns the function's result code. */
  async function send(g: (typeof groups)[number]): Promise<string> {
    const pdfBase64 = pdf(g).output("datauristring").split(",")[1];
    const { data, error } = await createClient().functions.invoke<{ result: string; to?: string }>("send-carrier-statement", {
      body: { weekId: week.id, carrierId: g.carrierId, pdfBase64 },
    });
    if (error || !data) return "not_configured";
    if (data.result === "sent") setSent((s) => ({ ...s, [g.carrierId]: { at: new Date().toISOString(), to: data.to ?? "" } }));
    return data.result;
  }

  function email() {
    if (!group) return;
    const to = carrier?.email;
    if (!to) return setMessage("This carrier has no email address. Add it on the carrier's page, then send again.");
    if (!confirm(`Email this statement to ${to}?`)) return;
    setMessage(null);
    start(async () => {
      const result = await send(group);
      if (result === "sent") return setMessage(`Statement emailed to ${to}.`);
      // Manual way: download the PDF and open the mail app with the message ready.
      downloadPdf(pdf(group), statementFileName(week, group.name));
      const subject = `CTAL statement, week ${week.week_start}`;
      const body = `Hello,\n\nAttached is your statement for the week starting ${week.week_start}. Total: ${money(statementTotal(group.totals))}.`;
      window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setMessage(`${WHY[result] ?? "The email could not be sent."} The PDF was downloaded: attach it to the email that just opened.`);
    });
  }

  function emailAll() {
    const targets = groups.filter((g) => carrierById.get(g.carrierId)?.email && !sent[g.carrierId]);
    const missing = groups.filter((g) => !carrierById.get(g.carrierId)?.email).length;
    if (targets.length === 0) return setMessage(missing > 0 ? `Nothing to send: ${missing} carrier${missing === 1 ? " has" : "s have"} no email address and the rest were already sent.` : "Every statement was already emailed.");
    if (!confirm(`Email ${targets.length} statement${targets.length === 1 ? "" : "s"} now?`)) return;
    setMessage(null);
    start(async () => {
      let ok = 0;
      for (const [i, g] of targets.entries()) {
        setProgress(`Sending ${i + 1} of ${targets.length}: ${g.name}`);
        const result = await send(g);
        if (result === "sent") ok += 1;
        else if (result === "not_configured" || result === "invalid_credentials") {
          setProgress(null);
          return setMessage(`${WHY[result]} Use Email on each statement to send it from your mail app.`);
        }
      }
      setProgress(null);
      setMessage(`${ok} of ${targets.length} statements emailed.${missing > 0 ? ` ${missing} skipped: no email address.` : ""}`);
    });
  }

  function saveLink(form: FormData) {
    start(async () => {
      const err = await saveStatementLink(week.id, selected, String(form.get("url") ?? ""));
      setMessage(err ?? "Tickets link saved.");
      if (!err) router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[290px_1fr]">
      <aside className={`${card} self-start overflow-hidden`}>
        <div className="border-b border-rule p-2">
          <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a carrier…" aria-label="Find a carrier" className={input} />
        </div>
        <ul className="max-h-[60vh] overflow-auto">
          {shown.map((g) => (
            <li key={g.carrierId}>
              <button
                type="button"
                aria-current={g.carrierId === selected ? "true" : undefined}
                onClick={() => { setSelected(g.carrierId); setMessage(null); }}
                className={`flex w-full items-start justify-between gap-2 border-b border-rule px-3 py-2 text-left text-sm ${g.carrierId === selected ? "bg-pine-100" : "hover:bg-pine-50"}`}
              >
                <span>
                  <span className="block font-medium"><Highlight text={g.name} query={find} /></span>
                  <span className={`text-xs ${sent[g.carrierId] ? "text-pine-700" : "text-zinc-500"}`}>{sent[g.carrierId] ? `Emailed ${when(sent[g.carrierId].at)}` : "Not emailed"}</span>
                </span>
                <span className="text-right tabular-nums">
                  <span className="block font-medium">{money(statementTotal(g.totals))}</span>
                  <span className="text-xs text-zinc-500">{g.totals.loads} loads</span>
                </span>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="px-3 py-4 text-sm text-zinc-500">No carrier with that name in this week.</li>}
        </ul>
        <div className="p-2">
          <button type="button" onClick={emailAll} disabled={pending} className={`${btn} w-full`}>
            Email all statements
          </button>
        </div>
      </aside>

      {group && (
        <section className={`${card} min-w-0 p-4`} aria-label={`Statement for ${group.name}`}>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{group.name}</h2>
              <p className="text-sm text-zinc-600">{carrier?.email ?? "No email address on file"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn} onClick={() => printPdf(pdf(group))}>Print</button>
              <button type="button" className={btn} onClick={() => downloadPdf(pdf(group), statementFileName(week, group.name))}>Download PDF</button>
              <button type="button" className={btnPrimary} disabled={pending} onClick={email}>Email statement</button>
            </div>
          </div>
          {(progress || message) && <p role="status" className="mb-3 rounded-md bg-pine-50 px-3 py-2 text-sm text-pine-950">{progress ?? message}</p>}
          <LoadsTable rows={group.rows} side="carrier" />
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <form action={saveLink} key={selected} className="flex min-w-64 flex-1 flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-sm font-medium text-zinc-700">
                Tickets link
                <input name="url" type="url" defaultValue={ticketsUrl} placeholder="https://your-server/tickets/…" className={`${input} mt-1`} />
              </label>
              <button className={btn} disabled={pending}>Save link</button>
              {ticketsUrl && (
                <a href={ticketsUrl} target="_blank" rel="noopener noreferrer" className={btn}>Open tickets</a>
              )}
              <p className="w-full text-xs text-zinc-500">The tickets stay on your own server; only the link is kept here.</p>
            </form>
            <TotalsBox
              lines={[["Subtotal", group.totals.carrier_amount], ["Broker fee", group.totals.broker_fee], ["Quick pay fee", group.totals.quick_pay_fee], ["FSC", group.totals.fsc_amount]]}
              total={statementTotal(group.totals)}
            />
          </div>
        </section>
      )}
    </div>
  );
}
