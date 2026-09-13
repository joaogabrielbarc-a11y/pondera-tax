import type { ProgressiveBracket } from "./types";

export const TAX_RULES_2026 = {
  taxYear: 2026,
  exerciseYear: 2027,
  dependentMonthly: 189.59,
  dependentAnnual: 2_275.08,
  educationAnnualPerBeneficiary: 3_561.5,
  monthlySimplified: 607.2,
  annualSimplifiedCap: 17_640,
  pgblLimitRate: 0.12,
  fgtsRate: 0.08,
  inss: [
    { upTo: 1_621, rate: 0.075 },
    { upTo: 2_902.84, rate: 0.09 },
    { upTo: 4_354.27, rate: 0.12 },
    { upTo: 8_475.55, rate: 0.14 },
  ],
  monthlyIr: [
    { upTo: 2_428.8, rate: 0, deduction: 0 },
    { upTo: 2_826.65, rate: 0.075, deduction: 182.16 },
    { upTo: 3_751.05, rate: 0.15, deduction: 394.16 },
    { upTo: 4_664.68, rate: 0.225, deduction: 675.49 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.275, deduction: 908.73 },
  ] satisfies ProgressiveBracket[],
  annualIr: [
    { upTo: 29_145.6, rate: 0, deduction: 0 },
    { upTo: 33_919.8, rate: 0.075, deduction: 2_185.92 },
    { upTo: 45_012.6, rate: 0.15, deduction: 4_729.91 },
    { upTo: 55_976.16, rate: 0.225, deduction: 8_105.85 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.275, deduction: 10_904.66 },
  ] satisfies ProgressiveBracket[],
  plr: [
    { upTo: 8_214.4, rate: 0, deduction: 0 },
    { upTo: 9_922.28, rate: 0.075, deduction: 616.08 },
    { upTo: 13_167, rate: 0.15, deduction: 1_360.25 },
    { upTo: 16_380.38, rate: 0.225, deduction: 2_347.78 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.275, deduction: 3_166.8 },
  ] satisfies ProgressiveBracket[],
} as const;
