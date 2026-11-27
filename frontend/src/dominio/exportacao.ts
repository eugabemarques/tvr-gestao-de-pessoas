/** Conteúdo das exportações (histórico em Excel e PDF, ficha do colaborador em PDF), sem depender das bibliotecas. */
import { fmt } from "./datas";
import { campos, campoToveri, docFor, docsDo, docsToveriDo, nomeSetor, opcDoc, setor, VACS } from "./documentos";
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
 * Conteúdo da ficha em PDF: dados pessoais, cursos e exames, e vacinas.
 * `paginasAnexos` (só no dossiê): página onde começa cada documento de `p.docs`, na mesma ordem.
 * As listas de documentos (obrigatórios do setor e anexados) só entram no dossiê; a ficha sozinha
 * fica só com os dados do colaborador.
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
  const toveri: [string, string][] = docsToveriDo(p.setor).map((n) => [n, docFor(p.docs, campoToveri(n)) ? "Anexado" : "Opcional"]);
  const anexos: [string, string][] = (p.docs || []).map((d, i) => [d.campo || "Outros", d.name + (paginasAnexos ? "  ·  página " + paginasAnexos[i] : "")]);
  const secoes: SecaoFichaPdf[] = [
    { titulo: "Dados pessoais", linhas: dados },
    { titulo: "Cursos e exames", linhas: cursos.length ? cursos : [["", "Nenhum curso cadastrado."]] },
    { titulo: "Vacinas", linhas: vac },
  ];
  if (paginasAnexos)
    secoes.push(
      { titulo: "Documentos obrigatórios do setor", linhas: obrig },
      ...(toveri.length ? [{ titulo: "Docs Toveri", linhas: toveri }] : []),
      { titulo: "Documentos anexados (a seguir, neste dossiê)", linhas: anexos.length ? anexos : [["", "Nenhum documento anexado."]] },
    );
  return { nome: unesc(p.name), sub: [nomeSetor(p.setor), unesc(p.role || "")].filter(Boolean).join(" · "), secoes };
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

/** Bloco de um colaborador no PDF do histórico. */
export interface BlocoHistoricoPdf {
  nome: string;
  /** Setor e função. */
  sub: string;
  /** "01/01/2026 a 31/03/2026". */
  intervalo: string;
  /** [rótulo, valor] dos totais do intervalo. */
  resumo: [string, string][];
  /** Uma linha por embarque, nas colunas de `COLUNAS_HISTORICO_PDF`. */
  linhas: string[][];
}

export const COLUNAS_HISTORICO_PDF = ["Barco", "Translado de ida", "A bordo", "Dias", "Dobra", "Translado de volta", "Folga", "Origem"];

/** Conteúdo do PDF do histórico: um bloco por colaborador, com os totais e a tabela de embarques. */
export function pdfHistorico(S: Pick<Estado, "boats">, R: Calculo[]): BlocoHistoricoPdf[] {
  return R.map((r) => ({
    nome: unesc(r.p.name) || "Sem nome",
    sub: [nomeSetor(r.p.setor), unesc(r.p.role || "")].filter(Boolean).join(" · "),
    intervalo: fmt(r.de) + " a " + fmt(r.ate),
    resumo: [
      ["Dias a bordo", String(r.ab)],
      ["Dobra", String(r.dob)],
      ["Translado", String(r.tr)],
      ["Trabalhados", String(r.ab + r.tr)],
      ["Folga", String(r.fo)],
    ],
    linhas: r.per.map((x) => {
      const e = etapasPeriodo(x);
      return [
        unesc(nomeBarco(S, x.boat)) || "—",
        fmt(e.ida),
        fmt(x.ini) + " a " + fmt(e.ultimoBordo),
        String(e.A),
        x.dobra ? String(x.dobra) : "—",
        fmt(e.volta),
        fmt(e.folgaIni) + " a " + fmt(e.folgaFim),
        x.src === "Registrado" ? "Registrado" : "Pela escala",
      ];
    }),
  }));
}
