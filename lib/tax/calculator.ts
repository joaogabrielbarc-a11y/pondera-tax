import { TAX_RULES_2026 } from "./rules-2026";
import type {
  CarneLeaoMonth,
  DeclarationResult,
  MonthlyResult,
  ProgressiveBracket,
  Projection,
  TaxState,
  VacationResult,
} from "./types";

const money = (value: number) => Math.round((value + 1e-9) * 100) / 100;
const sum = (values: number[]) =>
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
  const inssCalculated = calculateInss(taxableGross);
  const inssUsed = money(event.actualInss ?? inssCalculated);
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
  const month = state.months[monthIndex];
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
  const inssUsed = money(month.actualInss ?? inssCalculated);
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
  const netIncome = money(
    grossTaxable +
      month.nonTaxable -
      inssUsed -
      irrfUsed -
      month.pension -
      month.otherLegalDeductions -
      month.pgblPayroll -
      month.vgblPayroll -
      vacationAdvanceDeduction,
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
    netIncome,
    fgts: money(grossTaxable * TAX_RULES_2026.fgtsRate),
  };
}

export function calculateCarneLeao(state: TaxState): CarneLeaoMonth[] {
  return state.months.map((_, month) => {
    const entries = state.extraIncome.filter(
      (entry) => entry.month === month && entry.payerType !== "legalEntity",
    );
    const gross = sum(entries.map((entry) => entry.gross));
    if (gross === 0) {
      return { month, gross: 0, deductions: 0, taxableBase: 0, taxDue: 0 };
    }
    const legalDeductions = sum([
      ...entries.map((entry) => entry.deductibleExpenses + entry.inss),
      state.dependents.length * TAX_RULES_2026.dependentMonthly,
    ]);
    const result = calculateMonthlyIrrf(gross, legalDeductions);
    return {
      month,
      gross,
      deductions: result.deductionUsed,
      taxableBase: result.taxableBase,
      taxDue: result.tax,
    };
  });
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
  const taxDue = money(adjustmentTax + exclusiveTax);

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

function calculateThirteenthTax(state: TaxState) {
  const deductions =
    state.events.thirteenthInss +
    state.dependents.length * TAX_RULES_2026.dependentMonthly;
  return calculateMonthlyIrrf(state.events.thirteenthGross, deductions).tax;
}

function calculateProjectionCore(state: TaxState, extraPgbl = 0): Projection {
  const vacations = state.vacations.map((_, index) =>
    calculateVacation(state, index),
  );
  const months = state.months.map((_, index) =>
    calculateMonthly(state, index, vacations),
  );
  const carneLeao = calculateCarneLeao(state);

  const payrollGross = sum(months.map((month) => month.grossTaxable));
  const vacationTaxable = sum(vacations.map((event) => event.taxableGross));
  const vacationExempt = sum(vacations.map((event) => event.exemptGross));
  const otherExempt = sum(months.map((month) => month.nonTaxable));
  const extraIncome = sum(
    state.extraIncome.map((entry) =>
      Math.max(0, entry.gross - entry.deductibleExpenses),
    ),
  );
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
  const annualInss = sum([
    ...months.map((month) => month.inssUsed),
    ...vacations.map((event) => event.inssUsed),
    ...state.extraIncome.map((entry) => entry.inss),
  ]);
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
    annualInss,
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
  const thirteenthTax = calculateThirteenthTax(state);
  const exclusiveTax = sum([plrTax, thirteenthTax]);
  const plrWithheld = money(state.events.plrIrrf ?? plrTax);
  const thirteenthWithheld = money(
    state.events.thirteenthIrrf ?? thirteenthTax,
  );
  const totalWithheld = sum([
    ...months.map((month) => month.irrfUsed),
    ...vacations.map((event) => event.irrfUsed),
    ...state.extraIncome.map((entry) => entry.withheldIrrf),
    plrWithheld,
    thirteenthWithheld,
  ]);
  const totalCarneLeao = sum(carneLeao.map((item) => item.taxDue));
  const totalPrepaid = sum([totalWithheld, totalCarneLeao]);

  const complete = buildDeclaration(
    "complete",
    grossTaxable,
    completeDeductions,
    totalWithheld,
    totalPrepaid,
    exclusiveTax,
  );
  const simplified = buildDeclaration(
    "simplified",
    grossTaxable,
    simplifiedDeductions,
    totalWithheld,
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
    state.events.thirteenthGross * TAX_RULES_2026.fgtsRate,
  ]);
  const extraNet = sum(
    state.extraIncome.map(
      (entry) =>
        entry.gross -
        entry.deductibleExpenses -
        entry.inss -
        entry.withheldIrrf,
    ),
  );
  const totalNetIncome = sum([
    ...months.map((month) => month.netIncome),
    ...vacations.map((event) => event.netAdvance),
    extraNet,
    dependentIncome,
    state.events.thirteenthGross -
      thirteenthWithheld -
      state.events.thirteenthInss,
    state.events.plrGross - plrWithheld,
    -totalCarneLeao,
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
      vacationExempt,
      otherExempt,
      state.events.thirteenthGross,
      state.events.plrGross,
    ]),
    annualInss,
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
      thirteenth: money(state.events.thirteenthGross),
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
    taxSavings: money(current.complete.taxDue - optimized.complete.taxDue),
    balanceGain: money(optimized.complete.balance - current.complete.balance),
  };
}
