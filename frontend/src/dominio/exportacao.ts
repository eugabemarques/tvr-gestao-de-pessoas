/** Conteúdo das exportações do histórico (Excel e PDF), sem depender das bibliotecas. */
import { fmt } from "./datas";
import { nomeSetor } from "./documentos";
import { nomeBarco, type Calculo } from "./escala";
import { unesc } from "./texto";
import type { Estado } from "./tipos";

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
