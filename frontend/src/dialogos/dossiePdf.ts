/**
 * Dossiê do colaborador: a ficha em PDF seguida de todos os documentos anexados, num único PDF.
 * - Anexo em PDF: entram todas as páginas.
 * - Anexo em imagem: uma página A4 com o nome do documento no topo e a imagem ajustada
 *   (redesenhada pelo navegador, que respeita a rotação das fotos de celular).
 * - Anexo que não abre (protegido, danificado, não encontrado): uma página explicando, para o
 *   índice da ficha continuar batendo com as páginas.
 * Tudo é feito no navegador (jsPDF + pdf-lib).
 */
import type { PDFDocument as TPDFDocument, PDFFont } from "pdf-lib";
import type { Documento, Estado, Pessoa } from "../dominio/tipos";
import { blobDoc } from "../servidor/api";
import { gerarFichaPdf } from "./fichaPdf";

type Anexo = { d: Documento } & ({ tipo: "pdf"; pdf: TPDFDocument } | { tipo: "img"; jpg: Uint8Array; w: number; h: number } | { tipo: "falha"; motivo: string });

const A4: [number, number] = [595.28, 841.89];
const MAX_LADO = 2200; // px: imagens maiores são reduzidas (o dossiê não fica gigante)

/** Imagem → JPEG já na orientação certa, com no máximo MAX_LADO px. */
async function imagemJpeg(b: Blob): Promise<{ jpg: Uint8Array; w: number; h: number }> {
  const bmp = await createImageBitmap(b, { imageOrientation: "from-image" });
  const k = Math.min(1, MAX_LADO / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const out = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.85));
  if (!out) throw new Error("imagem");
  return { jpg: new Uint8Array(await out.arrayBuffer()), w: c.width, h: c.height };
}

const ePdf = (d: Documento, b: Blob) => b.type === "application/pdf" || /\.pdf$/i.test(d.name);

/** Texto que a fonte padrão do PDF consegue escrever (tira caracteres fora do Latin-1). */
const seguro = (s: string) => s.replace(/[^\x20-\x7E -ÿ—–·]/g, "?");

export async function gerarDossie(S: Estado, p: Pessoa, T: number): Promise<{ blob: Blob; falhas: string[] }> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  // 1) prepara cada anexo
  const anexos: Anexo[] = [];
  for (const d of p.docs || []) {
    const b = await blobDoc(d);
    if (!b) {
      anexos.push({ d, tipo: "falha", motivo: "o arquivo não foi encontrado no servidor" });
      continue;
    }
    try {
      if (ePdf(d, b)) {
        const pdf = await PDFDocument.load(await b.arrayBuffer(), { ignoreEncryption: true, throwOnInvalidObject: false });
        // um PDF danificado pode "abrir" sem páginas de verdade: confere já aqui
        if (pdf.getPageCount() < 1) throw new Error("sem páginas");
        pdf.getPages();
        anexos.push({ d, tipo: "pdf", pdf });
      } else anexos.push({ d, tipo: "img", ...(await imagemJpeg(b)) });
    } catch {
      anexos.push({ d, tipo: "falha", motivo: "o arquivo está protegido, danificado ou num formato que não abre" });
    }
  }
  const paginasDe = (a: Anexo) => (a.tipo === "pdf" ? a.pdf.getPageCount() : 1);

  // 2) ficha com o índice de páginas (a ficha pode ganhar uma página com o índice: repete até estabilizar)
  let nFicha = 1;
  let ficha: Awaited<ReturnType<typeof gerarFichaPdf>>;
  for (let tentativa = 0; ; tentativa++) {
    const inicio: number[] = [];
    let pg = nFicha + 1;
    for (const a of anexos) {
      inicio.push(pg);
      pg += paginasDe(a);
    }
    ficha = await gerarFichaPdf(S, p, T, { paginasAnexos: inicio, totalPaginas: pg - 1, titulo: "Dossiê do colaborador" });
    if (ficha.paginas === nFicha || tentativa >= 3) break;
    nFicha = ficha.paginas;
  }

  // 3) junta tudo
  const out = await PDFDocument.create();
  out.setTitle("Dossiê - " + seguro(p.name));
  out.setProducer("TOVERI - Gestão de Pessoas");
  const fichaDoc = await PDFDocument.load(ficha.bytes);
  (await out.copyPages(fichaDoc, fichaDoc.getPageIndices())).forEach((pg) => out.addPage(pg));

  const negrito: PDFFont = await out.embedFont(StandardFonts.HelveticaBold);
  const normal: PDFFont = await out.embedFont(StandardFonts.Helvetica);
  const titulo = (pg: ReturnType<typeof out.addPage>, d: Documento) => {
    pg.drawText(seguro("Anexo: " + (d.campo || "Outros documentos")), { x: 40, y: A4[1] - 50, size: 13, font: negrito, color: rgb(0.06, 0.29, 0.55) });
    pg.drawText(seguro(d.name), { x: 40, y: A4[1] - 67, size: 9.5, font: normal, color: rgb(0.43, 0.45, 0.5) });
  };

  const falhas: string[] = [];
  for (const a of anexos) {
    if (a.tipo === "pdf") {
      try {
        (await out.copyPages(a.pdf, a.pdf.getPageIndices())).forEach((pg) => out.addPage(pg));
        continue;
      } catch {
        /* cai na página de falha abaixo, mantendo uma página para o índice não quebrar */
      }
      falhas.push(a.d.name);
      // páginas que faltaram para o índice continuar certo
      for (let i = 0; i < a.pdf.getPageCount(); i++) {
        const pg = out.addPage(A4);
        titulo(pg, a.d);
        if (i === 0) pg.drawText(seguro("Não foi possível incluir este arquivo no dossiê. Baixe-o pela pasta do colaborador."), { x: 40, y: A4[1] - 110, size: 11, font: normal });
      }
    } else if (a.tipo === "img") {
      const pg = out.addPage(A4);
      titulo(pg, a.d);
      const img = await out.embedJpg(a.jpg);
      const caixaW = A4[0] - 80,
        caixaH = A4[1] - 90 - 50;
      const k = Math.min(caixaW / a.w, caixaH / a.h);
      const w = a.w * k,
        h = a.h * k;
      pg.drawImage(img, { x: (A4[0] - w) / 2, y: 50 + (caixaH - h), width: w, height: h });
    } else {
      falhas.push(a.d.name);
      const pg = out.addPage(A4);
      titulo(pg, a.d);
      pg.drawText(seguro("Não foi possível incluir este arquivo: " + a.motivo + "."), { x: 40, y: A4[1] - 110, size: 11, font: normal });
      pg.drawText(seguro("Baixe-o pela pasta do colaborador."), { x: 40, y: A4[1] - 126, size: 11, font: normal });
    }
  }
  const bytes = await out.save();
  return { blob: new Blob([bytes as BlobPart], { type: "application/pdf" }), falhas };
}
