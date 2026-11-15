import { describe, expect, it } from "vitest";
import { aplicarPatch, clone, diffEstado } from "../patch";
import { protoDiff } from "./prototipo";

const A = {
  people: [
    { id: 1, name: "Ana" },
    { id: 2, name: "Bruno" },
  ],
  boats: [{ id: 1, name: "Netuno" }],
  courses: [{ pid: 1, name: "CBSP", valid: 10 }],
  hist: [{ pid: 1, ini: 5, dias: 42 }],
  resolved: ["a"],
  log: [],
};

describe("diffEstado / aplicarPatch", () => {
  it("gera operações por registro, com as chaves do protótipo", () => {
    const B = clone(A);
    B.people[0].name = "Ana Maria";
    B.people.splice(1, 1);
    B.courses.push({ pid: 2, name: "ASO", valid: 20 });
    B.resolved.push("b");
    B.hist[0].dias = 30;
    const ops = diffEstado(A, B);
    expect(ops).toEqual(
      expect.arrayContaining([
        { c: "people", k: "1", v: { id: 1, name: "Ana Maria" } },
        { c: "people", k: "2", v: null },
        { c: "courses", k: "2|ASO", v: { pid: 2, name: "ASO", valid: 20 } },
        { c: "resolved", k: "b", v: "b" },
        { c: "hist", k: "1|5", v: { pid: 1, ini: 5, dias: 30 } },
      ]),
    );
    expect(ops.length).toBe(5);
    expect(ops).toEqual(protoDiff(A, B));
  });
  it("coleções sem chave são trocadas inteiras (w:1)", () => {
    expect(diffEstado({ log: [] }, { log: [1] })).toEqual([{ c: "log", w: 1, v: [1] }]);
    expect(diffEstado({}, { people: [], log: [] })).toEqual([{ c: "log", w: 1, v: [] }]);
    expect(diffEstado({ x: 1 }, {})).toEqual([{ c: "x", w: 1, v: null }]);
  });
  it("aplicar o diff transforma A em B", () => {
    const B = clone(A);
    B.people.push({ id: 3, name: "Carla" });
    B.boats = [];
    B.resolved = [];
    B.log = [{ x: 1 }] as never[];
    const r = aplicarPatch(clone(A), diffEstado(A, B));
    expect(r).toEqual(B);
  });
  it("sem mudanças, sem operações", () => {
    expect(diffEstado(A, clone(A))).toEqual([]);
    expect(diffEstado(null, null)).toEqual([]);
  });
});
