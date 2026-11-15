/** Escala de embarque (42x42), ciclos, férias, histórico e dobra — fórmulas do protótipo. */
import type { Barco, Embarque, Estado, Pessoa } from "./tipos";

export type Ciclo =
  | { st: "future"; next: number; end: number; days: number; pos: number; L: number; start: number; first: true; dobra: number }
  | {
      st: "aboard" | "rest";
      pos: number;
      L: number;
      start: number;
      first: boolean;
      dobra: number;
      next: number;
      days: number;
      day: number;
      end: number;
    };

/** Situação do ciclo de quem tem escala (p.embark definido). */
export function cycle(p: Pessoa, T: number): Ciclo {
  const embark = p.embark as number;
  const dob = p.dobra || 0,
    base = p.base || 42,
    A = (p.dias ?? 0) + dob;
  if (T < embark) return { st: "future", next: embark, end: embark + A - 1, days: embark - T, pos: 0, L: A, start: embark, first: true, dobra: dob };
  const off = T - embark,
    first = off < 2 * A;
  const L = first ? A : base,
    pos = first ? off : (off - 2 * A) % (2 * base),
    start = T - pos;
  const o = { pos, L, start, first, dobra: first ? dob : 0, next: start + 2 * L, days: start + 2 * L - T };
  if (pos < L) return { ...o, st: "aboard", day: pos + 1, end: start + L - 1 };
  return { ...o, st: "rest", day: pos - L + 1, end: start + 2 * L + base - 1 };
}

export const emFerias = (p: Pessoa, T: number): boolean => p.fIni != null && p.fFim != null && T >= p.fIni && T <= p.fFim;

export const temEscala = (p: Pessoa): boolean => p.embark != null;

export const barco = (S: Pick<Estado, "boats">, id: number | null | undefined): Barco | null =>
  id == null ? null : (S.boats || []).find((b) => b.id == id) || null;

export const nomeBarco = (S: Pick<Estado, "boats">, id: number | null | undefined): string => barco(S, id)?.name || "";

export const pessoa = (S: Pick<Estado, "people">, id: number | string | null | undefined): Pessoa | undefined =>
  id == null || id === "" ? undefined : S.people.find((p) => p.id == id);

export type Situacao =
  | { k: "ferias"; sub: string; fim: number }
  | { k: "none"; sub: "" }
  | { k: "emb"; c: Ciclo; barco: string; fim: number }
  | { k: "folga"; c: Ciclo; proximo: number };

/** Equivalente ao `status()` do protótipo (sem o HTML). */
export function situacao(S: Pick<Estado, "boats">, p: Pessoa, T: number): Situacao {
  if (emFerias(p, T)) return { k: "ferias", sub: "", fim: p.fFim as number };
  if (p.embark == null) return { k: "none", sub: "" };
  const c = cycle(p, T);
  if (c.st === "aboard") return { k: "emb", c, barco: nomeBarco(S, p.boat), fim: c.end };
  return { k: "folga", c, proximo: c.next };
}

/** Prévia do registro de embarque (painel "Registrar embarque"). */
export function previaRegistro(d: number, n: number) {
  return { folga: n, inicio: d, inicioFolga: d + n, proximo: d + 2 * n, ultimoBordo: d + n - 1, ultimoFolga: d + 2 * n - 1 };
}

/** Prévia da dobra para quem está embarcado. */
export function previaDobra(c: Ciclo, n: number) {
  const L2 = c.L + n;
  return { L: c.L, L2, ultimoBordo: c.start + L2 - 1, ultimoFolga: c.start + 2 * L2 - 1, proximo: c.start + 2 * L2 };
}

/** Registra um embarque (muda o estado recebido). */
export function registrarEmbarque(S: Estado, pid: number, embark: number, dias: number, boat: number | null): Pessoa | undefined {
  const p = pessoa(S, pid);
  if (!p) return undefined;
  p.embark = embark;
  p.dias = dias;
  p.dobra = 0;
  p.boat = boat;
  S.hist = (S.hist || []).filter((h) => !(h.pid === p.id && h.ini === p.embark)).concat([{ pid: p.id, ini: embark, dias, dobra: 0, boat }]);
  return p;
}

/** Adiciona dias de dobra ao embarque atual (muda o estado recebido). */
export function adicionarDobra(S: Estado, pid: number, n: number, T: number): Pessoa | undefined {
  const p = pessoa(S, pid);
  if (!p || p.embark == null) return undefined;
  const c = cycle(p, T);
  if (c.first) {
    p.dobra = (p.dobra || 0) + n;
  } else {
    p.embark = c.start;
    p.dias = c.L;
    p.dobra = n;
  }
  S.hist = S.hist || [];
  const hh = S.hist.find((x) => x.pid === p.id && x.ini === p.embark);
  if (hh) hh.dobra = p.dobra;
  else S.hist.push({ pid: p.id, ini: p.embark as number, dias: p.dias as number, dobra: p.dobra, boat: p.boat });
  return p;
}

export interface Periodo {
  ini: number;
  dias: number;
  dobra: number;
  boat: number | null | undefined;
  src: "Registrado" | "Previsto";
}

/** Embarques registrados seguidos dos previstos pela escala padrão, até a data `ate`. */
export function periodos(p: Pessoa, hist: Embarque[] | undefined, ate: number): Periodo[] {
  const out: Periodo[] = (hist || [])
    .filter((h) => h.pid == p.id)
    .sort((a, b) => a.ini - b.ini)
    .map((h) => ({ ini: h.ini, dias: h.dias, dobra: h.dobra || 0, boat: h.boat !== undefined ? h.boat : p.boat, src: "Registrado" as const }));
  const base = p.base || 42;
  let next: number;
  if (out.length) {
    const l = out[out.length - 1];
    next = l.ini + 2 * (l.dias + l.dobra);
  } else if (p.embark != null) {
    out.push({ ini: p.embark, dias: p.dias as number, dobra: p.dobra || 0, boat: p.boat, src: "Previsto" });
    next = p.embark + 2 * ((p.dias as number) + (p.dobra || 0));
  } else return out;
  while (next <= ate) {
    out.push({ ini: next, dias: base, dobra: 0, boat: p.boat, src: "Previsto" });
    next += 2 * base;
  }
  return out;
}

export type DiaSituacao = "A bordo" | "Dobra" | "Folga";

export interface Calculo {
  p: Pessoa;
  per: Periodo[];
  de: number;
  ate: number;
  dias: [number, DiaSituacao, Periodo["src"]][];
  ab: number;
  dob: number;
  fo: number;
}

/** Dias a bordo, de dobra e de folga no intervalo (histórico e exportação). */
export function calc(p: Pessoa, hist: Embarque[] | undefined, de0: number | null, ate: number): Calculo {
  const per = periodos(p, hist, ate),
    de = de0 == null ? (per.length ? per[0].ini : ate) : de0,
    m = new Map<number, { s: DiaSituacao; src: Periodo["src"] }>();
  per.forEach((x) => {
    const t = x.dias + x.dobra;
    for (let d = x.ini; d < x.ini + t; d++) m.set(d, { s: d >= x.ini + x.dias ? "Dobra" : "A bordo", src: x.src });
    for (let d = x.ini + t; d < x.ini + 2 * t; d++) m.set(d, { s: "Folga", src: x.src });
  });
  const dias: Calculo["dias"] = [];
  let ab = 0,
    dob = 0,
    fo = 0;
  for (let d = de; d <= ate; d++) {
    const v = m.get(d);
    if (!v) continue;
    dias.push([d, v.s, v.src]);
    if (v.s === "Folga") fo++;
    else {
      ab++;
      if (v.s === "Dobra") dob++;
    }
  }
  return { p, per, de, ate, dias, ab, dob, fo };
}

/** Linhas do histórico: todos (id "all") ou um colaborador com escala. */
export function dadosHistorico(S: Estado, id: string, de: number | null, ate: number): Calculo[] {
  return S.people.filter((p) => p.embark != null && (id === "all" || p.id == (id as unknown as number))).map((p) => calc(p, S.hist, de, ate));
}

/** Situação de um embarque na ficha do colaborador. */
export function situacaoPeriodo(x: Periodo, T: number): "Previsto" | "Embarcado" | "Folga" | "Concluído" {
  const t = x.dias + x.dobra,
    fb = x.ini + t - 1,
    ff = x.ini + 2 * t - 1;
  return T < x.ini ? "Previsto" : T <= fb ? "Embarcado" : T <= ff ? "Folga" : "Concluído";
}

/** Converte o formato antigo (barco em texto em `unit`) para a lista de barcos, como o protótipo. */
export function normalizar(S: Estado): Estado {
  if (!S.boats) {
    S.boats = [];
    const m: Record<string, number> = {};
    S.people.forEach((p) => {
      if (p.embark != null && p.unit) {
        if (!(p.unit in m)) {
          m[p.unit] = S.boats.length + 1;
          S.boats.push({ id: m[p.unit], name: p.unit, tipo: "", obs: "" });
        }
        if (p.boat == null) p.boat = m[p.unit];
      }
    });
  }
  return S;
}

/** Novo id: maior id + 1, ou o relógio (modo servidor, evita colisão entre usuários). */
export function novoId(a: { id: number }[], agora: number = Date.now()): number {
  const m = Math.max(0, ...a.map((x) => +x.id || 0)) + 1;
  return Math.max(m, agora);
}
