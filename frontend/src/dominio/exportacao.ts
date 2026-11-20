/** Conteúdo das exportações (histórico em Excel e PDF, ficha do colaborador em PDF), sem depender das bibliotecas. */
import { fmt } from "./datas";
import { campos, docFor, docsDo, nomeSetor, opcDoc, setor, VACS } from "./documentos";
import { etapasPeriodo, nomeBarco, type Calculo } from "./escala";
import { unesc } from "./texto";
import type { Estado, Pessoa } from "./tipos";
import { estadoQualquer, isExame } from "./validade";

/* ---------------- ficha do colaborador (PDF) ---------------- */

export interface SecaoFichaPdf {
  titulo: string;
  /** [rótulo, valor]; rótulo vazio = linha de aviso ("Nenhum curso cadastrado"). */
  linhas: [string, string][];
}

/**
 * Conteúdo da ficha em PDF: os mesmos dados da pasta, mais cursos/ASO e vacinas.
 * `paginasAnexos` (no dossiê): página onde começa cada documento de `p.docs`, na mesma ordem.
 */
export function fichaPdf(S: Pick<Estado, "boats" | "courses">, p: Pessoa, T: number, paginasAnexos?: number[]): { nome: string; sub: string; secoes: SecaoFichaPdf[] } {
  const dados: [string, string][] = campos(S, p).map(([k, v]) => [k, unesc(v || "") || "—"]);
  const cursos: [string, string][] = S.courses
    .filter((c) => c.pid == p.id)
    .sort((a, b) => +isExame(b) - +isExame(a) || a.valid - b.valid)
    .map((c) => [c.name, "Validade " + fmt(c.valid) + " (" + estadoQualquer(c, T).t.toLowerCase() + ")" + (c.exame != null ? " · exame em " + fmt(c.exame) : "")]);
  const vac: [string, string][] = VACS.map(([k, n]) => {
    const d = p.vac?.[k];
    return [n, d != null ? fmt(d) : "—"];
  });
  const obrig: [string, string][] = setor(p.setor)
    ? docsDo(p.setor).map((n) => [n, docFor(p.docs, n) ? "Anexado" : opcDoc(n) ? "Opcional" : "Pendente"])
    : [["", "Setor não definido."]];
  const anexos: [string, string][] = (p.docs || []).map((d, i) => [d.campo || "Outros", d.name + (paginasAnexos ? "  ·  página " + paginasAnexos[i] : "")]);
  return {
    nome: unesc(p.name),
    sub: [nomeSetor(p.setor), unesc(p.role || "")].filter(Boolean).join(" · "),
    secoes: [
      { titulo: "Dados pessoais", linhas: dados },
      { titulo: "Cursos e exames", linhas: cursos.length ? cursos : [["", "Nenhum curso cadastrado."]] },
      { titulo: "Vacinas", linhas: vac },
      { titulo: "Documentos obrigatórios do setor", linhas: obrig },
      { titulo: paginasAnexos ? "Documentos anexados (a seguir, neste dossiê)" : "Documentos anexados", linhas: anexos.length ? anexos : [["", "Nenhum documento anexado."]] },
    ],
  };
}

export type Celula = string | number;

/** Abas da planilha: [nome da aba, linhas]. */
export function planilhaHistorico(S: Pick<Estado, "boats">, R: Calculo[]): [string, Celula[][]][] {
  const resumo: Celula[][] = (
    [["Colaborador", "Setor", "De", "Até", "Dias a bordo", "Dias de dobra (incluídos)", "Dias de translado", "Dias trabalhados (a bordo + translado)", "Dias de folga"]] as Celula[][]
  ).concat(R.map((r) => [unesc(r.p.name), nomeSetor(r.p.setor), fmt(r.de), fmt(r.ate), r.ab, r.dob, r.tr, r.ab + r.tr, r.fo]));
  const pers: Celula[][] = [
    ["Colaborador", "Barco", "Translado de ida", "Início do embarque", "Último dia a bordo", "Translado de volta", "Dias a bordo", "Dobra", "Início da folga", "Último dia de folga", "Origem"],
  ];
  const dias: Celula[][] = [["Colaborador", "Data", "Situação", "Origem"]];
  R.forEach((r) => {
    const n = unesc(r.p.name);
    r.per.forEach((x) => {
      const e = etapasPeriodo(x);
      pers.push([n, unesc(nomeBarco(S, x.boat)), fmt(e.ida), fmt(x.ini), fmt(e.ultimoBordo), fmt(e.volta), e.A, x.dobra, fmt(e.folgaIni), fmt(e.folgaFim), x.src]);
    });
    r.dias.forEach((d) => dias.push([n, fmt(d[0]), d[1], d[2]]));
  });
  return [
    ["Resumo", resumo],
    ["Períodos", pers],
    ["Dia a dia", dias],
  ];
}

export interface LinhaPdf {
  t: string;
  x: number;
  sz: number;
  b: boolean;
  /** Espaço extra antes desta linha (mm). */
  antes?: number;
}

/** Linhas do PDF do histórico, com posição x, tamanho da fonte e negrito. */
export function pdfHistorico(S: Pick<Estado, "boats">, R: Calculo[], T: number): LinhaPdf[] {
  const out: LinhaPdf[] = [
    { t: "TOVERI - Gestão de Pessoas", x: 14, sz: 16, b: true },
    { t: "Histórico de embarques e folgas", x: 14, sz: 12, b: false },
    { t: "Gerado em " + fmt(T), x: 14, sz: 9, b: false },
  ];
  let antes = 4;
  R.forEach((r) => {
    out.push({ t: unesc(r.p.name) + "  |  " + fmt(r.de) + " a " + fmt(r.ate), x: 14, sz: 11, b: true, antes });
    out.push({ t: "Dias a bordo: " + r.ab + "   Dobra: " + r.dob + "   Translado: " + r.tr + "   Trabalhados: " + (r.ab + r.tr) + "   Dias de folga: " + r.fo, x: 14, sz: 10, b: false });
    r.per.forEach((x) => {
      const e = etapasPeriodo(x),
        bn = nomeBarco(S, x.boat);
      out.push({
        t:
          (bn ? unesc(bn) + ": " : "") +
          "translado " + fmt(e.ida) + "  |  " + fmt(x.ini) + " a " + fmt(e.ultimoBordo) + " a bordo (" + e.A + " dias" + (x.dobra ? ", dobra " + x.dobra : "") + ")" +
          (e.volta > e.ultimoBordo ? "  |  volta " + fmt(e.volta) : "") +
          "  |  folga " + fmt(e.folgaIni) + " a " + fmt(e.folgaFim) + "  [" + x.src + "]",
        x: 18,
        sz: 9,
        b: false,
      });
    });
    antes = 3;
  });
  return out;
}
