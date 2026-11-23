import { describe, expect, it } from "vitest";
import { diaIso, diaOk, diaOuNulo, fmt, toDay } from "../datas";

// Data digitada com ano de 5 dígitos (o campo de data do navegador aceita) derrubava a tela inteira.
describe("datas inválidas não derrubam a tela", () => {
  it("toDay de ano com 5 dígitos é NaN, e diaOuNulo devolve null", () => {
    expect(Number.isNaN(toDay("20255-01-10"))).toBe(true);
    expect(diaOuNulo("20255-01-10")).toBeNull();
    expect(diaOuNulo("")).toBeNull();
    expect(diaOuNulo("2026-11-23")).toBe(toDay("2026-11-23"));
  });
  it("diaIso e fmt devolvem vazio para dia inválido, sem lançar erro", () => {
    expect(diaIso(NaN)).toBe("");
    expect(diaIso(1e12)).toBe("");
    expect(fmt(NaN)).toBe("");
    expect(diaIso(null)).toBe("");
    expect(diaIso(toDay("2026-11-23"))).toBe("2026-11-23");
    expect(fmt(toDay("2026-11-23"))).toBe("23/11/2026");
  });
  it("diaOk", () => {
    expect(diaOk(0)).toBe(true);
    expect(diaOk(NaN)).toBe(false);
    expect(diaOk(undefined)).toBe(false);
  });
});
