import type { PayrollMonth, TaxState } from "./types";

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const salaryFor = (month: number) => (month < 8 ? 12_608 : 13_124.93);

export const monthLabel = (month: number) => monthNames[month] ?? "Mês";

export const createBlankMonth = (month: number): PayrollMonth => ({
  id: `2026-${String(month + 1).padStart(2, "0")}`,
  month,
  status: month < 8 ? "actual" : "projected",
  salary: salaryFor(month),
  overtime: 0,
  commission: 0,
  bonus: month === 5 ? 1_845 : 0,
  vacationPay: month === 2 ? 5_883.73 : month === 10 ? 2_187.49 : 0,
  vacationOneThird: month === 2 ? 1_961.24 : month === 10 ? 729.16 : 0,
  otherTaxable: month === 5 ? 2_680 : 0,
  nonTaxable: 0,
  dependents: 0,
  pension: 0,
  otherLegalDeductions: 0,
  pgblPayroll: 0,
  actualInss: null,
  actualIrrf: null,
});

export const createInitialState = (): TaxState => ({
  version: 1,
  taxYear: 2026,
  exerciseYear: 2027,
  taxpayerName: "Seu planejamento",
  dependents: 0,
  months: Array.from({ length: 12 }, (_, month) => createBlankMonth(month)),
  events: {
    thirteenthGross: 13_402.83,
    thirteenthInss: 988.09,
    thirteenthIrrf: null,
    plrGross: 34_459,
    plrIrrf: null,
  },
  deductions: {
    medical: 1_044,
    educationByBeneficiary: [],
    judicialPension: 0,
    pgblDirect: 5_000,
    otherLegal: 0,
  },
});
