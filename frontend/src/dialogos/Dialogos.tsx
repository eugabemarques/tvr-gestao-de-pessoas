/** Diálogos menores: informação, avisos, conta, dobra, barco, curso/ASO e pasta do colaborador. */
import { useState } from "react";
import { Chip, Dialogo } from "../componentes/Comuns";
import { avisoRemoverBarco, marcarResolvido, removerBarco, removerCurso, salvarBarco, salvarCurso, tripulantesDoBarco, validarBarco, validarCurso } from "../dominio/cadastros";
import { diaIso, fmt, toDay } from "../dominio/datas";
import { ACEITOS, campos, CURSOS, docFor, docsDo, erroArq, fichaTexto, opcDoc, setor } from "../dominio/documentos";
import { adicionarDobra, barco, cycle, pessoa, previaDobra } from "../dominio/escala";
import { nomeArquivoFicha, unesc } from "../dominio/texto";
import { avisos, isAso } from "../dominio/validade";
import type { Documento } from "../dominio/tipos";
import { loja, T, toast, useEstado } from "../loja";
import { baixar, blobDoc, guardar, URL_LOGOUT, type Usuario } from "../servidor/api";

type Fechar = { aoFechar: () => void };

export function Info({ aberto, titulo, texto, aoFechar }: Fechar & { aberto: boolean; titulo: string; texto: string }) {
  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} rotulo="t-in">
      <h2 id="t-in">{titulo}</h2>
      <p id="tx-in">{texto}</p>
      <div className="row">
        <button className="ghost" id="infechar" type="button" onClick={aoFechar}>
          Fechar
        </button>
      </div>
    </Dialogo>
  );
}

/** Lista de avisos do sino (pendentes e resolvidos). */
export function ListaAvisos() {
  const S = useEstado();
  const al = avisos(S, T);
  const pend = al.filter((a) => !a.res),
    done = al.filter((a) => a.res);
  const texto = (a: (typeof al)[number]) => (
    <div style={{ flex: 1 }}>
      <b>{unesc(a.pessoa.name)}</b>
      {": " + a.curso + " " + (a.vencido ? "já está vencido" : "vence em " + fmt(a.valid)) + ", antes do fim do embarque (" + fmt(a.fim) + ")."}
    </div>
  );
  const marcar = (key: string, r: boolean) => loja.mutar((E) => marcarResolvido(E, key, r));
  return (
    <div id="alertas">
      {pend.length ? (
        pend.map((a) => (
          <div className={"alert" + (a.bad ? "" : " w")} key={a.key}>
            {texto(a)}
            <button className="ghost" onClick={() => marcar(a.key, true)}>
              Resolvido
            </button>
          </div>
        ))
      ) : (
        <p className="empty">Nenhum aviso no momento.</p>
      )}
      {done.length ? (
        <details className="done">
          <summary>{"Resolvidos (" + done.length + ")"}</summary>
          {done.map((a) => (
            <div className="alert ok" key={a.key}>
              {texto(a)}
              <button className="ghost" onClick={() => marcar(a.key, false)}>
                Reabrir
              </button>
            </div>
          ))}
        </details>
      ) : null}
    </div>
  );
}

export function Avisos({ aberto, aoFechar }: Fechar & { aberto: boolean }) {
  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} rotulo="t-al">
      <h2 id="t-al">Avisos do sistema</h2>
      <p className="mute">Cursos que vencem durante um embarque em curso ou previsto para os próximos 30 dias.</p>
      <ListaAvisos />
      <div className="row">
        <button className="ghost" id="afechar" type="button" onClick={aoFechar}>
          Fechar
        </button>
      </div>
    </Dialogo>
  );
}

export function Conta({ aberto, usuario, aoFechar }: Fechar & { aberto: boolean; usuario: Usuario }) {
  const [saindo, setSaindo] = useState(false);
  const sair = async () => {
    setSaindo(true);
    try {
      await loja.sincronizar();
    } catch {
      /* segue para a saída */
    }
    location.href = URL_LOGOUT;
  };
  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} rotulo="t-ps">
      <h2 id="t-ps">Sua conta</h2>
      <p id="psnome" style={{ margin: "0 0 16px" }}>
        {usuario.nome + " · usuário " + usuario.login}
      </p>
      <div className="row">
        <button id="bsair" type="button" disabled={saindo} onClick={sair}>
          Sair
        </button>
        <button className="ghost" id="psfechar" type="button" onClick={aoFechar}>
          Fechar
        </button>
      </div>
    </Dialogo>
  );
}

/* ---------------- dobra ---------------- */

function CorpoDobra({ id, aoFechar }: Fechar & { id: number }) {
  const S = useEstado();
  const [pid, setPid] = useState(String(id));
  const [dias, setDias] = useState("7");
  const embarcados = S.people.filter((p) => p.embark != null && cycle(p, T).st === "aboard");
  const pidEf = embarcados.some((p) => String(p.id) === pid) ? pid : embarcados.length ? String(embarcados[0].id) : "";
  const p = pessoa(S, pidEf),
    n = Math.max(1, parseInt(dias) || 0);
  const salvar = () => {
    const nd = parseInt(dias);
    if (!p || !nd || nd < 1) {
      document.getElementById("ddias")?.focus();
      return;
    }
    loja.mutar((E) => adicionarDobra(E, p.id, nd, T));
    aoFechar();
    toast("Dobra de " + nd + " dias adicionada para " + unesc(p.name) + ".");
  };
  let res;
  if (!p) res = <p className="empty">Nenhum colaborador está embarcado hoje.</p>;
  else {
    const c = cycle(p, T),
      r = previaDobra(c, n);
    res = (
      <>
        <h3>{r.L2 + " dias a bordo"}</h3>
        <p>{r.L + " dias do embarque atual + " + n + " de dobra. A folga passa a ser de " + r.L2 + " dias."}</p>
        <div className="facts">
          <div>
            <b>{fmt(r.ultimoBordo)}</b>
            <span>Novo último dia a bordo</span>
          </div>
          <div>
            <b>{fmt(r.ultimoFolga)}</b>
            <span>Último dia de folga</span>
          </div>
          <div>
            <b>{fmt(r.proximo)}</b>
            <span>Próximo embarque</span>
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      <h2 id="t-dobra">Adicionar dobra</h2>
      <div className="reg">
        <div>
          <label>
            Colaborador embarcado
            <select id="dpessoa" value={pidEf} onChange={(e) => setPid(e.target.value)}>
              {embarcados.map((x) => (
                <option key={x.id} value={x.id}>
                  {unesc(x.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dias de dobra
            <input type="number" id="ddias" min="1" max="60" value={dias} onChange={(e) => setDias(e.target.value)} />
          </label>
          <div className="row">
            <button id="dsalvar" onClick={salvar}>
              Adicionar dobra
            </button>
            <button className="ghost" id="dfechar" type="button" onClick={aoFechar}>
              Cancelar
            </button>
          </div>
        </div>
        <div className="res" aria-live="polite" id="dres">
          {res}
        </div>
      </div>
    </>
  );
}

export function Dobra({ id, aoFechar }: Fechar & { id: number | null }) {
  return (
    <Dialogo aberto={id != null} aoFechar={aoFechar} rotulo="t-dobra" foco="#ddias" selecionar>
      {id != null ? <CorpoDobra id={id} aoFechar={aoFechar} /> : null}
    </Dialogo>
  );
}

/* ---------------- barco ---------------- */

function CorpoBarco({ id, aoFechar }: Fechar & { id: number | null }) {
  const S = useEstado();
  const b = id ? barco(S, id) : null;
  const [nome, setNome] = useState(b ? unesc(b.name) : "");
  const [tipo, setTipo] = useState(b ? unesc(b.tipo || "") : "");
  const [obs, setObs] = useState(b ? unesc(b.obs || "") : "");
  const [err, setErr] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const bedit = b ? b.id : null;

  const salvar = () => {
    const f = { nome, tipo, obs };
    const e = validarBarco(S, bedit, f);
    if (e) {
      setErr(e);
      document.getElementById("bnome")?.focus();
      return;
    }
    loja.mutar((E) => salvarBarco(E, bedit, f));
    aoFechar();
    toast(bedit ? "Barco atualizado." : "Barco adicionado.");
  };
  const remover = () => {
    if (bedit == null) return;
    if (!confirmar) {
      setConfirmar(true);
      const m = avisoRemoverBarco(tripulantesDoBarco(S, bedit));
      if (m) setErr(m);
      return;
    }
    loja.mutar((E) => removerBarco(E, bedit));
    aoFechar();
    toast("Barco removido.");
  };
  return (
    <>
      <h2 id="t-bo">{b ? "Editar barco" : "Novo barco"}</h2>
      <label>
        Nome
        <input id="bnome" autoComplete="off" value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      <label>
        Tipo (opcional)
        <input id="btipo" autoComplete="off" placeholder="Ex.: PSV, OSRV, AHTS" value={tipo} onChange={(e) => setTipo(e.target.value)} />
      </label>
      <label>
        Observações (opcional)
        <input id="bobs" autoComplete="off" value={obs} onChange={(e) => setObs(e.target.value)} />
      </label>
      <p id="berr" role="alert" style={{ color: "var(--bad)", margin: "0 0 10px", fontWeight: 600 }}>
        {err}
      </p>
      <div className="row">
        <button id="bsalvar" type="button" onClick={salvar}>
          Salvar
        </button>
        <button className="ghost" id="bfechar" type="button" onClick={aoFechar}>
          Cancelar
        </button>
        <button className="ghost" id="bremover" type="button" hidden={!b} onClick={remover}>
          {confirmar ? "Confirmar remoção" : "Remover"}
        </button>
      </div>
    </>
  );
}

export function BarcoDialogo({ aberto, id, aoFechar }: Fechar & { aberto: boolean; id: number | null }) {
  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} rotulo="t-bo" foco="#bnome">
      <CorpoBarco id={id} aoFechar={aoFechar} />
    </Dialogo>
  );
}

/* ---------------- curso / ASO ---------------- */

function CorpoCurso({ chave, tipo, aoFechar }: Fechar & { chave: string | null; tipo: "c" | "a" }) {
  const S = useEstado();
  const [c] = useState(() => (chave == null ? null : S.courses.find((x) => x.pid + "|" + x.name === chave) || null));
  const aso = c ? isAso(c) : tipo === "a";
  const [pid, setPid] = useState(c ? String(c.pid) : S.people.length ? String(S.people[0].id) : "");
  const [curn] = useState(c ? c.name : aso ? "ASO" : "");
  const [curs, setCurs] = useState(c && !aso ? c.name : "");
  const [validade, setValidade] = useState(c ? diaIso(c.valid) : "");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [confirmar, setConfirmar] = useState(false);

  const opcoes = CURSOS.slice();
  if (c && !aso && !CURSOS.some((x) => x[0] === c.name)) opcoes.push([c.name, c.name + " (nome antigo)"]);

  const salvar = async () => {
    const nome = aso ? curn.trim() : curs,
      p = +pid;
    const e = validarCurso(S, !c, aso, nome, p, validade);
    if (e) {
      setErr(e);
      if (!nome) document.getElementById(aso ? "curn" : "curs")?.focus();
      return;
    }
    if (!c && !pessoa(S, p)) {
      setErr("Cadastre um colaborador primeiro.");
      return;
    }
    let doc: Documento | null = null;
    if (arquivo) {
      try {
        doc = await guardar(arquivo);
      } catch (x) {
        setErr(erroArq(arquivo.name, x));
        return;
      }
    }
    loja.mutar((E) => salvarCurso(E, chave, c ? c.pid : p, nome, toDay(validade), doc));
    aoFechar();
    toast(c ? "Atualizado." : "Adicionado.");
  };
  const remover = () => {
    if (!confirmar) {
      setConfirmar(true);
      return;
    }
    if (chave) loja.mutar((E) => removerCurso(E, chave));
    aoFechar();
    toast("Removido.");
  };

  return (
    <>
      <h2 id="t-cr">{(c ? "Editar " : "Novo ") + (aso ? "ASO" : "curso")}</h2>
      <label>
        Colaborador
        <select id="curp" value={pid} disabled={!!c} onChange={(e) => setPid(e.target.value)}>
          {S.people.map((p) => (
            <option key={p.id} value={p.id}>
              {unesc(p.name)}
            </option>
          ))}
        </select>
      </label>
      <label id="curnl" hidden={!aso}>
        Nome
        <input id="curn" autoComplete="off" value={curn} readOnly />
      </label>
      <label id="cursl" hidden={aso}>
        Curso
        <select id="curs" value={curs} onChange={(e) => setCurs(e.target.value)}>
          {c ? null : <option value="">Escolha o curso</option>}
          {opcoes.map((x) => (
            <option key={x[0]} value={x[0]}>
              {x[1]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Validade
        <input type="date" id="curv" value={validade} onChange={(e) => setValidade(e.target.value)} />
      </label>
      <label>
        Anexar documento novo (PDF ou imagem, até 20 MB)
        <input type="file" id="curf" accept={ACEITOS} onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
      </label>
      <p className="mute" id="curm">
        O documento anexado será salvo na ficha e na pasta do colaborador.
      </p>
      <p id="curerr" role="alert" style={{ color: "var(--bad)", margin: "0 0 10px", fontWeight: 600 }}>
        {err}
      </p>
      <div className="row">
        <button id="cursalvar" type="button" onClick={salvar}>
          Salvar
        </button>
        <button className="ghost" id="curfechar" type="button" onClick={aoFechar}>
          Cancelar
        </button>
        <button className="ghost" id="curremover" type="button" hidden={!c} onClick={remover}>
          {confirmar ? "Confirmar remoção" : "Remover"}
        </button>
      </div>
    </>
  );
}

export function CursoDialogo({ aberto, chave, tipo, aoFechar }: Fechar & { aberto: boolean; chave: string | null; tipo: "c" | "a" }) {
  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} rotulo="t-cr">
      <CorpoCurso chave={chave} tipo={tipo} aoFechar={aoFechar} />
    </Dialogo>
  );
}

/* ---------------- pasta do colaborador ---------------- */

function CorpoPasta({ id, aoFechar }: Fechar & { id: number }) {
  const S = useEstado();
  const p = pessoa(S, id);
  if (!p) {
    return (
      <>
        <h2 id="t-pa">Pasta do colaborador</h2>
        <p className="empty">Colaborador não encontrado.</p>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="ghost" type="button" id="pfechar" onClick={aoFechar}>
            Fechar
          </button>
        </div>
      </>
    );
  }
  const docs = p.docs || [];
  const baixarDoc = (f: Documento) =>
    blobDoc(f).then((b) => (b ? baixar(f.name, b, () => toast("Não foi possível baixar o arquivo.")) : toast("Arquivo não encontrado neste navegador.")));
  return (
    <>
      <h2 id="t-pa">{"Pasta de " + unesc(p.name)}</h2>
      <div id="pbody">
        {campos(S, p).map((a) => (
          <div className="pf" key={a[0]}>
            <span className="mute">{a[0]}</span>
            <span>{unesc(a[1] || "") || "—"}</span>
          </div>
        ))}
        <h3 style={{ margin: "16px 0 6px", fontSize: 16 }}>Documentos obrigatórios do setor</h3>
        {setor(p.setor) ? (
          docsDo(p.setor).map((n) => {
            const d = docFor(p.docs, n);
            return (
              <div className="pf" key={n}>
                <span className="mute">{n}</span>
                <span>{d ? <Chip k="ok">Anexado</Chip> : opcDoc(n) ? <span className="mute">Opcional</span> : <Chip k="warn">Pendente</Chip>}</span>
              </div>
            );
          })
        ) : (
          <p className="empty">Setor não definido.</p>
        )}
        <h3 style={{ margin: "16px 0 6px", fontSize: 16 }}>Documentos anexados</h3>
        {docs.length ? (
          docs.map((f, i) => (
            <div className="pf" key={i}>
              <span className="mute">{f.campo ? f.campo : "Outros"}</span>
              <span>
                {f.name}{" "}
                <button className="ghost" type="button" onClick={() => void baixarDoc(f)}>
                  Baixar
                </button>
              </span>
            </div>
          ))
        ) : (
          <p className="empty">Nenhum documento anexado.</p>
        )}
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button type="button" id="pficha" onClick={() => baixar(nomeArquivoFicha(p.name), fichaTexto(S, p), () => toast("Não foi possível baixar o arquivo."))}>
          Baixar ficha (.txt)
        </button>
        <button className="ghost" type="button" id="pfechar" onClick={aoFechar}>
          Fechar
        </button>
      </div>
    </>
  );
}

export function Pasta({ id, aoFechar }: Fechar & { id: number | null }) {
  return (
    <Dialogo aberto={id != null} aoFechar={aoFechar} rotulo="t-pa">
      {id != null ? <CorpoPasta id={id} aoFechar={aoFechar} /> : null}
    </Dialogo>
  );
}
