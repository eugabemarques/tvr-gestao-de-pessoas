/** Embarques: registrar embarque, histórico com exportação e Equipe hoje. */
import { useState } from "react";
import { useAcoes } from "../acoes";
import { Chip } from "../componentes/Comuns";
import { DATA_MAX, diaIso, fmt, iso, toDay } from "../dominio/datas";
import { barco, cycle, dadosHistorico, emFerias, erroTranslado, nomeBarco, pessoa, podeDarDobra, previaRegistro, registrarEmbarque, TI_PADRAO, TV_PADRAO } from "../dominio/escala";
import { planilhaHistorico } from "../dominio/exportacao";
import { porNome, unesc } from "../dominio/texto";
import { AGORA, loja, T, toast, useEstado } from "../loja";
import { baixar } from "../servidor/api";

export function RegistrarEmbarque({ oculto }: { oculto: boolean }) {
  const S = useEstado();
  const [pid, setPid] = useState("");
  const [bsel, setBsel] = useState("");
  const [tocado, setTocado] = useState(false);
  const [data, setData] = useState(iso(AGORA));
  // Translado de ida: null = padrão (dia anterior ao embarque). Os dias a bordo seguem a escala do colaborador e a
  // volta fica no último dia a bordo; dias, dobra e volta diferentes se ajustam na ficha do colaborador (aba Embarques).
  const [ida, setIda] = useState<string | null>(null);

  const comEscala = porNome(S.people).filter((p) => p.embark != null);
  const pidEf = comEscala.some((p) => String(p.id) === pid) ? pid : comEscala.length ? String(comEscala[0].id) : "";
  const pp = pessoa(S, pidEf);
  const barcoEf = tocado ? (bsel === "" || barco(S, +bsel) ? bsel : "") : pp && barco(S, pp.boat) ? String(pp.boat) : "";

  const d = toDay(data || iso(AGORA)),
    n = pp?.base || 42;
  const idaEf = ida ?? diaIso(d - TI_PADRAO);
  const ti = idaEf ? d - toDay(idaEf) : TI_PADRAO,
    tv = TV_PADRAO;
  const erroTr = erroTranslado(ti, tv);
  const r = previaRegistro(d, n, erroTr ? TI_PADRAO : ti, erroTr ? TV_PADRAO : tv);

  const salvar = () => {
    const p = pessoa(S, pidEf);
    if (!p || !data) {
      toast("Informe colaborador e data de embarque.");
      return;
    }
    if (erroTr) {
      toast(erroTr);
      return;
    }
    loja.mutar((E) => registrarEmbarque(E, p.id, toDay(data), n, barcoEf ? +barcoEf : null, ti, tv));
    setTocado(false);
    setIda(null);
    toast("Registro salvo para " + unesc(p.name) + ".");
  };

  return (
    <section className="panel" aria-labelledby="t-reg" hidden={oculto}>
      <h2 id="t-reg">Registrar embarque</h2>
      <div className="reg">
        <div>
          <label>
            Colaborador
            <select
              id="pessoa"
              value={pidEf}
              onChange={(e) => {
                setPid(e.target.value);
                setTocado(false);
              }}
            >
              {comEscala.map((p) => (
                <option key={p.id} value={p.id}>
                  {unesc(p.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Barco
            <select
              id="barco"
              value={barcoEf}
              onChange={(e) => {
                setBsel(e.target.value);
                setTocado(true);
              }}
            >
              <option value="">Sem barco definido</option>
              {porNome(S.boats).map((b) => (
                <option key={b.id} value={b.id}>
                  {unesc(b.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Translado de ida
            <input type="date" max={DATA_MAX} id="tida" value={idaEf} onChange={(e) => setIda(e.target.value)} />
          </label>
          <label>
            Data de embarque
            <input type="date" max={DATA_MAX} id="data" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <p className="mute" style={{ margin: "-4px 0 10px", fontSize: 13 }}>
            {"Padrão: translado de ida no dia anterior ao embarque e " + n + " dias a bordo (escala do colaborador). Outros ajustes: ficha do colaborador, aba Embarques."}
          </p>
          {erroTr ? (
            <p className="ferr" role="alert">
              {erroTr}
            </p>
          ) : null}
          <button id="salvar" onClick={salvar}>
            Salvar registro
          </button>
        </div>
        <div className="res" aria-live="polite">
          <h3 id="r-folga">{n + " dias"}</h3>
          <p>
            {"dias de folga conquistados (1 dia de folga para cada dia a bordo) · " + r.trabalhados + " dias trabalhados" + (r.translado ? ", com " + r.translado + " de translado" : "")}
          </p>
          <div className="track" id="r-track">
            {r.inicio > r.ida ? (
              <div className="t3" style={{ flex: Math.max(3, r.inicio - r.ida) }} title={"Translado de ida · " + (r.inicio - r.ida) + (r.inicio - r.ida > 1 ? " dias" : " dia")}>
                ⇢
              </div>
            ) : null}
            <div className="t1" style={{ flex: n }}>
              {"A bordo · " + n + " dias"}
            </div>
            {r.volta > r.ultimoBordo ? (
              <div className="t3" style={{ flex: Math.max(3, r.volta - r.ultimoBordo) }} title={"Translado de volta · " + (r.volta - r.ultimoBordo) + (r.volta - r.ultimoBordo > 1 ? " dias" : " dia")}>
                ⇠
              </div>
            ) : null}
            <div className="t2" style={{ flex: n }}>
              {"Folga · " + n + " dias"}
            </div>
          </div>
          <div className="dates" id="r-dates">
            <span>{fmt(r.ida)}</span>
            <span>{fmt(r.inicioFolga)}</span>
            <span>{fmt(r.ultimoFolga)}</span>
          </div>
          <div className="facts" id="r-facts">
            <div className="tr">
              <b>{fmt(r.ida)}</b>
              <span>Translado de ida</span>
            </div>
            <div>
              <b>{fmt(r.inicio)}</b>
              <span>Embarque</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Historico({ oculto }: { oculto: boolean }) {
  const S = useEstado();
  const [hpes, setHpes] = useState("all");
  const [hde, setHde] = useState("");
  const [hate, setHate] = useState(iso(AGORA));

  const comEscala = porNome(S.people).filter((p) => p.embark != null);
  const pesEf = hpes === "all" || comEscala.some((p) => String(p.id) === hpes) ? hpes : "all";
  const dados = () => dadosHistorico(S, pesEf, hde ? toDay(hde) : null, hate ? toDay(hate) : T);
  const R = dados();

  const excel = async () => {
    let XLSX: typeof import("xlsx");
    try {
      XLSX = await import("xlsx");
    } catch {
      toast("A biblioteca de planilhas não carregou. Verifique a conexão.");
      return;
    }
    const wb = XLSX.utils.book_new();
    planilhaHistorico(S, dados()).forEach(([nome, linhas]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), nome));
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    baixar("historico-embarques.xlsx", new Blob([buf]), () => toast("Não foi possível baixar o arquivo."));
  };

  const pdf = async () => {
    let arq: Blob;
    try {
      const { gerarHistoricoPdf } = await import("../dialogos/historicoPdf");
      arq = await gerarHistoricoPdf(S, dados(), T, hde ? toDay(hde) : null, hate ? toDay(hate) : T);
    } catch {
      toast("A biblioteca de PDF não carregou. Verifique a conexão.");
      return;
    }
    baixar("historico-embarques.pdf", arq, () => toast("Não foi possível baixar o arquivo."));
  };

  return (
    <section className="panel" aria-labelledby="t-hi" hidden={oculto}>
      <h2 id="t-hi">Histórico e exportação</h2>
      <div className="g2">
        <label>
          Colaborador
          <select id="hpes" value={pesEf} onChange={(e) => setHpes(e.target.value)}>
            <option value="all">Todos os colaboradores</option>
            {comEscala.map((p) => (
              <option key={p.id} value={p.id}>
                {unesc(p.name)}
              </option>
            ))}
          </select>
        </label>
        <div className="g2">
          <label>
            De (opcional)
            <input type="date" max={DATA_MAX} id="hde" value={hde} onChange={(e) => setHde(e.target.value)} />
          </label>
          <label>
            Até
            <input type="date" max={DATA_MAX} id="hate" value={hate} onChange={(e) => setHate(e.target.value || iso(AGORA))} />
          </label>
        </div>
      </div>
      <div className="scroll" id="hres">
        {R.length ? (
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Período</th>
                <th>Dias a bordo</th>
                <th>Dobra</th>
                <th>Translado</th>
                <th>Dias trabalhados</th>
                <th>Dias de folga</th>
              </tr>
            </thead>
            <tbody>
              {R.map((r) => (
                <tr key={r.p.id}>
                  <td>
                    <b>{unesc(r.p.name)}</b>
                  </td>
                  <td>{fmt(r.de) + " a " + fmt(r.ate)}</td>
                  <td>{r.ab}</td>
                  <td>{r.dob}</td>
                  <td>{r.tr}</td>
                  <td>
                    <b>{r.ab + r.tr}</b>
                  </td>
                  <td>{r.fo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty">Nenhum colaborador com escala.</p>
        )}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button id="hxls" type="button" onClick={excel}>
          Baixar Excel
        </button>
        <button className="ghost" id="hpdf" type="button" onClick={pdf}>
          Baixar PDF
        </button>
      </div>
      <p className="mute" style={{ marginTop: 10 }}>
        Dias trabalhados = dias a bordo + dias de translado. O translado não gera folga. Períodos “Registrados” vieram de embarques lançados no sistema; “Previstos” seguem a escala padrão (translado de ida no dia anterior ao embarque) e ainda não foram confirmados.
      </p>
    </section>
  );
}

export function EquipeHoje({ oculto }: { oculto: boolean }) {
  const S = useEstado();
  const { abrirDobra } = useAcoes();
  const cy = porNome(S.people).filter((p) => p.embark != null).map((p) => ({ p, c: cycle(p, T) }));
  return (
    <section className="panel" aria-labelledby="t-eq" hidden={oculto}>
      <h2 id="t-eq">Equipe hoje</h2>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Situação</th>
              <th>Ciclo</th>
              <th>Próximo embarque</th>
              <th>Dobra</th>
            </tr>
          </thead>
          <tbody id="equipe">
            {cy.map(({ p, c }) => {
              const fe = emFerias(p, T);
              const chip = fe ? (
                <Chip k="vac">{"Férias até " + fmt(p.fFim as number)}</Chip>
              ) : c.st === "aboard" ? (
                <Chip k="sea">{"A bordo · dia " + c.day + " de " + c.L + (c.dobra ? " · dobra +" + c.dobra : "")}</Chip>
              ) : c.st === "transit" ? (
                <Chip k="warn">{c.sentido === "ida" ? "Translado de ida · embarca em " + fmt(c.next) : "Translado de volta · folga a partir de " + fmt(c.e.folgaIni)}</Chip>
              ) : c.st === "rest" ? (
                <Chip k="ok">{"Folga · dia " + c.day + " de " + c.L}</Chip>
              ) : (
                <Chip k="warn">{"Embarca em " + c.days + " dias"}</Chip>
              );
              return (
                <tr key={p.id}>
                  <td>
                    <b>{unesc(p.name)}</b>
                    <div className="mute">{[unesc(p.role), unesc(nomeBarco(S, p.boat)) || "sem barco"].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td>{chip}</td>
                  <td>
                    <div className="bar">{c.st === "future" ? null : <i style={{ left: (c.pos / c.tot) * 100 + "%" }} />}</div>
                  </td>
                  <td>
                    {fmt(c.next)}
                    <div className="mute">{"em " + c.days + " dias"}</div>
                  </td>
                  <td>
                    {podeDarDobra(c) && !fe ? (
                      <button className="ghost" onClick={() => abrirDobra(p.id)}>
                        Dobra
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
