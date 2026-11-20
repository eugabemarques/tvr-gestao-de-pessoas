/** Embarques: registrar embarque, histórico com exportação e Equipe hoje. */
import { useState } from "react";
import { useAcoes } from "../acoes";
import { Chip } from "../componentes/Comuns";
import { diaIso, fmt, iso, toDay } from "../dominio/datas";
import { barco, cycle, dadosHistorico, emFerias, erroTranslado, nomeBarco, pessoa, previaRegistro, registrarEmbarque, TI_PADRAO, TV_PADRAO } from "../dominio/escala";
import { pdfHistorico, planilhaHistorico } from "../dominio/exportacao";
import { unesc } from "../dominio/texto";
import { AGORA, loja, T, toast, useEstado } from "../loja";
import { baixar } from "../servidor/api";

export function RegistrarEmbarque({ oculto }: { oculto: boolean }) {
  const S = useEstado();
  const [pid, setPid] = useState("");
  const [bsel, setBsel] = useState("");
  const [tocado, setTocado] = useState(false);
  const [data, setData] = useState(iso(AGORA));
  const [dias, setDias] = useState("42");
  // translado: null = padrão (ida no dia anterior ao embarque, volta no último dia a bordo)
  const [ida, setIda] = useState<string | null>(null);
  const [volta, setVolta] = useState<string | null>(null);

  const comEscala = S.people.filter((p) => p.embark != null);
  const pidEf = comEscala.some((p) => String(p.id) === pid) ? pid : comEscala.length ? String(comEscala[0].id) : "";
  const pp = pessoa(S, pidEf);
  const barcoEf = tocado ? (bsel === "" || barco(S, +bsel) ? bsel : "") : pp && barco(S, pp.boat) ? String(pp.boat) : "";

  const d = toDay(data || iso(AGORA)),
    n = Math.max(1, parseInt(dias) || 0),
    ultimo = d + n - 1;
  const idaEf = ida ?? diaIso(d - TI_PADRAO),
    voltaEf = volta ?? diaIso(ultimo + TV_PADRAO);
  const ti = idaEf ? d - toDay(idaEf) : TI_PADRAO,
    tv = voltaEf ? toDay(voltaEf) - ultimo : TV_PADRAO;
  const erroTr = erroTranslado(ti, tv);
  const r = previaRegistro(d, n, erroTr ? TI_PADRAO : ti, erroTr ? TV_PADRAO : tv);

  const salvar = () => {
    const p = pessoa(S, pidEf),
      nd = parseInt(dias);
    if (!p || !nd || nd < 1 || !data) {
      toast("Informe colaborador, data e dias embarcados.");
      return;
    }
    if (erroTr) {
      toast(erroTr);
      return;
    }
    loja.mutar((E) => registrarEmbarque(E, p.id, toDay(data), nd, barcoEf ? +barcoEf : null, ti, tv));
    setTocado(false);
    setIda(null);
    setVolta(null);
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
              {(S.boats || []).map((b) => (
                <option key={b.id} value={b.id}>
                  {unesc(b.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Translado de ida
            <input type="date" id="tida" value={idaEf} onChange={(e) => setIda(e.target.value)} />
          </label>
          <label>
            Data de embarque
            <input type="date" id="data" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label>
            Dias embarcados
            <input type="number" id="dias" min="1" max="120" value={dias} onChange={(e) => setDias(e.target.value)} />
          </label>
          <label>
            Translado de volta
            <input type="date" id="tvolta" value={voltaEf} onChange={(e) => setVolta(e.target.value)} />
          </label>
          <p className="mute" style={{ margin: "-4px 0 10px", fontSize: 13 }}>
            Padrão: ida no dia anterior ao embarque e volta no último dia a bordo. Se a volta for no dia seguinte, ajuste a data.
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
            <div>
              <b>{fmt(r.ultimoBordo)}</b>
              <span>Último dia a bordo</span>
            </div>
            <div className="tr">
              <b>{fmt(r.volta)}</b>
              <span>{r.volta > r.ultimoBordo ? "Translado de volta" : "Translado de volta (no último dia a bordo)"}</span>
            </div>
            <div>
              <b>{fmt(r.inicioFolga) + " a " + fmt(r.ultimoFolga)}</b>
              <span>Folga</span>
            </div>
            <div>
              <b>{fmt(r.proximo)}</b>
              <span>{"Próximo embarque (translado em " + fmt(r.proximaIda) + ")"}</span>
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

  const comEscala = S.people.filter((p) => p.embark != null);
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
    let J: typeof import("jspdf").jsPDF;
    try {
      J = (await import("jspdf")).jsPDF;
    } catch {
      toast("A biblioteca de PDF não carregou. Verifique a conexão.");
      return;
    }
    const doc = new J({ unit: "mm", format: "a4" });
    let y = 18;
    pdfHistorico(S, dados(), T).forEach((l) => {
      y += l.antes || 0;
      if (y > 280) {
        doc.addPage();
        y = 18;
      }
      doc.setFontSize(l.sz);
      doc.setFont("helvetica", l.b ? "bold" : "normal");
      doc.text(l.t, l.x, y);
      y += l.sz > 12 ? 8 : 6;
    });
    baixar("historico-embarques.pdf", doc.output("blob"), () => toast("Não foi possível baixar o arquivo."));
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
            <input type="date" id="hde" value={hde} onChange={(e) => setHde(e.target.value)} />
          </label>
          <label>
            Até
            <input type="date" id="hate" value={hate} onChange={(e) => setHate(e.target.value || iso(AGORA))} />
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
  const cy = S.people.filter((p) => p.embark != null).map((p) => ({ p, c: cycle(p, T) }));
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
                    {c.st === "aboard" && !fe ? (
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
