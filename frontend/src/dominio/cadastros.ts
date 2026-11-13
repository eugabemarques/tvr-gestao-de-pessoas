/** Validações e gravações dos cadastros (colaborador, barco, curso/ASO, avisos). */
import { diaIso, toDay } from "./datas";
import { barco, novoId, pessoa } from "./escala";
import { curCampo, setor, VACS, type LinhaCurso } from "./documentos";
import { esc, unesc } from "./texto";
import type { ChaveVacina, Documento, Estado, Pessoa } from "./tipos";

/* ---------------- colaborador ---------------- */

export interface FormColab {
  nome: string;
  rg: string;
  cpf: string;
  pis: string;
  pass: string;
  mae: string;
  pai: string;
  email: string;
  cel: string;
  cel2: string;
  cargo: string;
  emerg: string;
  rua: string;
  num: string;
  bairro: string;
  cidade: string;
  cep: string;
  setor: string;
  tit: string;
  ctps: string;
  escol: string;
  ctf: string;
  barco: string;
  data: string;
  dias: string;
  fi: string;
  ff: string;
  vac: Record<ChaveVacina, string>;
}

/** Campos de texto: [campo do formulário, campo gravado]. */
const TEXTOS: [keyof FormColab, keyof Pessoa][] = [
  ["tit", "tit"],
  ["ctps", "ctps"],
  ["escol", "escol"],
  ["ctf", "ctf"],
  ["cel2", "cel2"],
  ["rg", "rg"],
  ["cpf", "cpf"],
  ["pass", "pass"],
  ["pis", "pis"],
  ["mae", "mae"],
  ["pai", "pai"],
  ["email", "email"],
  ["cel", "cel"],
  ["emerg", "emerg"],
  ["rua", "rua"],
  ["num", "num"],
  ["bairro", "bairro"],
  ["cidade", "cidade"],
  ["cep", "cep"],
];


/** Preenche o formulário da ficha (vazio para novo colaborador). */
export function formDe(S: Estado, p: Pessoa | null | undefined): FormColab {
  const f: FormColab = {
    nome: p ? unesc(p.name) : "",
    cargo: p ? unesc(p.role) : "",
    setor: (p && p.setor) || "",
    barco: p && barco(S, p.boat) ? String(p.boat) : "",
    data: p && p.embark != null ? diaIso(p.embark) : "",
    dias: String(p && p.dias ? p.dias : 42),
    fi: p ? diaIso(p.fIni) : "",
    ff: p ? diaIso(p.fFim) : "",
    vac: { cov: "", dt: "", fa: "" },
  } as FormColab;
  for (const [k, pk] of TEXTOS) (f as unknown as Record<string, string>)[k] = p && p[pk] ? unesc(p[pk]) : "";
  VACS.forEach(([k]) => {
    const x = p && p.vac && p.vac[k];
    f.vac[k] = x != null ? diaIso(x) : "";
  });
  return f;
}

export interface ErroForm {
  /** id do elemento a focar (como no protótipo: cnome, ccpf...). */
  campo: string;
  msg: string;
}

/** Validações da ficha na mesma ordem do protótipo; devolve a primeira que falhar. */
export function validarColab(f: FormColab): ErroForm | null {
  const v = (x: string) => x.trim(),
    dg = (x: string) => v(x).replace(/\D/g, "");
  const amb = !!setor(v(f.setor))?.escala,
    n = parseInt(f.dias) || 0;
  const checks: [string, boolean, string][] = [
    ["cnome", !!v(f.nome), "Informe o nome completo."],
    ["crg", !!v(f.rg), "Informe o RG."],
    ["ccpf", dg(f.cpf).length === 11, "O CPF precisa ter 11 números."],
    ["cpis", !dg(f.pis) || dg(f.pis).length === 11, "O PIS precisa ter 11 números (ou deixe em branco)."],
    ["cmae", !!v(f.mae), "Informe o nome da mãe."],
    ["cemail", /^\S+@\S+\.\S+$/.test(v(f.email)), "Informe um e-mail válido."],
    ["ccel", dg(f.cel).length >= 10, "Informe o celular com DDD."],
    ["csetor", !!v(f.setor), "Escolha o setor."],
    ["cemerg", !!v(f.emerg), "Informe o contato de emergência."],
    ["crua", !!v(f.rua), "Informe a rua."],
    ["cnum", !!v(f.num), "Informe o número do endereço."],
    ["ccep", dg(f.cep).length === 8, "O CEP precisa ter 8 números."],
    ["cdata", !amb || !!f.data, "No setor ambiental, informe a data de embarque da escala."],
    ["cdias", !amb || n >= 1, "No setor ambiental, informe os dias da escala."],
    ["cfi", !f.ff || !!f.fi, "Informe o início das férias."],
    ["cff", !f.fi || !!f.ff, "Informe o fim das férias."],
    ["cff", !f.fi || !f.ff || f.ff >= f.fi, "O fim das férias precisa ser depois do início."],
  ];
  const bad = checks.find((c) => !c[1]);
  return bad ? { campo: bad[0], msg: bad[2] } : null;
}

/** Linhas de curso incompletas: devolve o índice e a mensagem. */
export function validarCursosFicha(ccur: LinhaCurso[]): { i: number; msg: string; semNome: boolean } | null {
  const ci = ccur.findIndex((r) => !r.name || (r.valid == null && !r.req));
  if (ci < 0) return null;
  const semNome = !ccur[ci].name;
  return { i: ci, semNome, msg: semNome ? "Escolha o curso na linha " + (ci + 1) + " ou remova a linha." : "Informe a validade de " + ccur[ci].name + "." };
}

/** Grava o colaborador (novo ou edição) e os cursos da ficha. Muda o estado e devolve a pessoa. */
export function salvarColab(S: Estado, cedit: number | null, f: FormColab, docs: Documento[], ccur: LinhaCurso[], agora: number = Date.now()): Pessoa {
  const v = (x: string) => x.trim();
  const amb = !!setor(v(f.setor))?.escala,
    n = parseInt(f.dias) || 0;
  const hasEsc = amb && !!f.data && n >= 1;
  const d: Omit<Pessoa, "id"> = {
    name: esc(v(f.nome)),
    rg: esc(v(f.rg)),
    cpf: esc(v(f.cpf)),
    pass: esc(v(f.pass)),
    pis: esc(v(f.pis)),
    mae: esc(v(f.mae)),
    pai: esc(v(f.pai)),
    email: esc(v(f.email)),
    cel: esc(v(f.cel)),
    cel2: esc(v(f.cel2)),
    tit: esc(v(f.tit)),
    ctps: esc(v(f.ctps)),
    escol: esc(v(f.escol)),
    ctf: esc(v(f.ctf)),
    vac: Object.fromEntries(VACS.map(([k]) => [k, f.vac[k] ? toDay(f.vac[k]) : null])),
    setor: v(f.setor),
    emerg: esc(v(f.emerg)),
    rua: esc(v(f.rua)),
    num: esc(v(f.num)),
    bairro: esc(v(f.bairro)),
    cidade: esc(v(f.cidade)),
    cep: esc(v(f.cep)),
    role: esc(v(f.cargo)),
    boat: amb && f.barco ? +f.barco : null,
    fIni: f.fi ? toDay(f.fi) : null,
    fFim: f.ff ? toDay(f.ff) : null,
    embark: hasEsc ? toDay(f.data) : null,
    dias: hasEsc ? n : null,
    docs,
  };
  let p: Pessoa;
  if (cedit) {
    p = pessoa(S, cedit) as Pessoa;
    if (p.embark !== d.embark || p.dias !== d.dias) p.dobra = 0;
    Object.assign(p, d);
  } else {
    const nid = novoId(S.people, agora);
    p = { id: nid, ...d, dobra: 0, base: d.dias || 42 };
    S.people.push(p);
    if (d.embark != null) (S.hist = S.hist || []).push({ pid: nid, ini: d.embark, dias: d.dias as number, dobra: 0, boat: d.boat });
  }
  const pf = p.id;
  S.courses = S.courses.filter((c) => c.pid != pf).concat(ccur.filter((r) => r.valid != null).map((r) => ({ pid: pf, name: r.name, valid: r.valid as number })));
  return p;
}

export function removerColab(S: Estado, id: number): void {
  S.people = S.people.filter((p) => p.id != id);
  S.courses = S.courses.filter((c) => c.pid != id);
}

/* ---------------- barco ---------------- */

export interface FormBarco {
  nome: string;
  tipo: string;
  obs: string;
}

export function validarBarco(S: Estado, bedit: number | null, f: FormBarco): string | null {
  const n = f.nome.trim();
  if (!n) return "Informe o nome do barco.";
  if ((S.boats || []).some((b) => b.id !== bedit && unesc(b.name).toLowerCase() === n.toLowerCase())) return "Já existe um barco com esse nome.";
  return null;
}

export function salvarBarco(S: Estado, bedit: number | null, f: FormBarco, agora: number = Date.now()): void {
  const d = { name: esc(f.nome.trim()), tipo: esc(f.tipo.trim()), obs: esc(f.obs.trim()) };
  S.boats = S.boats || [];
  const b = bedit ? barco(S, bedit) : null;
  if (b) Object.assign(b, d);
  else S.boats.push({ id: novoId(S.boats, agora), ...d });
}

/** Quantos tripulantes ficarão sem barco ao remover. */
export const tripulantesDoBarco = (S: Estado, id: number): number => S.people.filter((p) => p.boat == id).length;

export const avisoRemoverBarco = (k: number): string => (k ? k + (k > 1 ? " tripulantes ficarão" : " tripulante ficará") + " sem barco definido." : "");

export function removerBarco(S: Estado, id: number): void {
  S.people.forEach((p) => {
    if (p.boat == id) p.boat = null;
  });
  S.boats = S.boats.filter((b) => b.id !== id);
}

/* ---------------- curso / ASO ---------------- */

/** Validação do diálogo de curso; devolve a mensagem de erro. */
export function validarCurso(S: Estado, novo: boolean, aso: boolean, nome: string, pid: number, validade: string): string | null {
  if (!nome) return aso ? "Informe o nome." : "Escolha o curso.";
  if (novo && !aso && S.courses.some((x) => x.pid == pid && x.name === nome)) return "Este colaborador já tem esse curso cadastrado. Use “Editar” para atualizar a validade.";
  if (!validade) return "Informe a validade.";
  return null;
}

/**
 * Grava o curso. `chaveOriginal` (pid|nome) identifica o curso em edição.
 * O documento anexado substitui o anterior do mesmo campo.
 */
export function salvarCurso(S: Estado, chaveOriginal: string | null, pid: number, nome: string, valid: number, doc: Documento | null): void {
  const c = chaveOriginal == null ? null : S.courses.find((x) => x.pid + "|" + x.name === chaveOriginal) || null;
  const p = pessoa(S, c ? c.pid : pid);
  if (c) {
    c.name = nome;
    c.valid = valid;
  } else S.courses.push({ pid: (p ? p.id : pid) as number, name: nome, valid });
  if (doc && p) {
    const campo = curCampo(nome);
    p.docs = (p.docs || []).filter((d) => d.campo !== campo).concat([{ campo, ...doc }]);
  }
}

export function removerCurso(S: Estado, chave: string): void {
  const i = S.courses.findIndex((x) => x.pid + "|" + x.name === chave);
  if (i >= 0) S.courses.splice(i, 1);
}

/* ---------------- avisos ---------------- */

export function marcarResolvido(S: Estado, key: string, resolvido: boolean): void {
  S.resolved = S.resolved || [];
  if (resolvido) S.resolved.push(key);
  else S.resolved = S.resolved.filter((k) => k !== key);
}
