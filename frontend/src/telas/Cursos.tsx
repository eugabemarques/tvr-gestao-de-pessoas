/** Cursos, ASO e Norueguês por validade: gráficos de colunas e tabela da coluna escolhida. */
import { useState } from "react";
import { useAcoes } from "../acoes";
import { Chip } from "../componentes/Comuns";
import { fmt } from "../dominio/datas";
import { pessoa } from "../dominio/escala";
import { unesc } from "../dominio/texto";
import { alturaBarra, ANOS_NORUEGUES, estadoQualquer, gruposAso, gruposCursos, gruposNoruegues, isAso, isNoruegues, NORUEGUES } from "../dominio/validade";
import type { Curso } from "../dominio/tipos";
import { T, useEstado } from "../loja";

function LinhaCurso({ c }: { c: Curso }) {
  const S = useEstado();
  const { abrirPasta, abrirCurso } = useAcoes();
  const s = estadoQualquer(c, T),
    p = pessoa(S, c.pid);
  return (
    <tr>
      <td>{c.name}</td>
      <td>
        {p ? (
          <button type="button" className="linkb" onClick={() => abrirPasta(p.id)}>
            {unesc(p.name)}
          </button>
        ) : (
          <span className="mute">—</span>
        )}
      </td>
      <td>{fmt(c.valid)}</td>
      <td>
        <Chip k={s.k}>{s.t}</Chip>
      </td>
      <td>
        <button className="ghost" type="button" onClick={() => abrirCurso(c.pid + "|" + c.name, isAso(c) ? "a" : isNoruegues(c) ? "n" : "c")}>
          Editar
        </button>
      </td>
    </tr>
  );
}

function Grafico<K extends string>(props: {
  id: string;
  g4?: boolean;
  rotulo: string;
  chaves: K[];
  grupos: Record<K, Curso[]>;
  meta: Record<K, string>;
  cor: (k: K) => string;
  sel: K | null;
  setSel: (k: K | null) => void;
}) {
  const { id, g4, rotulo, chaves, grupos, meta, cor, sel, setSel } = props;
  const max = Math.max(1, ...chaves.map((k) => grupos[k].length));
  return (
    <div className={"gcols" + (g4 ? " g4" : "")} id={id} role="group" aria-label={rotulo}>
      {chaves.map((k) => (
        <button key={k} type="button" className={"gcol g-" + cor(k) + (sel === k ? " on" : "")} aria-expanded={sel === k} onClick={() => setSel(sel === k ? null : k)}>
          <b>{grupos[k].length}</b>
          <span className="gfill" style={{ height: alturaBarra(grupos[k].length, max) + "px" }} />
          <span>{meta[k]}</span>
        </button>
      ))}
    </div>
  );
}

export function Cursos({ oculto }: { oculto: boolean }) {
  const S = useEstado();
  const { abrirCurso } = useAcoes();
  const [csel, setCsel] = useState<"bad" | "warn" | "ok" | null>(null);
  const gc = gruposCursos(S.courses, T);
  const ordenar = (l: Curso[]) => [...l].sort((a, b) => a.valid - b.valid);

  return (
    <>
      <section className="panel" aria-labelledby="t-cu" hidden={oculto}>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", marginBottom: 14 }}>
          <h2 id="t-cu" style={{ margin: 0 }}>
            Cursos por validade
          </h2>
          <button type="button" id="novocur" onClick={() => abrirCurso(null, "c")}>
            Novo curso
          </button>
        </div>
        <Grafico
          id="cgraf"
          rotulo="Cursos por situação"
          chaves={["bad", "warn", "ok"]}
          grupos={gc}
          meta={{ bad: "Vencidos", warn: "Vencem em até 90 dias", ok: "Em dia" }}
          cor={(k) => k}
          sel={csel}
          setSel={setCsel}
        />
        <p className="mute" id="cdica" hidden={!!csel}>
          Clique em uma coluna para ver os cursos.
        </p>
        <div className="scroll" id="cdet" hidden={!csel}>
          <table>
            <thead>
              <tr>
                <th>Curso</th>
                <th>Colaborador</th>
                <th>Validade</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="cursos">
              {csel ? (
                gc[csel].length ? (
                  ordenar(gc[csel]).map((c) => <LinhaCurso key={c.pid + "|" + c.name} c={c} />)
                ) : (
                  <tr>
                    <td colSpan={5} className="empty">
                      Nenhum curso nesta situação.
                    </td>
                  </tr>
                )
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <SecaoExame oculto={oculto} id="as" titulo="ASO" novo="Novo ASO" tipo="a" grupos={gruposAso(S.courses, T)} />
      <SecaoExame
        oculto={oculto}
        id="no"
        titulo="Norueguês"
        nomeCompleto={NORUEGUES}
        novo="Novo Norueguês"
        tipo="n"
        grupos={gruposNoruegues(S.courses, T)}
        dica={"Exame médico offshore com validade de " + ANOS_NORUEGUES + " anos a partir da data do exame."}
      />
    </>
  );
}

type GrupoExame = "bad" | "w60" | "w90" | "ok";

/** Quadro de um exame (ASO ou Norueguês): faixas de 60 e 90 dias e a lista com os dias para vencer. */
function SecaoExame(props: {
  oculto: boolean;
  id: string;
  titulo: string;
  nomeCompleto?: string;
  novo: string;
  tipo: "a" | "n";
  grupos: Record<GrupoExame, Curso[]>;
  dica?: string;
}) {
  const { oculto, id, titulo, nomeCompleto, novo, tipo, grupos, dica } = props;
  const { abrirCurso } = useAcoes();
  const [sel, setSel] = useState<GrupoExame | null>(null);
  return (
    <section className="panel" aria-labelledby={"t-" + id} hidden={oculto}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h2 id={"t-" + id} style={{ margin: 0 }}>
            {titulo + " por validade"}
          </h2>
          {nomeCompleto ? <div className="mute">{nomeCompleto}</div> : null}
        </div>
        <button type="button" id={"novo" + id} onClick={() => abrirCurso(null, tipo)}>
          {novo}
        </button>
      </div>
      {dica ? (
        <p className="mute" style={{ marginTop: -6 }}>
          {dica}
        </p>
      ) : null}
      <Grafico
        id={id + "graf"}
        g4
        rotulo={titulo + " por situação"}
        chaves={["bad", "w60", "w90", "ok"]}
        grupos={grupos}
        meta={{ bad: "Vencidos", w60: "Vencem em até 60 dias", w90: "Vencem entre 61 e 90 dias", ok: "Em dia" }}
        cor={(k) => (k === "bad" ? "bad" : k === "ok" ? "ok" : "warn")}
        sel={sel}
        setSel={setSel}
      />
      <p className="mute" hidden={!!sel}>
        {"Clique em uma coluna para ver os exames."}
      </p>
      <div className="scroll" hidden={!sel}>
        <table>
          <thead>
            <tr>
              <th>{titulo}</th>
              <th>Colaborador</th>
              <th>Validade</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sel ? (
              grupos[sel].length ? (
                [...grupos[sel]].sort((a, b) => a.valid - b.valid).map((c) => <LinhaCurso key={c.pid + "|" + c.name} c={c} />)
              ) : (
                <tr>
                  <td colSpan={5} className="empty">
                    {"Nenhum " + titulo + " nesta situação."}
                  </td>
                </tr>
              )
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
