// The three pay models from the client's Excel "PAYROLL MODELOS" (one tab
// per model), with the client's later changes (mixer paid per yard,
// "trucking" shown as Aggregate). They are the defaults of a new sheet: rates and extras are
// copied onto each sheet and can be adjusted there without touching older
// sheets.

export type PayModel = "flatbed" | "mixer" | "trucking";

export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABELS: Record<Day, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

export interface PayModelConfig {
  label: string;
  revenuePct: number;
  hourlyRate: number;
  /** null = no overtime (every hour at hourlyRate). */
  otRate: number | null;
  otThreshold: number;
  /**
   * Paid by % of each load's revenue (flat bed, aggregate). Mixer is not:
   * its loads have no revenue / company and pay per yard instead.
   */
  byRevenue: boolean;
  /**
   * Default $ per yard for the optional "EXTRA PER YARD" bonus (a checkbox on
   * the sheet, off by default); null = the model has no per-yard bonus.
   */
  perYardRate: number | null;
  /**
   * Which rate each driver of this group has of their own (saved on the
   * driver, migration 011): mixer $/hour, aggregate %. null = model rates.
   */
  driverRate: "hourly" | "pct" | null;
  /** Header of the free-text last loads column (zone / tons); null = numeric yards. */
  extraLabel: string | null;
  /** Empty load rows the template starts with. */
  loadRows: number;
  days: Day[];
  adjustments: { label: string; deduction: boolean }[];
}

export const PAY_MODELS: Record<PayModel, PayModelConfig> = {
  flatbed: {
    label: "Flat bed",
    revenuePct: 35,
    hourlyRate: 20,
    otRate: null,
    otThreshold: 40,
    byRevenue: true,
    perYardRate: null,
    driverRate: null,
    extraLabel: "Zone",
    loadRows: 22,
    days: ["MON", "TUE", "WED", "THU", "FRI"],
    adjustments: [
      { label: "HOLIDAY PAY", deduction: false },
      { label: "SAFETY MEETING PAY", deduction: false },
      { label: "BAD WEATHER DAY", deduction: false },
      { label: "DOT BONUS PAY", deduction: false },
      { label: "PAYROLL ERROR", deduction: false },
      { label: "MISC DEDUCTIONS", deduction: true },
    ],
  },
  mixer: {
    label: "Mixer",
    revenuePct: 0,
    hourlyRate: 28,
    otRate: 42,
    otThreshold: 40,
    byRevenue: false,
    perYardRate: 0.25,
    driverRate: "hourly",
    extraLabel: null,
    loadRows: 25,
    days: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
    adjustments: [
      { label: "SAFETY MEETING PAY", deduction: false },
      { label: "SAFETY BONUS", deduction: false },
      { label: "WEEKLY GROSS WAGE BONUS", deduction: false },
      { label: "MISC DEDUCTIONS", deduction: true },
    ],
  },
  // Key kept as "trucking" (stored in the DB); the client calls it Aggregate.
  trucking: {
    label: "Aggregate",
    revenuePct: 32,
    hourlyRate: 20,
    otRate: null,
    otThreshold: 40,
    byRevenue: true,
    perYardRate: null,
    driverRate: "pct",
    extraLabel: "Tons",
    loadRows: 25,
    days: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
    adjustments: [
      { label: "SAFETY MEETING PAY", deduction: false },
      { label: "BAD WEATHER PAY", deduction: false },
      { label: "PAYROLL ERROR", deduction: false },
      { label: "WEEKLY GROSS WAGE BONUS", deduction: false },
      { label: "MISC DEDUCTIONS", deduction: true },
    ],
  },
};

export const PAY_MODEL_KEYS = Object.keys(PAY_MODELS) as PayModel[];

export function isPayModel(v: unknown): v is PayModel {
  return typeof v === "string" && v in PAY_MODELS;
}

/** Overtime pays 1.5x the hourly rate ($28 -> $42). */
export const OT_MULTIPLIER = 1.5;

/**
 * Rates a new sheet starts with: the driver's own rate when the group has
 * one and it is set, else the model default. With overtime, OT = 1.5x hourly.
 */
export function sheetRates(
  model: PayModel,
  own?: { hourly_rate: number | null; revenue_pct: number | null } | null,
): { hourly: number; pct: number; ot: number | null } {
  const m = PAY_MODELS[model];
  const hourly = (m.driverRate === "hourly" ? own?.hourly_rate : null) ?? m.hourlyRate;
  const pct = (m.driverRate === "pct" ? own?.revenue_pct : null) ?? m.revenuePct;
  const ot = m.otRate === null ? null : Math.round(hourly * OT_MULTIPLIER * 100) / 100;
  return { hourly, pct, ot };
}

// Printed sheet header (from the Excel: billing phone / email).
export const PAYROLL_HEADER = {
  title: "ASG DRIVER PAY SHEET - LOCAL DRIVERS",
  phone: "817-240-7635",
  email: "BILLING@ALVARADOSAND.COM",
} as const;
