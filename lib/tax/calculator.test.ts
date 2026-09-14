import { describe, expect, it } from "vitest";
import {
  calculateInss,
  calculatePgblOpportunity,
  calculatePgblStudy,
  calculateProjection,
  progressiveTax,
  calculateThirteenth,
  money,
  sum,
} from "./calculator";
import { TAX_RULES_2026 } from "./rules-2026";
import {
  createDependent,
  createExtraIncome,
  createInitialState,
  createVacation,
  migrateTaxState,
} from "./seed";

describe("motor tributário 2026", () => {
  it("calcula o INSS progressivo até o teto", () => {
    expect(calculateInss(1_621)).toBe(121.58);
    expect(calculateInss(20_000)).toBe(988.09);
  });

  it("usa a faixa oficial de isenção da PLR", () => {
    expect(progressiveTax(8_214.4, TAX_RULES_2026.plr)).toBe(0);
    expect(progressiveTax(9_000, TAX_RULES_2026.plr)).toBe(58.92);
  });

  it("limita o PGBL a 12% da renda tributável", () => {
    const state = createInitialState();
    state.deductions.pgblDirect = 1_000_000;
    const result = calculateProjection(state);
    expect(result.pgbl.deductible).toBe(result.pgbl.limit);
    expect(result.pgbl.excess).toBeGreaterThan(0);
  });

  it("não inclui rendimentos não tributáveis na base", () => {
    const state = createInitialState();
    const before = calculateProjection(state).complete.grossTaxable;
    state.months[0].nonTaxable = 100_000;
    expect(calculateProjection(state).complete.grossTaxable).toBe(before);
  });

  it("demonstra a economia potencial do aporte PGBL", () => {
    const opportunity = calculatePgblOpportunity(createInitialState());
    expect(opportunity.current.pgbl.available).toBeGreaterThan(0);
    expect(opportunity.taxSavings).toBeGreaterThan(0);
  });

  it("apura férias tributáveis e mantém o abono fora da base", () => {
    const state = createInitialState();
    state.months.forEach((month) => {
      month.salary = 0;
      month.bonus = 0;
      month.otherTaxable = 0;
    });
    state.months[0].salary = 6_000;
    state.vacations = [
      {
        ...createVacation(0),
        daysTaken: 20,
        daysSold: 10,
        receivedAdvance: false,
      },
    ];
    const result = calculateProjection(state);
    expect(result.breakdown.vacationTaxable).toBe(5_333.33);
    expect(result.breakdown.vacationExempt).toBe(2_666.67);
    expect(
      result.months[0].inssUsed + result.vacations[0].inssUsed,
    ).toBeCloseTo(calculateInss(7_333.33), 2);
    state.vacations[0].daysSold = 0;
    const withoutAbono = calculateProjection(state);
    expect(result.complete.grossTaxable).toBe(
      withoutAbono.complete.grossTaxable,
    );
    expect(result.totalGrossIncome - withoutAbono.totalGrossIncome).toBeCloseTo(
      2_666.67,
      2,
    );
  });

  it("leva o adiantamento de férias ao líquido do mês seguinte", () => {
    const state = createInitialState();
    state.vacations = [
      { ...createVacation(0), daysTaken: 10, receivedAdvance: true },
    ];
    const withAdvance = calculateProjection(state);
    state.vacations[0].receivedAdvance = false;
    const withoutAdvance = calculateProjection(state);
    expect(withAdvance.months[1].vacationAdvanceDeduction).toBeGreaterThan(0);
    expect(withoutAdvance.months[1].netIncome).toBeGreaterThan(
      withAdvance.months[1].netIncome,
    );
  });

  it("aceita override manual de IRRF inclusive para zero", () => {
    const state = createInitialState();
    state.months[0].irrfOverrideEnabled = true;
    state.months[0].actualIrrf = 0;
    expect(calculateProjection(state).months[0].irrfUsed).toBe(0);
  });

  it("calcula Carnê-Leão somente para pessoa física ou exterior", () => {
    const state = createInitialState();
    state.extraIncome = [
      {
        ...createExtraIncome(0),
        gross: 8_000,
        deductibleExpenses: 500,
      },
    ];
    const fromIndividual = calculateProjection(state).carneLeao[0].taxDue;
    state.extraIncome.push({
      ...createExtraIncome(0),
      payerType: "legalEntity",
      gross: 20_000,
    });
    expect(fromIndividual).toBeGreaterThan(0);
    expect(calculateProjection(state).carneLeao[0].taxDue).toBe(fromIndividual);
  });

  it("inclui renda tributável do dependente no ajuste anual", () => {
    const state = createInitialState();
    const before = calculateProjection(state).complete.grossTaxable;
    state.dependents = [
      {
        ...createDependent(),
        hasTaxableIncome: true,
        taxableIncome: 12_000,
      },
    ];
    const result = calculateProjection(state);
    expect(result.complete.grossTaxable - before).toBe(12_000);
    expect(result.complete.deductions).toBeGreaterThan(
      calculateProjection(createInitialState()).complete.deductions,
    );
  });
});

describe("regressões da auditoria V1.2", () => {
  it("13º: salário de dezembro + média variável, duas parcelas e descontos integrais na segunda", () => {
    const state = createInitialState();
    state.months.forEach((m) =>
      Object.assign(m, {
        salary: 12000,
        overtime: 0,
        commission: 0,
        bonus: 0,
        otherTaxable: 0,
      }),
    );
    state.months[0].commission = 12000;
    const result = calculateThirteenth(state);
    expect(result.gross).toBe(13000);
    expect(result.inss).toBe(988.09);
    expect(result.irrfUsed).toBe(2394.55);
    expect(result.firstInstallment).toBe(6500);
    expect(result.secondInstallment).toBe(3117.36);
    expect(
      sum([
        result.firstInstallment,
        result.secondInstallment,
        result.inss,
        result.irrfUsed,
      ]),
    ).toBe(result.gross);
  });

  it("inclui INSS do 13º no total pago, nunca nas deduções do ajuste", () => {
    const state = createInitialState();
    const before = calculateProjection(state);
    expect(before.annualInss).toBe(
      sum([before.deductibleInss, before.thirteenth.inss]),
    );
    state.events.thirteenthInssOverrideEnabled = true;
    state.events.thirteenthInss = 0;
    const after = calculateProjection(state);
    expect(after.annualInss).toBe(before.deductibleInss);
    expect(after.complete.deductions).toBe(before.complete.deductions);
    expect(after.complete.balance).toBe(before.complete.balance);
  });

  it("IRRF exclusivo zero/manual não cria restituição nem débito no ajuste", () => {
    const state = createInitialState();
    const before = calculateProjection(state);
    state.events.plrIrrfOverrideEnabled = true;
    state.events.thirteenthIrrfOverrideEnabled = true;
    state.events.plrIrrf = 0;
    state.events.thirteenthIrrf = 0;
    const after = calculateProjection(state);
    expect(after.complete.balance).toBe(before.complete.balance);
    expect(after.totalWithheld).toBeLessThan(before.totalWithheld);
    expect(after.warnings.some((w) => w.includes("exclusivo"))).toBe(true);
    state.events.plrIrrfOverrideEnabled = false;
    state.events.thirteenthIrrfOverrideEnabled = false;
    expect(calculateProjection(state).totalWithheld).toBe(before.totalWithheld);
  });

  it("INSS manual zero é preservado e desligar retorna ao cálculo", () => {
    const state = createInitialState();
    state.months[0].actualInss = 0;
    state.months[0].inssOverrideEnabled = true;
    expect(calculateProjection(state).months[0].inssUsed).toBe(0);
    state.months[0].inssOverrideEnabled = false;
    expect(calculateProjection(state).months[0].inssUsed).toBe(988.09);
    expect(state.months[0].actualInss).toBe(0);
  });

  it("limita INSS agregado com mais de um evento de férias na mesma competência", () => {
    const state = createInitialState();
    state.vacations = [
      { ...createVacation(0), daysTaken: 10 },
      { ...createVacation(0), daysTaken: 10 },
    ];
    const result = calculateProjection(state);
    expect(
      sum([
        result.months[0].inssUsed,
        ...result.vacations.map((v) => v.inssUsed),
      ]),
    ).toBe(988.09);
    state.vacations[0].inssOverrideEnabled = true;
    state.vacations[0].actualInss = 0;
    expect(calculateProjection(state).vacations[0].inssUsed).toBe(0);
  });

  it("adiantamento liquida a verba sem reduzir o líquido anual duas vezes", () => {
    const state = createInitialState();
    state.vacations = [
      { ...createVacation(0), daysTaken: 10, receivedAdvance: true },
    ];
    const advanced = calculateProjection(state);
    state.vacations[0].receivedAdvance = false;
    const settled = calculateProjection(state);
    expect(advanced.totalNetIncome).toBe(settled.totalNetIncome);
    expect(advanced.complete.grossTaxable).toBe(settled.complete.grossTaxable);
    expect(
      money(settled.months[1].netIncome - advanced.months[1].netIncome),
    ).toBe(advanced.vacations[0].netAdvance);
  });

  it("descontos não dedutíveis só afetam o líquido", () => {
    const state = createInitialState();
    const before = calculateProjection(state);
    state.months[0].nonDeductiblePayroll = 1234.56;
    const after = calculateProjection(state);
    expect(after.complete.balance).toBe(before.complete.balance);
    expect(money(before.totalNetIncome - after.totalNetIncome)).toBe(1234.56);
  });

  it("previdência percentual acompanha salário, contrapartida não altera deduções", () => {
    const state = createInitialState();
    state.retirement = {
      automatic: true,
      pgblPercent: 2,
      vgblPercent: 4,
      employerMatchPercent: 100,
    };
    state.months[0].salary = 10000;
    const first = calculateProjection(state);
    expect(first.months[0].pgblPayroll).toBe(200);
    expect(first.months[0].vgblPayroll).toBe(400);
    expect(first.employerMatch).toBe(
      sum(first.months.map((m) => m.pgblPayroll + m.vgblPayroll)),
    );
    state.retirement.employerMatchPercent = 50;
    const half = calculateProjection(state);
    expect(half.complete.deductions).toBe(first.complete.deductions);
    expect(half.employerMatch).toBe(
      sum(half.months.map((m) => money((m.pgblPayroll + m.vgblPayroll) * 0.5))),
    );
    state.months[0].salary = 20000;
    expect(calculateProjection(state).months[0].pgblPayroll).toBe(400);
  });

  it("Carnê-Leão devido não é presumido pago nem reduz a base", () => {
    const state = createInitialState();
    state.extraIncome = [
      { ...createExtraIncome(0), gross: 8000, deductibleExpenses: 500 },
    ];
    const unpaid = calculateProjection(state);
    expect(unpaid.carneLeao[0].taxDue).toBe(986.79);
    expect(unpaid.totalCarneLeaoPaid).toBe(0);
    state.extraIncome[0].carneLeaoPaid = true;
    state.extraIncome[0].carneLeaoPaidAmount = 900;
    const paid = calculateProjection(state);
    expect(paid.complete.taxableBase).toBe(unpaid.complete.taxableBase);
    expect(money(paid.complete.balance - unpaid.complete.balance)).toBe(900);
  });

  it("anual direto não inventa rateio mensal e compensa somente pagamento informado", () => {
    const state = createInitialState();
    const base = calculateProjection(state);
    state.extraIncome = [
      {
        ...createExtraIncome(),
        entryMode: "annual",
        gross: 96000,
        carneLeaoPaid: true,
        carneLeaoPaidAmount: 1000,
      },
    ];
    const annual = calculateProjection(state);
    expect(annual.complete.grossTaxable - base.complete.grossTaxable).toBe(
      96000,
    );
    expect(annual.totalCarneLeao).toBe(0);
    expect(annual.totalCarneLeaoPaid).toBe(1000);
    expect(annual.warnings.some((w) => w.includes("anual direta"))).toBe(true);
  });

  it("Livro Caixa não reduz renda bruta nem gera desconto extra na simplificada", () => {
    const state = createInitialState();
    state.extraIncome = [
      { ...createExtraIncome(0), type: "services", gross: 8000 },
    ];
    const before = calculateProjection(state);
    state.extraIncome[0].deductibleExpenses = 1000;
    const after = calculateProjection(state);
    expect(after.simplified.taxDue).toBe(before.simplified.taxDue);
    expect(after.pgbl.limit).toBe(before.pgbl.limit);
    expect(after.complete.deductions - before.complete.deductions).toBe(1000);
  });

  it("transporta excesso de Livro Caixa até dezembro", () => {
    const state = createInitialState();
    state.extraIncome = [
      {
        ...createExtraIncome(0),
        type: "services",
        gross: 1000,
        deductibleExpenses: 3000,
      },
      { ...createExtraIncome(1), type: "services", gross: 8000 },
    ];
    const result = calculateProjection(state);
    expect(result.carneLeao[1].deductions).toBe(2000);
    expect(result.carneLeao[1].taxableBase).toBe(6000);
  });

  it("não repete dedução de dependentes já utilizada na folha", () => {
    const state = createInitialState();
    state.dependents = Array.from({ length: 4 }, createDependent);
    state.months[0].dependents = 4;
    state.extraIncome = [{ ...createExtraIncome(0), gross: 10000 }];
    expect(calculateProjection(state).carneLeao[0].deductions).toBe(607.2);
  });

  it("deduz cada dependente uma única vez no IRRF do holerite", () => {
    const state = createInitialState();
    state.vacations = [];
    state.months[0].salary = 10_000;
    state.months[0].dependents = 1;
    const result = calculateProjection(state).months[0];
    expect(result.detailedDeductions).toBe(
      money(result.inssUsed + TAX_RULES_2026.dependentMonthly),
    );
  });

  it("estudo PGBL respeita a margem e reconcilia custos e impostos", () => {
    const state = createInitialState();
    const current = calculateProjection(state);
    const study = calculatePgblStudy(state, {
      contribution: current.pgbl.available * 2,
      years: 20,
      pgblGrossReturnRate: 0.1,
      traditionalGrossReturnRate: 0.1,
      pgblAdminFeeRate: 0.01,
      traditionalAdminFeeRate: 0.002,
      reinvestmentRate: 0.08,
      pgblExitTaxRate: 0.1,
      traditionalGainsTaxRate: 0.15,
    });
    expect(study.contribution).toBe(current.pgbl.available);
    expect(study.taxEfficiency).toBeGreaterThan(0);
    expect(study.pgbl.administrationCost).toBeGreaterThan(0);
    expect(study.pgblStrategyNet).toBe(
      money(study.pgbl.netBalance + study.reinvestment.netBalance),
    );
    expect(study.series).toHaveLength(21);
    expect(study.series.at(-1)?.pgblStrategyNet).toBe(
      study.pgblStrategyNet,
    );
  });

  it("aplica teto de educação individual e reconcilia somas com centavos", () => {
    const state = createInitialState();
    state.dependents = [
      { ...createDependent(), education: 10000, medical: 10.01 },
    ];
    const a = calculateProjection(state);
    state.dependents[0].education = 3561.5;
    const b = calculateProjection(state);
    expect(a.complete.deductions).toBe(b.complete.deductions);
    expect(a.annualInss).toBe(
      sum([
        ...a.months.map((m) => m.inssUsed),
        ...a.vacations.map((v) => v.inssUsed),
        a.thirteenth.inss,
      ]),
    );
    expect(a.complete.balance).toBe(
      money(a.complete.prepaidTax - a.complete.adjustmentTax),
    );
  });

  it("migração preserva dados e overrides e não soma bônus novamente", () => {
    const old = createInitialState();
    old.months[0].bonus = 100;
    old.months[0].commission = 250;
    old.months[0].actualInss = 0;
    const legacy = JSON.parse(JSON.stringify(old));
    legacy.version = 2;
    delete legacy.months[0].inssOverrideEnabled;
    const migrated = migrateTaxState(legacy);
    expect(migrated.version).toBe(3);
    expect(migrated.months[0].commission).toBe(350);
    expect(migrated.months[0].bonus).toBe(0);
    expect(migrated.months[0].inssOverrideEnabled).toBe(true);
    expect(migrateTaxState(migrated).months[0].commission).toBe(350);
  });

  it.each([
    [1621, 121.58],
    [2902.84, 236.94],
    [4354.27, 411.11],
    [8475.55, 988.09],
  ])("INSS na fronteira %s = %s", (gross, expected) =>
    expect(calculateInss(gross)).toBe(expected),
  );
});
