import { describe, expect, it } from "vitest";
import {
  calculateInss,
  calculatePgblOpportunity,
  calculateProjection,
  progressiveTax,
} from "./calculator";
import { TAX_RULES_2026 } from "./rules-2026";
import { createInitialState } from "./seed";

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
});
