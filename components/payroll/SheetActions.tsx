"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { voidPaySheet } from "@/lib/payroll/actions";
import { buildSheetPdf, sheetFileName, sheetSummary } from "@/lib/payroll/pdf";
import { createClient } from "@/lib/supabase/client";
import type { PaySheet } from "@/lib/payroll/types";

/** wa.me wants digits with country code; 10-digit numbers are US (+1). */
function whatsappNumber(phone: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length === 10 ? `1${digits}` : digits;
}

/** Phones (and some desktops) can hand the PDF straight to WhatsApp / Mail. */
function canShareFiles(): boolean {
  try {
    const probe = new File([""], "x.pdf", { type: "application/pdf" });
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}
const noSubscribe = () => () => {};

// Why the email could not go out by itself (send-pay-sheet results).
const EMAIL_FALLBACK: Record<string, string> = {
  invalid_credentials: "The Gmail account was rejected: check GMAIL_USER and GMAIL_APP_PASSWORD.",
  send_failed: "Gmail could not send it.",
};

const btn = "rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50";

export function SheetActions({
  sheet,
  driverPhone,
  driverEmail,
}: {
  sheet: PaySheet;
  driverPhone: string | null;
  driverEmail: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  // false on the server, real capability once hydrated.
  const shareable = useSyncExternalStore(noSubscribe, canShareFiles, () => false);

  const pdfFile = () =>
    new File([buildSheetPdf(sheet).output("blob")], sheetFileName(sheet), { type: "application/pdf" });

  function download() {
    const url = URL.createObjectURL(pdfFile());
    const a = document.createElement("a");
    a.href = url;
    a.download = sheetFileName(sheet);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  function print() {
    const doc = buildSheetPdf(sheet);
    doc.autoPrint();
    const url = URL.createObjectURL(doc.output("blob"));
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function share() {
    setMessage(null);
    try {
      await navigator.share({ files: [pdfFile()], title: `Pay sheet #${sheet.sheet_number}`, text: sheetSummary(sheet) });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMessage("Could not open the share menu. Use Download PDF instead.");
    }
  }

  // Desktop browsers cannot attach files to WhatsApp / email links: download
  // the PDF so it can be attached, and open the chat / email with the summary.
  function whatsapp() {
    download();
    const to = whatsappNumber(driverPhone);
    window.open(`https://wa.me/${to}?text=${encodeURIComponent(sheetSummary(sheet))}`, "_blank");
    setMessage("PDF downloaded — attach it in the WhatsApp chat that just opened.");
  }

  function emailManually(reason = "") {
    download();
    const subject = `ASG Pay Sheet #${sheet.sheet_number} — ${sheet.driver_name} — ${sheet.pay_date}`;
    window.location.href = `mailto:${driverEmail ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(sheetSummary(sheet))}`;
    setMessage(`${reason ? `${reason} ` : ""}PDF downloaded — attach it to the email that just opened.`);
  }

  // Sent by the send-pay-sheet Edge Function when its Gmail secrets are set;
  // otherwise (not configured, not deployed, rejected) falls back to the
  // manual download + mail app flow.
  function email() {
    if (!driverEmail) return emailManually();
    if (!confirm(`Send pay sheet #${sheet.sheet_number} to ${driverEmail}?`)) return;
    setMessage(null);
    startTransition(async () => {
      const pdfBase64 = buildSheetPdf(sheet).output("datauristring").split(",")[1];
      const { data, error } = await createClient().functions.invoke<{ result: string; to?: string }>("send-pay-sheet", {
        body: { sheetId: sheet.id, pdfBase64 },
      });
      if (!error && data?.result === "sent") {
        setMessage(`Sent to ${data.to}.`);
        return;
      }
      emailManually(EMAIL_FALLBACK[data?.result ?? ""] ?? "Automatic email is not set up.");
    });
  }

  function voidSheet() {
    if (!confirm(`Void pay sheet #${sheet.sheet_number}? It stays in the records marked VOID and can no longer be edited.`)) return;
    startTransition(async () => {
      const res = await voidPaySheet(sheet.id);
      if (!res.ok) setMessage(res.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {sheet.status === "active" && (
          <Link href={`/payroll/${sheet.id}/edit`} className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white">
            Edit
          </Link>
        )}
        <button type="button" onClick={print} className={btn}>
          Print
        </button>
        <button type="button" onClick={download} className={btn}>
          Download PDF
        </button>
        {shareable && (
          <button type="button" onClick={share} className={btn}>
            Share…
          </button>
        )}
        <button type="button" onClick={whatsapp} className={btn} title={driverPhone ? `To ${driverPhone}` : "No phone on file: pick the chat in WhatsApp"}>
          WhatsApp
        </button>
        <button type="button" onClick={email} disabled={pending} className={btn} title={driverEmail ? `To ${driverEmail}` : "No email on file"}>
          Email
        </button>
        <Link href={`/payroll/new?from=${sheet.id}`} className={btn} title="New sheet for the same driver, rates and extras">
          Copy for next week
        </Link>
        {sheet.status === "active" && (
          <button type="button" onClick={voidSheet} disabled={pending} className={`${btn} text-red-700`}>
            Void
          </button>
        )}
      </div>
      {message && <p className="text-sm text-zinc-600">{message}</p>}
    </div>
  );
}
