/**
 * Formato dos dados compartilhados (o mesmo JSON do protótipo e do servidor).
 * Datas são números de dias desde 01/01/1970 (UTC), como no protótipo.
 * Textos digitados pelo usuário (nomes, cargo, barco...) ficam gravados com
 * escape HTML, como o protótipo faz; para exibir, use `unesc`.
 */

export interface Documento {
  /** Campo da ficha a que o documento pertence (ex.: "RG / CPF / CNH"); ausente em "Outros documentos". */
  campo?: string;
  name: string;
  size?: number;
  /** Identificador do arquivo no servidor (`/api/arquivos/{fid}`). */
  fid?: string;
  /** Campos do modo local do protótipo, mantidos só para leitura de dados antigos. */
  key?: string;
  data?: string;
  fsOk?: number;
  virt?: boolean;
}

export type ChaveVacina = "cov" | "dt" | "fa";

export interface Pessoa {
  id: number;
  name: string;
  role: string;
  setor?: string;
  boat?: number | null;
  embark?: number | null;
  dias?: number | null;
  dobra?: number;
  base?: number;
  fIni?: number | null;
  fFim?: number | null;
  docs?: Documento[];
  vac?: Partial<Record<ChaveVacina, number | null>>;
  rg?: string;
  cpf?: string;
  pass?: string;
  pis?: string;
  mae?: string;
  pai?: string;
  email?: string;
  cel?: string;
  cel2?: string;
  tit?: string;
  ctps?: string;
  escol?: string;
  ctf?: string;
  emerg?: string;
  rua?: string;
  num?: string;
  bairro?: string;
  cidade?: string;
  cep?: string;
  pasta?: string;
  /** Formato antigo: nome do barco em texto (convertido por `normalizar`). */
  unit?: string;
}

export interface Barco {
  id: number;
  name: string;
  tipo?: string;
  obs?: string;
}

export interface Curso {
  pid: number;
  name: string;
  valid: number;
}

export interface Embarque {
  pid: number;
  ini: number;
  dias: number;
  dobra?: number;
  boat?: number | null;
}

export interface Estado {
  people: Pessoa[];
  boats: Barco[];
  courses: Curso[];
  hist: Embarque[];
  resolved: string[];
  log: unknown[];
  [colecao: string]: unknown;
}

export const estadoVazio = (): Estado => ({ people: [], boats: [], courses: [], hist: [], resolved: [], log: [] });
