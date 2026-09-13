export type PayrollStatus = "actual" | "projected";

export type PayrollMonth = {
  id: string;
  month: number;
  status: PayrollStatus;
  salary: number;
  overtime: number;
  commission: number;
  bonus: number;
  vacationPay: number;
  vacationOneThird: number;
  otherTaxable: number;
  nonTaxable: number;
  dependents: number;
  pension: number;
  otherLegalDeductions: number;
  pgblPayroll: number;
  actualInss: number | null;
  actualIrrf: number | null;
};

export type AnnualEvents = {
  thirteenthGross: number;
  thirteenthInss: number;
  thirteenthIrrf: number | null;
  plrGross: number;
  plrIrrf: number | null;
};

export type AnnualDeductions = {
  medical: number;
  educationByBeneficiary: number[];
  judicialPension: number;
  pgblDirect: number;
  otherLegal: number;
};

export type TaxState = {
  version: 1;
  taxYear: 2026;
  exerciseYear: 2027;
  taxpayerName: string;
  dependents: number;
  months: PayrollMonth[];
  events: AnnualEvents;
  deductions: AnnualDeductions;
};

export type MonthlyResult = PayrollMonth & {
  grossTaxable: number;
  inssCalculated: number;
  inssUsed: number;
  detailedDeductions: number;
  deductionUsed: number;
  irrfCalculated: number;
  irrfUsed: number;
};

export type DeclarationResult = {
  model: "complete" | "simplified";
  grossTaxable: number;
  deductions: number;
  taxableBase: number;
  adjustmentTax: number;
  exclusiveTax: number;
  taxDue: number;
  withheld: number;
  balance: number;
};

export type Projection = {
  months: MonthlyResult[];
  complete: DeclarationResult;
  simplified: DeclarationResult;
  recommended: DeclarationResult;
  totalWithheld: number;
  plrTax: number;
  thirteenthTax: number;
  pgbl: {
    contributed: number;
    deductible: number;
    limit: number;
    available: number;
    excess: number;
    potentialSavings: number;
    optimizedCompleteBalance: number;
  };
};

export type ProgressiveBracket = {
  upTo: number;
  rate: number;
  deduction: number;
};
