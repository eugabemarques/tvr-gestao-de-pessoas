/** Estrutura da tela: menu lateral, barra superior, telas e diálogos. */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AcoesCtx, type Acoes } from "./acoes";
import { Toast } from "./componentes/Comuns";
import { IcBarco, IcChat, IcColab, IcCursos, IcEmbarques, IcLista, IcPainel, IcSeta, IcSino } from "./componentes/Icones";
import { Avisos, BarcoDialogo, Conta, CursoDialogo, Dobra, Info, Pasta } from "./dialogos/Dialogos";
import { Ficha } from "./dialogos/Ficha";
import { textoHoje } from "./dominio/datas";
import { iniciais } from "./dominio/texto";
import { avisos } from "./dominio/validade";
import { AGORA, T, useEstado, useStatusSync } from "./loja";
import type { Usuario } from "./servidor/api";
import { Barcos } from "./telas/Barcos";
import { Colaboradores } from "./telas/Colaboradores";
import { Cursos } from "./telas/Cursos";
import { EquipeHoje, Historico, RegistrarEmbarque } from "./telas/Embarques";
import { Painel } from "./telas/Painel";

type Tela = "painel" | "escala" | "colab" | "cursos" | "ponto" | "equipe" | "barcos";
const TITULOS: Record<Tela, string> = {
  painel: "Painel",
  escala: "Embarques",
  colab: "Colaboradores",
  cursos: "Cursos",
  ponto: "Folha de Ponto",
  equipe: "Equipe hoje",
  barcos: "Barcos",
};

const lerGa = (): number => {
  try {
    const x = localStorage.getItem("toveri-ga");
    if (x !== null) return +x;
  } catch {
    /* sem armazenamento local */
  }
  return 38;
};

export function App({ usuario }: { usuario: Usuario }) {
  const S = useEstado();
  const sync = useStatusSync();
  const [tela, setTela] = useState<Tela>("painel");
  const [col, setCol] = useState(false);
  const [ga, setGa] = useState(lerGa);

  // diálogos
  const [info, setInfo] = useState<{ t: string; x: string } | null>(null);
  const [avisosAb, setAvisosAb] = useState(false);
  const [contaAb, setContaAb] = useState(false);
  const [dobra, setDobra] = useState<number | null>(null);
  const [barcoDlg, setBarcoDlg] = useState<{ id: number | null } | null>(null);
  const [cursoDlg, setCursoDlg] = useState<{ chave: string | null; tipo: "c" | "a" } | null>(null);
  const [pasta, setPasta] = useState<number | null>(null);
  const [ficha, setFicha] = useState<{ id: number | null } | null>(null);

  useEffect(() => {
    document.body.classList.toggle("col", col);
  }, [col]);
  useEffect(() => {
    document.documentElement.style.setProperty("--ga", (1 - (ga / 100) * 0.7).toFixed(3));
  }, [ga]);

  const acoes = useMemo<Acoes>(
    () => ({
      abrirPasta: (id) => setPasta(id),
      abrirColab: (id) => setFicha({ id: id ?? null }),
      abrirBarco: (id) => setBarcoDlg({ id: id ?? null }),
      abrirCurso: (chave, tipo) => setCursoDlg({ chave, tipo }),
      abrirDobra: (id) => setDobra(id),
      info: (t, x) => setInfo({ t, x }),
    }),
    [],
  );

  const pend = avisos(S, T).filter((a) => !a.res);
  const subVisivel = tela === "escala" || tela === "equipe";
  const aba = (k: Tela, icone: ReactNode, rotulo: string, sub?: boolean) => (
    <button type="button" data-tab={k} className={sub ? "sub" : undefined} hidden={sub ? !subVisivel : undefined} aria-current={tela === k ? "page" : undefined} onClick={() => setTela(k)}>
      {icone}
      <span className="lbl">{rotulo}</span>
    </button>
  );

  return (
    <AcoesCtx.Provider value={acoes}>
      <aside id="side" aria-label="Menu principal">
        <div className="logo" role="img" aria-label="TOVERI">
          <span className="lbl">
            <img className="lo-c" alt="" src="/logo-cor.png" />
            <img className="lo-w" alt="" src="/logo-branca.png" />
          </span>
          <span className="lg">
            <img className="lo-c" alt="" src="/marca-cor.png" />
            <img className="lo-w" alt="" src="/marca-branca.png" />
          </span>
        </div>
        <button className="tgl" id="tgl" type="button" aria-label={col ? "Expandir menu" : "Recolher menu"} onClick={() => setCol((c) => !c)}>
          <IcSeta />
        </button>
        <nav className="tabs" aria-label="Seções">
          {aba("painel", <IcPainel />, "Painel")}
          {aba("colab", <IcColab />, "Colaboradores")}
          {aba("cursos", <IcCursos />, "Cursos")}
          {aba("escala", <IcEmbarques />, "Embarques")}
          {aba("equipe", <IcLista />, "Equipe hoje", true)}
          {aba("barcos", <IcBarco />, "Barcos")}
        </nav>
        <div className="foot">
          <label className="trans">
            Transparência
            <input
              type="range"
              id="ga"
              min="0"
              max="100"
              value={ga}
              aria-label="Transparência das janelas"
              onChange={(e) => {
                setGa(+e.target.value);
                try {
                  localStorage.setItem("toveri-ga", e.target.value);
                } catch {
                  /* sem armazenamento local */
                }
              }}
            />
          </label>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <h1>TOVERI - Gestão de Pessoas</h1>
            {/* Como no protótipo, a data só aparece nas telas Embarques e Equipe hoje. */}
            <p className="sub" id="hoje" hidden={!subVisivel}>
              {textoHoje(AGORA)}
            </p>
          </div>
          <div className="row">
            <span id="syncst" className={"syncst" + (sync.erro ? " err" : "")} role="status">
              {sync.texto}
            </span>
            <button
              className="bell"
              id="chat"
              type="button"
              aria-label="Chat da equipe"
              onClick={() => acoes.info("Chat da equipe", "O chat entre a equipe precisa de login e de um servidor compartilhado. Ele será ativado quando essa etapa for desenvolvida.")}
            >
              <IcChat />
            </button>
            <button className="bell" id="sino" type="button" aria-label={"Avisos do sistema (" + pend.length + ")"} onClick={() => setAvisosAb(true)}>
              <IcSino />
              <span className="badge" id="nbadge" hidden={!pend.length} style={{ background: pend.some((a) => a.bad) ? "var(--bad)" : "var(--warn)" }}>
                {pend.length}
              </span>
            </button>
            <button className="bell avatar" id="perfil" type="button" aria-label={"Perfil do usuário: " + usuario.nome} onClick={() => setContaAb(true)}>
              {iniciais(usuario.nome) || "?"}
            </button>
          </div>
        </header>
        <h2 className="vt" id="vt">
          {TITULOS[tela]}
        </h2>

        <RegistrarEmbarque oculto={tela !== "escala"} />
        <Painel oculto={tela !== "painel"} />
        <section className="panel" hidden={tela !== "ponto"}>
          <p className="empty">A Folha de Ponto será desenvolvida em uma próxima etapa.</p>
        </section>
        <Barcos oculto={tela !== "barcos"} />
        <EquipeHoje oculto={tela !== "equipe"} />
        <Historico oculto={tela !== "escala"} />
        <Cursos oculto={tela !== "cursos"} />
        <Colaboradores oculto={tela !== "colab"} />

        <Dobra id={dobra} aoFechar={() => setDobra(null)} />
        <Info aberto={!!info} titulo={info?.t || ""} texto={info?.x || ""} aoFechar={() => setInfo(null)} />
        <Avisos aberto={avisosAb} aoFechar={() => setAvisosAb(false)} />
        <BarcoDialogo aberto={!!barcoDlg} id={barcoDlg?.id ?? null} aoFechar={() => setBarcoDlg(null)} />
        <CursoDialogo aberto={!!cursoDlg} chave={cursoDlg?.chave ?? null} tipo={cursoDlg?.tipo || "c"} aoFechar={() => setCursoDlg(null)} />
        <Conta aberto={contaAb} usuario={usuario} aoFechar={() => setContaAb(false)} />
        <Pasta id={pasta} aoFechar={() => setPasta(null)} />
        <Ficha aberto={!!ficha} cedit={ficha?.id ?? null} aoFechar={() => setFicha(null)} />
      </main>
      <Toast />
    </AcoesCtx.Provider>
  );
}
