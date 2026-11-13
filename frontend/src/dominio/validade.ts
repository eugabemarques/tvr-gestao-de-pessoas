/** Validade de cursos e ASO: faixas, gráficos e avisos de embarque. */
import { cycle, emFerias, type Ciclo } from "./escala";
import type { Curso, Estado, Pessoa } from "./tipos";

export type Faixa = "bad" | "warn" | "ok";
export interface EstadoCurso {
  k: Faixa;
  t: string;
}
export interface EstadoAso extends EstadoCurso {
  g: "bad" | "w60" | "w90" | "ok";
}

export const isAso = (c: { name: string }): boolean => /^ASO/i.test(c.name);

/** Cursos: vencido, vence em até 90 dias, em dia. */
export function courseState(c: { valid: number }, T: number): EstadoCurso {
  const d = c.valid - T;
  if (d < 0) return { k: "bad", t: "Vencido há " + -d + " dias" };
  if (d <= 90) return { k: "warn", t: "Vence em " + d + " dias" };
  return { k: "ok", t: "Em dia" };
}

/** ASO: vencido, até 60 dias, 61 a 90 dias, em dia. */
export function stAso(c: { valid: number }, T: number): EstadoAso {
  const d = c.valid - T;
  return d < 0
    ? { k: "bad", g: "bad", t: "Vencido há " + -d + " dias" }
    : d <= 60
      ? { k: "warn", g: "w60", t: "Vence em " + d + " dias" }
      : d <= 90
        ? { k: "warn", g: "w90", t: "Vence em " + d + " dias" }
        : { k: "ok", g: "ok", t: "Em dia" };
}

export const estadoQualquer = (c: Curso, T: number): EstadoCurso => (isAso(c) ? stAso(c, T) : courseState(c, T));

export function gruposCursos(courses: Curso[], T: number): Record<Faixa, Curso[]> {
  const g: Record<Faixa, Curso[]> = { bad: [], warn: [], ok: [] };
  courses.filter((c) => !isAso(c)).forEach((c) => g[courseState(c, T).k].push(c));
  return g;
}

export function gruposAso(courses: Curso[], T: number): Record<EstadoAso["g"], Curso[]> {
  const g: Record<EstadoAso["g"], Curso[]> = { bad: [], w60: [], w90: [], ok: [] };
  courses.filter(isAso).forEach((c) => g[stAso(c, T).g].push(c));
  return g;
}

/** Altura da barra do gráfico em px (mínimo 6, máximo 120). */
export const alturaBarra = (n: number, max: number): number => Math.max(6, (n / max) * 120);

export interface Aviso {
  key: string;
  res: boolean;
  bad: boolean;
  pessoa: Pessoa;
  curso: string;
  /** "já está vencido" ou "vence em dd/mm/aaaa" (a data vem em `valid`). */
  vencido: boolean;
  valid: number;
  fim: number;
}

/**
 * Avisos do sino: quem está embarcado ou embarca em até 30 dias, com curso/ASO
 * que vence até o último dia a bordo. Crítico se já venceu ou vence antes de embarcar.
 */
export function avisos(S: Estado, T: number): Aviso[] {
  const al: Aviso[] = [];
  S.people
    .filter((p) => p.embark != null)
    .forEach((p) => {
      const c = cycle(p, T);
      if (c.st !== "aboard" && c.days > 30) return;
      S.courses
        .filter((k) => k.pid == p.id && k.valid <= c.end)
        .forEach((k) => {
          const before = k.valid < c.next && c.st !== "aboard";
          const key = p.id + "|" + k.name + "|" + k.valid;
          al.push({ key, res: (S.resolved || []).includes(key), bad: k.valid < T || before, pessoa: p, curso: k.name, vencido: k.valid < T, valid: k.valid, fim: c.end });
        });
    });
  return al.sort((a, b) => +b.bad - +a.bad);
}

export type ChavePainel = "emb" | "folga" | "equipe" | "cv" | "c60" | "c90" | "av" | "aa";
export interface ItemPessoa {
  p: Pessoa;
  c: Ciclo;
}

/** Grupos dos cartões do painel. */
export function gruposPainel(S: Estado, T: number) {
  const cy: ItemPessoa[] = S.people.filter((p) => p.embark != null).map((p) => ({ p, c: cycle(p, T) }));
  const ab = cy.filter((x) => x.c.st === "aboard" && !emFerias(x.p, T)),
    rs = cy.filter((x) => x.c.st !== "aboard" && !emFerias(x.p, T));
  const dd = (c: Curso) => c.valid - T;
  const C = S.courses.filter((c) => !isAso(c)),
    A = S.courses.filter(isAso);
  const pessoas: Record<"emb" | "folga" | "equipe", [string, ItemPessoa[]]> = {
    emb: ["Embarcados hoje", ab],
    folga: ["De folga hoje", rs],
    equipe: ["Equipe embarcada", ab],
  };
  const cursos: Record<"cv" | "c60" | "c90" | "av" | "aa", [string, Curso[]]> = {
    cv: ["Cursos vencidos", C.filter((c) => dd(c) < 0)],
    c60: ["Cursos que vencem em até 60 dias", C.filter((c) => dd(c) >= 0 && dd(c) <= 60)],
    c90: ["Cursos que vencem entre 61 e 90 dias", C.filter((c) => dd(c) > 60 && dd(c) <= 90)],
    av: ["ASOs vencidos", A.filter((c) => dd(c) < 0)],
    aa: ["ASOs a vencer (até 60 dias)", A.filter((c) => dd(c) >= 0 && dd(c) <= 60)],
  };
  return { cy, pessoas, cursos };
}
