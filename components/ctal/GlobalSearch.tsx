"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { searchTickets, type TicketHit } from "@/lib/ctal/actions";
import { weekLabel } from "@/lib/ctal/compute";
import { formatTicketDate } from "@/lib/timezone";
import type { Carrier, Week } from "@/lib/ctal/types";
import { fold, Highlight } from "./Combobox";

/** One box for everything: carriers (name, #, owner, phone, USDOT), tickets and weeks. */
export function GlobalSearch({ carriers, weeks }: { carriers: Carrier[]; weeks: Week[] }) {
  const [q, setQ] = useState("");
  const [tickets, setTickets] = useState<TicketHit[]>([]);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  const term = fold(q.trim());
  useEffect(() => {
    if (term.length < 2) return;
    const run = ++latest.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const hits = await searchTickets(term).catch(() => []);
      // Ignore answers to a search that was typed over.
      if (run === latest.current) {
        setTickets(hits);
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [term]);

  const carrierHits = term
    ? carriers.filter((c) => fold(`${c.name} ${c.carrier_number} ${c.owner ?? ""} ${c.dispatch_contact ?? ""} ${c.usdot ?? ""} ${c.phone ?? ""} ${c.equipment ?? ""}`).includes(term)).slice(0, 6)
    : [];
  const weekHits = term ? weeks.filter((w) => weekLabel(w.week_start).includes(term) || formatTicketDate(w.pay_date).includes(term)).slice(0, 4) : [];
  const ticketHits = term.length >= 2 ? tickets : [];
  const nothing = term.length >= 2 && !loading && carrierHits.length + weekHits.length + ticketHits.length === 0;
  const item = "flex flex-wrap items-baseline justify-between gap-x-3 px-4 py-2 text-sm hover:bg-pine-50 focus-visible:bg-pine-100 outline-none";
  const group = "border-t border-rule px-4 pt-2 pb-1 text-xs font-semibold text-zinc-500 first:border-0";

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        placeholder="Search a carrier, a ticket number, a week…"
        aria-label="Search CTAL"
        className="w-full rounded-lg border border-rule bg-white px-4 py-3 text-base outline-none focus:border-pine-500 focus:ring-2 focus:ring-pine-200"
      />
      {term && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-rule bg-white shadow-xl shadow-pine-950/10">
          {carrierHits.length > 0 && <p className={group}>Carriers</p>}
          {carrierHits.map((c) => (
            <Link key={c.id} href={`/ctal/carriers/${c.id}`} className={item}>
              <span className="font-medium"><Highlight text={c.name} query={q} /></span>
              <span className="text-xs text-zinc-500 tabular-nums">#{c.carrier_number} {c.owner ?? ""}</span>
            </Link>
          ))}
          {ticketHits.length > 0 && <p className={group}>Tickets</p>}
          {ticketHits.map((t) => (
            <Link key={t.id} href={`/ctal/weeks/${t.week_id}?ticket=${encodeURIComponent(t.ticket)}`} className={item}>
              <span className="font-medium tabular-nums"><Highlight text={t.ticket} query={q} /></span>
              <span className="text-xs text-zinc-500">{formatTicketDate(t.load_date)}, {t.carrier_name}, {t.customer_name}</span>
            </Link>
          ))}
          {weekHits.length > 0 && <p className={group}>Weeks</p>}
          {weekHits.map((w) => (
            <Link key={w.id} href={`/ctal/weeks/${w.id}`} className={item}>
              <span className="font-medium tabular-nums">Week {weekLabel(w.week_start)}</span>
              <span className="text-xs text-zinc-500 tabular-nums">paid {formatTicketDate(w.pay_date)}</span>
            </Link>
          ))}
          {nothing && <p className="px-4 py-3 text-sm text-zinc-600">Nothing found for “{q.trim()}”. Try part of a name or a ticket number.</p>}
          {term.length < 2 && carrierHits.length === 0 && <p className="px-4 py-3 text-sm text-zinc-500">Keep typing…</p>}
        </div>
      )}
    </div>
  );
}
