/**
 * Histórico de embarques e folgas em PDF (A4 em pé), com o logo da TOVERI:
 * um bloco por colaborador (nome em destaque, totais e tabela de embarques), dentro das margens do papel.
 */
import { fmt } from "../dominio/datas";
import { COLUNAS_HISTORICO_PDF, pdfHistorico } from "../dominio/exportacao";
import type { Calculo } from "../dominio/escala";
import type { Estado } from "../dominio/tipos";
import { AZUL, CINZA, logo, TEXTO } from "./fichaPdf";

const FUNDO_NOME: [number, number, number] = [234, 241, 250];
const FUNDO_CAB: [number, number, number] = [16, 74, 140];
const ZEBRA: [number, number, number] = [246, 248, 251];
const LINHA: [number, number, number] = [222, 226, 232];
const PREVISTO: [number, number, number] = [150, 156, 166];

const PW = 210,
  PH = 297,
  M = 14, // margem
  LARG = PW - 2 * M,
  FIM = PH - 16; // limite antes do rodapé

/** Larguras das colunas (mm), na ordem de COLUNAS_HISTORICO_PDF; somam LARG. */
const LARGURAS = [25, 19, 38, 10, 11, 19, 38, 22];
/** Colunas centralizadas (números e datas curtas). */
const CENTRO = new Set([1, 3, 4, 5]);

export async function gerarHistoricoPdf(S: Estado, R: Calculo[], T: number, de: number | null, ate: number): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const blocos = pdfHistorico(S, R);
  let y = M;

  // cabeçalho da primeira página
  const lg = await logo();
  if (lg) {
    const h = 12,
      w = (lg.w / lg.h) * h;
    doc.addImage(lg.url, "PNG", M, y, w, h);
  }
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...AZUL);
  doc.text("Histórico de embarques e folgas", PW - M, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...CINZA);
  doc.text("Período: " + (de != null ? fmt(de) + " a " + fmt(ate) : "até " + fmt(ate)), PW - M, y + 9, { align: "right" });
  doc.text("Gerado em " + fmt(T) + " · " + blocos.length + (blocos.length === 1 ? " colaborador" : " colaboradores"), PW - M, y + 13, { align: "right" });
  y += 18;
  doc.setDrawColor(...AZUL).setLineWidth(0.6).line(M, y, PW - M, y);
  y += 6;

  const novaPagina = () => {
    doc.addPage();
    y = M;
  };

  /** Altura de uma linha da tabela (as células quebram em várias linhas se precisar). */
  const alturaLinha = (cel: string[], tam: number) => {
    doc.setFontSize(tam);
    const n = Math.max(...cel.map((c, i) => doc.splitTextToSize(c, LARGURAS[i] - 3).length));
    return n * tam * 0.42 + 3.4;
  };

  const linhaTabela = (cel: string[], cab: boolean, fundo: [number, number, number] | null, cor: [number, number, number]) => {
    const tam = cab ? 7.5 : 8.5;
    const h = alturaLinha(cel, tam);
    if (fundo) doc.setFillColor(...fundo).rect(M, y, LARG, h, "F");
    doc.setFont("helvetica", cab ? "bold" : "normal").setFontSize(tam).setTextColor(...cor);
    let x = M;
    cel.forEach((c, i) => {
      const t = doc.splitTextToSize(c, LARGURAS[i] - 3);
      const cx = CENTRO.has(i) ? x + LARGURAS[i] / 2 : x + 1.5;
      doc.text(t, cx, y + 2.2 + tam * 0.35, { align: CENTRO.has(i) ? "center" : "left" });
      x += LARGURAS[i];
    });
    y += h;
    if (!cab) doc.setDrawColor(...LINHA).setLineWidth(0.15).line(M, y, PW - M, y);
  };

  const cabecalhoTabela = () => linhaTabela(COLUNAS_HISTORICO_PDF, true, FUNDO_CAB, [255, 255, 255]);

  const faixaNome = (nome: string, sub: string, intervalo: string, continuacao: boolean) => {
    const h = continuacao ? 9 : 15;
    doc.setFillColor(...FUNDO_NOME).rect(M, y, LARG, h, "F");
    doc.setFillColor(...AZUL).rect(M, y, 1.6, h, "F");
    doc.setFont("helvetica", "bold").setFontSize(continuacao ? 10.5 : 14).setTextColor(...AZUL);
    const n = doc.splitTextToSize(nome + (continuacao ? " (continuação)" : ""), LARG - 60)[0];
    doc.text(n, M + 5, y + (continuacao ? 6 : 7));
    if (!continuacao) {
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
      if (sub) doc.text(doc.splitTextToSize(sub, LARG - 60)[0], M + 5, y + 12);
      doc.text("Período: " + intervalo, PW - M - 3, y + 7, { align: "right" });
    }
    y += h + 2;
  };

  const resumo = (itens: [string, string][]) => {
    const gap = 2,
      w = (LARG - gap * (itens.length - 1)) / itens.length,
      h = 11;
    itens.forEach(([rot, val], i) => {
      const x = M + i * (w + gap);
      doc.setDrawColor(...LINHA).setLineWidth(0.25).roundedRect(x, y, w, h, 1.2, 1.2, "S");
      doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...TEXTO);
      doc.text(val, x + w / 2, y + 5.4, { align: "center" });
      doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA);
      doc.text(rot, x + w / 2, y + 9.2, { align: "center" });
    });
    y += h + 3;
  };

  if (!blocos.length) {
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...CINZA);
    doc.text("Nenhum colaborador com embarques no período.", M, y + 4);
  }

  blocos.forEach((b, bi) => {
    // nome + totais + cabeçalho da tabela + 1ª linha ficam juntos na mesma página
    const precisa = 17 + 14 + 9 + (b.linhas.length ? alturaLinha(b.linhas[0], 8.5) : 8);
    if (bi > 0) y += 5;
    if (y + precisa > FIM) novaPagina();
    faixaNome(b.nome, b.sub, b.intervalo, false);
    resumo(b.resumo);
    if (!b.linhas.length) {
      doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(...CINZA);
      doc.text("Nenhum embarque no período.", M + 2, y + 3);
      y += 7;
      return;
    }
    cabecalhoTabela();
    b.linhas.forEach((l, i) => {
      if (y + alturaLinha(l, 8.5) > FIM) {
        novaPagina();
        faixaNome(b.nome, "", "", true);
        cabecalhoTabela();
      }
      const prevista = l[l.length - 1] !== "Registrado";
      linhaTabela(l, false, i % 2 ? ZEBRA : null, prevista ? PREVISTO : TEXTO);
    });
  });

  // rodapé em todas as páginas
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINHA).setLineWidth(0.2).line(M, PH - 12, PW - M, PH - 12);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA);
    doc.text("TOVERI - Gestão de Pessoas · Histórico de embarques e folgas · Uso interno.", M, PH - 8);
    doc.text("Página " + i + " de " + n, PW - M, PH - 8, { align: "right" });
  }
  return doc.output("blob");
}
