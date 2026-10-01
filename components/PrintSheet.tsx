"use client";

import { useEffect, useRef, useState } from "react";
import type { TicketPrintData } from "@/lib/types";
import { TICKET_HEIGHT_IN, TICKET_WIDTH_IN, TicketView } from "./TicketView";

const COPIES = 3;

/**
 * Print-only Letter sheet with the same ticket three times (one per
 * perforated third). Invisible on screen; the rest of the page is hidden on
 * print via `print:hidden`. Bump `nonce` to print `ticket`.
 */
export function PrintSheet({ ticket, nonce }: { ticket: TicketPrintData | null; nonce: number }) {
  useEffect(() => {
    if (ticket && nonce > 0) {
      // Let React paint the sheet before the browser snapshots it.
      const id = requestAnimationFrame(() => window.print());
      return () => cancelAnimationFrame(id);
    }
  }, [nonce, ticket]);

  if (!ticket) return null;
  return (
    <div className="hidden print:block">
      {Array.from({ length: COPIES }, (_, i) => (
        <TicketView key={i} t={ticket} />
      ))}
    </div>
  );
}

/** Ticket preview scaled down to the width of its container. */
export function ScaledTicket({ ticket }: { ticket: TicketPrintData }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      // 96 CSS px per inch.
      setScale(Math.min(1, entry.contentRect.width / (TICKET_WIDTH_IN * 96)));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="w-full">
      <div
        className="overflow-hidden rounded border border-zinc-300 shadow-sm"
        style={{ height: TICKET_HEIGHT_IN * 96 * scale, width: TICKET_WIDTH_IN * 96 * scale }}
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <TicketView t={ticket} />
        </div>
      </div>
    </div>
  );
}
