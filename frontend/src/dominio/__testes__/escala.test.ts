import { describe, expect, it } from "vitest";
import { toDay, fmt, diaIso } from "../datas";
import { adicionarDobra, calc, cycle, emFerias, novoId, normalizar, periodos, previaDobra, previaRegistro, registrarEmbarque, situacao, situacaoPeriodo } from "../escala";
import { estadoVazio, type Estado, type Pessoa } from "../tipos";
import { protoCalc, protoCycle, protoDobra, protoPeriodos } from "./prototipo";

const T = toDay("2026-11-13");
const P = (x: Partial<Pessoa>): Pessoa => ({ id: 1, name: "Ana", role: "Técnica", embark: T, dias: 42, ...x });

/** Gerador pseudoaleatório determinístico. */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

describe("datas", () => {
  it("converte e formata como o protótipo", () => {
    expect(toDay("1970-01-02")).toBe(1);
    expect(fmt(toDay("2026-03-05"))).toBe("05/03/2026");
    expect(diaIso(toDay("2026-03-05"))).toBe("2026-03-05");
    expect(diaIso(null)).toBe("");
  });
});

describe("cycle (42x42)", () => {
  it("primeiro dia a bordo é o dia 1", () => {
    const c = cycle(P({ embark: T }), T);
    expect(c.st).toBe("aboard");
    if (c.st !== "future") expect(c.day).toBe(1);
    expect(c.end).toBe(T + 41);
    expect(c.next).toBe(T + 84);
  });
  it("antes do embarque é futuro", () => {
    const c = cycle(P({ embark: T + 5 }), T);
    expect(c).toMatchObject({ st: "future", days: 5, next: T + 5, end: T + 46 });
  });
  it("folga depois de 42 dias a bordo", () => {
    const c = cycle(P({ embark: T - 50 }), T);
    expect(c.st).toBe("rest");
    if (c.st === "rest") expect(c.day).toBe(9);
  });
  it("dobra soma ao primeiro ciclo e some no seguinte", () => {
    const c1 = cycle(P({ embark: T - 45, dobra: 7 }), T);
    expect(c1).toMatchObject({ st: "aboard", L: 49, dobra: 7 });
    const c2 = cycle(P({ embark: T - 100, dobra: 7 }), T);
    expect(c2).toMatchObject({ L: 42, dobra: 0, first: false });
  });
  it("é idêntico ao protótipo em 3000 casos aleatórios", () => {
    const r = rng(7);
    for (let i = 0; i < 3000; i++) {
      const p = P({ embark: T - 400 + Math.floor(r() * 500), dias: 1 + Math.floor(r() * 60), dobra: r() < 0.4 ? Math.floor(r() * 14) : undefined, base: r() < 0.3 ? 14 + Math.floor(r() * 40) : undefined });
      expect(cycle(p, T)).toEqual(protoCycle(p, T));
    }
  });
});

describe("férias e situação", () => {
  it("férias têm prioridade sobre a escala", () => {
    const p = P({ fIni: T - 3, fFim: T + 12 });
    expect(emFerias(p, T)).toBe(true);
    expect(situacao({ boats: [] }, p, T).k).toBe("ferias");
  });
  it("sem escala, embarcado com barco, folga", () => {
    expect(situacao({ boats: [] }, P({ embark: null }), T).k).toBe("none");
    const z = situacao({ boats: [{ id: 2, name: "Netuno" }] }, P({ boat: 2, embark: T - 10 }), T);
    expect(z).toMatchObject({ k: "emb", barco: "Netuno", fim: T + 31 });
    expect(situacao({ boats: [] }, P({ embark: T - 60 }), T).k).toBe("folga");
  });
});

describe("prévias", () => {
  it("registro: n dias de folga para n dias a bordo", () => {
    expect(previaRegistro(100, 42)).toEqual({ folga: 42, inicio: 100, inicioFolga: 142, proximo: 184, ultimoBordo: 141, ultimoFolga: 183 });
  });
  it("dobra: folga cresce junto", () => {
    const c = cycle(P({ embark: T - 10 }), T);
    expect(previaDobra(c, 7)).toEqual({ L: 42, L2: 49, ultimoBordo: T - 10 + 48, ultimoFolga: T - 10 + 97, proximo: T - 10 + 98 });
  });
});

describe("registro e dobra", () => {
  const base = (): Estado => ({ ...estadoVazio(), people: [P({ id: 1, embark: T - 10 }), P({ id: 2, embark: T - 100 })] });
  it("registrar substitui o embarque do mesmo dia no histórico", () => {
    const S = base();
    registrarEmbarque(S, 1, T, 30, 3);
    registrarEmbarque(S, 1, T, 28, null);
    expect(S.hist).toEqual([{ pid: 1, ini: T, dias: 28, dobra: 0, boat: null }]);
    expect(S.people[0]).toMatchObject({ embark: T, dias: 28, dobra: 0, boat: null });
  });
  it("dobra é igual ao protótipo no 1º ciclo e nos seguintes", () => {
    for (const pid of [1, 2]) {
      const a = base(),
        b = base();
      adicionarDobra(a, pid, 5, T);
      protoDobra(b, pid, 5, T);
      expect(a).toEqual(b);
      adicionarDobra(a, pid, 3, T);
      protoDobra(b, pid, 3, T);
      expect(a).toEqual(b);
    }
  });
});

describe("períodos e cálculo do histórico", () => {
  it("previstos seguem a escala padrão depois do último registrado", () => {
    const p = P({ embark: T - 200 });
    const hist = [
      { pid: 1, ini: T - 200, dias: 42, dobra: 0, boat: 1 },
      { pid: 1, ini: T - 116, dias: 42, dobra: 7, boat: 2 },
    ];
    const per = periodos(p, hist, T + 120);
    expect(per[0].src).toBe("Registrado");
    expect(per[2]).toMatchObject({ ini: T - 116 + 98, dias: 42, dobra: 0, src: "Previsto" });
    expect(per).toEqual(protoPeriodos({ hist }, p, T + 120));
  });
  it("conta dias a bordo, dobra e folga", () => {
    const p = P({ embark: T - 20, dias: 10, dobra: 2 });
    const r = calc(p, [], null, T);
    // 12 a bordo (2 de dobra) + 9 dias de folga (de T-8 até T)
    expect(r).toMatchObject({ ab: 12, dob: 2, fo: 9, de: T - 20 });
  });
  it("é idêntico ao protótipo em casos aleatórios", () => {
    const r = rng(42);
    for (let i = 0; i < 300; i++) {
      const p = P({ embark: T - Math.floor(r() * 600), dias: 7 + Math.floor(r() * 50), dobra: Math.floor(r() * 5), base: r() < 0.5 ? 28 : undefined });
      const hist = r() < 0.5 ? [] : [{ pid: 1, ini: p.embark as number, dias: p.dias as number, dobra: p.dobra, boat: null }];
      const de = r() < 0.5 ? null : T - Math.floor(r() * 300);
      const ate = T + Math.floor(r() * 100) - 50;
      expect(calc(p, hist, de, ate)).toEqual(protoCalc({ hist }, p, de, ate));
    }
  });
  it("situação de cada embarque na ficha", () => {
    const x = { ini: T - 50, dias: 42, dobra: 0, boat: null, src: "Registrado" as const };
    expect(situacaoPeriodo(x, T)).toBe("Folga");
    expect(situacaoPeriodo({ ...x, ini: T + 1 }, T)).toBe("Previsto");
    expect(situacaoPeriodo({ ...x, ini: T - 10 }, T)).toBe("Embarcado");
    expect(situacaoPeriodo({ ...x, ini: T - 200 }, T)).toBe("Concluído");
  });
});

describe("dados antigos e ids", () => {
  it("converte o barco em texto (unit) para a lista de barcos", () => {
    const S = { ...estadoVazio(), people: [P({ id: 1, unit: "Atlântico" }), P({ id: 2, unit: "Atlântico" })] } as Estado;
    delete (S as Partial<Estado>).boats;
    normalizar(S);
    expect(S.boats).toEqual([{ id: 1, name: "Atlântico", tipo: "", obs: "" }]);
    expect(S.people.map((p) => p.boat)).toEqual([1, 1]);
  });
  it("novo id usa o relógio no modo servidor", () => {
    expect(novoId([{ id: 5 }], 1000)).toBe(1000);
    expect(novoId([{ id: 5000 }], 1000)).toBe(5001);
  });
});
