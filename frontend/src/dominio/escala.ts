/**
 * Escala de embarque com translado (setor Ambiental).
 *
 * Um ciclo tem quatro etapas:
 *   translado de ida → a bordo → translado de volta → folga
 * - Translado de ida: `ti` dias antes do embarque (padrão 1: o dia anterior). Dia trabalhado, sem folga.
 * - A bordo: `dias` + `dobra` dias, a partir do embarque (o dia do embarque é o dia 1).
 * - Translado de volta: `tv` dias depois do último dia a bordo (padrão 0: volta no próprio último dia).
 * - Folga: tantos dias quanto os dias a bordo, a partir do dia seguinte ao translado de volta.
 *   O translado não gera folga.
 * O próximo ciclo começa no dia seguinte ao fim da folga (translado de ida) e o embarque é no dia
 * seguinte. Com o padrão, o ciclo 42x42 dura 1 + 42 + 42 = 85 dias.
 * Dados antigos, sem `ti`/`tv`, usam o padrão.
 */
import type { Barco, Embarque, Estado, Pessoa } from "./tipos";

/** Dias de translado de ida antes do embarque (padrão). */
export const TI_PADRAO = 1;
/** Dias de translado de volta depois do último dia a bordo (padrão: volta no último dia a bordo). */
export const TV_PADRAO = 0;

export const diasIda = (x: { ti?: number | null }): number => (x.ti != null && x.ti >= 0 ? x.ti : TI_PADRAO);
export const diasVolta = (x: { ti?: number | null; tv?: number | null }): number => (x.tv != null && x.tv >= 0 ? x.tv : TV_PADRAO);

/** Confere os dias de translado (a partir das datas informadas); null se estiver tudo certo. */
export function erroTranslado(ti: number, tv: number): string | null {
  if (!Number.isFinite(ti) || ti < 0) return "O translado de ida não pode ser depois da data de embarque.";
  if (ti > 10) return "O translado de ida está mais de 10 dias antes do embarque. Confira a data.";
  if (!Number.isFinite(tv) || tv < 0) return "O translado de volta não pode ser antes do último dia a bordo.";
  if (tv > 10) return "O translado de volta está mais de 10 dias depois do último dia a bordo. Confira a data.";
  return null;
}

/** Datas de um ciclo (números de dia). */
export interface Etapas {
  /** 1º dia do translado de ida (= ini quando não há translado). */
  ida: number;
  /** Embarque (1º dia a bordo). */
  ini: number;
  /** Dias a bordo (com dobra). */
  A: number;
  ultimoBordo: number;
  /** Último dia trabalhado: último dia a bordo ou do translado de volta. */
  volta: number;
  folgaIni: number;
  folgaFim: number;
  /** Embarque seguinte pela escala padrão (translado de ida no dia seguinte ao fim da folga). */
  proximo: number;
}

export function etapas(ini: number, A: number, ti: number = TI_PADRAO, tv: number = TV_PADRAO): Etapas {
  const ultimoBordo = ini + A - 1,
    volta = ultimoBordo + tv,
    folgaFim = volta + A;
  return { ida: ini - ti, ini, A, ultimoBordo, volta, folgaIni: volta + 1, folgaFim, proximo: folgaFim + 1 + TI_PADRAO };
}

export interface Ciclo {
  /** future: antes do translado de ida; transit: em translado; aboard: a bordo; rest: de folga. */
  st: "future" | "transit" | "aboard" | "rest";
  /** No translado: de ida (antes do embarque) ou de volta (depois do último dia a bordo). */
  sentido?: "ida" | "volta";
  /** Dia dentro da etapa (a bordo: dia 1 = embarque; folga: dia 1 = 1º dia de folga). */
  day: number;
  /** Dias a bordo deste ciclo (com dobra). */
  L: number;
  /** Embarque deste ciclo. */
  start: number;
  first: boolean;
  dobra: number;
  /** Próximo embarque (no futuro e no translado de ida: o embarque deste ciclo). */
  next: number;
  days: number;
  /** Último dia a bordo do embarque atual ou do próximo (avisos de cursos). */
  end: number;
  /** Posição no ciclo, a partir do translado de ida, e tamanho do ciclo (barra da Equipe hoje). */
  pos: number;
  tot: number;
  /** Dias de translado de volta deste ciclo. */
  tv: number;
  /** Datas do ciclo. */
  e: Etapas;
}

/** Situação do ciclo de quem tem escala (p.embark definido). */
export function cycle(p: Pessoa, T: number): Ciclo {
  const dob = p.dobra || 0,
    base = p.base || 42,
    A = (p.dias ?? 0) + dob;
  let e = etapas(p.embark as number, A, diasIda(p), diasVolta(p)),
    first = true;
  if (T > e.folgaFim) {
    // ciclos seguintes pela escala padrão: cada um com 2 × base + translado de ida
    const passo = 2 * base + TI_PADRAO,
      k = Math.floor((T - (e.folgaFim + 1)) / passo);
    e = etapas(e.proximo + k * passo, base);
    first = false;
  }
  const seguinte = etapas(e.proximo, base);
  const o = { L: e.A, start: e.ini, first, dobra: first ? dob : 0, pos: Math.max(0, T - e.ida), tot: e.folgaFim - e.ida + 1, tv: e.volta - e.ultimoBordo, e };
  if (T < e.ida) return { ...o, st: "future", day: 0, next: e.ini, days: e.ini - T, end: e.ultimoBordo };
  if (T < e.ini) return { ...o, st: "transit", sentido: "ida", day: T - e.ida + 1, next: e.ini, days: e.ini - T, end: e.ultimoBordo };
  const prox = { next: seguinte.ini, days: seguinte.ini - T };
  if (T <= e.ultimoBordo) return { ...o, ...prox, st: "aboard", day: T - e.ini + 1, end: e.ultimoBordo };
  if (T <= e.volta) return { ...o, ...prox, st: "transit", sentido: "volta", day: T - e.ultimoBordo, end: seguinte.ultimoBordo };
  return { ...o, ...prox, st: "rest", day: T - e.volta, end: seguinte.ultimoBordo };
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
  | { k: "translado"; c: Ciclo; sentido: "ida" | "volta"; embarque: number }
  | { k: "folga"; c: Ciclo; proximo: number };

/** Situação do colaborador hoje (férias têm prioridade sobre a escala). */
export function situacao(S: Pick<Estado, "boats">, p: Pessoa, T: number): Situacao {
  if (emFerias(p, T)) return { k: "ferias", sub: "", fim: p.fFim as number };
  if (p.embark == null) return { k: "none", sub: "" };
  const c = cycle(p, T);
  if (c.st === "aboard") return { k: "emb", c, barco: nomeBarco(S, p.boat), fim: c.end };
  if (c.st === "transit") return { k: "translado", c, sentido: c.sentido as "ida" | "volta", embarque: c.next };
  return { k: "folga", c, proximo: c.next };
}

/** Prévia do registro de embarque: `ti` dias de translado de ida e `tv` de volta. */
export function previaRegistro(d: number, n: number, ti: number = TI_PADRAO, tv: number = TV_PADRAO) {
  const e = etapas(d, n, ti, tv);
  return {
    folga: n,
    translado: ti + tv,
    trabalhados: n + ti + tv,
    ida: e.ida,
    inicio: d,
    ultimoBordo: e.ultimoBordo,
    volta: e.volta,
    inicioFolga: e.folgaIni,
    ultimoFolga: e.folgaFim,
    proximaIda: e.folgaFim + 1,
    proximo: e.proximo,
  };
}

/** Prévia da dobra para quem está embarcado (o translado de volta acompanha o último dia a bordo). */
export function previaDobra(c: Ciclo, n: number) {
  const L2 = c.L + n,
    e = etapas(c.start, L2, c.e.ini - c.e.ida, c.tv);
  return { L: c.L, L2, ultimoBordo: e.ultimoBordo, ultimoFolga: e.folgaFim, proximo: e.proximo };
}

/** Registra um embarque (muda o estado recebido). `ti`/`tv`: dias de translado de ida e de volta. */
export function registrarEmbarque(S: Estado, pid: number, embark: number, dias: number, boat: number | null, ti: number = TI_PADRAO, tv: number = TV_PADRAO): Pessoa | undefined {
  const p = pessoa(S, pid);
  if (!p) return undefined;
  p.embark = embark;
  p.dias = dias;
  p.dobra = 0;
  p.boat = boat;
  p.ti = ti;
  p.tv = tv;
  S.hist = (S.hist || []).filter((h) => !(h.pid === p.id && h.ini === p.embark)).concat([{ pid: p.id, ini: embark, dias, dobra: 0, boat, ti, tv }]);
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
    // embarque previsto pela escala padrão vira o embarque registrado
    p.embark = c.start;
    p.dias = c.L;
    p.dobra = n;
    p.ti = TI_PADRAO;
    p.tv = TV_PADRAO;
  }
  S.hist = S.hist || [];
  const hh = S.hist.find((x) => x.pid === p.id && x.ini === p.embark);
  if (hh) hh.dobra = p.dobra;
  else S.hist.push({ pid: p.id, ini: p.embark as number, dias: p.dias as number, dobra: p.dobra, boat: p.boat, ti: diasIda(p), tv: diasVolta(p) });
  return p;
}

export interface Periodo {
  ini: number;
  dias: number;
  dobra: number;
  boat: number | null | undefined;
  src: "Registrado" | "Previsto";
  /** Dias de translado de ida e de volta. */
  ti: number;
  tv: number;
}

/** Datas de um período do histórico. */
export const etapasPeriodo = (x: Periodo): Etapas => etapas(x.ini, x.dias + x.dobra, x.ti, x.tv);

/** Embarques registrados seguidos dos previstos pela escala padrão, até a data `ate`. */
export function periodos(p: Pessoa, hist: Embarque[] | undefined, ate: number): Periodo[] {
  const out: Periodo[] = (hist || [])
    .filter((h) => h.pid == p.id)
    .sort((a, b) => a.ini - b.ini)
    .map((h) => ({ ini: h.ini, dias: h.dias, dobra: h.dobra || 0, boat: h.boat !== undefined ? h.boat : p.boat, src: "Registrado" as const, ti: diasIda(h), tv: diasVolta(h) }));
  const base = p.base || 42;
  let next: number;
  if (out.length) {
    next = etapasPeriodo(out[out.length - 1]).proximo;
  } else if (p.embark != null) {
    const x: Periodo = { ini: p.embark, dias: p.dias as number, dobra: p.dobra || 0, boat: p.boat, src: "Previsto", ti: diasIda(p), tv: diasVolta(p) };
    out.push(x);
    next = etapasPeriodo(x).proximo;
  } else return out;
  while (next - TI_PADRAO <= ate) {
    out.push({ ini: next, dias: base, dobra: 0, boat: p.boat, src: "Previsto", ti: TI_PADRAO, tv: TV_PADRAO });
    next = etapas(next, base).proximo;
  }
  return out;
}

export type DiaSituacao = "Translado" | "A bordo" | "Dobra" | "Folga";

export interface Calculo {
  p: Pessoa;
  per: Periodo[];
  de: number;
  ate: number;
  dias: [number, DiaSituacao, Periodo["src"]][];
  /** Dias a bordo (com dobra). */
  ab: number;
  dob: number;
  /** Dias de translado (trabalhados, sem folga). */
  tr: number;
  fo: number;
}

/** Dias de translado, a bordo, de dobra e de folga no intervalo (histórico e exportação). */
export function calc(p: Pessoa, hist: Embarque[] | undefined, de0: number | null, ate: number): Calculo {
  const per = periodos(p, hist, ate),
    de = de0 == null ? (per.length ? etapasPeriodo(per[0]).ida : ate) : de0,
    m = new Map<number, { s: DiaSituacao; src: Periodo["src"] }>();
  per.forEach((x) => {
    const e = etapasPeriodo(x);
    for (let d = e.ida; d < e.ini; d++) m.set(d, { s: "Translado", src: x.src });
    for (let d = e.ini; d <= e.ultimoBordo; d++) m.set(d, { s: d >= x.ini + x.dias ? "Dobra" : "A bordo", src: x.src });
    for (let d = e.ultimoBordo + 1; d <= e.volta; d++) m.set(d, { s: "Translado", src: x.src });
    for (let d = e.folgaIni; d <= e.folgaFim; d++) m.set(d, { s: "Folga", src: x.src });
  });
  const dias: Calculo["dias"] = [];
  let ab = 0,
    dob = 0,
    tr = 0,
    fo = 0;
  for (let d = de; d <= ate; d++) {
    const v = m.get(d);
    if (!v) continue;
    dias.push([d, v.s, v.src]);
    if (v.s === "Folga") fo++;
    else if (v.s === "Translado") tr++;
    else {
      ab++;
      if (v.s === "Dobra") dob++;
    }
  }
  return { p, per, de, ate, dias, ab, dob, tr, fo };
}

/** Linhas do histórico: todos (id "all") ou um colaborador com escala. */
export function dadosHistorico(S: Estado, id: string, de: number | null, ate: number): Calculo[] {
  return S.people.filter((p) => p.embark != null && (id === "all" || p.id == (id as unknown as number))).map((p) => calc(p, S.hist, de, ate));
}

/** Situação de um embarque na ficha do colaborador. */
export function situacaoPeriodo(x: Periodo, T: number): "Previsto" | "Translado" | "Embarcado" | "Folga" | "Concluído" {
  const e = etapasPeriodo(x);
  return T < e.ida ? "Previsto" : T < e.ini ? "Translado" : T <= e.ultimoBordo ? "Embarcado" : T <= e.volta ? "Translado" : T <= e.folgaFim ? "Folga" : "Concluído";
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
