import { describe, expect, it } from "vitest";
import { botoesPagina, paginar } from "../paginacao";

const L = Array.from({ length: 23 }, (_, i) => i + 1);

describe("paginação", () => {
  it("mostra 10 por página", () => {
    expect(paginar(L, 1, 10)).toMatchObject({ itens: L.slice(0, 10), pagina: 1, paginas: 3, de: 1, ate: 10, total: 23 });
    expect(paginar(L, 3, 10)).toMatchObject({ itens: [21, 22, 23], de: 21, ate: 23 });
  });
  it("página fora do intervalo vai para a primeira ou a última (ex.: a busca diminuiu a lista)", () => {
    expect(paginar(L, 9, 10).pagina).toBe(3);
    expect(paginar(L, 0, 10).pagina).toBe(1);
    expect(paginar([], 2, 10)).toMatchObject({ itens: [], pagina: 1, paginas: 1, de: 0, ate: 0, total: 0 });
  });
  it("botões: todos quando são poucos; senão primeira, última e vizinhas", () => {
    expect(botoesPagina(1, 3)).toEqual([1, 2, 3]);
    expect(botoesPagina(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(botoesPagina(1, 10)).toEqual([1, 2, null, 10]);
    expect(botoesPagina(10, 10)).toEqual([1, null, 9, 10]);
  });
});
