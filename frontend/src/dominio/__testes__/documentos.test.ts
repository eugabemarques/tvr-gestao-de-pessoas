import { describe, expect, it } from "vitest";
import { toDay } from "../datas";
import { campoObrigatorio, campos, curCampo, docFor, docsDo, erroArq, fichaTexto, pendDocs, reqCursos, reqInfo, syncReqCur, VACDOC } from "../documentos";
import { esc, iniciais, nomeArquivoFicha, unesc } from "../texto";
import type { Pessoa } from "../tipos";

const T = toDay("2026-11-13");
const vacinas = ["Covid-19", "DT (difteria e tétano)", "Febre amarela"].map((n) => ({ campo: "Vacina: " + n, name: n + ".pdf", fid: "x" }));

describe("documentos obrigatórios por setor", () => {
  it("ambiental soma CTF, Work Citation e cursos à base", () => {
    expect(docsDo("administrativo").length).toBe(9);
    expect(docsDo("ambiental").length).toBe(15);
    expect(docsDo("")).toEqual([]);
    expect(reqCursos("ambiental")).toEqual(["CBSP", "THUET / BOSIET / FOET", "Norueguês / OEUK / ENG1", "Certificado PAM"]);
    expect(reqCursos("manutencao")).toEqual([]);
  });
  it("passaporte e PIS são opcionais", () => {
    const p = { setor: "administrativo", docs: [] };
    expect(pendDocs(p)).not.toContain("Nº do PIS");
    expect(pendDocs(p)).not.toContain("Passaporte (se tiver)");
    expect(pendDocs(p).length).toBe(7);
  });
  it("vacinação completa com os três comprovantes", () => {
    expect(docFor(vacinas.slice(0, 2), VACDOC)).toBeNull();
    expect(docFor(vacinas, VACDOC)).toEqual({ name: "3 comprovantes na seção Vacinas", virt: true });
    expect(pendDocs({ setor: "administrativo", docs: vacinas })).not.toContain(VACDOC);
  });
  it("conta pendências por seção da ficha", () => {
    expect(reqInfo("ambiental", []).sec).toEqual({ dados: 8, cursos: 4, vacinas: 1 });
    expect(reqInfo("ambiental", [...vacinas, { campo: "CBSP", name: "c.pdf" }]).sec).toEqual({ dados: 8, cursos: 3, vacinas: 0 });
    expect(reqInfo("", []).list).toEqual([]);
  });
  it("campos obrigatórios (vacinas contam pelo comprovante)", () => {
    const { list } = reqInfo("administrativo", []);
    expect(campoObrigatorio(list, "Vacina: Covid-19")).toBe(true);
    expect(campoObrigatorio(list, "Nº do PIS")).toBe(false);
    expect(campoObrigatorio(list, "RG / CPF / CNH")).toBe(true);
  });
  it("campo do certificado de cada curso", () => {
    expect(curCampo("ASO")).toBe("ASO");
    expect(curCampo("CBSP")).toBe("CBSP");
    expect(curCampo("MMO - Observação de Mamíferos Marinhos")).toBe("Curso: MMO - Observação de Mamíferos Marinhos");
  });
});

describe("cursos obrigatórios na ficha", () => {
  it("coloca os obrigatórios do setor no topo, na ordem", () => {
    const r = syncReqCur([{ name: "ASO", valid: T }], "ambiental", []);
    expect(r.map((x) => [x.name, !!x.req])).toEqual([
      ["CBSP", true],
      ["THUET / BOSIET / FOET", true],
      ["Norueguês / OEUK / ENG1", true],
      ["Certificado PAM", true],
      ["ASO", false],
    ]);
  });
  it("ao trocar de setor, descarta obrigatórios vazios e mantém os preenchidos", () => {
    const amb = syncReqCur([], "ambiental", []);
    amb[0].valid = T;
    const adm = syncReqCur(amb, "administrativo", [{ campo: "Certificado PAM", name: "pam.pdf" }]);
    expect(adm.map((x) => [x.name, !!x.req])).toEqual([
      ["CBSP", false],
      ["Certificado PAM", false],
    ]);
  });
});

describe("ficha e textos", () => {
  const p: Pessoa = { id: 1, name: esc("Ana & Cia"), role: "Técnica", setor: "ambiental", boat: 1, embark: T, dias: 42, rua: "Rua A", num: "10", cidade: "Macaé", cep: "27900000" };
  it("linhas da ficha", () => {
    const c = Object.fromEntries(campos({ boats: [{ id: 1, name: "Netuno" }] }, p));
    expect(c["Setor"]).toBe("Ambiental");
    expect(c["Barco"]).toBe("Netuno");
    expect(c["Endereço"]).toBe("Rua A, 10 - Macaé - CEP 27900000");
    expect(c["Escala"]).toBe("42 dias a bordo e 42 de folga");
  });
  it("Ficha.txt sem escape HTML e com travessão nos vazios", () => {
    const t = fichaTexto({ boats: [] }, p);
    expect(t.split("\n")[0]).toBe("Nome completo: Ana & Cia");
    expect(t).toContain("RG: —");
  });
  it("escape, iniciais e nome do arquivo", () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    expect(unesc(esc(`<a href="x">'&'</a>`))).toBe(`<a href="x">'&'</a>`);
    expect(iniciais("  Ana   Maria Ribeiro ")).toBe("AR");
    expect(iniciais("")).toBe("");
    expect(nomeArquivoFicha("José da Silva")).toBe("ficha_Jose_da_Silva.txt");
  });
  it("mensagens de erro de anexo", () => {
    expect(erroArq("a.pdf", new Error("grande"))).toBe("“a.pdf” passa de 20 MB e não foi anexado.");
    expect(erroArq("a.pdf", new Error("x"))).toBe("“a.pdf” não pôde ser guardado neste navegador.");
  });
});
