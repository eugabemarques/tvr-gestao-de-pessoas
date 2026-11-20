/**
 * Texto de um documento anexado, lido no próprio navegador (nada é enviado para fora).
 * - PDF gerado no computador: usa o texto que já vem dentro do arquivo (pdf.js).
 * - PDF escaneado ou imagem: reconhece o texto da imagem (Tesseract, português).
 * Os arquivos do Tesseract são servidos pelo próprio sistema em /ocr/<versão>/ (scripts/copiar-ocr.mjs).
 * As bibliotecas só são carregadas na primeira leitura, para não pesar na abertura das telas.
 */
import type { Worker } from "tesseract.js";

declare const __OCR_VERSAO__: string;
const BASE = "/ocr/" + __OCR_VERSAO__;
/** Páginas lidas de cada PDF (documentos de cadastro raramente passam disso). */
const MAX_PAGINAS = 3;

let trabalhador: Promise<Worker> | null = null;

function tesseract(): Promise<Worker> {
  if (!trabalhador) {
    trabalhador = import("tesseract.js")
      .then(({ createWorker }) =>
        createWorker("por", 1, {
          workerPath: BASE + "/worker.min.js",
          corePath: BASE + "/core",
          langPath: BASE,
          gzip: true,
        }),
      )
      .catch((e) => {
        trabalhador = null;
        throw e;
      });
  }
  return trabalhador;
}

async function reconhecer(img: Blob | HTMLCanvasElement): Promise<string> {
  const w = await tesseract();
  const r = await w.recognize(img);
  return r.data.text || "";
}

async function lerPdf(arq: Blob): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arq.arrayBuffer()) }).promise;
  try {
    const n = Math.min(doc.numPages, MAX_PAGINAS);
    const paginas = [];
    for (let i = 1; i <= n; i++) paginas.push(await doc.getPage(i));

    // 1) texto que já vem no PDF
    let texto = "";
    for (const pg of paginas) {
      const c = await pg.getTextContent();
      texto += c.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("") + "\n";
    }
    if (texto.replace(/\s/g, "").length >= 40) return texto;

    // 2) PDF escaneado: desenha cada página e reconhece a imagem
    texto = "";
    for (const pg of paginas) {
      const vp = pg.getViewport({ scale: 2 }); // testado: 3 piora a leitura
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      await pg.render({ canvas, viewport: vp }).promise;
      texto += (await reconhecer(canvas)) + "\n";
    }
    return texto;
  } finally {
    void doc.destroy();
  }
}

/** Texto do arquivo (PDF ou imagem). */
export async function lerTexto(arq: File): Promise<string> {
  const pdf = arq.type === "application/pdf" || /\.pdf$/i.test(arq.name);
  return pdf ? lerPdf(arq) : reconhecer(arq);
}
