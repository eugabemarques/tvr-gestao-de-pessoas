/** Documentos e cursos obrigatórios por setor, pendências e ficha do colaborador. */
import { fmt } from "./datas";
import { nomeBarco } from "./escala";
import { unesc } from "./texto";
import type { ChaveVacina, Documento, Estado, Pessoa } from "./tipos";

export const BASE = [
  "RG / CPF / CNH",
  "Certidão de Nascimento / Certidão de casamento",
  "Título de Eleitor",
  "CTPS física (e CTPS digital)",
  "Passaporte (se tiver)",
  "Nº do PIS",
  "Comprovante de Residência",
  "Comprovante de Escolaridade",
  "Comprovante de Vacinação (Covid 19, DT, Febre Amarela)",
];

export interface Setor {
  nome: string;
  escala: boolean;
  docs: string[];
}

export const SETORES: Record<string, Setor> = {
  administrativo: { nome: "Administrativo", escala: false, docs: [] },
  ambiental: {
    nome: "Ambiental",
    escala: true,
    docs: ["CTF Ibama (atualizado)", "CBSP", "THUET / BOSIET / FOET", "Norueguês / OEUK / ENG1", "Certificado PAM", "Work Citation"],
  },
  manutencao: { nome: "Manutenção Offshore", escala: false, docs: [] },
};

export const setor = (s: string | undefined | null): Setor | undefined => (s && Object.prototype.hasOwnProperty.call(SETORES, s) ? SETORES[s] : undefined);
export const nomeSetor = (s: string | undefined | null): string => setor(s)?.nome || "";

export function docsDo(s: string | undefined | null): string[] {
  const x = setor(s);
  return x ? BASE.concat(x.docs) : [];
}

export const VACDOC = "Comprovante de Vacinação (Covid 19, DT, Febre Amarela)";
export const VACS: [ChaveVacina, string][] = [
  ["cov", "Covid-19"],
  ["dt", "DT (difteria e tétano)"],
  ["fa", "Febre amarela"],
];

/** Documento anexado a um item; a vacinação conta como anexada com os três comprovantes. */
export function docFor(docs: Documento[] | undefined, n: string): Documento | null | undefined {
  const d = (docs || []).find((x) => x.campo === n);
  if (d || n !== VACDOC) return d;
  return VACS.every((a) => (docs || []).some((x) => x.campo === "Vacina: " + a[1])) ? { name: "3 comprovantes na seção Vacinas", virt: true } : null;
}

export const opcDoc = (n: string): boolean => /se tiver/i.test(n) || n === "Nº do PIS";

export function pendDocs(p: Pick<Pessoa, "setor" | "docs">): string[] {
  return docsDo(p.setor).filter((n) => !opcDoc(n) && !docFor(p.docs, n));
}

export const CURSO_DOCS = ["CBSP", "THUET / BOSIET / FOET", "Norueguês / OEUK / ENG1", "Certificado PAM"];
export const reqCursos = (st: string): string[] => docsDo(st).filter((n) => CURSO_DOCS.includes(n));

/** Cursos da lista de escolha: [valor, rótulo]. */
export const CURSOS: [string, string][] = [
  ["CBSP", "CBSP"],
  ["THUET / BOSIET / FOET", "THUET / BOSIET / FOET"],
  ["MMO - Observação de Mamíferos Marinhos", "MMO - Observação de Mamíferos Marinhos"],
  ["MAP - Monitoramento Acústico Passivo", "MAP - Monitoramento Acústico Passivo"],
];

/** Campo do documento (certificado) de um curso. */
export const curCampo = (n: string): string => (/^ASO/i.test(n) ? "ASO" : SETORES.ambiental.docs.includes(n) ? n : "Curso: " + n);

export type SecaoFicha = "dados" | "cursos" | "vacinas";

/** Itens obrigatórios do setor e quantos faltam em cada seção da ficha. */
export function reqInfo(st: string, docs: Documento[]): { list: string[]; sec: Record<SecaoFicha, number> } {
  const sec: Record<SecaoFicha, number> = { dados: 0, cursos: 0, vacinas: 0 };
  if (!setor(st)) return { list: [], sec };
  const list = docsDo(st).filter((n) => !opcDoc(n));
  list.filter((n) => !docFor(docs, n)).forEach((n) => sec[CURSO_DOCS.includes(n) ? "cursos" : n === VACDOC ? "vacinas" : "dados"]++);
  return { list, sec };
}

/** O campo de anexo `campo` é obrigatório para o setor? (vacinas contam pelo comprovante de vacinação). */
export function campoObrigatorio(list: string[], campo: string): boolean {
  const req = new Set(list);
  return req.has(campo) || (req.has(VACDOC) && /^Vacina: /.test(campo));
}

export interface LinhaCurso {
  name: string;
  valid: number | null;
  req?: boolean;
}

/** Mantém as linhas de cursos obrigatórios do setor no topo da lista da ficha. */
export function syncReqCur(ccur: LinhaCurso[], st: string, docs: Documento[]): LinhaCurso[] {
  const req = reqCursos(st);
  const out = ccur.filter((r) => !r.req || req.includes(r.name) || r.valid != null || docs.some((d) => d.campo === curCampo(r.name))).map((r) => ({ ...r, req: req.includes(r.name) }));
  req
    .slice()
    .reverse()
    .forEach((n) => {
      if (!out.some((r) => r.name === n)) out.unshift({ name: n, valid: null, req: true });
    });
  return out;
}

/** Linhas da ficha do colaborador (pasta e Ficha.txt). Valores ainda com escape HTML. */
export function campos(S: Pick<Estado, "boats">, p: Pessoa): [string, string | undefined][] {
  return [
    ["Nome completo", p.name],
    ["Setor", nomeSetor(p.setor)],
    ["Cargo", p.role],
    ["Barco", nomeBarco(S, p.boat)],
    ["Férias", p.fIni != null ? fmt(p.fIni) + " a " + fmt(p.fFim as number) : ""],
    ["RG", p.rg],
    ["CPF", p.cpf],
    ["PIS", p.pis],
    ["Passaporte", p.pass],
    ["Nome da mãe", p.mae],
    ["Nome do pai", p.pai],
    ["E-mail", p.email],
    ["Celular", p.cel],
    ["Celular 2", p.cel2],
    ["Título de eleitor", p.tit],
    ["CTPS", p.ctps],
    ["Escolaridade", p.escol],
    ["CTF Ibama", p.ctf],
    ["Contato de emergência", p.emerg],
    ["Endereço", [p.rua && p.rua + (p.num ? ", " + p.num : ""), p.bairro, p.cidade, p.cep && "CEP " + p.cep].filter(Boolean).join(" - ")],
    ["Escala", p.embark == null ? "Sem escala" : p.dias + " dias a bordo e " + p.dias + " de folga"],
  ];
}

/** Conteúdo do arquivo ficha_<nome>.txt. */
export const fichaTexto = (S: Pick<Estado, "boats">, p: Pessoa): string =>
  campos(S, p)
    .map((a) => a[0] + ": " + (unesc(a[1] || "") || "—"))
    .join("\n");

/** Tamanho máximo de cada arquivo anexado. */
export const MAXF = 20 * 1048576;
export const MAXT = "20 MB";
export const ACEITOS = ".pdf,.png,.jpg,.jpeg,.webp";

export const erroArq = (nome: string, e: unknown): string =>
  "“" + nome + "” " + (e instanceof Error && e.message === "grande" ? "passa de " + MAXT + " e não foi anexado." : "não pôde ser guardado neste navegador.");
