// Weight rules (client correction of the Excel "BASE" sheet):
//   the truck registry stores the truck TARE (empty weight, tons),
//   NET   = tons entered in the form (material loaded),
//   GROSS = TARE + NET.
// Tickets for trucks that are not registered only show NET.
export const LBS_PER_TON = 2000;

export interface TicketWeights {
  gross: number | null;
  tare: number | null;
  net: number | null;
}

export function ticketWeights(truckTareTons: number | null, netTons: number | null): TicketWeights {
  if (truckTareTons === null) return { gross: null, tare: null, net: netTons };
  const gross = netTons === null ? null : Math.round((truckTareTons + netTons) * 100) / 100;
  return { gross, tare: truckTareTons, net: netTons };
}
