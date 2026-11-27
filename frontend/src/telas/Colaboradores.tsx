/** Colaboradores: busca e lista com situação, documentos pendentes e cursos. */
import { useState } from "react";
import { useAcoes } from "../acoes";
import { Chip, ChipPendencias, ChipSituacao, subSituacao } from "../componentes/Comuns";
import { nomeSetor } from "../dominio/documentos";
import { nomeBarco, situacao } from "../dominio/escala";
import { botoesPagina, paginar } from "../dominio/paginacao";
import { porNome, unesc } from "../dominio/texto";
import { courseState } from "../dominio/validade";
import { T, useEstado } from "../loja";

const POR_PAGINA = 10;

export function Colaboradores({ oculto }: { oculto: boolean }) {
  const S = useEstado();
  const { abrirColab, abrirPasta } = useAcoes();
  const [busca, setBusca] = useState("");
  const q = busca.toLowerCase().trim();
  // em ordem alfabética (sem diferenciar acentos e maiúsculas: "Álvaro" vem junto de "Alvaro")
  const todos = porNome(S.people).filter((p) => unesc(p.name + " " + p.role + " " + nomeBarco(S, p.boat)).toLowerCase().includes(q));
  // 10 por página; a busca procura em todos e volta para a 1ª página
  const [pag, setPag] = useState(1);
  const pg = paginar(todos, pag, POR_PAGINA),
    rows = pg.itens;
  const irPara = (n: number) => {
    setPag(n);
    document.getElementById("t-co")?.scrollIntoView({ block: "nearest" });
  };

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
        <input type="search" id="busca" placeholder="Nome, cargo ou barco" autoComplete="off" value={busca} onChange={(e) => { setBusca(e.target.value); setPag(1); }} />
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
      {pg.total ? (
        <nav className="paginacao" aria-label="Páginas da lista de colaboradores">
          <span className="mute" id="pg-info">
            {pg.paginas > 1 ? `Mostrando ${pg.de}–${pg.ate} de ${pg.total} colaboradores` : `${pg.total} ${pg.total === 1 ? "colaborador" : "colaboradores"}`}
          </span>
          {pg.paginas > 1 ? (
            <div className="row pg-botoes">
              <button type="button" className="ghost" id="pg-ant" disabled={pg.pagina === 1} onClick={() => irPara(pg.pagina - 1)}>
                ‹ Anterior
              </button>
              {botoesPagina(pg.pagina, pg.paginas).map((n, i) =>
                n == null ? (
                  <span key={"r" + i} className="mute" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    className={n === pg.pagina ? "pg-num atual" : "ghost pg-num"}
                    aria-current={n === pg.pagina ? "page" : undefined}
                    aria-label={"Página " + n}
                    onClick={() => irPara(n)}
                  >
                    {n}
                  </button>
                ),
              )}
              <button type="button" className="ghost" id="pg-prox" disabled={pg.pagina === pg.paginas} onClick={() => irPara(pg.pagina + 1)}>
                Próxima ›
              </button>
            </div>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
