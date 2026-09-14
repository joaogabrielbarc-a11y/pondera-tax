import { TAX_RULES_2026 } from "./rules-2026";
import type {
  CarneLeaoMonth,
  DeclarationResult,
  MonthlyResult,
  PgblStudyAssumptions,
  PgblStudyResult,
  ProgressiveBracket,
  Projection,
  TaxState,
  VacationResult,
} from "./types";

export const money = (value: number) => Math.round((value + 1e-9) * 100) / 100;
export const sum = (values: number[]) =>
  money(values.reduce((total, value) => total + value, 0));

export function progressiveTax(
  base: number,
  brackets: readonly ProgressiveBracket[],
) {
  const safeBase = Math.max(0, base);
  const bracket =
    brackets.find((item) => safeBase <= item.upTo) ?? brackets.at(-1)!;
  return money(Math.max(0, safeBase * bracket.rate - bracket.deduction));
}

export function calculateInss(gross: number) {
  let previousLimit = 0;
  let total = 0;

  for (const bracket of TAX_RULES_2026.inss) {
    const slice = Math.max(0, Math.min(gross, bracket.upTo) - previousLimit);
    total += slice * bracket.rate;
    previousLimit = bracket.upTo;
    if (gross <= bracket.upTo) break;
  }

  return money(total);
}

export function monthlyReduction(
  grossTaxable: number,
  taxBeforeReduction: number,
) {
  if (grossTaxable <= 5_000) return Math.min(taxBeforeReduction, 312.89);
  if (grossTaxable <= 7_350) {
    return Math.min(
      taxBeforeReduction,
      Math.max(0, 978.62 - 0.133145 * grossTaxable),
    );
  }
  return 0;
}

export function annualReduction(
  grossTaxable: number,
  taxBeforeReduction: number,
) {
  if (grossTaxable <= 60_000) return Math.min(taxBeforeReduction, 2_694.15);
  if (grossTaxable <= 88_200) {
    return Math.min(
      taxBeforeReduction,
      Math.max(0, 8_429.73 - 0.095575 * grossTaxable),
    );
  }
  return 0;
}

function calculateMonthlyIrrf(gross: number, detailedDeductions: number) {
  const deductionUsed = money(
    Math.max(detailedDeductions, TAX_RULES_2026.monthlySimplified),
  );
  const taxableBase = money(Math.max(0, gross - deductionUsed));
  const beforeReduction = progressiveTax(taxableBase, TAX_RULES_2026.monthlyIr);
  const tax = money(
    Math.max(0, beforeReduction - monthlyReduction(gross, beforeReduction)),
  );
  return { deductionUsed, taxableBase, tax };
}

export function calculateVacation(
  state: TaxState,
  index: number,
): VacationResult {
  const event = state.vacations[index];
  const month = state.months[event.month] ?? state.months[0];
  const dailySalary = Math.max(0, month.salary) / 30;
  const baseVacation = money(
    dailySalary * event.daysTaken + event.taxableAverage,
  );
  const constitutionalOneThird = money(baseVacation / 3);
  const taxableGross = money(baseVacation + constitutionalOneThird);
  const abonoBase = money(dailySalary * event.daysSold + event.abonoAverage);
  const abonoOneThird = money(abonoBase / 3);
  const exemptGross = money(abonoBase + abonoOneThird);
  // Allocate one progressive contribution across all vacation events in the same month.
  const earlierGross = sum(
    state.vacations
      .slice(0, index)
      .filter((item) => item.month === event.month)
      .map((item) => {
        const base = money(dailySalary * item.daysTaken + item.taxableAverage);
        return money(base + money(base / 3));
      }),
  );
  const inssCalculated = money(
    calculateInss(earlierGross + taxableGross) - calculateInss(earlierGross),
  );
  const inssUsed = money(
    event.inssOverrideEnabled ? (event.actualInss ?? 0) : inssCalculated,
  );
  const irrf = calculateMonthlyIrrf(
    taxableGross,
    inssUsed + month.dependents * TAX_RULES_2026.dependentMonthly,
  );
  const irrfUsed = money(
    event.irrfOverrideEnabled ? (event.actualIrrf ?? 0) : irrf.tax,
  );
  const netAdvance = money(taxableGross + exemptGross - inssUsed - irrfUsed);

  return {
    ...event,
    baseVacation,
    constitutionalOneThird,
    taxableGross,
    abonoBase,
    abonoOneThird,
    exemptGross,
    inssCalculated,
    inssUsed,
    taxableBase: irrf.taxableBase,
    irrfCalculated: irrf.tax,
    irrfUsed,
    netAdvance,
    fgts: money(taxableGross * TAX_RULES_2026.fgtsRate),
  };
}

export function calculateMonthly(
  state: TaxState,
  monthIndex: number,
  vacations: VacationResult[],
): MonthlyResult {
  const month = pensionMonth(state, monthIndex);
  const vacationDays = Math.min(
    30,
    sum(
      vacations
        .filter((event) => event.month === monthIndex)
        .map((event) => event.daysTaken),
    ),
  );
  const proratedSalary = money(
    (month.salary * Math.max(0, 30 - vacationDays)) / 30,
  );
  const grossTaxable = money(
    proratedSalary +
      month.overtime +
      month.commission +
      month.bonus +
      month.otherTaxable,
  );
  const vacationGross = sum(
    vacations
      .filter((event) => event.month === monthIndex)
      .map((event) => event.taxableGross),
  );
  const vacationInss = sum(
    vacations
      .filter((event) => event.month === monthIndex)
      .map((event) => event.inssUsed),
  );
  const inssCalculated = money(
    Math.max(0, calculateInss(grossTaxable + vacationGross) - vacationInss),
  );
  const inssUsed = money(
    month.inssOverrideEnabled ? (month.actualInss ?? 0) : inssCalculated,
  );
  const detailedDeductions = money(
    inssUsed +
      month.dependents * TAX_RULES_2026.dependentMonthly +
      month.pension +
      month.otherLegalDeductions +
      month.pgblPayroll,
  );
  const irrf = calculateMonthlyIrrf(grossTaxable, detailedDeductions);
  const irrfUsed = money(
    month.irrfOverrideEnabled ? (month.actualIrrf ?? 0) : irrf.tax,
  );
  const vacationAdvanceDeduction = sum(
    vacations
      .filter(
        (event) => event.receivedAdvance && event.month + 1 === monthIndex,
      )
      .map((event) => event.netAdvance),
  );
  // The next payroll settles the vacation entitlement and deducts any advance
  // already paid. Never deduct that advance from unrelated ordinary salary twice.
  const vacationSettlementCredit = sum(
    vacations
      .filter((event) => event.month + 1 === monthIndex)
      .map((event) => event.netAdvance),
  );
  const netIncome = money(
    grossTaxable +
      month.nonTaxable -
      inssUsed -
      irrfUsed -
      month.pension -
      month.otherLegalDeductions -
      month.pgblPayroll -
      month.vgblPayroll -
      month.nonDeductiblePayroll -
      vacationAdvanceDeduction +
      vacationSettlementCredit,
  );

  return {
    ...month,
    vacationDays,
    proratedSalary,
    grossTaxable,
    inssCalculated,
    inssUsed,
    detailedDeductions,
    deductionUsed: irrf.deductionUsed,
    taxableBase: irrf.taxableBase,
    irrfCalculated: irrf.tax,
    irrfUsed,
    vacationAdvanceDeduction,
    vacationSettlementCredit,
    netIncome,
    fgts: money(grossTaxable * TAX_RULES_2026.fgtsRate),
  };
}

// Annual entry is not arbitrarily divided by 12: monthly tax cannot be inferred.
export function calculateCarneLeao(state: TaxState): CarneLeaoMonth[] {
  let carriedExpenses = 0;
  return state.months.map((payroll, month) => {
    const all = state.extraIncome.filter(
      (e) => e.entryMode !== "annual" && e.month === month,
    );
    const entries = all.filter((e) => e.payerType !== "legalEntity");
    const serviceGross = sum(
      all.filter((e) => e.type === "services").map((e) => e.gross),
    );
    const serviceExpenses = sum(
      all.filter((e) => e.type === "services").map((e) => e.deductibleExpenses),
    );
    const bookUsed = money(
      Math.min(serviceGross, serviceExpenses + carriedExpenses),
    );
    carriedExpenses = money(
      Math.max(0, serviceExpenses + carriedExpenses - bookUsed),
    );
    const gross = sum(entries.map(entryTaxableGross));
    const legal = sum([
      ...entries.map((e) => e.inss),
      bookUsed,
      Math.max(0, state.dependents.length - payroll.dependents) *
        TAX_RULES_2026.dependentMonthly,
    ]);
    const result = calculateMonthlyIrrf(gross, legal);
    return {
      month,
      gross,
      deductions: result.deductionUsed,
      taxableBase: result.taxableBase,
      taxDue: result.tax,
      taxPaid: sum(
        entries.map((e) => (e.carneLeaoPaid ? e.carneLeaoPaidAmount : 0)),
      ),
    };
  });
}

export function pensionMonth(state: TaxState, index: number) {
  const month = state.months[index];
  if (!state.retirement.automatic) return month;
  // Contractual gross salary is the explicit basis selected for compulsory contributions.
  return {
    ...month,
    pgblPayroll: money((month.salary * state.retirement.pgblPercent) / 100),
    vgblPayroll: money((month.salary * state.retirement.vgblPercent) / 100),
  };
}

const entryTaxableGross = (entry: TaxState["extraIncome"][number]) =>
  money(
    Math.max(
      0,
      entry.gross -
        (entry.type === "rent"
          ? Math.min(entry.gross, entry.deductibleExpenses)
          : 0),
    ),
  );

export function calculateThirteenth(state: TaxState) {
  const extraAverage =
    sum(
      state.months.map(
        (m) => m.overtime + m.commission + m.bonus + m.otherTaxable,
      ),
    ) / 12;
  const gross = money(
    state.events.thirteenthGrossOverrideEnabled
      ? state.events.thirteenthGross
      : state.months[11].salary + extraAverage,
  );
  const inss = money(
    state.events.thirteenthInssOverrideEnabled
      ? state.events.thirteenthInss
      : calculateInss(gross),
  );
  const result = calculateMonthlyIrrf(
    gross,
    inss + state.months[11].dependents * TAX_RULES_2026.dependentMonthly,
  );
  const irrfUsed = money(
    state.events.thirteenthIrrfOverrideEnabled
      ? (state.events.thirteenthIrrf ?? 0)
      : result.tax,
  );
  const firstInstallment = money(gross / 2);
  return {
    gross,
    inss,
    taxableBase: result.taxableBase,
    tax: result.tax,
    irrfUsed,
    firstInstallment,
    secondInstallment: money(gross - firstInstallment - inss - irrfUsed),
  };
}

function bookDeductions(state: TaxState) {
  let carry = 0;
  let used = 0;
  for (let month = 0; month < 12; month++) {
    const entries = state.extraIncome.filter(
      (e) =>
        e.type === "services" && e.entryMode !== "annual" && e.month === month,
    );
    const gross = sum(entries.map((e) => e.gross));
    const expenses = sum(entries.map((e) => e.deductibleExpenses));
    const deducted = money(Math.min(gross, expenses + carry));
    carry = money(Math.max(0, expenses + carry - deducted));
    used = sum([used, deducted]);
  }
  const annual = state.extraIncome.filter(
    (e) => e.type === "services" && e.entryMode === "annual",
  );
  return sum([
    used,
    Math.min(
      sum(annual.map((e) => e.gross)),
      sum(annual.map((e) => e.deductibleExpenses)),
    ),
  ]);
}

function buildDeclaration(
  model: DeclarationResult["model"],
  grossTaxable: number,
  deductions: number,
  withheld: number,
  prepaidTax: number,
  exclusiveTax: number,
): DeclarationResult {
  const taxableBase = money(Math.max(0, grossTaxable - deductions));
  const taxBeforeReduction = progressiveTax(
    taxableBase,
    TAX_RULES_2026.annualIr,
  );
  const adjustmentTax = money(
    Math.max(
      0,
      taxBeforeReduction - annualReduction(grossTaxable, taxBeforeReduction),
    ),
  );
  const taxDue = adjustmentTax; // Exclusive withholding never enters the annual adjustment.

  return {
    model,
    grossTaxable: money(grossTaxable),
    deductions: money(deductions),
    taxableBase,
    adjustmentTax,
    exclusiveTax: money(exclusiveTax),
    taxDue,
    withheld: money(withheld),
    prepaidTax: money(prepaidTax),
    balance: money(prepaidTax - taxDue),
  };
}

function calculateProjectionCore(state: TaxState, extraPgbl = 0): Projection {
  const vacations = state.vacations.map((_, index) =>
    calculateVacation(state, index),
  );
  const months = state.months.map((_, index) =>
    calculateMonthly(state, index, vacations),
  );
  const carneLeao = calculateCarneLeao(state);
  const thirteenth = calculateThirteenth(state);

  const payrollGross = sum(months.map((month) => month.grossTaxable));
  const vacationTaxable = sum(vacations.map((event) => event.taxableGross));
  const vacationExempt = sum(vacations.map((event) => event.exemptGross));
  const otherExempt = sum(months.map((month) => month.nonTaxable));
  const extraIncome = sum(state.extraIncome.map(entryTaxableGross));
  const dependentIncome = sum(
    state.dependents.map((dependent) =>
      dependent.hasTaxableIncome ? dependent.taxableIncome : 0,
    ),
  );
  const grossTaxable = sum([
    payrollGross,
    vacationTaxable,
    extraIncome,
    dependentIncome,
  ]);
  const deductibleInss = sum([
    ...months.map((month) => month.inssUsed),
    ...vacations.map((event) => event.inssUsed),
    ...state.extraIncome.map((entry) => entry.inss),
  ]);
  const annualInss = sum([deductibleInss, thirteenth.inss]);
  const monthlyPension = sum(months.map((month) => month.pension));
  const payrollPgbl = sum(months.map((month) => month.pgblPayroll));
  const pgblContributed = sum([
    payrollPgbl,
    state.deductions.pgblDirect,
    extraPgbl,
  ]);
  const pgblLimit = money(grossTaxable * TAX_RULES_2026.pgblLimitRate);
  const pgblDeductible = money(Math.min(pgblContributed, pgblLimit));
  const education = sum([
    Math.min(
      state.deductions.holderEducation,
      TAX_RULES_2026.educationAnnualPerBeneficiary,
    ),
    ...state.dependents.map((dependent) =>
      Math.min(
        dependent.education,
        TAX_RULES_2026.educationAnnualPerBeneficiary,
      ),
    ),
  ]);
  const dependentMedical = sum(
    state.dependents.map((dependent) => dependent.medical),
  );
  const completeDeductions = sum([
    deductibleInss,
    bookDeductions(state),
    ...months.map((month) => month.otherLegalDeductions),
    state.dependents.length * TAX_RULES_2026.dependentAnnual,
    monthlyPension,
    state.deductions.judicialPension,
    state.deductions.medical,
    dependentMedical,
    education,
    pgblDeductible,
    state.deductions.otherLegal,
  ]);
  const simplifiedDeductions = money(
    Math.min(grossTaxable * 0.2, TAX_RULES_2026.annualSimplifiedCap),
  );
  const plrTax = progressiveTax(state.events.plrGross, TAX_RULES_2026.plr);
  const thirteenthTax = thirteenth.tax;
  const exclusiveTax = sum([plrTax, thirteenthTax]);
  const plrWithheld = money(
    state.events.plrIrrfOverrideEnabled ? (state.events.plrIrrf ?? 0) : plrTax,
  );
  const thirteenthWithheld = thirteenth.irrfUsed;
  const totalWithheld = sum([
    ...months.map((month) => month.irrfUsed),
    ...vacations.map((event) => event.irrfUsed),
    ...state.extraIncome
      .filter((e) => e.payerType === "legalEntity")
      .map((entry) => entry.withheldIrrf),
    plrWithheld,
    thirteenthWithheld,
  ]);
  const totalCarneLeao = sum(carneLeao.map((item) => item.taxDue));
  const adjustmentWithheld = money(
    totalWithheld - plrWithheld - thirteenthWithheld,
  );
  const totalCarneLeaoPaid = sum(
    state.extraIncome
      .filter((e) => e.payerType !== "legalEntity" && e.carneLeaoPaid)
      .map((e) => e.carneLeaoPaidAmount),
  );
  const totalPrepaid = sum([adjustmentWithheld, totalCarneLeaoPaid]);

  const complete = buildDeclaration(
    "complete",
    grossTaxable,
    completeDeductions,
    adjustmentWithheld,
    totalPrepaid,
    exclusiveTax,
  );
  const simplified = buildDeclaration(
    "simplified",
    grossTaxable,
    simplifiedDeductions,
    adjustmentWithheld,
    totalPrepaid,
    exclusiveTax,
  );
  const recommended =
    complete.taxDue <= simplified.taxDue ? complete : simplified;
  const available = money(
    Math.max(0, pgblLimit - (payrollPgbl + state.deductions.pgblDirect)),
  );
  const totalFgts = sum([
    ...months.map((month) => month.fgts),
    ...vacations.map((event) => event.fgts),
    thirteenth.gross * TAX_RULES_2026.fgtsRate,
  ]);
  const extraNet = sum(
    state.extraIncome.map(
      (entry) =>
        entry.gross -
        (entry.type === "proLabore" ? 0 : entry.deductibleExpenses) -
        entry.inss -
        (entry.payerType === "legalEntity" ? entry.withheldIrrf : 0),
    ),
  );
  const totalNetIncome = sum([
    ...months.map((month) => month.netIncome),
    ...vacations
      .filter((event) => event.receivedAdvance)
      .map((event) => event.netAdvance),
    extraNet,
    dependentIncome,
    thirteenth.gross - thirteenthWithheld - thirteenth.inss,
    state.events.plrGross - plrWithheld,
    -totalCarneLeaoPaid,
  ]);

  return {
    months,
    vacations,
    carneLeao,
    complete,
    simplified,
    recommended,
    totalGrossIncome: sum([
      grossTaxable,
      sum(state.extraIncome.map((e) => e.gross)) - extraIncome,
      vacationExempt,
      otherExempt,
      thirteenth.gross,
      state.events.plrGross,
    ]),
    annualInss,
    deductibleInss,
    thirteenth,
    employerMatch: sum(
      months.map((m) =>
        money(
          ((m.pgblPayroll + m.vgblPayroll) *
            state.retirement.employerMatchPercent) /
            100,
        ),
      ),
    ),
    totalCarneLeaoPaid,
    warnings: [
      ...(state.extraIncome.some(
        (e) => e.entryMode === "annual" && e.payerType !== "legalEntity",
      )
        ? [
            "Renda anual direta: o Carnê-Leão mensal não pode ser apurado sem as datas e os valores de cada recebimento. Não foi dividido por 12.",
          ]
        : []),
      ...(carneLeao.some((m) => m.taxDue > m.taxPaid)
        ? [
            "Há Carnê-Leão devido sem recolhimento integral informado. Somente o principal efetivamente pago é compensado; verifique vencimentos, multa e juros no Sicalc.",
          ]
        : []),
      ...(plrWithheld !== plrTax || thirteenthWithheld !== thirteenthTax
        ? [
            "IRRF exclusivo informado diverge do previsto. Confira com a fonte pagadora: a diferença de PLR/13º não é compensada no ajuste anual.",
          ]
        : []),
      ...(months.some(
        (m) =>
          m.inssUsed +
            sum(
              vacations
                .filter((v) => v.month === m.month)
                .map((v) => v.inssUsed),
            ) >
          calculateInss(1e9),
      )
        ? [
            "Overrides de INSS excedem o teto de uma competência. Confira os recibos de férias e o holerite para não repetir o mesmo desconto.",
          ]
        : []),
      ...(grossTaxable > 600000
        ? [
            "Renda elevada: tributação mínima de altas rendas e situações especiais não são abrangidas por esta projeção CLT.",
          ]
        : []),
    ],
    totalFgts,
    totalWithheld,
    totalCarneLeao,
    totalPrepaid,
    totalNetIncome,
    plrTax,
    thirteenthTax,
    breakdown: {
      payroll: payrollGross,
      vacationTaxable,
      vacationExempt,
      extraIncome,
      dependentIncome,
      thirteenth: thirteenth.gross,
      plr: money(state.events.plrGross),
      otherExempt,
    },
    pgbl: {
      contributed: pgblContributed,
      deductible: pgblDeductible,
      limit: pgblLimit,
      available,
      excess: money(Math.max(0, pgblContributed - pgblLimit)),
      potentialSavings: 0,
      optimizedCompleteBalance: complete.balance,
    },
  };
}

export function calculateProjection(
  state: TaxState,
  extraPgbl = 0,
): Projection {
  const result = calculateProjectionCore(state, extraPgbl);
  if (extraPgbl <= 0) return result;
  const current = calculateProjectionCore(state, 0);
  return {
    ...result,
    pgbl: {
      ...result.pgbl,
      potentialSavings: money(current.complete.taxDue - result.complete.taxDue),
    },
  };
}

export function calculatePgblOpportunity(state: TaxState) {
  const current = calculateProjectionCore(state, 0);
  const optimized = calculateProjectionCore(state, current.pgbl.available);
  return {
    current,
    optimized,
    taxSavings: money(
      Math.max(0, current.recommended.taxDue - optimized.recommended.taxDue),
    ),
    balanceGain: money(
      Math.max(0, optimized.recommended.balance - current.recommended.balance),
    ),
  };
}

const futureAfterAnnualFee = (
  principal: number,
  grossRate: number,
  annualFee: number,
  years: number,
) => principal * Math.pow((1 + grossRate) * (1 - annualFee), years);

const futureNetTraditional = (
  principal: number,
  grossRate: number,
  annualFee: number,
  gainsTaxRate: number,
  years: number,
) => {
  const grossWithoutFees = principal * Math.pow(1 + grossRate, years);
  const afterFees = futureAfterAnnualFee(
    principal,
    grossRate,
    annualFee,
    years,
  );
  const gainsTax = Math.max(0, afterFees - principal) * gainsTaxRate;
  return {
    grossWithoutFees: money(grossWithoutFees),
    administrationCost: money(Math.max(0, grossWithoutFees - afterFees)),
    gainsTax: money(gainsTax),
    netBalance: money(afterFees - gainsTax),
  };
};

/** Compara um aporte único em PGBL com investimento tradicional equivalente. */
export function calculatePgblStudy(
  state: TaxState,
  assumptions: PgblStudyAssumptions,
): PgblStudyResult {
  const current = calculateProjectionCore(state, 0);
  const contribution = money(
    Math.min(
      current.pgbl.available,
      Math.max(0, assumptions.contribution),
    ),
  );
  const years = Math.max(1, Math.min(50, Math.round(assumptions.years)));
  const taxEfficiency = money(
    Math.max(
      0,
      current.complete.taxDue -
        calculateProjectionCore(state, contribution).complete.taxDue,
    ),
  );
  const traditional = futureNetTraditional(
    contribution,
    assumptions.traditionalGrossReturnRate,
    assumptions.traditionalAdminFeeRate,
    assumptions.traditionalGainsTaxRate,
    years,
  );
  const pgblGrossWithoutFees =
    contribution * Math.pow(1 + assumptions.pgblGrossReturnRate, years);
  const pgblAfterFees = futureAfterAnnualFee(
    contribution,
    assumptions.pgblGrossReturnRate,
    assumptions.pgblAdminFeeRate,
    years,
  );
  const pgblTax = Math.max(0, pgblAfterFees) * assumptions.pgblExitTaxRate;
  const pgbl = {
    grossWithoutFees: money(pgblGrossWithoutFees),
    administrationCost: money(
      Math.max(0, pgblGrossWithoutFees - pgblAfterFees),
    ),
    redemptionTax: money(pgblTax),
    netBalance: money(pgblAfterFees - pgblTax),
  };
  const reinvestment = futureNetTraditional(
    taxEfficiency,
    assumptions.reinvestmentRate,
    0,
    assumptions.traditionalGainsTaxRate,
    years,
  );
  const pgblStrategyNet = money(pgbl.netBalance + reinvestment.netBalance);
  const series = Array.from({ length: years + 1 }, (_, year) => {
    const traditionalAtYear = futureNetTraditional(
      contribution,
      assumptions.traditionalGrossReturnRate,
      assumptions.traditionalAdminFeeRate,
      assumptions.traditionalGainsTaxRate,
      year,
    );
    const pgblAtYear = money(
      futureAfterAnnualFee(
        contribution,
        assumptions.pgblGrossReturnRate,
        assumptions.pgblAdminFeeRate,
        year,
      ) *
        (1 - assumptions.pgblExitTaxRate),
    );
    const reinvestmentAtYear = futureNetTraditional(
      taxEfficiency,
      assumptions.reinvestmentRate,
      0,
      assumptions.traditionalGainsTaxRate,
      year,
    );
    return {
      year,
      pgblStrategyNet: money(pgblAtYear + reinvestmentAtYear.netBalance),
      traditionalNet: traditionalAtYear.netBalance,
    };
  });

  return {
    contribution,
    taxEfficiency,
    pgbl,
    reinvestment: {
      grossBalance: reinvestment.grossWithoutFees,
      gainsTax: reinvestment.gainsTax,
      netBalance: reinvestment.netBalance,
    },
    traditional,
    pgblStrategyNet,
    advantage: money(pgblStrategyNet - traditional.netBalance),
    series,
  };
}
