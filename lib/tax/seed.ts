import type {
  Dependent,
  Employer,
  ExtraIncome,
  PayrollMonth,
  TaxState,
  VacationEvent,
} from "./types";

export const PRIMARY_EMPLOYER_ID = "employer-primary";

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

export const createBlankMonth = (
  month: number,
  employerId = PRIMARY_EMPLOYER_ID,
  withDemoValues = employerId === PRIMARY_EMPLOYER_ID,
): PayrollMonth => ({
  id: `${employerId}-2026-${String(month + 1).padStart(2, "0")}`,
  employerId,
  month,
  status: month < 8 ? "actual" : "projected",
  salary: withDemoValues ? salaryFor(month) : 0,
  overtime: 0,
  commission: 0,
  bonus: withDemoValues && month === 5 ? 1_845 : 0,
  otherTaxable: withDemoValues && month === 5 ? 2_680 : 0,
  nonTaxable: 0,
  dependents: 0,
  pension: 0,
  otherLegalDeductions: 0,
  pgblPayroll: 0,
  vgblPayroll: 0,
  actualInss: null,
  actualIrrf: null,
  irrfOverrideEnabled: false,
  inssOverrideEnabled: false,
  nonDeductiblePayroll: 0,
});

const randomId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const createEmployment = (name = "Novo vínculo") => {
  const employer: Employer = { id: randomId("employer"), name };
  return {
    employer,
    months: Array.from({ length: 12 }, (_, month) =>
      createBlankMonth(month, employer.id, false),
    ),
  };
};

export const createVacation = (
  month = 0,
  employerId = PRIMARY_EMPLOYER_ID,
): VacationEvent => ({
  id: randomId("vacation"),
  employerId,
  month,
  daysTaken: 0,
  daysSold: 0,
  taxableAverage: 0,
  abonoAverage: 0,
  receivedAdvance: true,
  actualInss: null,
  actualIrrf: null,
  irrfOverrideEnabled: false,
  inssOverrideEnabled: false,
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
  entryMode: "monthly",
  carneLeaoPaid: false,
  carneLeaoPaidAmount: 0,
  carneLeaoPaidOverrideEnabled: false,
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
  version: 4,
  taxYear: 2026,
  exerciseYear: 2027,
  taxpayerName: "Seu planejamento",
  employers: [{ id: PRIMARY_EMPLOYER_ID, name: "Empregador principal" }],
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
  retirement: {
    automatic: false,
    pgblPercent: 0,
    vgblPercent: 0,
    employerMatchPercent: 100,
  },
  events: {
    thirteenthGrossOverrideEnabled: false,
    thirteenthInssOverrideEnabled: false,
    thirteenthIrrfOverrideEnabled: false,
    plrIrrfOverrideEnabled: false,
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
  retirement?: TaxState["retirement"];
  employers?: Employer[];
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

  if (
    incoming.version === 2 ||
    incoming.version === 3 ||
    incoming.version === 4
  ) {
    const employers = incoming.employers?.length
      ? incoming.employers
      : [{ id: PRIMARY_EMPLOYER_ID, name: "Empregador principal" }];
    const incomingMonths = incoming.months ?? [];
    const migratedMonths =
      incoming.version === 4
        ? incomingMonths.map((item, index) => ({
            ...createBlankMonth(
              item.month ?? index % 12,
              item.employerId ?? employers[0].id,
              false,
            ),
            ...item,
            employerId: item.employerId ?? employers[0].id,
          }))
        : base.months.map((fallback, index) => ({
            ...fallback,
            ...(incomingMonths[index] ?? {}),
            employerId: employers[0].id,
            month: index,
            commission:
              (incomingMonths[index]?.commission ?? fallback.commission) +
              (incomingMonths[index]?.bonus ?? fallback.bonus),
            bonus: 0,
            inssOverrideEnabled:
              incomingMonths[index]?.inssOverrideEnabled ??
              incomingMonths[index]?.actualInss != null,
          }));
    return {
      ...base,
      ...incoming,
      version: 4,
      employers,
      months: migratedMonths,
      vacations: (incoming.vacations ?? []).map((event) => ({
        ...createVacation(event.month, event.employerId ?? employers[0].id),
        ...event,
        employerId: event.employerId ?? employers[0].id,
        inssOverrideEnabled:
          event.inssOverrideEnabled ?? event.actualInss != null,
      })),
      extraIncome: (incoming.extraIncome ?? []).map((entry) => ({
        ...createExtraIncome(entry.month),
        ...entry,
        carneLeaoPaidOverrideEnabled:
          entry.carneLeaoPaidOverrideEnabled ?? entry.carneLeaoPaidAmount > 0,
      })),
      retirement: { ...base.retirement, ...incoming.retirement },
      dependents: Array.isArray(incoming.dependents) ? incoming.dependents : [],
      events: {
        ...base.events,
        ...(incoming.events ?? {}),
        thirteenthGrossOverrideEnabled:
          incoming.events?.thirteenthGrossOverrideEnabled ??
          incoming.events?.thirteenthGross != null,
        thirteenthInssOverrideEnabled:
          incoming.events?.thirteenthInssOverrideEnabled ??
          incoming.events?.thirteenthInss != null,
        thirteenthIrrfOverrideEnabled:
          incoming.events?.thirteenthIrrfOverrideEnabled ??
          incoming.events?.thirteenthIrrf != null,
        plrIrrfOverrideEnabled:
          incoming.events?.plrIrrfOverrideEnabled ??
          incoming.events?.plrIrrf != null,
      },
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
      employerId: PRIMARY_EMPLOYER_ID,
      month: index,
      vgblPayroll: 0,
      commission:
        (legacy.commission ?? fallback.commission) +
        (legacy.bonus ?? fallback.bonus),
      bonus: 0,
      inssOverrideEnabled: legacy.actualInss != null,
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
    employers: base.employers,
    months,
    vacations,
    dependents,
    events: {
      ...base.events,
      ...(incoming.events ?? {}),
      thirteenthGrossOverrideEnabled:
        incoming.events?.thirteenthGrossOverrideEnabled ??
        incoming.events?.thirteenthGross != null,
      thirteenthInssOverrideEnabled:
        incoming.events?.thirteenthInssOverrideEnabled ??
        incoming.events?.thirteenthInss != null,
      thirteenthIrrfOverrideEnabled:
        incoming.events?.thirteenthIrrfOverrideEnabled ??
        incoming.events?.thirteenthIrrf != null,
      plrIrrfOverrideEnabled:
        incoming.events?.plrIrrfOverrideEnabled ??
        incoming.events?.plrIrrf != null,
    },
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
