// Must mirror the SQL normalization exactly:
//   upper(regexp_replace(trim(name), '\s+', ' ', 'g'))
// Used to resolve customers (and materials) before insert so casing or extra
// spaces can never fork a customer into two ("ghost customers" in the Excel).
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

export function normalizeTicket(ticket: string): string {
  return ticket.trim().replace(/\s+/g, "").toUpperCase();
}
