/** Barcos: tripulação a bordo hoje, próximos embarques e férias. */
import type { ReactNode } from "react";
import { useAcoes } from "../acoes";
import { fmt } from "../dominio/datas";
import { barco, situacao, type Situacao } from "../dominio/escala";
import { unesc } from "../dominio/texto";
import type { Barco, Pessoa } from "../dominio/tipos";
import { T, useEstado } from "../loja";

export function Barcos({ oculto }: { oculto: boolean }) {
  const S = useEstado();
  const { abrirBarco, abrirPasta } = useAcoes();
  const ps = S.people.filter((p) => p.embark != null);

  const item = (p: Pessoa, t: string) => (
    <div className="bi" key={p.id}>
      <button type="button" className="linkb" onClick={() => abrirPasta(p.id)}>
        {unesc(p.name)}
      </button>
      <span className="mute">{t}</span>
    </div>
  );
  const bloco = (tit: string, arr: ReactNode[], vazio: string) => (
    <>
      <h4>{tit}</h4>
      {arr.length ? arr : <p className="empty">{vazio}</p>}
    </>
  );
  const card = (b: Barco | null, lst: Pessoa[]) => {
    const z = lst.map((p) => ({ p, s: situacao(S, p, T) }));
    type Com<K extends Situacao["k"]> = { p: Pessoa; s: Extract<Situacao, { k: K }> };
    const on = z.filter((x): x is Com<"emb"> => x.s.k === "emb").sort((a, b) => a.s.c.end - b.s.c.end),
      nx = z.filter((x): x is Com<"folga"> => x.s.k === "folga" && x.s.c.next - T <= 30).sort((a, b) => a.s.c.next - b.s.c.next),
      fe = z.filter((x) => x.s.k === "ferias");
    return (
      <article className="panel boat" key={b ? b.id : "sem"}>
        <div className="bh">
          <div>
            <h3>{b ? unesc(b.name) : "Sem barco definido"}</h3>
            <div className="mute">{[b && unesc(b.tipo || ""), lst.length + (lst.length === 1 ? " tripulante vinculado" : " tripulantes vinculados")].filter(Boolean).join(" · ")}</div>
          </div>
          {b ? (
            <button className="ghost" type="button" onClick={() => abrirBarco(b.id)}>
              Editar
            </button>
          ) : null}
        </div>
        <div className="bcount">
          <b>{on.length}</b>
          <span>a bordo hoje</span>
        </div>
        {b && b.obs ? (
          <p className="mute" style={{ margin: "0 0 6px" }}>
            {unesc(b.obs)}
          </p>
        ) : null}
        {bloco("A bordo hoje", on.map((x) => item(x.p, "até " + fmt(x.s.c.end))), "Ninguém a bordo hoje.")}
        {bloco("Próximos embarques (30 dias)", nx.map((x) => item(x.p, "embarca em " + fmt(x.s.c.next))), "Nenhum embarque previsto.")}
        {fe.length ? bloco("De férias", fe.map((x) => item(x.p, "até " + fmt(x.p.fFim as number))), "") : null}
        {b ? null : (
          <p className="mute" style={{ marginTop: 10 }}>
            Defina o barco ao registrar o embarque ou no cadastro do colaborador.
          </p>
        )}
      </article>
    );
  };
  const sem = ps.filter((p) => !barco(S, p.boat));
  const cards = (S.boats || []).map((b) => card(b, ps.filter((p) => p.boat == b.id)));
  if (sem.length) cards.push(card(null, sem));

  return (
    <>
      <div className="row bbar" hidden={oculto}>
        <p className="mute">Setor ambiental: tripulação a bordo hoje e próximos embarques de cada barco.</p>
        <button type="button" id="novob" onClick={() => abrirBarco(null)}>
          Novo barco
        </button>
      </div>
      <div className="boats" id="boats" hidden={oculto}>
        {cards.length ? cards : <p className="empty">Nenhum barco cadastrado.</p>}
      </div>
    </>
  );
}
