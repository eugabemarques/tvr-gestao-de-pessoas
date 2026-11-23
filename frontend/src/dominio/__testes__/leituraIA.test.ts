import { describe, expect, it } from "vitest";
import { leituraDaIA, type CamposIA } from "../leitura";

const vazio: CamposIA = { nome: "", cpf: "", rg: "", pis: "", titulo: "", passaporte: "", cep: "", validade: "" };

describe("leitura com IA (dados fictícios)", () => {
  it("identidade: CPF válido formatado, RG e nome", () => {
    const r = leituraDaIA("RG / CPF / CNH", { ...vazio, nome: "JOAO DA SILVA TESTE", cpf: "52998224725", rg: "12.345.678-9", cep: "01001000" });
    expect(r.valores).toEqual({ cpf: "529.982.247-25", rg: "12.345.678-9", nome: "Joao da Silva Teste" });
    expect(r.avisos).toEqual([]);
  });
  it("CPF com dígito errado não preenche e avisa", () => {
    const r = leituraDaIA("Nome", { ...vazio, cpf: "529.982.247-26" });
    expect(r.valores.cpf).toBeUndefined();
    expect(r.avisos[0]).toMatch(/CPF/);
  });
  it("PIS, título e CEP só no campo certo", () => {
    expect(leituraDaIA("Nº do PIS", { ...vazio, pis: "120.54321.98-7", cpf: "52998224725" }).valores.cpf).toBeUndefined();
    expect(leituraDaIA("Comprovante de Residência", { ...vazio, cep: "01001-000" }).valores).toEqual({ cep: "01001-000" });
  });
  it("certificado: validade válida; data impossível é ignorada", () => {
    expect(leituraDaIA("ASO", { ...vazio, validade: "2027-03-15" }).validade).toBe("2027-03-15");
    expect(leituraDaIA("ASO", { ...vazio, validade: "2027-02-30" }).validade).toBeUndefined();
    expect(leituraDaIA("ASO", { ...vazio, validade: "" }).validade).toBeUndefined();
  });
});
