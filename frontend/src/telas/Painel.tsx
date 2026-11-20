/** Painel: cartões de resumo e listagem do cartão escolhido. */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Chip } from "../componentes/Comuns";
import { fmt } from "../dominio/datas";
import { nomeBarco, pessoa } from "../dominio/escala";
import { unesc } from "../dominio/texto";
import { estadoQualquer, gruposPainel, type ChavePainel } from "../dominio/validade";
import { T, useEstado } from "../loja";

export function Painel({ oculto }: { oculto: boolean }) {
  const S = useEstado();
  const [sel, setSel] = useState<ChavePainel | null>(null);
  const lista = useRef<HTMLElement>(null);
  const { pessoas, cursos } = gruposPainel(S, T);
  const qtd = (k: ChavePainel) => (k in pessoas ? pessoas[k as keyof typeof pessoas][1].length : cursos[k as keyof typeof cursos][1].length);

  const escolher = (k: ChavePainel) => setSel((s) => (s === k ? null : k));
  useEffect(() => {
    if (!sel || !lista.current) return;
    const r = lista.current.getBoundingClientRect();
    if (r.bottom > innerHeight)
      lista.current.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth", block: "nearest" });
  }, [sel]);

  const card = (k: ChavePainel, l: string, cls: string, style?: CSSProperties) => (
    <button key={k} type="button" className={"card " + cls + (sel === k ? " on" : "")} style={style} data-sel={k} aria-pressed={sel === k} onClick={() => escolher(k)}>
      <span>{l}</span>
      <b>{qtd(k)}</b>
    </button>
  );
  const ab = pessoas.equipe[1];
  // cartões de pendência: só aparecem os que têm alguma (o painel fica mais limpo)
  const PENDENCIAS: [ChavePainel, string, string][] = [
    ["cv", "Curso vencido", "bad"],
    ["c60", "Vencem em 60 dias", "warn"],
    ["c90", "Vencem em 90 dias", "warn"],
    ["av", "ASOs vencidos", "bad"],
    ["aa", "ASOs a vencer", "warn"],
    ["nv", "Norueguês vencido", "bad"],
    ["na", "Norueguês a vencer", "warn"],
  ];
  const pendentes = PENDENCIAS.filter(([k]) => qtd(k) > 0);
  // o cartão aberto zerou (ex.: curso renovado): fecha a lista
  if (sel && PENDENCIAS.some(([k]) => k === sel) && qtd(sel) === 0) setSel(null);

  let titulo = "Listagem",
    corpo: ReactNode = null;
  if (sel) {
    if (sel === "emb" || sel === "tr" || sel === "folga" || sel === "equipe") {
      const [nome, itens] = pessoas[sel];
      titulo = nome + " (" + itens.length + ")";
      corpo = !itens.length ? (
        <p className="empty">Nada a mostrar nesta situação.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Barco</th>
              <th>Situação</th>
              <th>Próximo embarque</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((x) => (
              <tr key={x.p.id}>
                <td>
                  <b>{unesc(x.p.name)}</b>
                  <div className="mute">{unesc(x.p.role)}</div>
                </td>
                <td>{unesc(nomeBarco(S, x.p.boat)) || <span className="mute">—</span>}</td>
                <td>
                  {x.c.st === "aboard" ? (
                    <Chip k="sea">Embarcado</Chip>
                  ) : x.c.st === "transit" ? (
                    <Chip k="warn">{x.c.sentido === "ida" ? "Translado de ida" : "Translado de volta"}</Chip>
                  ) : (
                    <Chip k="ok">Folga</Chip>
                  )}
                </td>
                <td>{fmt(x.c.next)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else {
      const [nome, itens] = cursos[sel];
      titulo = nome + " (" + itens.length + ")";
      corpo = !itens.length ? (
        <p className="empty">Nada a mostrar nesta situação.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Curso</th>
              <th>Colaborador</th>
              <th>Validade</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {[...itens]
              .sort((a, b) => a.valid - b.valid)
              .map((c) => {
                const s = estadoQualquer(c, T);
                return (
                  <tr key={c.pid + "|" + c.name}>
                    <td>{c.name}</td>
                    <td>{unesc(pessoa(S, c.pid)?.name ?? "—")}</td>
                    <td>{fmt(c.valid)}</td>
                    <td>
                      <Chip k={s.k}>{s.t}</Chip>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      );
    }
  }

  return (
    <>
      <div className="cards r4" id="c1" hidden={oculto}>
        {card("emb", "Embarcados hoje", "")}
        {card("tr", "Em translado hoje", "")}
        {card("folga", "De folga hoje", "")}
        <button type="button" className={"card" + (sel === "equipe" ? " on" : "")} data-sel="equipe" aria-pressed={sel === "equipe"} onClick={() => escolher("equipe")}>
          <span>Equipe embarcada</span>
          <span className="av">
            {ab.slice(0, 4).map((x) => (
              <i key={x.p.id}>{unesc(x.p.name)[0]}</i>
            ))}
            {ab.length > 4 ? <i>{"+" + (ab.length - 4)}</i> : null}
          </span>
        </button>
      </div>
      {pendentes.length ? (
        <div className="cards" id="c2" hidden={oculto}>
          {/* alinhados à direita, como a fileira de cima (grade de 5 colunas) */}
          {pendentes.map(([k, l, cls], i) =>
            i === 0 && pendentes.length < 5 ? card(k, l, cls + " ini", { "--ini": 6 - pendentes.length } as CSSProperties) : card(k, l, cls),
          )}
        </div>
      ) : (
        <p className="mute tudoemdia" id="c2" hidden={oculto}>
          Nenhum curso, ASO ou Norueguês vencido ou vencendo nos próximos 90 dias.
        </p>
      )}
      <section ref={lista} className={"panel" + (sel ? "" : " off")} id="plst" aria-labelledby="lt" hidden={oculto}>
        <div className="lhead">
          <h2 id="lt">{titulo}</h2>
          <button
            className="ghost"
            id="lfechar"
            type="button"
            onClick={() => {
              const k = sel;
              setSel(null);
              if (k) document.querySelector<HTMLElement>('[data-sel="' + k + '"]')?.focus();
            }}
          >
            Fechar
          </button>
        </div>
        <div className="scroll" id="lst" aria-live="polite">
          {corpo}
        </div>
      </section>
    </>
  );
}
