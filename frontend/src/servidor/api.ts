/** Chamadas ao servidor (mesmo protocolo do servidor Python de referência). */
import { MAXF } from "../dominio/documentos";
import type { Documento, Estado } from "../dominio/tipos";

export const URL_LOGIN = "/entrar";
export const URL_LOGOUT = "/auth/sair";

export class SessaoExpirada extends Error {
  constructor() {
    super("sessao");
  }
}

/** Usuário autenticado, mas sem acesso liberado (403). */
export class AcessoNegado extends Error {
  constructor() {
    super("acesso");
  }
}

/** Redireciona para o login da Microsoft (feito pelo back end em /entrar). */
export function irParaLogin(): void {
  location.href = URL_LOGIN;
}

export interface Usuario {
  login: string;
  nome: string;
  admin: boolean;
}

export interface RespostaEstado {
  versao: number;
  dados: Estado | null;
}

export async function api<T>(url: string, op: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = op.method || "GET";
  const h: Record<string, string> = { "X-Toveri": "1" };
  let body: BodyInit | undefined;
  if (op.body instanceof FormData) body = op.body;
  else if (op.body !== undefined) {
    h["Content-Type"] = "application/json";
    body = JSON.stringify(op.body);
  }
  const r = await fetch(url, { method, headers: h, body, credentials: "same-origin" });
  if (r.status === 401) {
    irParaLogin();
    throw new SessaoExpirada();
  }
  if (r.status === 403) throw new AcessoNegado();
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { detail?: string; erro?: string; title?: string };
    throw new Error(j.detail || j.erro || "Erro " + r.status);
  }
  return (await r.json()) as T;
}

export const obterUsuario = () => api<Usuario>("/api/me");
export const obterEstado = () => api<RespostaEstado>("/api/estado");
export const obterVersao = () => api<{ versao: number }>("/api/estado/versao");
export const enviarPatch = (patch: unknown[]) => api<RespostaEstado>("/api/estado/patch", { method: "POST", body: { patch } });

/** Envia um arquivo (até 20 MB) e devolve o documento com `fid`. */
export async function guardar(f: File): Promise<Documento> {
  if (f.size > MAXF) throw new Error("grande");
  const fd = new FormData();
  fd.append("arquivo", f);
  const r = await api<{ fid: string; name: string; size: number }>("/api/arquivos", { method: "POST", body: fd });
  return { name: r.name, size: r.size, fid: r.fid };
}

/** Baixa o conteúdo de um documento guardado no servidor. */
export async function blobDoc(d: Documento): Promise<Blob | null> {
  if (!d.fid) return null;
  try {
    const r = await fetch("/api/arquivos/" + encodeURIComponent(d.fid), { credentials: "same-origin" });
    if (r.status === 401) {
      irParaLogin();
      return null;
    }
    return r.ok ? await r.blob() : null;
  } catch {
    return null;
  }
}

/** Download normal do navegador (Blob + <a download>). */
export function baixar(filename: string, data: Blob | string, aoFalhar?: () => void): void {
  try {
    const b = data instanceof Blob ? data : new Blob([data], { type: "text/plain;charset=utf-8" }),
      u = URL.createObjectURL(b),
      a = document.createElement("a");
    a.href = u;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  } catch {
    aoFalhar?.();
  }
}
