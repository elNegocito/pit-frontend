// Weight rules ported from the client's Excel "BASE" sheet:
//   the truck registry stores the truck GROSS (tons),
//   NET  = tons entered in the form,
//   TARE = GROSS - NET.
// Tickets for trucks that are not registered only show NET.
export const LBS_PER_TON = 2000;

export interface TicketWeights {
  gross: number | null;
  tare: number | null;
  net: number | null;
}

export function ticketWeights(truckGrossTons: number | null, netTons: number | null): TicketWeights {
  if (truckGrossTons === null) return { gross: null, tare: null, net: netTons };
  const tare = netTons === null ? null : Math.round((truckGrossTons - netTons) * 100) / 100;
  return { gross: truckGrossTons, tare, net: netTons };
}
