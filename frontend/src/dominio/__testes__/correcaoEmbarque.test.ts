import { describe, expect, it } from "vitest";
import { toDay } from "../datas";
import { apagarEmbarque, corrigirEmbarque, erroCorrecao, etapasPeriodo, periodos, registrarPeriodo } from "../escala";
import { estadoVazio, type Estado } from "../tipos";

const D = (s: string) => toDay(s);

function estado(): Estado {
  const S = estadoVazio();
  S.people.push({ id: 1, name: "Ana", setor: "ambiental", embark: D("2026-05-02"), dias: 42, dobra: 0, base: 42, boat: null, ti: 1, tv: 0 } as never);
  S.hist.push(
    { pid: 1, ini: D("2026-02-06"), dias: 42, dobra: 0, ti: 1, tv: 0 },
    { pid: 1, ini: D("2026-05-02"), dias: 42, dobra: 0, ti: 1, tv: 0 },
  );
  return S;
}
const c = (ini: string, dias = 42, dobra = 0) => ({ ini: D(ini), dias, dobra, boat: null, ti: 1, tv: 0 });

describe("correção de embarques registrados (Admin RH)", () => {
  it("corrige um embarque antigo sem mexer no mais recente", () => {
    const S = estado();
    expect(erroCorrecao(S, 1, D("2026-02-06"), c("2026-02-08", 40))).toBeNull();
    corrigirEmbarque(S, 1, D("2026-02-06"), c("2026-02-08", 40));
    expect(S.hist.find((h) => h.ini === D("2026-02-08"))?.dias).toBe(40);
    expect(S.hist.some((h) => h.ini === D("2026-02-06"))).toBe(false);
    expect(S.people[0].embark).toBe(D("2026-05-02"));
  });
  it("corrigir o mais recente atualiza a escala do colaborador", () => {
    const S = estado();
    corrigirEmbarque(S, 1, D("2026-05-02"), c("2026-05-04", 42, 3));
    expect(S.people[0].embark).toBe(D("2026-05-04"));
    expect(S.people[0].dobra).toBe(3);
    const per = periodos(S.people[0], S.hist, D("2026-12-31"));
    expect(per[1].ini).toBe(D("2026-05-04"));
    expect(per[2].src).toBe("Previsto");
  });
  it("não aceita período que se sobrepõe a outro embarque nem valores inválidos", () => {
    const S = estado();
    expect(erroCorrecao(S, 1, D("2026-02-06"), c("2026-04-20"))).toMatch(/sobrepõe/);
    expect(erroCorrecao(S, 1, D("2026-02-06"), c("2026-02-06", 0))).toMatch(/Dias a bordo/);
    expect(erroCorrecao(S, 1, D("2026-02-06"), { ...c("2026-02-06"), ti: -1 })).toMatch(/translado de ida/);
  });
  it("apaga um embarque, mas o colaborador mantém ao menos um", () => {
    const S = estado();
    expect(apagarEmbarque(S, 1, D("2026-05-02"))).toBe(true);
    expect(S.hist).toHaveLength(1);
    expect(S.people[0].embark).toBe(D("2026-02-06"));
    expect(apagarEmbarque(S, 1, D("2026-02-06"))).toBe(false);
    expect(S.hist).toHaveLength(1);
  });
});

describe("embarques pela escala da ficha (sem registro) — dobra e edição", () => {
  // colaboradora lançada só pelos campos da escala na ficha: nenhum embarque no histórico
  function soFicha(): Estado {
    const S = estadoVazio();
    S.people.push({ id: 2, name: "Bia", setor: "ambiental", embark: D("2026-09-29"), dias: 42, dobra: 0, base: 42, boat: null } as never);
    return S;
  }
  const hoje = D("2026-11-24");
  it("a lista da ficha não mostra previsão futura: só o que já começou", () => {
    const S = soFicha();
    const per = periodos(S.people[0], S.hist, hoje).filter((x) => x.src === "Registrado" || etapasPeriodo(x).ida <= hoje);
    expect(per.map((x) => x.ini)).toEqual([D("2026-09-29")]);
  });
  it("dar dobra num embarque da escala: registra o embarque e grava a dobra", () => {
    const S = soFicha();
    const x = periodos(S.people[0], S.hist, hoje)[0];
    expect(x.src).toBe("Previsto");
    expect(erroCorrecao(S, 2, x.ini, c("2026-09-29", 42, 7))).toBeNull();
    expect(registrarPeriodo(S, 2, x)).toBe(true);
    corrigirEmbarque(S, 2, x.ini, c("2026-09-29", 42, 7));
    expect(S.hist).toEqual([{ pid: 2, ini: D("2026-09-29"), dias: 42, dobra: 7, boat: null, ti: 1, tv: 0 }]);
    expect(S.people[0]).toMatchObject({ embark: D("2026-09-29"), dias: 42, dobra: 7 });
    // registrar de novo o mesmo embarque não duplica
    expect(registrarPeriodo(S, 2, { ...x, dobra: 7 })).toBe(false);
    expect(S.hist.length).toBe(1);
  });
  it("um ciclo da escala que já passou também pode ser editado (vira registrado)", () => {
    const S = soFicha();
    const ciclos = periodos(S.people[0], S.hist, D("2027-01-10")).filter((x) => etapasPeriodo(x).ida <= D("2027-01-10"));
    expect(ciclos.length).toBe(2);
    registrarPeriodo(S, 2, ciclos[0]);
    registrarPeriodo(S, 2, ciclos[1]);
    corrigirEmbarque(S, 2, ciclos[1].ini, c("2026-12-24", 42, 2));
    expect(S.hist.map((h) => h.ini)).toEqual([D("2026-09-29"), D("2026-12-24")]);
    expect(S.people[0]).toMatchObject({ embark: D("2026-12-24"), dobra: 2 });
  });
});
