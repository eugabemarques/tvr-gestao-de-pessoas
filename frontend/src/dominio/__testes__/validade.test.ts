import { describe, expect, it } from "vitest";
import { toDay } from "../datas";
import { estadoVazio, type Estado } from "../tipos";
import { alturaBarra, avisos, courseState, gruposAso, gruposCursos, gruposPainel, isAso, stAso } from "../validade";
import { protoAvisos, protoCourseState, protoStAso } from "./prototipo";

const T = toDay("2026-11-13");

describe("faixas de validade", () => {
  it("cursos: vencido, até 90 dias, em dia", () => {
    expect(courseState({ valid: T - 1 }, T)).toEqual({ k: "bad", t: "Vencido há 1 dias" });
    expect(courseState({ valid: T }, T)).toEqual({ k: "warn", t: "Vence em 0 dias" });
    expect(courseState({ valid: T + 90 }, T).k).toBe("warn");
    expect(courseState({ valid: T + 91 }, T)).toEqual({ k: "ok", t: "Em dia" });
  });
  it("ASO: 60 e 90 dias", () => {
    expect(stAso({ valid: T + 60 }, T).g).toBe("w60");
    expect(stAso({ valid: T + 61 }, T).g).toBe("w90");
    expect(stAso({ valid: T + 91 }, T).g).toBe("ok");
    expect(stAso({ valid: T - 3 }, T).g).toBe("bad");
  });
  it("idênticas ao protótipo de -200 a +200 dias", () => {
    for (let d = -200; d <= 200; d++) {
      expect(courseState({ valid: T + d }, T)).toEqual(protoCourseState({ valid: T + d }, T));
      expect(stAso({ valid: T + d }, T)).toEqual(protoStAso({ valid: T + d }, T));
    }
  });
  it("ASO reconhecido pelo nome", () => {
    expect(isAso({ name: "ASO" })).toBe(true);
    expect(isAso({ name: "aso periódico" })).toBe(true);
    expect(isAso({ name: "CBSP" })).toBe(false);
  });
  it("altura das colunas do gráfico", () => {
    expect(alturaBarra(0, 4)).toBe(6);
    expect(alturaBarra(4, 4)).toBe(120);
  });
});

/** Mesmo cenário dos dados de exemplo do protótipo. */
function exemplo(): Estado {
  return {
    ...estadoVazio(),
    people: [
      { id: 1, name: "Ana Ribeiro", role: "Técnica de segurança", setor: "ambiental", boat: 2, embark: T - 10, dias: 42 },
      { id: 2, name: "Bruno Almeida", role: "Eletricista", setor: "ambiental", boat: 2, embark: T - 36, dias: 42, dobra: 7, base: 42 },
      { id: 3, name: "Carla Mendes", role: "Enfermeira", setor: "ambiental", boat: 1, embark: T - 52, dias: 42 },
      { id: 4, name: "Diego Fontes", role: "Mecânico", setor: "ambiental", boat: 1, embark: T - 80, dias: 42, fIni: T - 3, fFim: T + 12 },
      { id: 5, name: "Elisa Costa", role: "Marinheira", setor: "ambiental", boat: 1, embark: T - 20, dias: 42 },
      { id: 6, name: "Fábio Nunes", role: "Soldador", setor: "ambiental", boat: 2, embark: T - 60, dias: 42 },
    ],
    boats: [
      { id: 1, name: "Atlântico", tipo: "PSV", obs: "" },
      { id: 2, name: "Netuno", tipo: "OSRV", obs: "" },
    ],
    courses: (
      [
        [1, "CBSP", 300], [1, "THUET / BOSIET / FOET", 40], [1, "MMO - Observação de Mamíferos Marinhos", 20],
        [2, "CBSP", 150], [2, "MAP - Monitoramento Acústico Passivo", -12], [2, "THUET / BOSIET / FOET", 500],
        [3, "CBSP", 80], [3, "THUET / BOSIET / FOET", 25], [4, "MMO - Observação de Mamíferos Marinhos", 60],
        [5, "CBSP", 30], [6, "MAP - Monitoramento Acústico Passivo", 10], [1, "ASO", 200], [2, "ASO", -5], [3, "ASO", 45], [6, "ASO", 20],
      ] as [number, string, number][]
    ).map(([pid, name, d]) => ({ pid, name, valid: T + d })),
    resolved: [],
  };
}

describe("avisos de embarque", () => {
  it("iguais ao protótipo nos dados de exemplo", () => {
    const S = exemplo();
    S.resolved = ["1|MMO - Observação de Mamíferos Marinhos|" + (T + 20)];
    const a = avisos(S, T).map(({ key, res, bad }) => ({ key, res, bad }));
    expect(a).toEqual(protoAvisos(S, T));
    expect(a.length).toBeGreaterThan(0);
    expect(a.find((x) => x.key.startsWith("1|MMO"))?.res).toBe(true);
  });
  it("crítico quando vence antes de embarcar; atenção quando vence a bordo", () => {
    const S: Estado = {
      ...estadoVazio(),
      people: [{ id: 9, name: "X", role: "", embark: T + 10, dias: 42 }],
      courses: [
        { pid: 9, name: "CBSP", valid: T + 5 },
        { pid: 9, name: "ASO", valid: T + 20 },
        { pid: 9, name: "MAP", valid: T + 100 },
      ],
    };
    const a = avisos(S, T);
    expect(a.map((x) => [x.curso, x.bad])).toEqual([
      ["CBSP", true],
      ["ASO", false],
    ]);
  });
  it("ignora quem embarca daqui a mais de 30 dias", () => {
    const S: Estado = { ...estadoVazio(), people: [{ id: 9, name: "X", role: "", embark: T + 31, dias: 42 }], courses: [{ pid: 9, name: "CBSP", valid: T }] };
    expect(avisos(S, T)).toEqual([]);
  });
});

describe("painel e gráficos", () => {
  it("separa embarcados, folga e férias", () => {
    const S = exemplo();
    const g = gruposPainel(S, T);
    expect(g.pessoas.emb[1].map((x) => x.p.id)).toEqual([1, 2, 5]);
    expect(g.pessoas.folga[1].map((x) => x.p.id)).toEqual([3, 6]);
    expect(g.cursos.cv[1].length).toBe(1);
    expect(g.cursos.c60[1].length).toBe(6);
    expect(g.cursos.c90[1].length).toBe(1);
    expect(g.cursos.av[1].length).toBe(1);
    expect(g.cursos.aa[1].length).toBe(2);
  });
  it("agrupa cursos e ASO por faixa", () => {
    const S = exemplo();
    const c = gruposCursos(S.courses, T),
      a = gruposAso(S.courses, T);
    expect([c.bad.length, c.warn.length, c.ok.length]).toEqual([1, 7, 3]);
    expect([a.bad.length, a.w60.length, a.w90.length, a.ok.length]).toEqual([1, 2, 0, 1]);
  });
});
