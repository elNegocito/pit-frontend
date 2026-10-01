// Business-date helpers. The pit operates on America/Chicago calendar days:
// the entry form defaults to "today in Chicago", and orders store a plain
// DATE (no time component), so midnight boundaries can never shift a record
// to the wrong day.
export const PIT_TIME_ZONE = "America/Chicago";

/** Today's date in the pit timezone as yyyy-MM-dd (suitable for a DATE column). */
export function todayInPit(realNow: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PIT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(realNow);
  return parts; // en-CA yields yyyy-MM-dd
}

/** Human label shown next to the locked date field, e.g. "Sep 14, 2026 (Chicago)". */
export function formatPitDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: PIT_TIME_ZONE,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(dt) + " (Chicago)"
  );
}

/** Ticket header date, e.g. "09/30/2026". */
export function formatTicketDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${m}/${d}/${y}`;
}

/** Ticket header time in the pit timezone, e.g. "3:24 PM". */
export function formatTicketTime(at: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PIT_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

/** UTC instant (ISO) of 00:00 on `isoDate` in the pit timezone. */
export function pitDayStartUtc(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  // Offset at 00:00 local (e.g. "GMT-05:00"); DST switches at 2 AM, so the
  // offset just after UTC midnight-ish of that day is the right one.
  const probe = new Date(Date.UTC(y, m - 1, d, 6));
  const tz =
    new Intl.DateTimeFormat("en-US", { timeZone: PIT_TIME_ZONE, timeZoneName: "longOffset" })
      .formatToParts(probe)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(tz);
  const offsetMin = match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
  return new Date(Date.UTC(y, m - 1, d) - offsetMin * 60000).toISOString();
}
