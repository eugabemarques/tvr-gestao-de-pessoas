/** Gera a ficha do colaborador em PDF (A4), com o logo da TOVERI, a partir de `fichaPdf`. */
import { fmt } from "../dominio/datas";
import { fichaPdf } from "../dominio/exportacao";
import type { Estado, Pessoa } from "../dominio/tipos";

const AZUL: [number, number, number] = [16, 74, 140];
const CINZA: [number, number, number] = [110, 116, 128];
const TEXTO: [number, number, number] = [30, 34, 40];
const ALERTA: [number, number, number] = [176, 104, 0];
const VERDE: [number, number, number] = [22, 128, 61];

/** Logo como data URL (ou null se não carregar: o PDF sai sem logo). */
async function logo(): Promise<{ url: string; w: number; h: number } | null> {
  try {
    const b = await (await fetch("/logo-cor.png")).blob();
    const url = await new Promise<string>((ok, erro) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = erro;
      r.readAsDataURL(b);
    });
    const img = new Image();
    img.src = url;
    await img.decode();
    return { url, w: img.naturalWidth, h: img.naturalHeight };
  } catch {
    return null;
  }
}

export interface OpcoesFicha {
  /** Dossiê: página onde começa cada anexo (mesma ordem de `p.docs`). */
  paginasAnexos?: number[];
  /** Dossiê: total de páginas, para o rodapé "Página x de y". */
  totalPaginas?: number;
  titulo?: string;
}

/** Ficha em PDF; devolve o arquivo e quantas páginas ele tem. */
export async function gerarFichaPdf(S: Estado, p: Pessoa, T: number, o: OpcoesFicha = {}): Promise<{ bytes: ArrayBuffer; paginas: number }> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const F = fichaPdf(S, p, T, o.paginasAnexos);
  const M = 16, // margem
    LARG = 210 - 2 * M,
    COL = 64, // largura da coluna dos rótulos
    FIM = 297 - 18; // limite antes do rodapé
  let y = M;

  // cabeçalho
  const lg = await logo();
  if (lg) {
    const h = 12,
      w = (lg.w / lg.h) * h;
    doc.addImage(lg.url, "PNG", M, y, w, h);
  }
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...CINZA);
  doc.text(o.titulo || "Ficha do colaborador", 210 - M, y + 4, { align: "right" });
  doc.text((o.titulo ? "Gerado em " : "Gerada em ") + fmt(T), 210 - M, y + 9, { align: "right" }); // o dossiê / a ficha
  y += 20;
  doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(...AZUL);
  doc.text(doc.splitTextToSize(F.nome || "Sem nome", LARG), M, y);
  y += 7;
  if (F.sub) {
    doc.setFont("helvetica", "normal").setFontSize(10.5).setTextColor(...CINZA);
    doc.text(F.sub, M, y);
    y += 5;
  }
  y += 3;

  const novaPagina = (precisa: number) => {
    if (y + precisa > FIM) {
      doc.addPage();
      y = M + 4;
    }
  };

  for (const s of F.secoes) {
    novaPagina(16);
    y += 4;
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...AZUL);
    doc.text(s.titulo, M, y);
    y += 2;
    doc.setDrawColor(...AZUL).setLineWidth(0.4).line(M, y, 210 - M, y);
    y += 5;
    for (const [rot, val] of s.linhas) {
      doc.setFontSize(9.5);
      const lr = rot ? doc.splitTextToSize(rot, COL - 4) : [];
      const lv = doc.splitTextToSize(val, rot ? LARG - COL : LARG);
      const h = Math.max(lr.length, lv.length) * 4.4 + 1.6;
      novaPagina(h);
      if (rot) {
        doc.setFont("helvetica", "normal").setTextColor(...CINZA);
        doc.text(lr, M, y);
      }
      const pend = val === "Pendente",
        ok = val === "Anexado";
      doc.setFont("helvetica", pend || ok ? "bold" : "normal").setTextColor(...(pend ? ALERTA : ok ? VERDE : TEXTO));
      doc.text(lv, rot ? M + COL : M, y);
      y += h;
      doc.setDrawColor(225, 228, 233).setLineWidth(0.15).line(M, y - 3.2, 210 - M, y - 3.2);
    }
  }

  // rodapé em todas as páginas
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...CINZA);
    doc.text("TOVERI - Gestão de Pessoas · Documento com dados pessoais (LGPD): não compartilhe fora da empresa.", M, 297 - 9);
    doc.text("Página " + i + " de " + (o.totalPaginas || n), 210 - M, 297 - 9, { align: "right" });
  }
  return { bytes: doc.output("arraybuffer"), paginas: n };
}
