/** Cursos e ASO por validade: gráficos de colunas e tabela da coluna escolhida. */
import { useState } from "react";
import { useAcoes } from "../acoes";
import { Chip } from "../componentes/Comuns";
import { fmt } from "../dominio/datas";
import { pessoa } from "../dominio/escala";
import { unesc } from "../dominio/texto";
import { alturaBarra, estadoQualquer, gruposAso, gruposCursos } from "../dominio/validade";
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
        <button className="ghost" type="button" onClick={() => abrirCurso(c.pid + "|" + c.name, "c")}>
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
  const [asel, setAsel] = useState<"bad" | "w60" | "w90" | "ok" | null>(null);
  const gc = gruposCursos(S.courses, T),
    ga = gruposAso(S.courses, T);
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
      <section className="panel" aria-labelledby="t-as" hidden={oculto}>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", marginBottom: 14 }}>
          <h2 id="t-as" style={{ margin: 0 }}>
            ASO por validade
          </h2>
          <button type="button" id="novoaso" onClick={() => abrirCurso(null, "a")}>
            Novo ASO
          </button>
        </div>
        <Grafico
          id="agraf"
          g4
          rotulo="ASO por situação"
          chaves={["bad", "w60", "w90", "ok"]}
          grupos={ga}
          meta={{ bad: "Vencidos", w60: "Vencem em até 60 dias", w90: "Vencem entre 61 e 90 dias", ok: "Em dia" }}
          cor={(k) => (k === "bad" ? "bad" : k === "ok" ? "ok" : "warn")}
          sel={asel}
          setSel={setAsel}
        />
        <p className="mute" id="adica" hidden={!!asel}>
          Clique em uma coluna para ver os ASOs.
        </p>
        <div className="scroll" id="adet" hidden={!asel}>
          <table>
            <thead>
              <tr>
                <th>ASO</th>
                <th>Colaborador</th>
                <th>Validade</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="asos">
              {asel ? (
                ga[asel].length ? (
                  ordenar(ga[asel]).map((c) => <LinhaCurso key={c.pid + "|" + c.name} c={c} />)
                ) : (
                  <tr>
                    <td colSpan={5} className="empty">
                      Nenhum ASO nesta situação.
                    </td>
                  </tr>
                )
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
