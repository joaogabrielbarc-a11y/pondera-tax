import { describe, expect, it } from "vitest";
import {
  calculateInss,
  calculatePgblOpportunity,
  calculateProjection,
  progressiveTax,
} from "./calculator";
import { TAX_RULES_2026 } from "./rules-2026";
import {
  createDependent,
  createExtraIncome,
  createInitialState,
  createVacation,
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
