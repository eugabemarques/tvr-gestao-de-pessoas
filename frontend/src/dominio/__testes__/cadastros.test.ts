import { describe, expect, it } from "vitest";
import {
  avisoRemoverBarco,
  formDe,
  marcarResolvido,
  removerBarco,
  removerColab,
  removerCurso,
  salvarBarco,
  salvarColab,
  salvarCurso,
  validarBarco,
  validarColab,
  validarCurso,
  validarCursosFicha,
  type FormColab,
} from "../cadastros";
import { toDay } from "../datas";
import { estadoVazio, type Estado } from "../tipos";

const T = toDay("2026-11-13");

const valido = (x: Partial<FormColab> = {}): FormColab => ({
  ...formDe(estadoVazio(), null),
  nome: "Ana <Ribeiro>",
  rg: "123",
  cpf: "529.982.247-25",
  mae: "Maria",
  email: "ana@x.com",
  cel: "(22) 99999-0000",
  setor: "administrativo",
  emerg: "João 2299",
  rua: "Rua A",
  num: "1",
  cep: "27900-000",
  ...x,
});

describe("validação da ficha (ordem do protótipo)", () => {
  it("aceita uma ficha completa", () => expect(validarColab(valido())).toBeNull());
  it.each([
    [{ nome: " " }, "cnome", "Informe o nome completo."],
    [{ cpf: "123" }, "ccpf", "O CPF precisa ter 11 números."],
    [{ pis: "12" }, "cpis", "O PIS precisa ter 11 números (ou deixe em branco)."],
    [{ email: "ana@x" }, "cemail", "Informe um e-mail válido."],
    [{ cel: "99999-000" }, "ccel", "Informe o celular com DDD."],
    [{ setor: "" }, "csetor", "Escolha o setor."],
    [{ cep: "123" }, "ccep", "O CEP precisa ter 8 números."],
    [{ setor: "ambiental", data: "" }, "cdata", "No setor ambiental, informe a data de embarque da escala."],
    [{ setor: "ambiental", data: "2026-11-01", dias: "0" }, "cdias", "No setor ambiental, informe os dias da escala."],
    [{ ff: "2026-12-01" }, "cfi", "Informe o início das férias."],
    [{ fi: "2026-12-01" }, "cff", "Informe o fim das férias."],
    [{ fi: "2026-12-10", ff: "2026-12-01" }, "cff", "O fim das férias precisa ser depois do início."],
  ] as [Partial<FormColab>, string, string][])("%o → %s", (x, campo, msg) => {
    expect(validarColab(valido(x))).toEqual({ campo, msg });
  });
  it("linhas de curso incompletas", () => {
    expect(validarCursosFicha([{ name: "", valid: null }])).toMatchObject({ i: 0, semNome: true, msg: "Escolha o curso na linha 1 ou remova a linha." });
    expect(validarCursosFicha([{ name: "CBSP", valid: null, req: true }, { name: "ASO", valid: null }])).toMatchObject({ i: 1, msg: "Informe a validade de ASO." });
    expect(validarCursosFicha([{ name: "CBSP", valid: null, req: true }])).toBeNull();
  });
});

describe("gravar colaborador", () => {
  it("novo colaborador ambiental: escala, histórico, cursos e escape", () => {
    const S = estadoVazio();
    const p = salvarColab(S, null, valido({ setor: "ambiental", data: "2026-11-01", dias: "42", barco: "" }), [], [{ name: "CBSP", valid: T, req: true }, { name: "PAM", valid: null, req: true }], 5000);
    expect(p).toMatchObject({ id: 5000, name: "Ana &lt;Ribeiro&gt;", embark: toDay("2026-11-01"), dias: 42, dobra: 0, base: 42, boat: null });
    expect(S.hist).toEqual([{ pid: 5000, ini: toDay("2026-11-01"), dias: 42, dobra: 0, boat: null }]);
    expect(S.courses).toEqual([{ pid: 5000, name: "CBSP", valid: T }]);
    expect(formDe(S, p).nome).toBe("Ana <Ribeiro>");
  });
  it("setor sem escala não grava embarque; edição zera a dobra se a escala mudar", () => {
    const S: Estado = { ...estadoVazio(), people: [{ id: 1, name: "A", role: "", setor: "ambiental", embark: T, dias: 42, dobra: 7 }] };
    salvarColab(S, 1, valido({ setor: "ambiental", data: "2026-11-13", dias: "42" }), [], []);
    expect(S.people[0].dobra).toBe(7);
    salvarColab(S, 1, valido({ setor: "administrativo" }), [], []);
    expect(S.people[0]).toMatchObject({ embark: null, dias: null, dobra: 0 });
  });
  it("remover tira a pessoa e os cursos dela", () => {
    const S: Estado = { ...estadoVazio(), people: [{ id: 1, name: "A", role: "" }], courses: [{ pid: 1, name: "ASO", valid: T }] };
    removerColab(S, 1);
    expect(S.people).toEqual([]);
    expect(S.courses).toEqual([]);
  });
});

describe("barcos", () => {
  it("valida nome vazio e repetido", () => {
    const S: Estado = { ...estadoVazio(), boats: [{ id: 1, name: "Netuno &amp; Cia" }] };
    expect(validarBarco(S, null, { nome: "", tipo: "", obs: "" })).toBe("Informe o nome do barco.");
    expect(validarBarco(S, null, { nome: "netuno & cia", tipo: "", obs: "" })).toBe("Já existe um barco com esse nome.");
    expect(validarBarco(S, 1, { nome: "netuno & cia", tipo: "", obs: "" })).toBeNull();
  });
  it("salva, edita e remove deixando a tripulação sem barco", () => {
    const S: Estado = { ...estadoVazio(), people: [{ id: 1, name: "A", role: "", boat: 7 }] };
    salvarBarco(S, null, { nome: "Atlântico", tipo: "PSV", obs: "" }, 7);
    salvarBarco(S, 7, { nome: "Atlântico II", tipo: "PSV", obs: "x" });
    expect(S.boats).toEqual([{ id: 7, name: "Atlântico II", tipo: "PSV", obs: "x" }]);
    expect(avisoRemoverBarco(1)).toBe("1 tripulante ficará sem barco definido.");
    expect(avisoRemoverBarco(2)).toBe("2 tripulantes ficarão sem barco definido.");
    removerBarco(S, 7);
    expect(S.boats).toEqual([]);
    expect(S.people[0].boat).toBeNull();
  });
});

describe("cursos e avisos", () => {
  it("valida e grava curso com certificado", () => {
    const S: Estado = { ...estadoVazio(), people: [{ id: 1, name: "A", role: "" }], courses: [{ pid: 1, name: "CBSP", valid: T }] };
    expect(validarCurso(S, true, false, "", 1, "")).toBe("Escolha o curso.");
    expect(validarCurso(S, true, false, "CBSP", 1, "2027-01-01")).toBe("Este colaborador já tem esse curso cadastrado. Use “Editar” para atualizar a validade.");
    expect(validarCurso(S, true, true, "ASO", 1, "")).toBe("Informe a validade.");
    salvarCurso(S, null, 1, "ASO", T + 10, { name: "aso.pdf", fid: "f1" });
    salvarCurso(S, "1|CBSP", 1, "CBSP", T + 300, null);
    expect(S.courses).toEqual([
      { pid: 1, name: "CBSP", valid: T + 300 },
      { pid: 1, name: "ASO", valid: T + 10 },
    ]);
    expect(S.people[0].docs).toEqual([{ campo: "ASO", name: "aso.pdf", fid: "f1" }]);
    removerCurso(S, "1|ASO");
    expect(S.courses.length).toBe(1);
  });
  it("resolver e reabrir aviso", () => {
    const S = estadoVazio();
    marcarResolvido(S, "k", true);
    expect(S.resolved).toEqual(["k"]);
    marcarResolvido(S, "k", false);
    expect(S.resolved).toEqual([]);
  });
});
