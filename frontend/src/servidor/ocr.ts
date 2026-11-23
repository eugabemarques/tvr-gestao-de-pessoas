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

/** Maior lado, em pixels, das imagens ampliadas para a leitura detalhada. */
const MAX_LADO = 4000;

async function lerPdf(arq: Blob, detalhe: boolean): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arq.arrayBuffer()) }).promise;
  try {
    const n = Math.min(doc.numPages, MAX_PAGINAS);
    const paginas = [];
    for (let i = 1; i <= n; i++) paginas.push(await doc.getPage(i));

    // 1) texto que já vem no PDF (PDF gerado no computador)
    let camada = "";
    for (const pg of paginas) {
      const c = await pg.getTextContent();
      camada += c.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("") + "\n";
    }
    if (!detalhe && camada.replace(/\s/g, "").length >= 40) return camada;

    let texto = camada;

    // 2) leitura detalhada: as imagens que estão dentro do PDF (ex.: o cartão da CNH digital), na
    //    resolução original, ampliadas e em tons de cinza — como uma foto anexada. Desenhar a página
    //    inteira e ampliar perde nitidez.
    if (detalhe) {
      let achou = false;
      for (const pg of paginas) {
        for (const img of await imagensDaPagina(pdfjs, pg)) {
          achou = true;
          texto += "\n" + (await reconhecer(img));
        }
      }
      if (achou) return texto;
    }

    // 3) desenha cada página e reconhece a imagem: PDF escaneado, ou PDF que tem algum texto mas traz
    //    o documento como imagem (ex.: CNH digital). Na leitura detalhada (PDF sem imagens separadas),
    //    em tamanho maior, porque letras pequenas só são reconhecidas ampliadas.
    // detalhada: uma leitura só, com a maior ampliação possível (limitada por MAX_LADO)
    for (const escala of detalhe ? [8] : [2]) {
      for (const pg of paginas) {
        const base = pg.getViewport({ scale: 1 });
        const vp = pg.getViewport({ scale: Math.min(escala, MAX_LADO / Math.max(base.width, base.height)) });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        await pg.render({ canvas, viewport: vp }).promise;
        texto += "\n" + (await reconhecer(detalhe ? cinza(canvas) : canvas));
      }
    }
    return texto;
  } finally {
    void doc.destroy();
  }
}

/**
 * Cópia em tons de cinza. Testado com uma CNH real: o fundo verde estampado atrapalha; em cinza,
 * CPF e nº do documento passaram a ser reconhecidos (aumentar o contraste piorou).
 */
function cinza(origem: HTMLCanvasElement | ImageBitmap, w = origem.width, h = origem.height): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  const g = c.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.filter = "grayscale(1)";
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(origem, 0, 0, c.width, c.height);
  return c;
}

type PdfJs = typeof import("pdfjs-dist");
type PaginaPdf = Awaited<ReturnType<Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>["getPage"]>>;
/** Imagens que o pdf.js entrega: em ImageBitmap ou em pixels (RGBA, RGB ou 1 bit). */
type ImagemPdf = { bitmap?: ImageBitmap; data?: Uint8ClampedArray; width: number; height: number; kind?: number };

/**
 * Imagens com pelo menos 300 px dentro de uma página do PDF, já ampliadas (até 3×) e em tons de
 * cinza. Ícones e QR codes pequenos ficam de fora.
 */
async function imagensDaPagina(pdfjs: PdfJs, pg: PaginaPdf): Promise<HTMLCanvasElement[]> {
  const out: HTMLCanvasElement[] = [];
  try {
    const ops = await pg.getOperatorList();
    const ids = new Set<string>();
    ops.fnArray.forEach((fn, i) => {
      if (fn === pdfjs.OPS.paintImageXObject) ids.add(String(ops.argsArray[i][0]));
    });
    for (const id of ids) {
      const img = await new Promise<ImagemPdf | null>((ok) => {
        try {
          pg.objs.get(id, (x: ImagemPdf) => ok(x));
        } catch {
          ok(null);
        }
      });
      if (!img || Math.max(img.width, img.height) < 300) continue;
      let fonte: HTMLCanvasElement | ImageBitmap;
      if (img.bitmap) fonte = img.bitmap;
      else if (img.data) {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const px = new ImageData(img.width, img.height);
        const n = img.width * img.height;
        if (img.data.length === n * 4) px.data.set(img.data);
        else if (img.data.length === n * 3) for (let i = 0; i < n; i++) px.data.set([img.data[i * 3], img.data[i * 3 + 1], img.data[i * 3 + 2], 255], i * 4);
        else continue; // formato raro (1 bit): fica para a leitura da página desenhada
        c.getContext("2d")!.putImageData(px, 0, 0);
        fonte = c;
      } else continue;
      const k = Math.max(1, Math.min(3, MAX_LADO / Math.max(img.width, img.height)));
      out.push(cinza(fonte, img.width * k, img.height * k));
    }
  } catch (e) {
    console.warn("Imagens do PDF", e);
  }
  return out;
}

/** Imagem ampliada (até 3×, sem passar de MAX_LADO) e em tons de cinza, para letras pequenas. */
async function ampliada(arq: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(arq, { imageOrientation: "from-image" });
  const k = Math.max(1, Math.min(3, MAX_LADO / Math.max(bmp.width, bmp.height)));
  const c = cinza(bmp, bmp.width * k, bmp.height * k);
  bmp.close();
  return c;
}

/**
 * Texto do arquivo (PDF ou imagem).
 * `detalhe`: segunda tentativa, mais lenta, quando a primeira não achou os campos principais —
 * lê a imagem do PDF e versões ampliadas, em tons de cinza.
 */
export async function lerTexto(arq: File, detalhe = false): Promise<string> {
  const pdf = arq.type === "application/pdf" || /\.pdf$/i.test(arq.name);
  if (pdf) return lerPdf(arq, detalhe);
  return reconhecer(detalhe ? await ampliada(arq) : arq);
}
