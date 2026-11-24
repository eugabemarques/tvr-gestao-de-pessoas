/** Diálogos menores: informação, avisos, conta, dobra, barco, curso/ASO e pasta do colaborador. */
import { useState } from "react";
import { Chip, Dialogo } from "../componentes/Comuns";
import { useAcoes } from "../acoes";
import { avisoRemoverBarco, cadastrosIncompletos, marcarResolvido, removerBarco, removerCurso, salvarBarco, salvarCurso, tripulantesDoBarco, validarBarco, validarCurso } from "../dominio/cadastros";
import { DATA_MAX, diaIso, fmt, toDay } from "../dominio/datas";
import { ACEITOS, campos, campoToveri, CURSOS, docFor, docsDo, docsToveriDo, erroArq, fichaTexto, opcDoc, setor } from "../dominio/documentos";
import { adicionarDobra, barco, cycle, pessoa, podeDarDobra, previaDobra } from "../dominio/escala";
import { nomeArquivoFicha, porNome, unesc } from "../dominio/texto";
import { ANOS_NORUEGUES, avisos, isAso, isNoruegues, NORUEGUES, validadeNoruegues } from "../dominio/validade";
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

/** Lista de avisos do sino (pendentes e resolvidos) e cadastros incompletos. */
export function ListaAvisos({ aoAbrirFicha }: { aoAbrirFicha?: (id: number) => void }) {
  const S = useEstado();
  const al = avisos(S, T);
  const inc = cadastrosIncompletos(S);
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
      {inc.length ? (
        <>
          <h4 className="fh4">{"Cadastros incompletos (" + inc.length + ")"}</h4>
          {inc.map((x) => (
            <div className="alert w" key={"inc|" + x.pessoa.id}>
              <div style={{ flex: 1 }}>
                <b>{unesc(x.pessoa.name)}</b>
                {": falta " + x.falta.join(", ") + "."}
              </div>
              {aoAbrirFicha ? (
                <button className="ghost" onClick={() => aoAbrirFicha(x.pessoa.id)}>
                  Abrir ficha
                </button>
              ) : null}
            </div>
          ))}
          <h4 className="fh4">Cursos e ASO</h4>
        </>
      ) : null}
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
  const { abrirColab } = useAcoes();
  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} rotulo="t-al">
      <h2 id="t-al">Avisos do sistema</h2>
      <p className="mute">Cadastros com informações faltando e cursos que vencem durante um embarque em curso ou previsto para os próximos 30 dias.</p>
      <ListaAvisos
        aoAbrirFicha={(id) => {
          aoFechar();
          abrirColab(id);
        }}
      />
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
  // a bordo, no translado de volta ou de folga: a dobra vai para o embarque do ciclo atual
  const embarcados = porNome(S.people).filter((p) => p.embark != null && podeDarDobra(cycle(p, T)));
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
  if (!p) res = <p className="empty">Nenhum colaborador a bordo ou de folga hoje.</p>;
  else {
    const c = cycle(p, T),
      r = previaDobra(c, n);
    res = (
      <>
        <h3>{r.L2 + " dias a bordo"}</h3>
        <p>
          {r.L +
            (c.st === "aboard" ? " dias do embarque atual" : " dias do embarque de " + fmt(c.start) + " a " + fmt(c.e.ultimoBordo)) +
            " + " +
            n +
            " de dobra. A folga passa a ser de " +
            r.L2 +
            " dias."}
        </p>
        {c.st !== "aboard" ? (
          <p className="mute" style={{ marginTop: -6 }}>
            {"Hoje " + unesc(p.name) + " está " + (c.st === "rest" ? "de folga" : "no translado de volta") + ": a dobra vale para esse último embarque e a folga é recalculada a partir do novo último dia a bordo."}
          </p>
        ) : null}
        {c.st !== "aboard" && r.ultimoBordo >= T ? (
          <p className="ferr" role="alert">
            {"Atenção: com " + n + " dias de dobra, o último dia a bordo (" + fmt(r.ultimoBordo) + ") passa de hoje e " + unesc(p.name) + " volta a aparecer como embarcado. Confira os dias."}
          </p>
        ) : null}
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
            Colaborador (a bordo ou de folga)
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

function CorpoCurso({ chave, tipo, aoFechar }: Fechar & { chave: string | null; tipo: "c" | "a" | "n" }) {
  const S = useEstado();
  const [c] = useState(() => (chave == null ? null : S.courses.find((x) => x.pid + "|" + x.name === chave) || null));
  const aso = c ? isAso(c) : tipo === "a";
  const nor = c ? isNoruegues(c) : tipo === "n";
  // exames (ASO e Norueguês) têm o nome fixo; cursos são escolhidos na lista
  const exame = aso || nor;
  const [pid, setPid] = useState(c ? String(c.pid) : S.people.length ? String(S.people[0].id) : "");
  const [curn] = useState(c ? c.name : aso ? "ASO" : nor ? NORUEGUES : "");
  const [curs, setCurs] = useState(c && !exame ? c.name : "");
  const [validade, setValidade] = useState(c ? diaIso(c.valid) : "");
  const [dataExame, setDataExame] = useState(c && c.exame != null ? diaIso(c.exame) : "");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [confirmar, setConfirmar] = useState(false);

  const opcoes = CURSOS.slice();
  if (c && !exame && !CURSOS.some((x) => x[0] === c.name)) opcoes.push([c.name, c.name + " (nome antigo)"]);

  const salvar = async () => {
    const nome = exame ? curn.trim() : curs,
      p = +pid;
    const e = validarCurso(S, !c, aso, nome, p, validade);
    if (e) {
      setErr(e);
      if (!nome) document.getElementById(exame ? "curn" : "curs")?.focus();
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
    loja.mutar((E) => salvarCurso(E, chave, c ? c.pid : p, nome, toDay(validade), doc, nor && dataExame ? toDay(dataExame) : null));
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
      <h2 id="t-cr">{(c ? "Editar " : "Novo ") + (aso ? "ASO" : nor ? "Norueguês" : "curso")}</h2>
      <label>
        Colaborador
        <select id="curp" value={pid} disabled={!!c} onChange={(e) => setPid(e.target.value)}>
          {porNome(S.people).map((p) => (
            <option key={p.id} value={p.id}>
              {unesc(p.name)}
            </option>
          ))}
        </select>
      </label>
      <label id="curnl" hidden={!exame}>
        Nome
        <input id="curn" autoComplete="off" value={curn} readOnly />
      </label>
      {nor ? (
        <label>
          Data do exame
          <input
            type="date" max={DATA_MAX}
            id="curx"
            value={dataExame}
            onChange={(e) => {
              setDataExame(e.target.value);
              if (e.target.value) setValidade(diaIso(validadeNoruegues(toDay(e.target.value))));
            }}
          />
          <span className="mute" style={{ fontSize: 13 }}>
            {"A validade é calculada sozinha: " + ANOS_NORUEGUES + " anos depois do exame (pode ser ajustada)."}
          </span>
        </label>
      ) : null}
      <label id="cursl" hidden={exame}>
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
        <input type="date" max={DATA_MAX} id="curv" value={validade} onChange={(e) => setValidade(e.target.value)} />
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

export function CursoDialogo({ aberto, chave, tipo, aoFechar }: Fechar & { aberto: boolean; chave: string | null; tipo: "c" | "a" | "n" }) {
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
  const [montando, setMontando] = useState(false);
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
  const falhaDown = () => toast("Não foi possível baixar o arquivo.");
  const baixarPdf = async () => {
    try {
      const { gerarFichaPdf } = await import("./fichaPdf");
      const r = await gerarFichaPdf(S, p, T);
      baixar(nomeArquivoFicha(p.name).replace(/\.txt$/, ".pdf"), new Blob([r.bytes], { type: "application/pdf" }), falhaDown);
    } catch (e) {
      console.warn("Ficha em PDF", e);
      toast("Não foi possível gerar o PDF. Tente de novo.");
    }
  };
  const baixarDossie = async () => {
    setMontando(true);
    toast("Montando o dossiê com " + docs.length + (docs.length === 1 ? " documento" : " documentos") + "…");
    try {
      const { gerarDossie } = await import("./dossiePdf");
      const r = await gerarDossie(S, p, T);
      baixar(nomeArquivoFicha(p.name).replace(/^ficha_/, "dossie_").replace(/\.txt$/, ".pdf"), r.blob, falhaDown);
      toast(r.falhas.length ? "Dossiê baixado, mas não foi possível incluir: " + r.falhas.join(", ") + ". Baixe esses arquivos pela pasta." : "Dossiê baixado.");
    } catch (e) {
      console.warn("Dossiê", e);
      toast("Não foi possível montar o dossiê. Tente de novo.");
    } finally {
      setMontando(false);
    }
  };
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
        {docsToveriDo(p.setor).length ? (
          <>
            <h3 style={{ margin: "16px 0 6px", fontSize: 16 }}>Docs Toveri</h3>
            {docsToveriDo(p.setor).map((n) => (
              <div className="pf" key={n}>
                <span className="mute">{n}</span>
                <span>{docFor(p.docs, campoToveri(n)) ? <Chip k="ok">Anexado</Chip> : <span className="mute">Opcional</span>}</span>
              </div>
            ))}
          </>
        ) : null}
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
        <button type="button" id="pdossie" disabled={montando} title="Ficha seguida de todos os documentos anexados, num único PDF" onClick={() => void baixarDossie()}>
          {montando ? "Montando o dossiê…" : "Baixar dossiê (PDF)"}
        </button>
        <button type="button" className="ghost" id="pfichapdf" title="Só a ficha, sem os documentos" onClick={() => void baixarPdf()}>
          Só a ficha (PDF)
        </button>
        <button type="button" className="ghost" id="pficha" onClick={() => baixar(nomeArquivoFicha(p.name), fichaTexto(S, p), falhaDown)}>
          Ficha (.txt)
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
