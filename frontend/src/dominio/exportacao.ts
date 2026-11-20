/** Conteúdo das exportações (histórico em Excel e PDF, ficha do colaborador em PDF), sem depender das bibliotecas. */
import { fmt } from "./datas";
import { campos, docFor, docsDo, nomeSetor, opcDoc, setor, VACS } from "./documentos";
import { nomeBarco, type Calculo } from "./escala";
import { unesc } from "./texto";
import type { Estado, Pessoa } from "./tipos";
import { estadoQualquer, isAso } from "./validade";

/* ---------------- ficha do colaborador (PDF) ---------------- */

export interface SecaoFichaPdf {
  titulo: string;
  /** [rótulo, valor]; rótulo vazio = linha de aviso ("Nenhum curso cadastrado"). */
  linhas: [string, string][];
}

/** Conteúdo da ficha em PDF: os mesmos dados da pasta, mais cursos/ASO e vacinas. */
export function fichaPdf(S: Pick<Estado, "boats" | "courses">, p: Pessoa, T: number): { nome: string; sub: string; secoes: SecaoFichaPdf[] } {
  const dados: [string, string][] = campos(S, p).map(([k, v]) => [k, unesc(v || "") || "—"]);
  const cursos: [string, string][] = S.courses
    .filter((c) => c.pid == p.id)
    .sort((a, b) => +isAso(b) - +isAso(a) || a.valid - b.valid)
    .map((c) => [c.name, "Validade " + fmt(c.valid) + " (" + estadoQualquer(c, T).t.toLowerCase() + ")"]);
  const vac: [string, string][] = VACS.map(([k, n]) => {
    const d = p.vac?.[k];
    return [n, d != null ? fmt(d) : "—"];
  });
  const obrig: [string, string][] = setor(p.setor)
    ? docsDo(p.setor).map((n) => [n, docFor(p.docs, n) ? "Anexado" : opcDoc(n) ? "Opcional" : "Pendente"])
    : [["", "Setor não definido."]];
  const anexos: [string, string][] = (p.docs || []).map((d) => [d.campo || "Outros", d.name]);
  return {
    nome: unesc(p.name),
    sub: [nomeSetor(p.setor), unesc(p.role || "")].filter(Boolean).join(" · "),
    secoes: [
      { titulo: "Dados pessoais", linhas: dados },
      { titulo: "Cursos e ASO", linhas: cursos.length ? cursos : [["", "Nenhum curso cadastrado."]] },
      { titulo: "Vacinas", linhas: vac },
      { titulo: "Documentos obrigatórios do setor", linhas: obrig },
      { titulo: "Documentos anexados", linhas: anexos.length ? anexos : [["", "Nenhum documento anexado."]] },
    ],
  };
}

export type Celula = string | number;

/** Abas da planilha: [nome da aba, linhas]. */
export function planilhaHistorico(S: Pick<Estado, "boats">, R: Calculo[]): [string, Celula[][]][] {
  const resumo: Celula[][] = ([["Colaborador", "Setor", "De", "Até", "Dias a bordo", "Dias de dobra (incluídos)", "Dias de folga"]] as Celula[][]).concat(
    R.map((r) => [unesc(r.p.name), nomeSetor(r.p.setor), fmt(r.de), fmt(r.ate), r.ab, r.dob, r.fo]),
  );
  const pers: Celula[][] = [["Colaborador", "Barco", "Início do embarque", "Último dia a bordo", "Dias a bordo", "Dobra", "Início da folga", "Último dia de folga", "Origem"]];
  const dias: Celula[][] = [["Colaborador", "Data", "Situação", "Origem"]];
  R.forEach((r) => {
    const n = unesc(r.p.name);
    r.per.forEach((x) => {
      const t = x.dias + x.dobra;
      pers.push([n, unesc(nomeBarco(S, x.boat)), fmt(x.ini), fmt(x.ini + t - 1), t, x.dobra, fmt(x.ini + t), fmt(x.ini + 2 * t - 1), x.src]);
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
    out.push({ t: "Dias a bordo: " + r.ab + "   Dobra: " + r.dob + "   Dias de folga: " + r.fo, x: 14, sz: 10, b: false });
    r.per.forEach((x) => {
      const t = x.dias + x.dobra,
        bn = nomeBarco(S, x.boat);
      out.push({
        t: (bn ? unesc(bn) + ": " : "") + fmt(x.ini) + " a " + fmt(x.ini + t - 1) + " a bordo (" + t + " dias" + (x.dobra ? ", dobra " + x.dobra : "") + ")  |  folga " + fmt(x.ini + t) + " a " + fmt(x.ini + 2 * t - 1) + "  [" + x.src + "]",
        x: 18,
        sz: 9,
        b: false,
      });
    });
    antes = 3;
  });
  return out;
}
