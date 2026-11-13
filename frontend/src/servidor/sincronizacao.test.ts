import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aplicarPatch, clone, type Op } from "../dominio/patch";
import type { Estado } from "../dominio/tipos";
import { Sincronizador } from "./sincronizacao";

/** Servidor falso que aplica os patches como o servidor real. */
function servidor(inicial: Estado | null) {
  let dados: Record<string, unknown> | null = inicial ? clone(inicial) : null,
    versao = 1;
  const recebidos: Op[][] = [];
  let falhar = 0;
  return {
    recebidos,
    falharProximos: (n: number) => (falhar = n),
    alterarPorOutro: (fn: (d: Estado) => void) => {
      fn(dados as Estado);
      versao++;
    },
    t: {
      enviarPatch: async (ops: Op[]) => {
        if (falhar > 0) {
          falhar--;
          throw new Error("rede");
        }
        recebidos.push(ops);
        dados = aplicarPatch(dados || { people: [], boats: [], courses: [], hist: [], resolved: [], log: [] }, ops);
        versao++;
        return { versao, dados: clone(dados) as Estado };
      },
      obterVersao: async () => ({ versao }),
      obterEstado: async () => ({ versao, dados: clone(dados) as Estado }),
    },
  };
}

const amb = { dialogoAberto: () => false, oculto: () => false };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Sincronizador", () => {
  it("banco vazio começa sem dados de exemplo e cria a estrutura", async () => {
    const s = servidor(null);
    const z = new Sincronizador(s.t, amb);
    z.iniciar({ versao: 0, dados: null });
    expect(z.S.people).toEqual([]);
    await vi.advanceTimersByTimeAsync(300);
    expect(s.recebidos[0]).toEqual([{ c: "log", w: 1, v: [] }]);
  });

  it("agrupa alterações em 250 ms e mostra o status", async () => {
    const s = servidor({ people: [], boats: [], courses: [], hist: [], resolved: [], log: [] });
    const z = new Sincronizador(s.t, amb);
    z.iniciar(await s.t.obterEstado());
    z.mutar((S) => S.people.push({ id: 1, name: "A", role: "" }));
    z.mutar((S) => S.people.push({ id: 2, name: "B", role: "" }));
    expect(z.pendente()).toBe(true);
    await vi.advanceTimersByTimeAsync(200);
    expect(s.recebidos.length).toBe(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(s.recebidos.length).toBe(1);
    expect(s.recebidos[0].map((o) => ("k" in o ? o.k : "")).sort()).toEqual(["1", "2"]);
    expect(z.status.texto).toBe("");
    expect(z.pendente()).toBe(false);
  });

  it("sem conexão: mostra o aviso e tenta de novo com espera crescente", async () => {
    const s = servidor({ people: [], boats: [], courses: [], hist: [], resolved: [], log: [] });
    const z = new Sincronizador(s.t, amb);
    z.iniciar(await s.t.obterEstado());
    s.falharProximos(1);
    z.mutar((S) => S.boats.push({ id: 1, name: "N" }));
    await vi.advanceTimersByTimeAsync(300);
    expect(z.status).toEqual({ texto: "Sem conexão: as alterações serão enviadas assim que possível.", erro: true });
    await vi.advanceTimersByTimeAsync(3300);
    expect(s.recebidos.length).toBe(1);
    expect(z.status.erro).toBe(false);
  });

  it("recebe alterações de outro usuário sem perder as locais", async () => {
    const s = servidor({ people: [{ id: 1, name: "A", role: "" }], boats: [], courses: [], hist: [], resolved: [], log: [] });
    const z = new Sincronizador(s.t, amb);
    z.iniciar(await s.t.obterEstado());
    s.alterarPorOutro((d) => d.people.push({ id: 2, name: "Do colega", role: "" }));
    await z.verificar();
    expect(z.S.people.map((p) => p.id)).toEqual([1, 2]);

    // alteração local feita enquanto o envio está em andamento é reaplicada
    z.mutar((S) => (S.people[0].name = "A1"));
    await vi.advanceTimersByTimeAsync(260);
    z.mutar((S) => (S.people[0].role = "Técnica"));
    await vi.advanceTimersByTimeAsync(600);
    const final = (await s.t.obterEstado()).dados as Estado;
    expect(final.people[0]).toEqual({ id: 1, name: "A1", role: "Técnica" });
    expect(z.S).toEqual(final);
  });

  it("não busca dados com diálogo aberto ou aba oculta", async () => {
    const s = servidor({ people: [], boats: [], courses: [], hist: [], resolved: [], log: [] });
    let aberto = true;
    const z = new Sincronizador(s.t, { dialogoAberto: () => aberto, oculto: () => false });
    z.iniciar(await s.t.obterEstado());
    s.alterarPorOutro((d) => d.boats.push({ id: 9, name: "X" }));
    await z.verificar();
    expect(z.S.boats).toEqual([]);
    aberto = false;
    await z.verificar();
    expect(z.S.boats).toEqual([{ id: 9, name: "X" }]);
  });
});
