/**
 * Estado compartilhado e sincronização com o servidor, como o "modo servidor" do protótipo:
 * cada alteração gera um patch (diffEstado) enviado após 250 ms; a resposta é mesclada
 * com o que mudou localmente nesse meio tempo (receber); a cada 15 s confere a versão.
 */
import { normalizar } from "../dominio/escala";
import { aplicarPatch, clone, diffEstado, type Op } from "../dominio/patch";
import { estadoVazio, type Estado } from "../dominio/tipos";
import { SessaoExpirada, type RespostaEstado } from "./api";

export interface Transporte {
  enviarPatch(ops: Op[]): Promise<RespostaEstado>;
  obterVersao(): Promise<{ versao: number }>;
  obterEstado(): Promise<RespostaEstado>;
}

export interface Ambiente {
  /** Há algum diálogo aberto? (não atualiza enquanto o usuário edita) */
  dialogoAberto(): boolean;
  /** A aba está oculta? */
  oculto(): boolean;
}

export interface StatusSync {
  texto: string;
  erro: boolean;
}

type Ouvinte = () => void;

export class Sincronizador {
  S: Estado = estadoVazio();
  status: StatusSync = { texto: "", erro: false };
  private ebase: Record<string, unknown> | null = null;
  private versao = 0;
  private sync: Promise<void> | null = null;
  private tsync: ReturnType<typeof setTimeout> | null = null;
  private falhas = 0;
  private ouvintes = new Set<Ouvinte>();
  private t: Transporte;
  private amb: Ambiente;
  private debounce: number;

  constructor(t: Transporte, amb: Ambiente, debounce = 250) {
    this.t = t;
    this.amb = amb;
    this.debounce = debounce;
  }

  /** Começa com o estado lido do servidor (dados nulos = banco vazio, sem dados de exemplo). */
  iniciar(r: RespostaEstado): void {
    const d = r.dados;
    this.versao = r.versao;
    this.S = normalizar(d && d.people ? clone(d) : estadoVazio());
    this.ebase = d && d.people ? clone(d) : {};
    this.avisar();
    this.agendar();
  }

  assinar = (f: Ouvinte): (() => void) => {
    this.ouvintes.add(f);
    return () => this.ouvintes.delete(f);
  };

  obter = (): Estado => this.S;
  obterStatus = (): StatusSync => this.status;

  private avisar(): void {
    this.ouvintes.forEach((f) => f());
  }

  private mostrar(texto: string, erro = false): void {
    if (this.status.texto === texto && this.status.erro === erro) return;
    this.status = { texto, erro };
    this.avisar();
  }

  /** Altera o estado (numa cópia) e agenda o envio. */
  mutar<R>(fn: (S: Estado) => R): R {
    const novo = clone(this.S);
    const r = fn(novo);
    this.S = novo;
    this.avisar();
    this.agendar();
    return r;
  }

  /** Há alterações ainda não confirmadas pelo servidor? */
  pendente(): boolean {
    return !!this.sync || diffEstado(this.ebase, this.S as unknown as Record<string, unknown>).length > 0;
  }

  agendar(): void {
    if (!this.ebase) return;
    if (this.tsync) clearTimeout(this.tsync);
    this.tsync = setTimeout(() => {
      this.tsync = null;
      void this.sincronizar();
    }, this.debounce);
  }

  sincronizar(): Promise<void> {
    if (this.sync) {
      this.sync.then(() => this.agendar());
      return this.sync;
    }
    const ops = diffEstado(this.ebase, this.S as unknown as Record<string, unknown>);
    if (!ops.length) return Promise.resolve();
    const enviado = clone(this.S);
    this.mostrar("Salvando…");
    this.sync = (async () => {
      try {
        const r = await this.t.enviarPatch(ops);
        this.falhas = 0;
        this.receber(r, enviado);
        this.mostrar("");
      } catch (e) {
        if (e instanceof SessaoExpirada) return;
        this.falhas++;
        this.mostrar("Sem conexão: as alterações serão enviadas assim que possível.", true);
        setTimeout(() => this.agendar(), Math.min(30000, 3000 * this.falhas));
      } finally {
        this.sync = null;
      }
    })();
    return this.sync;
  }

  /** Recebe o estado do servidor e reaplica o que mudou aqui depois do envio. */
  receber(r: RespostaEstado, enviado: Estado | null): void {
    const extra = diffEstado((enviado || this.ebase) as Record<string, unknown> | null, this.S as unknown as Record<string, unknown>);
    this.versao = r.versao;
    const dados = (r.dados || {}) as Record<string, unknown>;
    this.ebase = clone(dados);
    const novo = normalizar(aplicarPatch(clone(dados), extra) as unknown as Estado),
      mudou = JSON.stringify(novo) !== JSON.stringify(this.S);
    if (mudou) {
      this.S = novo;
      this.avisar();
    }
    if (extra.length) this.agendar();
  }

  /** Confere se outro usuário alterou os dados (a cada 15 s e ao voltar para a aba). */
  async verificar(): Promise<void> {
    if (this.sync || (this.tsync && this.pendente()) || this.amb.oculto() || this.amb.dialogoAberto()) return;
    try {
      const v = await this.t.obterVersao();
      if (v.versao > this.versao) {
        const r = await this.t.obterEstado();
        if (!this.sync && !this.amb.dialogoAberto()) this.receber(r, null);
      }
    } catch {
      /* tenta de novo na próxima verificação */
    }
  }

  get versaoAtual(): number {
    return this.versao;
  }
}
