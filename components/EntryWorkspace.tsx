"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getTicket, voidOrder } from "@/lib/orders/actions";
import { normalizeName, normalizeTicket } from "@/lib/normalize";
import type { Material, TicketPrintData } from "@/lib/types";
import { EntryForm, emptyValues, parseTons, type EntryValues } from "./EntryForm";
import { PrintSheet, ScaledTicket } from "./PrintSheet";
import { TodaysTickets, type TodayRow } from "./TodaysTickets";

interface Props {
  materials: Material[];
  trucks: { truck_number: string; gross_tons: number }[];
  jobOrders: { code: string; customer: string }[];
  today: string;
  weighmaster: string;
  todays: { rows: TodayRow[]; total: number; page: number; pageSize: number };
}

/**
 * Operator screen: entry form on the left, the ticket being built on the
 * right (fills in live while typing), today's tickets below with
 * print / edit / void per row.
 */
export function EntryWorkspace({ materials, trucks, jobOrders, today, weighmaster, todays }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<EntryValues>(() => emptyValues(materials));
  const [editing, setEditing] = useState<TicketPrintData | null>(null);
  const [printTicket, setPrintTicket] = useState<TicketPrintData | null>(null);
  const [printNonce, setPrintNonce] = useState(0);
  const [listError, setListError] = useState<string | null>(null);

  const truckGross = useMemo(() => {
    const key = normalizeTicket(values.truck);
    const t = key ? trucks.find((x) => normalizeTicket(x.truck_number) === key) : undefined;
    return t ? Number(t.gross_tons) : null;
  }, [trucks, values.truck]);

  const orderCode = useMemo(() => {
    const key = normalizeName(values.customer);
    return key ? (jobOrders.find((o) => normalizeName(o.customer) === key)?.code ?? null) : null;
  }, [jobOrders, values.customer]);

  const preview: TicketPrintData = {
    id: editing?.id ?? null,
    ticketNumber: editing?.ticketNumber ?? null,
    createdAt: editing?.createdAt ?? null,
    date: editing?.date ?? today,
    status: "active",
    truckNumber: values.truck.trim(),
    orderCode,
    customer: values.customer.trim(),
    materialId: values.materialId,
    product: materials.find((m) => m.id === values.materialId)?.name ?? "",
    poNumber: values.poNumber,
    jobNumber: values.jobNumber,
    netTons: parseTons(values.tons),
    truckGrossTons: truckGross,
    payment: values.payment,
    codMethod: values.payment === "COD" ? values.codMethod : null,
    customerLoads: editing?.customerLoads ?? null,
    truckLoads: editing?.truckLoads ?? null,
    weighmaster: editing?.weighmaster || weighmaster,
    edited: false,
  };

  function print(t: TicketPrintData) {
    setPrintTicket(t);
    setPrintNonce((n) => n + 1);
  }

  function onSaved(t: TicketPrintData, doPrint: boolean) {
    if (doPrint) print(t);
    if (editing) {
      setEditing(null);
      setValues(emptyValues(materials));
    } else {
      // Continuous entry: keep catalog selections + customer (convoys from
      // the same customer arrive in series), clear the per-load fields.
      setValues((v) => ({ ...v, truck: "", tons: "", poNumber: "", jobNumber: "" }));
    }
    router.refresh();
  }

  async function onReprint(id: string) {
    setListError(null);
    const t = await getTicket(id);
    if (!t) return setListError("Could not load that ticket.");
    print(t);
  }

  async function onEdit(id: string) {
    setListError(null);
    const t = await getTicket(id);
    if (!t) return setListError("Could not load that ticket.");
    setEditing(t);
    setValues({
      materialId: t.materialId,
      truck: t.truckNumber,
      tons: String(t.netTons ?? ""),
      customer: t.customer,
      payment: t.payment,
      codMethod: t.codMethod ?? "CASH",
      poNumber: t.poNumber,
      jobNumber: t.jobNumber,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onVoid(row: TodayRow) {
    setListError(null);
    if (!window.confirm(`Void ticket ${row.ticket_number} (${row.customer}, ${Number(row.tons).toFixed(2)} t)?\nIt stays on record as VOID and stops counting.`)) {
      return;
    }
    const res = await voidOrder(row.id);
    if (!res.ok) return setListError(res.message);
    if (editing?.id === row.id) {
      setEditing(null);
      setValues(emptyValues(materials));
    }
    router.refresh();
  }

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-6 print:hidden lg:grid-cols-12">
        <div className="lg:col-span-6">
          <EntryForm
            materials={materials}
            truckNumbers={trucks.map((t) => t.truck_number)}
            today={today}
            values={values}
            onChange={setValues}
            truckGross={truckGross}
            editing={editing}
            onSaved={onSaved}
            onCancelEdit={() => {
              setEditing(null);
              setValues(emptyValues(materials));
            }}
          />
        </div>
        <div className="space-y-5 lg:col-span-6">
          <aside className="rounded-3xl border-2 border-pink-200/90 bg-white/95 p-5 shadow-cute sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-pink-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-100 text-sm font-black text-pink-600">
                  🎫
                </span>
                <h2 className="font-cute text-lg font-extrabold tracking-tight text-pink-950">
                  Ticket preview {editing ? `— editing #${editing.ticketNumber}` : ""}
                </h2>
              </div>
              <span className="text-[11px] font-bold text-pink-600">Prints 3 copies on a Letter sheet</span>
            </div>
            <ScaledTicket ticket={preview} />
          </aside>
          {listError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{listError}</p>
          )}
          <TodaysTickets
            {...todays}
            editingId={editing?.id ?? null}
            onReprint={onReprint}
            onEdit={onEdit}
            onVoid={onVoid}
          />
        </div>
      </div>
      <PrintSheet ticket={printTicket} nonce={printNonce} />
    </>
  );
}
