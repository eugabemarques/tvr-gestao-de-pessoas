import { describe, expect, it } from "vitest";
import { leituraDaIA, type CamposIA } from "../leitura";

const vazio: CamposIA = { nome: "", cpf: "", rg: "", pis: "", titulo: "", passaporte: "", ctps: "", ctf: "", mae: "", pai: "", rua: "", numero: "", bairro: "", cidade: "", cep: "", escolaridade: "", validade: "", dataExame: "" };

describe("leitura com IA (dados fictícios)", () => {
  it("identidade: CPF válido formatado, RG e nome", () => {
    const r = leituraDaIA("RG / CPF / CNH", { ...vazio, nome: "JOAO DA SILVA TESTE", cpf: "52998224725", rg: "12.345.678-9", cep: "01001000" });
    expect(r.valores).toEqual({ cpf: "529.982.247-25", rg: "12.345.678-9", nome: "Joao da Silva Teste" });
  });
  it("identidade também traz a filiação", () => {
    const r = leituraDaIA("RG / CPF / CNH", { ...vazio, mae: "MARIA DA SILVA TESTE", pai: "JOSE TESTE" });
    expect(r.valores).toEqual({ mae: "Maria da Silva Teste", pai: "Jose Teste" });
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

describe("leitura com IA: campos novos (dados fictícios)", () => {
  it("comprovante de residência preenche o endereço completo", () => {
    const r = leituraDaIA("Comprovante de Residência", { ...vazio, rua: "Rua das Flores", numero: "123 ap 4", bairro: "Centro", cidade: "Macaé - RJ", cep: "27910000", nome: "Fulano Teste" });
    expect(r.valores).toEqual({ rua: "Rua das Flores", num: "123 ap 4", bairro: "Centro", cidade: "Macaé - RJ", cep: "27910-000" });
  });
  it("CTPS, CTF e escolaridade", () => {
    expect(leituraDaIA("CTPS física (e CTPS digital)", { ...vazio, ctps: "1234567 série 00123-SP" }).valores).toEqual({ ctps: "1234567 série 00123-SP" });
    expect(leituraDaIA("CTF Ibama (atualizado)", { ...vazio, ctf: "7654321" }).valores).toEqual({ ctf: "7654321" });
    expect(leituraDaIA("Comprovante de Escolaridade", { ...vazio, escolaridade: "ensino médio" }).valores).toEqual({ escol: "Ensino médio" });
    expect(leituraDaIA("Comprovante de Escolaridade", { ...vazio, escolaridade: "Mestrado" }).valores).toEqual({});
  });
  it("Norueguês devolve a data do exame", () => {
    const r = leituraDaIA("Norueguês / OEUK / ENG1", { ...vazio, dataExame: "2025-06-10" });
    expect(r.exame).toBe("2025-06-10");
  });
});

describe("endereço em maiúsculas", () => {
  it("vira iniciais maiúsculas", () => {
    const r = leituraDaIA("Comprovante de Residência", { ...vazio, rua: "RUA DAS GAIVOTAS", numero: "245 APTO 302", bairro: "CAVALEIROS", cidade: "MACAE - RJ" });
    expect(r.valores).toEqual({ rua: "Rua das Gaivotas", num: "245 Apto 302", bairro: "Cavaleiros", cidade: "Macae - RJ" });
  });
});
