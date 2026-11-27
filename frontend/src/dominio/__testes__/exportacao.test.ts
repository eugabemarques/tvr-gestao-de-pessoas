import { describe, expect, it } from "vitest";
import { toDay } from "../datas";
import { calc } from "../escala";
import { COLUNAS_HISTORICO_PDF, pdfHistorico } from "../exportacao";
import type { Pessoa } from "../tipos";

const T = toDay("2026-11-13");

describe("PDF do histórico de embarques", () => {
  it("um bloco por colaborador, com nome, setor, totais e uma linha por embarque", () => {
    const p: Pessoa = { id: 1, name: "Ana Fictícia", role: "Técnica", setor: "ambiental", embark: T - 20, dias: 10, dobra: 2, boat: 7 };
    const [b] = pdfHistorico({ boats: [{ id: 7, name: "Barco Teste" }] }, [calc(p, [], null, T)]);
    expect(b.nome).toBe("Ana Fictícia");
    expect(b.sub).toBe("Ambiental · Técnica");
    expect(b.intervalo).toBe("23/10/2026 a 13/11/2026");
    expect(b.resumo).toEqual([
      ["Dias a bordo", "12"],
      ["Dobra", "2"],
      ["Translado", "1"],
      ["Trabalhados", "13"],
      ["Folga", "9"],
    ]);
    expect(b.linhas[0]).toEqual(["Barco Teste", "23/10/2026", "24/10/2026 a 04/11/2026", "12", "2", "04/11/2026", "05/11/2026 a 16/11/2026", "Pela escala"]);
    expect(b.linhas[0]).toHaveLength(COLUNAS_HISTORICO_PDF.length);
  });
  it("sem barco e sem dobra mostra traço; embarque registrado aparece como Registrado", () => {
    const p: Pessoa = { id: 2, name: "Bruno Fictício", role: "", embark: T - 20, dias: 10 };
    const [b] = pdfHistorico({ boats: [] }, [calc(p, [{ pid: 2, ini: T - 20, dias: 10 }], null, T)]);
    expect(b.sub).toBe("");
    expect(b.linhas[0][0]).toBe("—");
    expect(b.linhas[0][4]).toBe("—");
    expect(b.linhas[0][7]).toBe("Registrado");
  });
});
