import { describe, expect, it } from "vitest";
import { toDay, fmt, diaIso } from "../datas";
import {
  adicionarDobra,
  calc,
  cycle,
  emFerias,
  erroTranslado,
  etapas,
  novoId,
  normalizar,
  periodos,
  previaDobra,
  podeDarDobra,
  previaRegistro,
  registrarEmbarque,
  situacao,
  situacaoPeriodo,
} from "../escala";
import { estadoVazio, type Estado, type Pessoa } from "../tipos";

const T = toDay("2026-11-13");
const D = (s: string) => toDay(s);
const P = (x: Partial<Pessoa>): Pessoa => ({ id: 1, name: "Ana", role: "Técnica", embark: T, dias: 42, ...x });

/** Gerador pseudoaleatório determinístico. */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

describe("datas", () => {
  it("converte e formata", () => {
    expect(toDay("1970-01-02")).toBe(1);
    expect(fmt(toDay("2026-03-05"))).toBe("05/03/2026");
    expect(diaIso(toDay("2026-03-05"))).toBe("2026-03-05");
    expect(diaIso(null)).toBe("");
  });
});

describe("ciclo com translado (exemplo do RH: translado 16/11, embarque 17/11, 42 dias)", () => {
  const ana = P({ embark: D("2026-11-17"), dias: 42 });
  it("etapas do ciclo", () => {
    expect(etapas(D("2026-11-17"), 42)).toEqual({
      ida: D("2026-11-16"),
      ini: D("2026-11-17"),
      A: 42,
      ultimoBordo: D("2026-12-28"),
      volta: D("2026-12-28"),
      folgaIni: D("2026-12-29"),
      folgaFim: D("2027-02-08"),
      proximo: D("2027-02-10"),
    });
  });
  it("antes do translado: futuro", () => {
    expect(cycle(ana, D("2026-11-10"))).toMatchObject({ st: "future", days: 7, next: D("2026-11-17"), end: D("2026-12-28") });
  });
  it("dia do translado de ida: trabalhado, embarca no dia seguinte", () => {
    expect(cycle(ana, D("2026-11-16"))).toMatchObject({ st: "transit", sentido: "ida", next: D("2026-11-17"), days: 1 });
    expect(situacao({ boats: [] }, ana, D("2026-11-16"))).toMatchObject({ k: "translado", sentido: "ida", embarque: D("2026-11-17") });
  });
  it("a bordo do dia 1 ao 42", () => {
    expect(cycle(ana, D("2026-11-17"))).toMatchObject({ st: "aboard", day: 1, end: D("2026-12-28"), next: D("2027-02-10") });
    expect(cycle(ana, D("2026-12-28"))).toMatchObject({ st: "aboard", day: 42 });
  });
  it("folga começa no dia seguinte e tem 42 dias (o translado não gera folga)", () => {
    expect(cycle(ana, D("2026-12-29"))).toMatchObject({ st: "rest", day: 1 });
    expect(cycle(ana, D("2027-02-08"))).toMatchObject({ st: "rest", day: 42, next: D("2027-02-10") });
  });
  it("próximo ciclo: translado no dia seguinte ao fim da folga, embarque no outro dia", () => {
    expect(cycle(ana, D("2027-02-09"))).toMatchObject({ st: "transit", sentido: "ida", first: false, next: D("2027-02-10") });
    expect(cycle(ana, D("2027-02-10"))).toMatchObject({ st: "aboard", day: 1, first: false, L: 42, start: D("2027-02-10") });
  });
  it("translado de volta no dia seguinte ao último dia a bordo", () => {
    const b = P({ embark: D("2026-11-17"), dias: 42, tv: 1 });
    expect(cycle(b, D("2026-12-29"))).toMatchObject({ st: "transit", sentido: "volta", day: 1 });
    expect(situacao({ boats: [] }, b, D("2026-12-29")).k).toBe("translado");
    expect(cycle(b, D("2026-12-30"))).toMatchObject({ st: "rest", day: 1 });
    expect(cycle(b, D("2027-02-09"))).toMatchObject({ st: "rest", day: 42 });
    expect(cycle(b, D("2027-02-11"))).toMatchObject({ st: "aboard", day: 1, first: false });
  });
  it("translado de ida de 2 dias", () => {
    const c = P({ embark: D("2026-11-17"), dias: 42, ti: 2 });
    expect(cycle(c, D("2026-11-15"))).toMatchObject({ st: "transit", sentido: "ida", day: 1, days: 2 });
    expect(cycle(c, D("2026-11-14")).st).toBe("future");
  });
  it("ciclo padrão dura 85 dias (1 + 42 + 42) depois do primeiro", () => {
    const a = cycle(ana, D("2027-03-01")),
      b = cycle(ana, D("2027-03-01") + 85),
      c = cycle(ana, D("2027-03-01") + 85 * 10);
    expect(b).toMatchObject({ st: a.st, day: a.day, first: false });
    expect(c).toMatchObject({ st: a.st, day: a.day });
  });
  it("dobra soma ao primeiro ciclo e some no seguinte", () => {
    const d = P({ embark: D("2026-11-17"), dias: 42, dobra: 7 });
    expect(cycle(d, D("2027-01-04"))).toMatchObject({ st: "aboard", day: 49, L: 49, dobra: 7 });
    // folga = dias a bordo com a dobra: 49 dias, de 05/01 a 22/02
    expect(cycle(d, D("2027-01-05"))).toMatchObject({ st: "rest", day: 1 });
    expect(cycle(d, D("2027-02-22"))).toMatchObject({ st: "rest", day: 49 });
    expect(cycle(d, D("2027-02-23"))).toMatchObject({ st: "transit", sentido: "ida" });
    expect(cycle(d, D("2027-02-24"))).toMatchObject({ st: "aboard", L: 42, dobra: 0, first: false });
  });
  it("dados antigos (sem translado gravado) usam o padrão", () => {
    expect(cycle(P({ embark: T }), T - 1)).toMatchObject({ st: "transit", sentido: "ida" });
  });
});

describe("ciclo do dia e histórico sempre concordam (casos aleatórios)", () => {
  it("a situação de cada dia é a mesma no ciclo e no cálculo do histórico", () => {
    const r = rng(7);
    const mapa = { aboard: ["A bordo", "Dobra"], transit: ["Translado"], rest: ["Folga"] } as const;
    for (let i = 0; i < 400; i++) {
      const p = P({
        embark: T - 300 + Math.floor(r() * 300),
        dias: 7 + Math.floor(r() * 50),
        dobra: r() < 0.4 ? Math.floor(r() * 10) : undefined,
        base: r() < 0.3 ? 14 + Math.floor(r() * 40) : undefined,
        ti: r() < 0.3 ? Math.floor(r() * 3) : undefined,
        tv: r() < 0.3 ? Math.floor(r() * 3) : undefined,
      });
      const ate = T + 200;
      const k = calc(p, [], null, ate);
      const porDia = new Map(k.dias.map(([d, s]) => [d, s]));
      for (let d = T - 100; d <= ate; d += 7) {
        const c = cycle(p, d);
        if (c.st === "future") {
          expect(porDia.has(d)).toBe(false);
          continue;
        }
        expect(mapa[c.st]).toContain(porDia.get(d));
      }
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
  it("registro com o translado padrão", () => {
    expect(previaRegistro(100, 42)).toEqual({
      folga: 42,
      translado: 1,
      trabalhados: 43,
      ida: 99,
      inicio: 100,
      ultimoBordo: 141,
      volta: 141,
      inicioFolga: 142,
      ultimoFolga: 183,
      proximaIda: 184,
      proximo: 185,
    });
  });
  it("registro com volta no dia seguinte: folga começa depois do translado", () => {
    expect(previaRegistro(100, 42, 1, 1)).toMatchObject({ trabalhados: 44, volta: 142, inicioFolga: 143, ultimoFolga: 184, proximo: 186 });
  });
  it("dobra: folga cresce junto e o translado acompanha", () => {
    const c = cycle(P({ embark: T - 10 }), T);
    expect(previaDobra(c, 7)).toEqual({ L: 42, L2: 49, ultimoBordo: T - 10 + 48, ultimoFolga: T - 10 + 97, proximo: T - 10 + 99 });
    const c2 = cycle(P({ embark: T - 10, tv: 1 }), T);
    expect(previaDobra(c2, 7)).toMatchObject({ ultimoBordo: T - 10 + 48, ultimoFolga: T - 10 + 98 });
  });
  it("confere as datas de translado", () => {
    expect(erroTranslado(1, 0)).toBeNull();
    expect(erroTranslado(0, 0)).toBeNull();
    expect(erroTranslado(-1, 0)).toContain("ida");
    expect(erroTranslado(1, -1)).toContain("volta");
    expect(erroTranslado(11, 0)).toContain("10 dias");
  });
});

describe("registro e dobra", () => {
  const base = (): Estado => ({ ...estadoVazio(), people: [P({ id: 1, embark: T - 10 }), P({ id: 2, embark: T - 100 })] });
  it("registrar grava o translado e substitui o embarque do mesmo dia no histórico", () => {
    const S = base();
    registrarEmbarque(S, 1, T, 30, 3);
    registrarEmbarque(S, 1, T, 28, null, 2, 1);
    expect(S.hist).toEqual([{ pid: 1, ini: T, dias: 28, dobra: 0, boat: null, ti: 2, tv: 1 }]);
    expect(S.people[0]).toMatchObject({ embark: T, dias: 28, dobra: 0, boat: null, ti: 2, tv: 1 });
  });
  it("dobra no 1º ciclo soma; num ciclo previsto, ele vira o embarque registrado", () => {
    const S = base();
    adicionarDobra(S, 1, 5, T);
    expect(S.people[0]).toMatchObject({ embark: T - 10, dobra: 5 });
    expect(S.hist).toEqual([{ pid: 1, ini: T - 10, dias: 42, dobra: 5, boat: undefined, ti: 1, tv: 0 }]);
    adicionarDobra(S, 1, 3, T);
    expect(S.people[0].dobra).toBe(8);
    expect(S.hist[0].dobra).toBe(8);
    // pessoa 2: embarque em T-100 → ciclo seguinte começa em T-100+85
    const c = cycle(S.people[1], T);
    expect(c).toMatchObject({ first: false, start: T - 15 });
    adicionarDobra(S, 2, 4, T);
    expect(S.people[1]).toMatchObject({ embark: T - 15, dias: 42, dobra: 4, ti: 1, tv: 0 });
  });
});

describe("períodos e cálculo do histórico", () => {
  it("previstos seguem a escala padrão (com translado) depois do último registrado", () => {
    const p = P({ embark: T - 200 });
    const hist = [
      { pid: 1, ini: T - 200, dias: 42, dobra: 0, boat: 1 },
      { pid: 1, ini: T - 116, dias: 42, dobra: 7, boat: 2, ti: 1, tv: 1 },
    ];
    const per = periodos(p, hist, T + 120);
    expect(per[0]).toMatchObject({ src: "Registrado", ti: 1, tv: 0 });
    // 49 dias a bordo + 1 de volta + 49 de folga + 1 de translado de ida
    expect(per[2]).toMatchObject({ ini: T - 116 + 49 + 1 + 49 + 1, dias: 42, dobra: 0, src: "Previsto", ti: 1, tv: 0 });
    expect(per[3].ini - per[2].ini).toBe(85);
  });
  it("conta translado, dias a bordo, dobra e folga", () => {
    const p = P({ embark: T - 20, dias: 10, dobra: 2 });
    // translado T-21, 12 a bordo (2 de dobra), folga de T-8 até T (9 dias)
    expect(calc(p, [], null, T)).toMatchObject({ tr: 1, ab: 12, dob: 2, fo: 9, de: T - 21 });
    const v = P({ embark: T - 20, dias: 10, tv: 2 });
    // translado de ida T-21, 10 a bordo (T-20 a T-11), volta T-10 e T-9, folga de T-8 até T (9 dias)
    expect(calc(v, [], null, T)).toMatchObject({ tr: 3, ab: 10, fo: 9 });
  });
  it("situação de cada embarque na ficha", () => {
    const x = { ini: T - 50, dias: 42, dobra: 0, boat: null, src: "Registrado" as const, ti: 1, tv: 0 };
    expect(situacaoPeriodo(x, T)).toBe("Folga");
    expect(situacaoPeriodo({ ...x, ini: T + 2 }, T)).toBe("Previsto");
    expect(situacaoPeriodo({ ...x, ini: T + 1 }, T)).toBe("Translado");
    expect(situacaoPeriodo({ ...x, ini: T - 10 }, T)).toBe("Embarcado");
    expect(situacaoPeriodo({ ...x, ini: T - 42, tv: 1 }, T)).toBe("Translado");
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

describe("dobra durante a folga (Equipe hoje)", () => {
  const D2 = (s: string) => toDay(s);
  it("quem pode receber dobra: a bordo, translado de volta e folga", () => {
    const p = P({ embark: D2("2026-11-17"), dias: 42, tv: 1 });
    expect(podeDarDobra(cycle(p, D2("2026-11-15")))).toBe(false); // antes do 1º embarque
    expect(podeDarDobra(cycle(p, D2("2026-11-16")))).toBe(false); // translado de ida
    expect(podeDarDobra(cycle(p, D2("2026-11-20")))).toBe(true); // a bordo
    expect(podeDarDobra(cycle(p, D2("2026-12-29")))).toBe(true); // translado de volta
    expect(podeDarDobra(cycle(p, D2("2027-01-05")))).toBe(true); // folga
  });
  it("de folga no 1º ciclo: a dobra vai para o embarque que terminou e a folga é recalculada", () => {
    const S: Estado = { ...estadoVazio(), people: [P({ id: 1, embark: D2("2026-09-29"), dias: 42 })] };
    const hoje = D2("2026-11-24"); // folga desde 10/11
    expect(cycle(S.people[0], hoje).st).toBe("rest");
    adicionarDobra(S, 1, 5, hoje);
    expect(S.people[0]).toMatchObject({ embark: D2("2026-09-29"), dobra: 5 });
    const c = cycle(S.people[0], hoje);
    // último dia a bordo 09/11 + 5 = 14/11; folga de 47 dias a partir de 15/11; hoje = 10º dia de folga
    expect(c).toMatchObject({ st: "rest", day: 10, L: 47 });
    expect(c.e.folgaFim).toBe(D2("2026-12-31"));
  });
  it("de folga num ciclo previsto: o ciclo vira registrado com a dobra", () => {
    const S: Estado = { ...estadoVazio(), people: [P({ id: 1, embark: D2("2026-05-01"), dias: 42 })] };
    const hoje = D2("2026-09-15"); // 2º ciclo: a bordo de 25/07 a 04/09, folga desde 05/09
    const antes = cycle(S.people[0], hoje);
    expect(antes).toMatchObject({ st: "rest", first: false });
    adicionarDobra(S, 1, 3, hoje);
    expect(S.people[0]).toMatchObject({ embark: antes.start, dias: 42, dobra: 3 });
    expect(S.hist.at(-1)).toMatchObject({ ini: antes.start, dobra: 3 });
  });
});
