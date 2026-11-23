import { describe, expect, it } from "vitest";
import {
  acharNomesMrz,
  acharValidade,
  cpfValido,
  extrairDoDocumento,
  faltamPrincipais,
  juntarLeituras,
  nomeProprio,
  normalizar,
  pisValido,
  primeiraData,
  tipoLeitura,
  tituloValido,
} from "../leitura";

describe("dígitos verificadores", () => {
  it("CPF", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("529.982.247-26")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
  });
  it("PIS", () => {
    expect(pisValido("120.63817.45-8")).toBe(true);
    expect(pisValido("120.63817.45-9")).toBe(false);
  });
  it("título de eleitor", () => {
    expect(tituloValido("1023 4567 0582")).toBe(true);
    expect(tituloValido("1023 4567 0583")).toBe(false);
    expect(tituloValido("1023 4567 9982")).toBe(false); // UF inexistente
  });
});

describe("qual leitura vale para cada campo", () => {
  it("documentos com leitura", () => {
    expect(tipoLeitura("RG / CPF / CNH")).toBe("identidade");
    expect(tipoLeitura("Comprovante de Residência")).toBe("residencia");
    expect(tipoLeitura("CBSP")).toBe("certificado");
    expect(tipoLeitura("Curso: MMO - Observação de Mamíferos Marinhos")).toBe("certificado");
    expect(tipoLeitura("ASO")).toBe("certificado");
  });
  it("documentos sem leitura", () => {
    expect(tipoLeitura("Work Citation")).toBeNull();
    // a certidão passou a ser lida (nome e filiação) pela leitura com IA
    expect(tipoLeitura("Certidão de Nascimento / Certidão de casamento")).toBe("certidao");
  });
});

describe("RG / CPF / CNH", () => {
  it("RG com CPF e número do registro geral", () => {
    const t = "REPUBLICA FEDERATIVA DO BRASIL\nREGISTRO GERAL 12.345.678-9 DATA DE EXPEDICAO 10/05/2015\nNOME ANA RIBEIRO\nCPF 529.982.247-25";
    expect(extrairDoDocumento("RG / CPF / CNH", t)).toEqual({ valores: { cpf: "529.982.247-25", rg: "12.345.678-9" }, avisos: [] });
  });
  it("CNH: número do documento na linha de baixo do rótulo", () => {
    const t = "DOC. IDENTIDADE / ORG. EMISSOR / UF\n201234567 DETRAN RJ\nCPF DATA NASCIMENTO\n52998224725 01/02/1990";
    expect(extrairDoDocumento("RG / CPF / CNH", t).valores).toEqual({ cpf: "529.982.247-25", rg: "201234567" });
  });
  it("corrige O e l lidos no lugar de 0 e 1 dentro do número", () => {
    expect(normalizar("CPF 529.982.247-25 e 1O2l3")).toContain("10213");
    expect(normalizar("1o andar")).toBe("1o andar"); // só dentro de números
  });
  it("7 lido como barra dentro de número com pontos (texto real do OCR)", () => {
    const t = "REGISTRO GERAL 12.345.6/8-9º— DATA DE EXPEDICAO 10/05/2015\nCPF 529.982.24/-25";
    expect(extrairDoDocumento("RG / CPF / CNH", t).valores).toEqual({ rg: "12.345.678-9", cpf: "529.982.247-25" });
    expect(normalizar("10/05/2015")).toBe("10/05/2015");
  });
  it("número com dígito errado (leitura ruim) não é preenchido", () => {
    expect(extrairDoDocumento("RG / CPF / CNH", "CPF 529.982.247-26").valores.cpf).toBeUndefined();
  });
});

describe("CNH digital (texto como o OCR devolve, dados fictícios)", () => {
  // mesmo formato do OCR de uma CNH real ampliada: lixo entre rótulo e número, espaço solto no CPF
  const cnh = [
    "CARTEIRA NACIONAL DE HABILITAÇÃO / DRIVER LICENSE / PERMISO DE CONDUCCIÓN [=] —",
    "(MARIA FICTICIA DE SOUZA | [0510472024 ) 2 E OT RUE O: .",
    '44 O0C IDENTIDADE / ÓSG IMESSOR / 66  . e a E r - "l',
    '[201234567 ssp sp ) E "1 AT. q. . El n +',
    "qo | 529.982 .247-25 | 0860904970 | AB ) 1% Eptúgo",
    "Documento assinado com certificado digital em conformidade com a Medida Provisória nº 2200-2/2001.",
    "I<BRA086090497<106<<<<<<<<<<<<",
    "9405114F3308040BRA<<<<<<<<<<<8",
    "MARIA<<FICTICIA<DE<SOUZA<<<<<<",
  ].join("\n");
  it("CPF com espaço solto, nº do documento antes do órgão emissor e nome das linhas de código", () => {
    expect(extrairDoDocumento("RG / CPF / CNH", cnh).valores).toEqual({ cpf: "529.982.247-25", rg: "201234567", nome: "Maria Ficticia de Souza" });
  });
  it("órgão emissor colado com a UF (SSPSP, SSP/SP)", () => {
    expect(extrairDoDocumento("Nome", '[201234567 SSPSP ) E "1').valores.rg).toBe("201234567");
    expect(extrairDoDocumento("Nome", "RG 12.345.678-9 SSP/SP").valores.rg).toBe("12.345.678-9");
  });
  it("o clipe do campo Nome também lê o documento de identidade", () => {
    expect(tipoLeitura("Nome")).toBe("identidade");
    expect(extrairDoDocumento("Nome", cnh).valores.cpf).toBe("529.982.247-25");
  });
  it("só o texto da assinatura digital (PDF sem leitura da imagem): faltam os campos principais", () => {
    const r = extrairDoDocumento("Nome", "Documento assinado com certificado digital em conformidade com a Medida Provisória nº 2200-2/2001.");
    expect(r.valores).toEqual({});
    expect(faltamPrincipais("Nome", r)).toBe(true);
    expect(faltamPrincipais("Nome", extrairDoDocumento("Nome", cnh))).toBe(false);
  });
  it("no mesmo texto, valores que discordam não preenchem: avisam", () => {
    const r = extrairDoDocumento("Nome", cnh + "\nMARIAC<FICTICIA<DE<SOUZA<<<<<<");
    expect(r.valores.nome).toBeUndefined();
    expect(r.avisos.join(" ")).toContain("mais de um nome");
  });
  it("1ª leitura (rápida) + 2ª (detalhada): a detalhada vale mais e o aviso resolvido some", () => {
    const r1 = { valores: { nome: "Mariac Ficticia de Souza", rg: "201234567" }, avisos: ["Encontrei mais de um CPF no documento (x, y). Preencha o certo."] };
    const r2 = { valores: { nome: "Maria Ficticia de Souza", cpf: "529.982.247-25" }, avisos: [] };
    expect(juntarLeituras(r1, r2)).toEqual({ valores: { nome: "Maria Ficticia de Souza", rg: "201234567", cpf: "529.982.247-25" }, avisos: [] });
  });
  it("linhas de código: passaporte e linhas com números", () => {
    expect(acharNomesMrz("P<BRASOUZA<<MARIA<FICTICIA<<<<<<<<<<<<<<<<<<<\nFZ123456<0BRA9405114F3308040<<<<<<<<<<<<<<04")).toEqual(["Souza Maria Ficticia"]);
    expect(acharNomesMrz("I<BRA086090497<106<<<<<<<<<<<<")).toEqual([]);
    expect(nomeProprio("ANA DOS SANTOS E SILVA")).toBe("Ana dos Santos e Silva");
  });
});

describe("outros documentos", () => {
  it("PIS", () => expect(extrairDoDocumento("Nº do PIS", "PIS/PASEP 120.63817.45-8").valores).toEqual({ pis: "120.63817.45-8" }));
  it("título de eleitor", () => expect(extrairDoDocumento("Título de Eleitor", "INSCRICAO 1023 4567 0582 ZONA 012").valores).toEqual({ tit: "1023 4567 0582" }));
  it("passaporte", () => expect(extrairDoDocumento("Passaporte (se tiver)", "PASSAPORTE / PASSPORT No FZ123456").valores).toEqual({ pass: "FZ123456" }));
  it("comprovante de residência com um CEP", () => {
    expect(extrairDoDocumento("Comprovante de Residência", "RUA DAS FLORES 10 CENTRO MACAE RJ CEP 27910030").valores).toEqual({ cep: "27910-030" });
  });
  it("comprovante com dois CEPs (empresa e cliente): não preenche e avisa", () => {
    const r = extrairDoDocumento("Comprovante de Residência", "ENEL AV. X 100 CEP 24210-205 NITEROI\nCLIENTE RUA Y 20 CEP 27910-030 MACAE");
    expect(r.valores).toEqual({});
    expect(r.avisos[0]).toContain("24210-205");
    expect(r.avisos[0]).toContain("27910-030");
  });
});

describe("validade de certificados", () => {
  it("datas em vários formatos", () => {
    expect(primeiraData(": 15/03/2027")).toBe("2027-03-15");
    expect(primeiraData(" 15.03.2027")).toBe("2027-03-15");
    expect(primeiraData(" 15 MAR 2027")).toBe("2027-03-15");
    expect(primeiraData(" 15-Mar-2027")).toBe("2027-03-15");
    expect(primeiraData(" 31/02/2027")).toBeNull();
  });
  it("usa a data depois de 'validade' e ignora emissão e realização", () => {
    const t = "CERTIFICADO CBSP\nRealizado em 10/01/2025 Emissão: 12/01/2025\nVálido até: 12/01/2029";
    expect(extrairDoDocumento("CBSP", t)).toEqual({ valores: {}, validade: "2029-01-12", avisos: [] });
  });
  it("certificado em inglês", () => expect(acharValidade("Date of issue 02 Feb 2025 Expiry date: 01 Feb 2029")).toBe("2029-02-01"));
  it("sem palavra de validade, não chuta uma data", () => expect(extrairDoDocumento("ASO", "Data do exame 10/01/2026").validade).toBeUndefined());
});
