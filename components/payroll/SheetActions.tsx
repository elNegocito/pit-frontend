"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { voidPaySheet } from "@/lib/payroll/actions";
import { buildSheetPdf, sheetFileName, sheetSummary } from "@/lib/payroll/pdf";
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

  function email() {
    download();
    const subject = `ASG Pay Sheet #${sheet.sheet_number} — ${sheet.driver_name} — ${sheet.pay_date}`;
    window.location.href = `mailto:${driverEmail ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(sheetSummary(sheet))}`;
    setMessage("PDF downloaded — attach it to the email that just opened.");
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
        <button type="button" onClick={email} className={btn} title={driverEmail ? `To ${driverEmail}` : "No email on file"}>
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
