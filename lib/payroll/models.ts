// The three pay models from the client's Excel "PAYROLL MODELOS" (one tab
// per model). They are the defaults of a new sheet: rates and extras are
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
  /** Header of the last loads column (zone / tons / yards). */
  extraLabel: string;
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
    revenuePct: 30,
    hourlyRate: 28,
    otRate: 42,
    otThreshold: 40,
    extraLabel: "Yards",
    loadRows: 25,
    days: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
    adjustments: [
      { label: "SAFETY MEETING PAY", deduction: false },
      { label: "SAFETY BONUS", deduction: false },
      { label: "WEEKLY GROSS WAGE BONUS", deduction: false },
      { label: "MISC DEDUCTIONS", deduction: true },
    ],
  },
  trucking: {
    label: "Trucking",
    revenuePct: 32,
    hourlyRate: 20,
    otRate: null,
    otThreshold: 40,
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

// Printed sheet header (from the Excel: billing phone / email).
export const PAYROLL_HEADER = {
  title: "ASG DRIVER PAY SHEET - LOCAL DRIVERS",
  phone: "817-240-7635",
  email: "BILLING@ALVARADOSAND.COM",
} as const;
