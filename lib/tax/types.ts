export type PayrollStatus = "actual" | "projected";

export type PayrollMonth = {
  id: string;
  month: number;
  status: PayrollStatus;
  salary: number;
  overtime: number;
  commission: number;
  bonus: number;
  otherTaxable: number;
  nonTaxable: number;
  dependents: number;
  pension: number;
  otherLegalDeductions: number;
  pgblPayroll: number;
  vgblPayroll: number;
  actualInss: number | null;
  actualIrrf: number | null;
  irrfOverrideEnabled: boolean;
};

export type VacationEvent = {
  id: string;
  month: number;
  daysTaken: number;
  daysSold: number;
  taxableAverage: number;
  abonoAverage: number;
  receivedAdvance: boolean;
  actualInss: number | null;
  actualIrrf: number | null;
  irrfOverrideEnabled: boolean;
};

export type ExtraIncomeType = "rent" | "proLabore" | "services";
export type PayerType = "individual" | "legalEntity" | "abroad";

export type ExtraIncome = {
  id: string;
  month: number;
  type: ExtraIncomeType;
  description: string;
  payerType: PayerType;
  gross: number;
  deductibleExpenses: number;
  inss: number;
  withheldIrrf: number;
};

export type Dependent = {
  id: string;
  name: string;
  hasTaxableIncome: boolean;
  taxableIncome: number;
  education: number;
  medical: number;
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
  holderEducation: number;
  judicialPension: number;
  pgblDirect: number;
  otherLegal: number;
};

export type TaxState = {
  version: 2;
  taxYear: 2026;
  exerciseYear: 2027;
  taxpayerName: string;
  months: PayrollMonth[];
  vacations: VacationEvent[];
  extraIncome: ExtraIncome[];
  dependents: Dependent[];
  events: AnnualEvents;
  deductions: AnnualDeductions;
};

export type MonthlyResult = PayrollMonth & {
  vacationDays: number;
  proratedSalary: number;
  grossTaxable: number;
  inssCalculated: number;
  inssUsed: number;
  detailedDeductions: number;
  deductionUsed: number;
  taxableBase: number;
  irrfCalculated: number;
  irrfUsed: number;
  vacationAdvanceDeduction: number;
  netIncome: number;
  fgts: number;
};

export type VacationResult = VacationEvent & {
  baseVacation: number;
  constitutionalOneThird: number;
  taxableGross: number;
  abonoBase: number;
  abonoOneThird: number;
  exemptGross: number;
  inssCalculated: number;
  inssUsed: number;
  taxableBase: number;
  irrfCalculated: number;
  irrfUsed: number;
  netAdvance: number;
  fgts: number;
};

export type CarneLeaoMonth = {
  month: number;
  gross: number;
  deductions: number;
  taxableBase: number;
  taxDue: number;
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
  prepaidTax: number;
  balance: number;
};

export type Projection = {
  months: MonthlyResult[];
  vacations: VacationResult[];
  carneLeao: CarneLeaoMonth[];
  complete: DeclarationResult;
  simplified: DeclarationResult;
  recommended: DeclarationResult;
  totalGrossIncome: number;
  annualInss: number;
  totalFgts: number;
  totalWithheld: number;
  totalCarneLeao: number;
  totalPrepaid: number;
  totalNetIncome: number;
  plrTax: number;
  thirteenthTax: number;
  breakdown: {
    payroll: number;
    vacationTaxable: number;
    vacationExempt: number;
    extraIncome: number;
    dependentIncome: number;
    thirteenth: number;
    plr: number;
    otherExempt: number;
  };
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
