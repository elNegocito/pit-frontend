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
