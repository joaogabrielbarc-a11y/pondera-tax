import type {
  Dependent,
  ExtraIncome,
  PayrollMonth,
  TaxState,
  VacationEvent,
} from "./types";

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
  otherTaxable: month === 5 ? 2_680 : 0,
  nonTaxable: 0,
  dependents: 0,
  pension: 0,
  otherLegalDeductions: 0,
  pgblPayroll: 0,
  vgblPayroll: 0,
  actualInss: null,
  actualIrrf: null,
  irrfOverrideEnabled: false,
});

const randomId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const createVacation = (month = 0): VacationEvent => ({
  id: randomId("vacation"),
  month,
  daysTaken: 0,
  daysSold: 0,
  taxableAverage: 0,
  abonoAverage: 0,
  receivedAdvance: true,
  actualInss: null,
  actualIrrf: null,
  irrfOverrideEnabled: false,
});

export const createExtraIncome = (month = 0): ExtraIncome => ({
  id: randomId("income"),
  month,
  type: "rent",
  description: "",
  payerType: "individual",
  gross: 0,
  deductibleExpenses: 0,
  inss: 0,
  withheldIrrf: 0,
});

export const createDependent = (): Dependent => ({
  id: randomId("dependent"),
  name: "",
  hasTaxableIncome: false,
  taxableIncome: 0,
  education: 0,
  medical: 0,
});

export const createInitialState = (): TaxState => ({
  version: 2,
  taxYear: 2026,
  exerciseYear: 2027,
  taxpayerName: "Seu planejamento",
  months: Array.from({ length: 12 }, (_, month) => createBlankMonth(month)),
  vacations: [
    {
      ...createVacation(2),
      id: "vacation-2026-03",
      daysTaken: 14,
      taxableAverage: 611.2,
    },
    {
      ...createVacation(10),
      id: "vacation-2026-11",
      daysTaken: 5,
      daysSold: 10,
      taxableAverage: 46,
    },
  ],
  extraIncome: [],
  dependents: [],
  events: {
    thirteenthGross: 13_402.83,
    thirteenthInss: 988.09,
    thirteenthIrrf: null,
    plrGross: 34_459,
    plrIrrf: null,
  },
  deductions: {
    medical: 1_044,
    holderEducation: 0,
    judicialPension: 0,
    pgblDirect: 5_000,
    otherLegal: 0,
  },
});

type LegacyMonth = Partial<PayrollMonth> & {
  vacationPay?: number;
  vacationOneThird?: number;
};

type LegacyState = {
  version?: number;
  taxpayerName?: string;
  dependents?: number | Dependent[];
  months?: LegacyMonth[];
  vacations?: VacationEvent[];
  extraIncome?: ExtraIncome[];
  events?: Partial<TaxState["events"]>;
  deductions?: Partial<TaxState["deductions"]> & {
    educationByBeneficiary?: number[];
  };
};

export function migrateTaxState(value: unknown): TaxState {
  if (!value || typeof value !== "object") return createInitialState();
  const incoming = value as LegacyState;
  const base = createInitialState();

  if (incoming.version === 2) {
    return {
      ...base,
      ...incoming,
      version: 2,
      months: base.months.map((fallback, index) => ({
        ...fallback,
        ...(incoming.months?.[index] ?? {}),
        month: index,
      })),
      vacations: incoming.vacations ?? [],
      extraIncome: incoming.extraIncome ?? [],
      dependents: Array.isArray(incoming.dependents) ? incoming.dependents : [],
      events: { ...base.events, ...(incoming.events ?? {}) },
      deductions: { ...base.deductions, ...(incoming.deductions ?? {}) },
    };
  }

  const legacyMonths = incoming.months ?? [];
  const months = base.months.map((fallback, index) => {
    const legacy = legacyMonths[index] ?? {};
    const {
      vacationPay: _vacationPay,
      vacationOneThird: _vacationOneThird,
      ...payroll
    } = legacy;
    void _vacationPay;
    void _vacationOneThird;
    return {
      ...fallback,
      ...payroll,
      month: index,
      vgblPayroll: 0,
      irrfOverrideEnabled:
        legacy.actualIrrf !== null && legacy.actualIrrf !== undefined,
    };
  });
  const vacations = legacyMonths.flatMap((month, index) => {
    const vacationPay = Number(month.vacationPay) || 0;
    const oneThird = Number(month.vacationOneThird) || 0;
    if (vacationPay + oneThird <= 0) return [];
    return [
      {
        ...createVacation(index),
        id: `migrated-vacation-${index + 1}`,
        taxableAverage:
          vacationPay > 0 ? vacationPay : Math.round(oneThird * 300) / 100,
      },
    ];
  });
  const dependentCount = Array.isArray(incoming.dependents)
    ? incoming.dependents.length
    : Number(incoming.dependents) || 0;
  const legacyEducation = incoming.deductions?.educationByBeneficiary ?? [];
  const dependents = Array.from({ length: dependentCount }, (_, index) => ({
    ...createDependent(),
    id: `migrated-dependent-${index + 1}`,
    name: `Dependente ${index + 1}`,
    education: legacyEducation[index + 1] ?? 0,
  }));

  return {
    ...base,
    taxpayerName: incoming.taxpayerName ?? base.taxpayerName,
    months,
    vacations,
    dependents,
    events: { ...base.events, ...(incoming.events ?? {}) },
    deductions: {
      ...base.deductions,
      medical: Number(incoming.deductions?.medical) || 0,
      holderEducation: legacyEducation[0] ?? 0,
      judicialPension: Number(incoming.deductions?.judicialPension) || 0,
      pgblDirect: Number(incoming.deductions?.pgblDirect) || 0,
      otherLegal: Number(incoming.deductions?.otherLegal) || 0,
    },
  };
}
