import { describe, expect, it } from "vitest";
import { toDay } from "../datas";
import { campoObrigatorio, campos, curCampo, docFor, docsDo, erroArq, fichaTexto, pendDocs, reqCursos, reqInfo, syncReqCur, VACDOC } from "../documentos";
import { fichaPdf } from "../exportacao";
import { esc, iniciais, nomeArquivoFicha, unesc } from "../texto";
import type { Pessoa } from "../tipos";

const T = toDay("2026-11-13");
const vacinas = ["Covid-19", "DT (difteria e tétano)", "Febre amarela"].map((n) => ({ campo: "Vacina: " + n, name: n + ".pdf", fid: "x" }));

describe("documentos obrigatórios por setor", () => {
  it("ambiental soma CTF, Work Citation e cursos à base", () => {
    expect(docsDo("administrativo").length).toBe(9);
    expect(docsDo("ambiental").length).toBe(15);
    expect(docsDo("")).toEqual([]);
    expect(reqCursos("ambiental")).toEqual(["CBSP", "THUET / BOSIET / FOET", "Norueguês / OEUK / ENG1"]);
    expect(reqCursos("manutencao")).toEqual([]);
  });
  it("passaporte e PIS são opcionais", () => {
    const p = { setor: "administrativo", docs: [] };
    expect(pendDocs(p)).not.toContain("Nº do PIS");
    expect(pendDocs(p)).not.toContain("Passaporte (se tiver)");
    expect(pendDocs(p).length).toBe(7);
  });
  it("Certificado PAM é opcional no setor ambiental", () => {
    expect(pendDocs({ setor: "ambiental", docs: [] })).not.toContain("Certificado PAM");
    expect(campoObrigatorio(reqInfo("ambiental", []).list, "Certificado PAM")).toBe(false);
    expect(curCampo("Certificado PAM")).toBe("Certificado PAM");
  });
  it("vacinação completa com os três comprovantes", () => {
    expect(docFor(vacinas.slice(0, 2), VACDOC)).toBeNull();
    expect(docFor(vacinas, VACDOC)).toEqual({ name: "3 comprovantes na seção Vacinas", virt: true });
    expect(pendDocs({ setor: "administrativo", docs: vacinas })).not.toContain(VACDOC);
  });
  it("conta pendências por seção da ficha", () => {
    expect(reqInfo("ambiental", []).sec).toEqual({ dados: 8, cursos: 3, vacinas: 1 });
    expect(reqInfo("ambiental", [...vacinas, { campo: "CBSP", name: "c.pdf" }]).sec).toEqual({ dados: 8, cursos: 2, vacinas: 0 });
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
      ["ASO", false],
    ]);
  });
  it("ao trocar de setor, descarta obrigatórios vazios e mantém os preenchidos", () => {
    const amb = syncReqCur([], "ambiental", []);
    amb[0].valid = T;
    const adm = syncReqCur(amb, "administrativo", [{ campo: "THUET / BOSIET / FOET", name: "thuet.pdf" }]);
    expect(adm.map((x) => [x.name, !!x.req])).toEqual([
      ["CBSP", false],
      ["THUET / BOSIET / FOET", false],
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
  it("ficha em PDF: dados, cursos e vacinas; documentos só no dossiê", () => {
    const S = { boats: [{ id: 1, name: "Netuno" }], courses: [{ pid: 1, name: "CBSP", valid: T + 30 }, { pid: 1, name: "ASO", valid: T - 2 }, { pid: 2, name: "CBSP", valid: T }] };
    const F = fichaPdf(S, { ...p, vac: { cov: T - 100 }, docs: [{ campo: "CBSP", name: "cbsp.pdf" }] }, T);
    expect(F.nome).toBe("Ana & Cia");
    expect(F.sub).toBe("Ambiental · Técnica");
    const sec = Object.fromEntries(F.secoes.map((s) => [s.titulo, s.linhas]));
    expect(sec["Dados pessoais"]).toContainEqual(["RG", "—"]);
    expect(sec["Cursos e exames"]).toEqual([
      ["ASO", "Validade 11/11/2026 (vencido há 2 dias)"],
      ["CBSP", "Validade 13/12/2026 (vence em 30 dias)"],
    ]);
    expect(sec["Vacinas"][0]).toEqual(["Covid-19", "05/08/2026"]);
    // a ficha sozinha não tem as listas de documentos
    expect(F.secoes.map((s) => s.titulo)).toEqual(["Dados pessoais", "Cursos e exames", "Vacinas"]);
    // no dossiê, as listas entram e cada anexo mostra a página onde começa
    const D = fichaPdf(S, { ...p, docs: [{ campo: "CBSP", name: "cbsp.pdf" }, { name: "outro.png" }] }, T, [3, 5]);
    const dsec = Object.fromEntries(D.secoes.map((s) => [s.titulo, s.linhas]));
    expect(dsec["Documentos obrigatórios do setor"]).toContainEqual(["CBSP", "Anexado"]);
    expect(dsec["Documentos obrigatórios do setor"]).toContainEqual(["Certificado PAM", "Opcional"]);
    expect(dsec["Documentos obrigatórios do setor"]).toContainEqual(["Work Citation", "Pendente"]);
    const ult = D.secoes.at(-1)!;
    expect(ult.titulo).toBe("Documentos anexados (a seguir, neste dossiê)");
    expect(ult.linhas).toEqual([
      ["CBSP", "cbsp.pdf  ·  página 3"],
      ["Outros", "outro.png  ·  página 5"],
    ]);
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
    expect(nomeArquivoFicha("Ana Fictícia Conceição")).toBe("ficha_Ana_Ficticia_Conceicao.txt");
  });
  it("mensagens de erro de anexo", () => {
    expect(erroArq("a.pdf", new Error("grande"))).toBe("“a.pdf” passa de 20 MB e não foi anexado.");
    expect(erroArq("a.pdf", new Error("x"))).toBe("“a.pdf” não pôde ser guardado neste navegador.");
  });
});
