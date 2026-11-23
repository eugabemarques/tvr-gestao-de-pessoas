/**
 * Leitura de documentos anexados: a partir do texto reconhecido (OCR ou texto do PDF),
 * encontra os números com formato conhecido. Funções puras, sem rede nem IA.
 *
 * Só devolve o que tem boa chance de estar certo: CPF, PIS e título passam pelos dígitos
 * verificadores; quando o documento traz mais de um valor possível (ex.: conta de luz com
 * o CEP da empresa e o do cliente), nada é preenchido e um aviso explica o motivo.
 */
import { CURSO_DOCS } from "./documentos";

export type CampoLido = "nome" | "cpf" | "rg" | "pis" | "tit" | "pass" | "cep";

export interface Leitura {
  valores: Partial<Record<CampoLido, string>>;
  /** Validade de curso/ASO, "AAAA-MM-DD". */
  validade?: string;
  avisos: string[];
}

/** Rótulos para as mensagens ("Lido do documento: CPF, RG"). */
export const ROTULO_LIDO: Record<CampoLido | "validade", string> = {
  nome: "nome",
  cpf: "CPF",
  rg: "RG",
  pis: "PIS",
  tit: "título de eleitor",
  pass: "passaporte",
  cep: "CEP",
  validade: "validade",
};

type Tipo = "identidade" | "pis" | "titulo" | "passaporte" | "residencia" | "certificado";

/** Que leitura vale para o documento anexado neste campo (nada para os demais). */
export function tipoLeitura(campo: string): Tipo | null {
  // o clipe do Nome também recebe o documento de identidade (RG ou CNH)
  if (campo === "RG / CPF / CNH" || campo === "Nome") return "identidade";
  if (campo === "Nº do PIS") return "pis";
  if (campo === "Título de Eleitor") return "titulo";
  if (campo === "Passaporte (se tiver)") return "passaporte";
  if (campo === "Comprovante de Residência") return "residencia";
  if (campo === "ASO" || campo.startsWith("Curso: ") || CURSO_DOCS.includes(campo)) return "certificado";
  return null;
}

/* ---------------- números com dígito verificador ---------------- */

const so = (s: string) => s.replace(/\D/g, "");

export function cpfValido(c: string): boolean {
  const d = so(c);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const n of [9, 10]) {
    let s = 0;
    for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i);
    if (((s * 10) % 11) % 10 !== +d[n]) return false;
  }
  return true;
}

export function pisValido(p: string): boolean {
  const d = so(p);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const r = 11 - (pesos.reduce((s, w, i) => s + w * +d[i], 0) % 11);
  return (r >= 10 ? 0 : r) === +d[10];
}

export function tituloValido(t: string): boolean {
  const d = so(t);
  if (d.length !== 12) return false;
  const uf = +d.slice(8, 10);
  if (uf < 1 || uf > 28) return false;
  const spmg = uf === 1 || uf === 2;
  const dv = (s: number) => {
    const r = s % 11;
    return r === 10 ? 0 : r === 0 && spmg ? 1 : r;
  };
  let s1 = 0;
  for (let i = 0; i < 8; i++) s1 += +d[i] * (i + 2);
  const dv1 = dv(s1);
  const dv2 = dv(+d[8] * 7 + +d[9] * 8 + dv1 * 9);
  return dv1 === +d[10] && dv2 === +d[11];
}

/* ---------------- texto ---------------- */

/**
 * Tira acentos e corrige trocas comuns do OCR dentro de números:
 * O→0, l/I→1, espaços soltos em volta de ponto e hífen ("529.982 .247-25"), e, num número com
 * pontos (12.345.678-9), uma barra no meio de um grupo de 3 → 7 (o 7 é lido como "/" com
 * frequência; datas não têm pontos e não são afetadas).
 */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/(?<=\d)[Oo](?=[\d.\-/ ]*\d)/g, "0")
    .replace(/(?<=\d)[lI|](?=[\d.\-/ ]*\d)/g, "1")
    .replace(/(?<=\d)[ \t]*([.\-])[ \t]*(?=\d)/g, "$1")
    .replace(/(?<=\d\.)[\d/]{3}(?=[.\-\s]|$)/gm, (g) => (g.split("/").length === 2 && /\d/.test(g[0]) ? g.replace("/", "7") : g))
    .replace(/[ \t]+/g, " ");
}

const unicos = (xs: string[]) => [...new Set(xs)];
const fmtCpf = (d: string) => d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6, 9) + "-" + d.slice(9);
const fmtPis = (d: string) => d.slice(0, 3) + "." + d.slice(3, 8) + "." + d.slice(8, 10) + "-" + d.slice(10);
const fmtTit = (d: string) => d.slice(0, 4) + " " + d.slice(4, 8) + " " + d.slice(8);
const fmtCep = (d: string) => d.slice(0, 5) + "-" + d.slice(5);

function todos(re: RegExp, t: string): RegExpExecArray[] {
  return [...t.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))];
}

export function acharCpfs(t: string): string[] {
  return unicos(todos(/(?<!\d)\d{3}[. ]?\d{3}[. ]?\d{3}[-. ]?\d{2}(?!\d)/, t).map((m) => so(m[0])).filter(cpfValido));
}

export function acharPis(t: string): string[] {
  const cpfs = new Set(acharCpfs(t));
  return unicos(
    todos(/(?<!\d)\d{3}[. ]?\d{5}[. ]?\d{2}[-. ]?\d(?!\d)/, t)
      .map((m) => so(m[0]))
      .filter((d) => pisValido(d) && !cpfs.has(d)),
  );
}

export function acharTitulos(t: string): string[] {
  return unicos(todos(/(?<!\d)\d{4} ?\d{4} ?\d{4}(?!\d)/, t).map((m) => so(m[0])).filter(tituloValido));
}

export function acharPassaportes(t: string): string[] {
  return unicos(todos(/(?<![A-Z0-9])[A-Z]{2}\d{6}(?![0-9])/, t.toUpperCase()).map((m) => m[0]));
}

/** CEPs: com hífen (00000-000) ou logo depois da palavra CEP. */
export function acharCeps(t: string): string[] {
  const com = todos(/(?<!\d)\d{5}-\d{3}(?!\d)/, t).map((m) => so(m[0]));
  const rot = todos(/CEP\W{0,4}(\d{5})[-. ]?(\d{3})(?!\d)/i, t).map((m) => m[1] + m[2]);
  return unicos(rot.concat(com));
}

const RG_NUM = "(?:\\d{1,3}\\.)?\\d{3}\\.?\\d{3}-?[0-9Xx]|\\d{5,14}";
/** Órgãos emissores mais comuns (o número do documento vem logo antes deles: "201234567 SSP SP"). */
const ORGAOS = "SSP|SDS|SESP|SEJUSP|SSPDS|SESDEC|DETRAN|IFP|IIRGD|IGP|ITEP|DGPC|PCMG|PC|DIC|DPF|MD|MEX|MAER";

/**
 * RG / documento de identidade (formato varia por estado):
 * 1º o número seguido do órgão emissor ("201234567 SSP SP", "201234567 DETRAN RJ");
 * 2º o primeiro número nos 120 caracteres depois de "Registro Geral", "RG" ou "Doc. Identidade"
 *    (o OCR costuma deixar lixo entre o rótulo e o número).
 */
export function acharRg(t: string, cpfs: string[]): string[] {
  const ok = (v: string) => {
    const d = v.replace(/[^\dX]/gi, "");
    return d.length >= 5 && !cpfs.includes(d);
  };
  // o órgão pode vir colado com a UF ("SSPSP", "SSP/SP")
  const comOrgao = todos(new RegExp("(?<![\\d.])(" + RG_NUM + ")[ \\t]*[-/]?[ \\t]*(?:" + ORGAOS + ")(?:[ \\t/-]*[A-Z]{2})?(?![A-Z])", "i"), t)
    .map((m) => m[1].toUpperCase())
    .filter(ok);
  if (comOrgao.length) return unicos(comOrgao);
  const out: string[] = [];
  for (const m of todos(/REGISTRO GERAL|DOC\.? ?(?:DE )?IDENTIDADE|IDENTIDADE|\bR\.? ?G\.?\b/i, t)) {
    const trecho = t.slice(m.index + m[0].length, m.index + m[0].length + 120);
    const n = new RegExp("(?<![\\d./])(" + RG_NUM + ")(?![\\d/])").exec(trecho);
    if (n && ok(n[1])) out.push(n[1].toUpperCase());
  }
  return unicos(out);
}

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);
/** "ANA DE SOUZA" → "Ana de Souza". */
export const nomeProprio = (s: string): string =>
  s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");

/**
 * Nome completo nas linhas de código do rodapé da CNH e do passaporte (zona de leitura mecânica):
 * "ANA<<MARIA<DE<SOUZA<<<<" → "Ana Maria de Souza". Ignora as linhas com números.
 */
export function acharNomesMrz(texto: string): string[] {
  const out: string[] = [];
  for (const linha of texto.toUpperCase().split(/\n/)) {
    const l = linha.replace(/\s/g, "").replace(/^P<[A-Z]{3}/, "");
    if (!/^[A-Z<]{12,44}$/.test(l) || !l.includes("<<")) continue;
    const partes = l.replace(/<+/g, " ").trim().split(" ");
    if (partes.length >= 2 && partes.every((p) => p.length >= 2 || MINUSCULAS.has(p.toLowerCase()))) out.push(nomeProprio(partes.join(" ")));
  }
  return unicos(out);
}

/* ---------------- validade ---------------- */

const MESES: Record<string, number> = {
  JAN: 1, FEB: 2, FEV: 2, MAR: 3, APR: 4, ABR: 4, MAY: 5, MAI: 5, JUN: 6, JUL: 7,
  AUG: 8, AGO: 8, SEP: 9, SET: 9, OCT: 10, OUT: 10, NOV: 11, DEC: 12, DEZ: 12,
};

/** Primeira data no trecho, como "AAAA-MM-DD" (dd/mm/aaaa, dd.mm.aaaa, dd-mm-aaaa ou "12 MAR 2027"). */
export function primeiraData(trecho: string): string | null {
  const num = /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?!\d)/.exec(trecho);
  const ext = /(?<!\d)(\d{1,2})[ \-/]?([A-Za-z]{3})[a-z]*\.?[ \-/,]*(\d{4})(?!\d)/.exec(trecho);
  const cands: { i: number; d: number; m: number; a: number }[] = [];
  if (num) cands.push({ i: num.index, d: +num[1], m: +num[2], a: +num[3] });
  if (ext && MESES[ext[2].toUpperCase()]) cands.push({ i: ext.index, d: +ext[1], m: MESES[ext[2].toUpperCase()], a: +ext[3] });
  cands.sort((x, y) => x.i - y.i);
  for (const c of cands) {
    const dt = new Date(Date.UTC(c.a, c.m - 1, c.d));
    if (c.a >= 2000 && c.a <= 2100 && dt.getUTCMonth() === c.m - 1 && dt.getUTCDate() === c.d) return dt.toISOString().slice(0, 10);
  }
  return null;
}

/** Validade: a data que vem logo depois de "validade", "válido até", "vencimento", "expiry"... (a mais distante, se houver várias). */
export function acharValidade(t: string): string | null {
  const datas: string[] = [];
  for (const m of todos(/valid[ao]?de|valid[oa]s? (ate|until|to)|vencimento|venc\.|expira|expiry|expiration|valid thru|data de validade/i, t)) {
    const d = primeiraData(t.slice(m.index + m[0].length, m.index + m[0].length + 60));
    if (d) datas.push(d);
  }
  return datas.length ? datas.sort().at(-1)! : null;
}

/* ---------------- por documento ---------------- */

function um(valores: string[], rotulo: string, fmt: (d: string) => string, avisos: string[]): string | undefined {
  if (valores.length === 1) return fmt(valores[0]);
  if (valores.length > 1) avisos.push("Encontrei mais de um " + rotulo + " no documento (" + valores.map(fmt).join(", ") + "). Preencha o certo.");
  return undefined;
}

/** Rótulo usado no aviso "Encontrei mais de um …" de cada campo. */
const ROTULO_AVISO: Record<CampoLido, string> = { nome: "nome", cpf: "CPF", rg: "RG", pis: "PIS", tit: "título", pass: "número de passaporte", cep: "CEP" };

/**
 * Junta a 1ª leitura (rápida) com a 2ª (detalhada): o que a 2ª achou vale mais, porque a imagem
 * foi lida ampliada e mais nítida; o que só a 1ª achou é mantido. Avisos de "mais de um" somem
 * quando o campo acabou preenchido.
 */
export function juntarLeituras(r1: Leitura, r2: Leitura): Leitura {
  const valores = { ...r1.valores, ...r2.valores };
  const validade = r2.validade ?? r1.validade;
  const resolvido = (a: string) =>
    (Object.keys(valores) as CampoLido[]).some((k) => a.startsWith("Encontrei mais de um " + ROTULO_AVISO[k] + " ")) ||
    (!!validade && /validade/i.test(a));
  const avisos = [...new Set([...r2.avisos, ...r1.avisos])].filter((a) => !resolvido(a));
  return validade ? { valores, validade, avisos } : { valores, avisos };
}

/** Campos principais de cada tipo: se a primeira leitura não achar algum, vale ler de novo com mais detalhe. */
export function faltamPrincipais(campo: string, r: Leitura): boolean {
  switch (tipoLeitura(campo)) {
    case "identidade":
      return !r.valores.cpf || !r.valores.rg;
    case "pis":
      return !r.valores.pis;
    case "titulo":
      return !r.valores.tit;
    case "passaporte":
      return !r.valores.pass;
    case "residencia":
      return !r.valores.cep;
    case "certificado":
      return !r.validade;
    default:
      return false;
  }
}

/** Campos devolvidos pela leitura com IA (mesmos nomes do servidor). */
export interface CamposIA {
  nome: string;
  cpf: string;
  rg: string;
  pis: string;
  titulo: string;
  passaporte: string;
  cep: string;
  validade: string;
}

/**
 * Converte a resposta da leitura com IA numa Leitura, com as mesmas garantias do leitor do navegador:
 * só os campos que fazem sentido para o documento anexado neste campo, e CPF, PIS e título apenas se
 * passarem nos dígitos verificadores (senão, um aviso pede para conferir).
 */
export function leituraDaIA(campo: string, ia: CamposIA): Leitura {
  const tipo = tipoLeitura(campo);
  const valores: Leitura["valores"] = {};
  const avisos: string[] = [];
  const s = (v: string | undefined) => (v || "").trim();
  const digitos = (k: CampoLido, bruto: string, n: number, ok: (d: string) => boolean, fmt: (d: string) => string, rotulo: string) => {
    const v = s(bruto);
    if (!v) return;
    const d = so(v);
    if (d.length === n && ok(d)) valores[k] = fmt(d);
    else avisos.push("O " + rotulo + " lido do documento (" + v + ") não confere. Preencha à mão.");
  };
  const nome = () => {
    const n = s(ia.nome).replace(/\s+/g, " ");
    if (n.split(" ").length >= 2) valores.nome = n === n.toUpperCase() ? nomeProprio(n) : n;
  };
  switch (tipo) {
    case "identidade":
      digitos("cpf", ia.cpf, 11, cpfValido, fmtCpf, "CPF");
      if (s(ia.rg)) valores.rg = s(ia.rg).toUpperCase();
      nome();
      break;
    case "pis":
      digitos("pis", ia.pis, 11, pisValido, fmtPis, "PIS");
      break;
    case "titulo":
      digitos("tit", ia.titulo, 12, tituloValido, fmtTit, "título");
      break;
    case "passaporte": {
      const p = s(ia.passaporte).toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (p.length >= 6 && p.length <= 9) valores.pass = p;
      nome();
      break;
    }
    case "residencia": {
      const d = so(s(ia.cep));
      if (d.length === 8) valores.cep = fmtCep(d);
      break;
    }
    case "certificado": {
      const v = s(ia.validade);
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
      if (m) {
        const [a, me, di] = [Number(m[1]), Number(m[2]), Number(m[3])];
        const dt = new Date(Date.UTC(a, me - 1, di));
        if (a >= 2000 && a <= 2100 && dt.getUTCMonth() === me - 1 && dt.getUTCDate() === di) return { valores, validade: v, avisos };
      }
      return { valores, avisos };
    }
  }
  return { valores, avisos };
}

/** O que dá para preencher a partir do texto do documento anexado no campo `campo`. */
export function extrairDoDocumento(campo: string, texto: string): Leitura {
  const tipo = tipoLeitura(campo);
  const t = normalizar(texto);
  const avisos: string[] = [];
  const valores: Leitura["valores"] = {};
  const por = (k: CampoLido, v: string | undefined) => {
    if (v) valores[k] = v;
  };
  switch (tipo) {
    case "identidade": {
      const cpfs = acharCpfs(t);
      por("cpf", um(cpfs, "CPF", fmtCpf, avisos));
      por("rg", um(acharRg(t, cpfs), "RG", (x) => x, avisos));
      por("nome", um(acharNomesMrz(t), "nome", (x) => x, avisos));
      break;
    }
    case "pis":
      por("pis", um(acharPis(t), "PIS", fmtPis, avisos));
      break;
    case "titulo":
      por("tit", um(acharTitulos(t), "título", fmtTit, avisos));
      break;
    case "passaporte":
      por("pass", um(acharPassaportes(t), "número de passaporte", (x) => x, avisos));
      por("nome", um(acharNomesMrz(t), "nome", (x) => x, avisos));
      break;
    case "residencia":
      por("cep", um(acharCeps(t), "CEP", fmtCep, avisos));
      break;
    case "certificado": {
      const v = acharValidade(t);
      return { valores, validade: v ?? undefined, avisos };
    }
  }
  return { valores, avisos };
}
