/** Colaboradores: busca e lista com situação, documentos pendentes e cursos. */
import { useState } from "react";
import { useAcoes } from "../acoes";
import { Chip, ChipPendencias, ChipSituacao, subSituacao } from "../componentes/Comuns";
import { nomeSetor } from "../dominio/documentos";
import { nomeBarco, situacao } from "../dominio/escala";
import { unesc } from "../dominio/texto";
import { courseState } from "../dominio/validade";
import { T, useEstado } from "../loja";

export function Colaboradores({ oculto }: { oculto: boolean }) {
  const S = useEstado();
  const { abrirColab, abrirPasta } = useAcoes();
  const [busca, setBusca] = useState("");
  const q = busca.toLowerCase().trim();
  const rows = S.people.filter((p) => unesc(p.name + " " + p.role + " " + nomeBarco(S, p.boat)).toLowerCase().includes(q));

  return (
    <section className="panel" aria-labelledby="t-co" hidden={oculto}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", marginBottom: 14 }}>
        <h2 id="t-co" style={{ margin: 0 }}>
          Colaboradores
        </h2>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button id="novoc" type="button" onClick={() => abrirColab(null)}>
            Novo colaborador
          </button>
        </div>
      </div>
      <label>
        Buscar
        <input type="search" id="busca" placeholder="Nome, cargo ou barco" autoComplete="off" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </label>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Situação</th>
              <th>Cursos</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="colabs">
            {rows.length ? (
              rows.map((p) => {
                const cs = S.courses.filter((k) => k.pid == p.id).map((c) => courseState(c, T));
                const nb = cs.filter((s) => s.k === "bad").length,
                  nw = cs.filter((s) => s.k === "warn").length;
                const z = situacao(S, p, T),
                  sub = subSituacao(z);
                return (
                  <tr key={p.id}>
                    <td>
                      <b>{unesc(p.name)}</b>
                      <div className="mute">{[nomeSetor(p.setor), unesc(p.role)].filter(Boolean).join(" · ")}</div>
                      <ChipPendencias p={p} />
                    </td>
                    <td>
                      <ChipSituacao z={z} />
                      {sub ? <div className="mute">{sub}</div> : null}
                    </td>
                    <td>
                      {nb ? (
                        <Chip k="bad">{nb + (nb > 1 ? " vencidos" : " vencido")}</Chip>
                      ) : nw ? (
                        <Chip k="warn">{nw + " vencendo"}</Chip>
                      ) : cs.length ? (
                        <Chip k="ok">Em dia</Chip>
                      ) : (
                        <span className="mute">Sem cursos</span>
                      )}
                    </td>
                    <td>
                      <button className="ghost" onClick={() => abrirPasta(p.id)}>
                        Pasta
                      </button>{" "}
                      <button className="ghost" onClick={() => abrirColab(p.id)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="empty">
                  Nenhum colaborador encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
