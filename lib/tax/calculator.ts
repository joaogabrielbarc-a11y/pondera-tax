import { TAX_RULES_2026 } from "./rules-2026";
import type {
  DeclarationResult,
  MonthlyResult,
  ProgressiveBracket,
  Projection,
  TaxState,
} from "./types";

const money = (value: number) => Math.round((value + 1e-9) * 100) / 100;

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

export function calculateMonthly(
  month: TaxState["months"][number],
): MonthlyResult {
  const grossTaxable = money(
    month.salary +
      month.overtime +
      month.commission +
      month.bonus +
      month.vacationPay +
      month.vacationOneThird +
      month.otherTaxable,
  );
  const inssCalculated = calculateInss(grossTaxable);
  const inssUsed = month.actualInss ?? inssCalculated;
  const detailedDeductions = money(
    inssUsed +
      month.dependents * TAX_RULES_2026.dependentMonthly +
      month.pension +
      month.otherLegalDeductions +
      month.pgblPayroll,
  );
  const deductionUsed = money(
    Math.max(detailedDeductions, TAX_RULES_2026.monthlySimplified),
  );
  const taxableBase = Math.max(0, grossTaxable - deductionUsed);
  const beforeReduction = progressiveTax(taxableBase, TAX_RULES_2026.monthlyIr);
  const irrfCalculated = money(
    Math.max(
      0,
      beforeReduction - monthlyReduction(grossTaxable, beforeReduction),
    ),
  );

  return {
    ...month,
    grossTaxable,
    inssCalculated,
    inssUsed: money(inssUsed),
    detailedDeductions,
    deductionUsed,
    irrfCalculated,
    irrfUsed: money(month.actualIrrf ?? irrfCalculated),
  };
}

function buildDeclaration(
  model: DeclarationResult["model"],
  grossTaxable: number,
  deductions: number,
  withheld: number,
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
    balance: money(withheld - taxDue),
  };
}

function calculateThirteenthTax(state: TaxState) {
  const deductions =
    state.events.thirteenthInss +
    state.dependents * TAX_RULES_2026.dependentMonthly;
  const base = Math.max(0, state.events.thirteenthGross - deductions);
  const beforeReduction = progressiveTax(base, TAX_RULES_2026.monthlyIr);
  return money(
    Math.max(
      0,
      beforeReduction -
        monthlyReduction(state.events.thirteenthGross, beforeReduction),
    ),
  );
}

export function calculateProjection(
  state: TaxState,
  extraPgbl = 0,
): Projection {
  const months = state.months.map(calculateMonthly);
  const grossTaxable = money(
    months.reduce((sum, month) => sum + month.grossTaxable, 0),
  );
  const annualInss = money(
    months.reduce((sum, month) => sum + month.inssUsed, 0),
  );
  const monthlyPension = money(
    months.reduce((sum, month) => sum + month.pension, 0),
  );
  const payrollPgbl = money(
    months.reduce((sum, month) => sum + month.pgblPayroll, 0),
  );
  const pgblContributed = money(
    payrollPgbl + state.deductions.pgblDirect + extraPgbl,
  );
  const pgblLimit = money(grossTaxable * TAX_RULES_2026.pgblLimitRate);
  const pgblDeductible = money(Math.min(pgblContributed, pgblLimit));
  const education = money(
    state.deductions.educationByBeneficiary.reduce(
      (sum, value) =>
        sum + Math.min(value, TAX_RULES_2026.educationAnnualPerBeneficiary),
      0,
    ),
  );
  const completeDeductions = money(
    annualInss +
      state.dependents * TAX_RULES_2026.dependentAnnual +
      monthlyPension +
      state.deductions.judicialPension +
      state.deductions.medical +
      education +
      pgblDeductible +
      state.deductions.otherLegal,
  );
  const simplifiedDeductions = money(
    Math.min(grossTaxable * 0.2, TAX_RULES_2026.annualSimplifiedCap),
  );
  const plrTax = money(
    progressiveTax(state.events.plrGross, TAX_RULES_2026.plr),
  );
  const thirteenthTax = money(calculateThirteenthTax(state));
  const exclusiveTax = money(plrTax + thirteenthTax);
  const plrWithheld = money(state.events.plrIrrf ?? plrTax);
  const thirteenthWithheld = money(
    state.events.thirteenthIrrf ?? thirteenthTax,
  );
  const withheld = money(
    months.reduce((sum, month) => sum + month.irrfUsed, 0) +
      plrWithheld +
      thirteenthWithheld,
  );

  const complete = buildDeclaration(
    "complete",
    grossTaxable,
    completeDeductions,
    withheld,
    exclusiveTax,
  );
  const simplified = buildDeclaration(
    "simplified",
    grossTaxable,
    simplifiedDeductions,
    withheld,
    exclusiveTax,
  );
  const recommended =
    complete.taxDue <= simplified.taxDue ? complete : simplified;

  const baseProjection = extraPgbl === 0 ? null : complete;
  const currentCompleteTax =
    baseProjection === null
      ? complete.taxDue
      : calculateProjection(state, 0).complete.taxDue;
  const available = money(
    Math.max(0, pgblLimit - (payrollPgbl + state.deductions.pgblDirect)),
  );

  return {
    months,
    complete,
    simplified,
    recommended,
    totalWithheld: withheld,
    plrTax,
    thirteenthTax,
    pgbl: {
      contributed: pgblContributed,
      deductible: pgblDeductible,
      limit: pgblLimit,
      available,
      excess: money(Math.max(0, pgblContributed - pgblLimit)),
      potentialSavings: money(
        Math.max(0, currentCompleteTax - complete.taxDue),
      ),
      optimizedCompleteBalance: complete.balance,
    },
  };
}

export function calculatePgblOpportunity(state: TaxState) {
  const current = calculateProjection(state);
  const optimized = calculateProjection(state, current.pgbl.available);
  return {
    current,
    optimized,
    taxSavings: money(current.complete.taxDue - optimized.complete.taxDue),
    balanceGain: money(optimized.complete.balance - current.complete.balance),
  };
}
