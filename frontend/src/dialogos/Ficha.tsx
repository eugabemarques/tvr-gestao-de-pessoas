/** Ficha do colaborador: dados pessoais, cursos e ASO, embarques e vacinas, com anexos por campo. */
import { useRef, useState, type ReactNode } from "react";
import { Chip, Dialogo } from "../componentes/Comuns";
import { IcAncora, IcClipe, IcDados, IcFechar, IcLivro, IcOk, IcPessoa, IcVacina } from "../componentes/Icones";
import { formDe, removerColab, salvarColab, validarColab, validarCursosFicha, type FormColab } from "../dominio/cadastros";
import { fmt, toDay } from "../dominio/datas";
import {
  ACEITOS,
  campoObrigatorio,
  CURSOS,
  curCampo,
  docsDo,
  erroArq,
  reqInfo,
  setor,
  syncReqCur,
  VACS,
  type LinhaCurso,
  type SecaoFicha,
} from "../dominio/documentos";
import { nomeBarco, periodos, pessoa, situacaoPeriodo } from "../dominio/escala";
import { iniciais, unesc } from "../dominio/texto";
import type { ChaveVacina, Documento, Estado, Pessoa } from "../dominio/tipos";
import { courseState, isAso, stAso } from "../dominio/validade";
import { loja, T, toast, useEstado } from "../loja";
import { guardar } from "../servidor/api";

type Secao = SecaoFicha | "embarques";

/** Campos validados que ficam na seção Embarques. */
const DA_SECAO_EMBARQUES = new Set(["cdata", "cdias", "cfi", "cff"]);

interface Ctx {
  docs: Documento[];
  req: string[];
  anexar: (campo: string) => void;
  removerDoc: (campo: string) => void;
}

function Clip({ ctx, anexo, rotulo, ariaPrefixo = "Anexar documento: " }: { ctx: Ctx; anexo: string; rotulo: string; ariaPrefixo?: string }) {
  const d = ctx.docs.find((x) => x.campo === anexo);
  const req = campoObrigatorio(ctx.req, anexo) && !d;
  return (
    <button
      type="button"
      className={"clip" + (d ? " on" : "") + (req ? " req" : "")}
      aria-label={ariaPrefixo + rotulo}
      title={d ? "Anexado: " + d.name + " (clique para trocar)" : "Anexar documento"}
      onClick={(e) => {
        e.preventDefault();
        ctx.anexar(anexo);
      }}
    >
      <IcClipe />
    </button>
  );
}

function FDoc({ ctx, campo, className = "fdoc" }: { ctx: Ctx; campo: string; className?: string }) {
  const d = ctx.docs.find((x) => x.campo === campo);
  return (
    <div className={className} data-docof={campo}>
      {d ? (
        <>
          <Chip k="ok">Anexado</Chip>
          <span>{d.name}</span>
          <button className="linkb" type="button" onClick={() => ctx.removerDoc(campo)}>
            Remover
          </button>
        </>
      ) : null}
    </div>
  );
}

function RTag({ ctx, anexo }: { ctx: Ctx; anexo: string }) {
  if (!campoObrigatorio(ctx.req, anexo)) return null;
  const ok = ctx.docs.some((x) => x.campo === anexo);
  return <span className={"rtag " + (ok ? "ok" : "pend")}>{ok ? "Documento anexado" : "Documento obrigatório"}</span>;
}

/** Um campo da ficha, com clipe de anexo e situação do documento quando houver. */
function Campo(props: { ctx: Ctx; id?: string; rotulo: string; w2?: boolean; anexo?: string; semDoc?: boolean; aria?: string; children: ReactNode }) {
  const { ctx, id, rotulo, w2, anexo, semDoc, aria, children } = props;
  return (
    <div className={"ff" + (w2 ? " w2" : "")}>
      <label htmlFor={id}>
        {rotulo}
        {anexo && !semDoc ? <RTag ctx={ctx} anexo={anexo} /> : null}
      </label>
      <div className="fin">
        {children}
        {anexo ? <Clip ctx={ctx} anexo={anexo} rotulo={aria || rotulo} /> : null}
      </div>
      {anexo && !semDoc ? <FDoc ctx={ctx} campo={anexo} /> : null}
    </div>
  );
}

function Anexar({ ctx, anexo }: { ctx: Ctx; anexo: string }) {
  const d = ctx.docs.find((x) => x.campo === anexo);
  return (
    <button type="button" className={"fattach" + (d ? " on" : "")} onClick={() => ctx.anexar(anexo)}>
      {d ? d.name : "Clique para anexar o documento"}
    </button>
  );
}

function EmbarquesFicha({ S, p }: { S: Estado; p: Pessoa | undefined }) {
  if (!p) return <p className="empty">Salve o colaborador para ver os embarques.</p>;
  if (p.embark == null) return <p className="empty">Sem escala definida.</p>;
  const per = periodos(p, S.hist, T + 120);
  if (!per.length) return <p className="empty">Nenhum embarque registrado.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>Nº</th>
          <th>A bordo</th>
          <th>Dias</th>
          <th>Folga até</th>
          <th>Barco</th>
          <th>Situação</th>
        </tr>
      </thead>
      <tbody>
        {per.map((x, i) => {
          const t = x.dias + x.dobra,
            fb = x.ini + t - 1,
            ff = x.ini + 2 * t - 1,
            s = situacaoPeriodo(x, T);
          return (
            <tr key={i}>
              <td>
                <b>{i + 1 + "º"}</b>
              </td>
              <td>
                {fmt(x.ini) + " a " + fmt(fb)}
                <div className="mute">{x.src}</div>
              </td>
              <td>
                {t}
                {x.dobra ? <div className="mute">{"dobra +" + x.dobra}</div> : null}
              </td>
              <td>{fmt(ff)}</td>
              <td>{unesc(nomeBarco(S, x.boat)) || <span className="mute">—</span>}</td>
              <td>
                {s === "Previsto" ? <Chip k="warn">Previsto</Chip> : s === "Embarcado" ? <Chip k="sea">Embarcado</Chip> : s === "Folga" ? <Chip k="ok">Folga</Chip> : <span className="mute">Concluído</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CorpoFicha({ cedit, aoFechar }: { cedit: number | null; aoFechar: () => void }) {
  const S = useEstado();
  const [inicial] = useState(() => {
    const p = cedit ? pessoa(S, cedit) : undefined;
    const docs = p && p.docs ? [...p.docs] : [];
    const ccur: LinhaCurso[] = p
      ? S.courses
          .filter((c) => c.pid == p.id)
          .sort((a, b) => +isAso(b) - +isAso(a) || a.valid - b.valid)
          .map((c) => ({ name: c.name, valid: c.valid }))
      : [];
    const f = formDe(S, p);
    return { f, docs, ccur: syncReqCur(ccur, f.setor, docs) };
  });
  const [f, setF] = useState<FormColab>(inicial.f);
  const [docs, setDocs] = useState<Documento[]>(inicial.docs);
  const [ccur, setCcur] = useState<LinhaCurso[]>(inicial.ccur);
  const [sec, setSec] = useState<Secao>("dados");
  const [erro, setErro] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const anx = useRef<string | null>(null);
  const inputAnexo = useRef<HTMLInputElement>(null);
  const corpo = useRef<HTMLDivElement>(null);

  const p = cedit ? pessoa(S, cedit) : undefined;
  const st = setor(f.setor);
  const I = reqInfo(f.setor, docs);

  const focar = (id: string) => setTimeout(() => document.getElementById(id)?.focus(), 0);
  const irPara = (k: Secao) => {
    setSec(k);
    if (corpo.current) corpo.current.scrollTop = 0;
  };
  const set = <K extends keyof FormColab>(k: K, v: FormColab[K]) => setF((x) => ({ ...x, [k]: v }));
  const txt = (k: keyof Omit<FormColab, "vac">) => ({
    value: f[k] as string,
    onChange: (e: { target: { value: string } }) => set(k, e.target.value),
  });

  const ctx: Ctx = {
    docs,
    req: I.list,
    anexar: (campo) => {
      anx.current = campo;
      inputAnexo.current?.click();
    },
    removerDoc: (campo) => setDocs((d) => d.filter((x) => x.campo !== campo)),
  };

  const aoAnexar = async (fl: File | undefined) => {
    if (!fl) return;
    const campo = anx.current as string;
    let doc: Documento;
    try {
      doc = await guardar(fl);
    } catch (e) {
      setErro(erroArq(fl.name, e));
      return;
    }
    setDocs((d) => d.filter((x) => x.campo !== campo).concat([{ campo, ...doc }]));
  };

  const aoOutros = async (fs: File[]) => {
    for (const fl of fs) {
      try {
        const doc = await guardar(fl);
        setDocs((d) => d.concat([doc]));
      } catch (e) {
        setErro(erroArq(fl.name, e));
      }
    }
  };

  const mudarSetor = (v: string) => {
    set("setor", v);
    setCcur((c) => syncReqCur(c, v, docs));
  };

  /* cursos da ficha */
  const addCurso = (k: "a" | "c") => {
    if (k === "a") {
      if (ccur.some((x) => /^ASO/i.test(x.name))) {
        toast("Este colaborador já tem ASO. Atualize a validade dele.");
        return;
      }
      setCcur((c) => c.concat([{ name: "ASO", valid: null }]));
      focar("fcv" + ccur.length);
    } else {
      if (ccur.filter((x) => !/^ASO/i.test(x.name)).length >= CURSOS.length && !ccur.some((x) => !x.name)) {
        toast("Todos os cursos da lista já foram adicionados.");
        return;
      }
      setCcur((c) => c.concat([{ name: "", valid: null }]));
      focar("fcn" + ccur.length);
    }
  };
  const remCurso = (i: number) => {
    const x = ccur[i];
    if (x.name) {
      const cp = curCampo(x.name);
      setDocs((d) => d.filter((y) => y.campo !== cp));
    }
    setCcur((c) => c.filter((_, j) => j !== i));
  };
  const nomeCurso = (i: number, nw: string) => {
    const old = ccur[i].name;
    if (old) {
      const oc = curCampo(old),
        nc = nw ? curCampo(nw) : null;
      setDocs((d) => (nc ? d.map((x) => (x.campo === oc ? { ...x, campo: nc } : x)) : d.filter((x) => x.campo !== oc)));
    }
    setCcur((c) => c.map((r, j) => (j === i ? { ...r, name: nw } : r)));
  };
  const validadeCurso = (i: number, v: string) => setCcur((c) => c.map((r, j) => (j === i ? { ...r, valid: v ? toDay(v) : null } : r)));

  const salvar = () => {
    const bad = validarColab(f);
    if (bad) {
      setErro(bad.msg);
      irPara(DA_SECAO_EMBARQUES.has(bad.campo) ? "embarques" : "dados");
      focar(bad.campo);
      return;
    }
    const bc = validarCursosFicha(ccur);
    if (bc) {
      irPara("cursos");
      setErro(bc.msg);
      focar((bc.semNome ? "fcn" : "fcv") + bc.i);
      return;
    }
    setErro("");
    const novo = !cedit;
    loja.mutar((E) => salvarColab(E, cedit, f, docs, ccur));
    aoFechar();
    toast(novo ? "Colaborador adicionado." : "Colaborador atualizado.");
  };
  const remover = () => {
    if (!confirmar) {
      setConfirmar(true);
      return;
    }
    if (cedit) loja.mutar((E) => removerColab(E, cedit));
    aoFechar();
    toast("Colaborador removido.");
  };

  const ini = iniciais(f.nome);
  const nb = (k: SecaoFicha) => {
    const n = I.sec[k] || 0;
    return (
      <span className="nb" hidden={!n} title={n + (n > 1 ? " documentos obrigatórios pendentes" : " documento obrigatório pendente")}>
        {n}
      </span>
    );
  };
  const navBtn = (k: Secao, icone: ReactNode, rotulo: string) => (
    <button type="button" aria-current={sec === k ? "true" : undefined} onClick={() => irPara(k)}>
      {icone}
      {rotulo}
      {k !== "embarques" ? nb(k) : null}
    </button>
  );
  const outros = docs.map((d, i) => ({ d, i })).filter((x) => !x.d.campo);

  return (
    <div className="fwrap">
      <aside className="fside">
        <div className="favatar" id="cav" aria-hidden="true">
          {ini || <IcPessoa />}
        </div>
        <h2 id="t-cd">{f.nome.trim() || "Novo colaborador"}</h2>
        <p className="mute fsub" id="cavsub">
          {[st?.nome, f.cargo.trim()].filter(Boolean).join(" · ") || (cedit ? "" : "Novo cadastro")}
        </p>
        <nav className="fnav" aria-label="Seções da ficha">
          {navBtn("dados", <IcDados />, "Dados pessoais")}
          {navBtn("cursos", <IcLivro />, "Cursos")}
          {navBtn("embarques", <IcAncora />, "Embarques")}
          {navBtn("vacinas", <IcVacina />, "Vacinas")}
        </nav>
        <button className="ghost" id="cremover" type="button" hidden={!cedit} onClick={remover}>
          {confirmar ? "Confirmar remoção" : "Remover colaborador"}
        </button>
      </aside>
      <div className="fmain">
        <div className="fbody" id="fbody" ref={corpo}>
          <section hidden={sec !== "dados"}>
            <h3 className="fh">Dados pessoais</h3>
            <p className="mute fintro">
              Use o clipe ao lado de cada campo para anexar o documento, que vai direto para a pasta do colaborador. Ao escolher o setor, os documentos obrigatórios ficam marcados nos próprios campos.
            </p>
            <div className="fgrid">
              <Campo ctx={ctx} id="cnome" rotulo="Nome completo" w2 anexo="Nome">
                <input id="cnome" type="text" autoComplete="off" {...txt("nome")} />
              </Campo>
              <Campo ctx={ctx} id="crg" rotulo="RG" anexo="RG / CPF / CNH">
                <input id="crg" type="text" autoComplete="off" {...txt("rg")} />
              </Campo>
              <Campo ctx={ctx} id="ccpf" rotulo="CPF" anexo="RG / CPF / CNH" semDoc>
                <input id="ccpf" type="text" autoComplete="off" inputMode="numeric" {...txt("cpf")} />
              </Campo>
              <Campo ctx={ctx} id="cpis" rotulo="Nº PIS (opcional)" anexo="Nº do PIS">
                <input id="cpis" type="text" autoComplete="off" inputMode="numeric" {...txt("pis")} />
              </Campo>
              <Campo ctx={ctx} id="cpass" rotulo="Nº Passaporte (opcional)" anexo="Passaporte (se tiver)">
                <input id="cpass" type="text" autoComplete="off" {...txt("pass")} />
              </Campo>
              <Campo ctx={ctx} id="cmae" rotulo="Nome da mãe" w2>
                <input id="cmae" type="text" autoComplete="off" {...txt("mae")} />
              </Campo>
              <Campo ctx={ctx} id="cpai" rotulo="Nome do pai (opcional)" w2>
                <input id="cpai" type="text" autoComplete="off" {...txt("pai")} />
              </Campo>
              <Campo ctx={ctx} id="cemail" rotulo="E-mail" w2>
                <input id="cemail" type="email" autoComplete="off" {...txt("email")} />
              </Campo>
              <Campo ctx={ctx} id="ccel" rotulo="Celular">
                <input id="ccel" type="tel" autoComplete="off" {...txt("cel")} />
              </Campo>
              <Campo ctx={ctx} id="ccel2" rotulo="Celular 2 (opcional)">
                <input id="ccel2" type="tel" autoComplete="off" {...txt("cel2")} />
              </Campo>
              <Campo ctx={ctx} id="ccargo" rotulo="Cargo">
                <input id="ccargo" type="text" autoComplete="off" {...txt("cargo")} />
              </Campo>
              <Campo ctx={ctx} id="cemerg" rotulo="Contato de emergência (nome e telefone)">
                <input id="cemerg" type="text" autoComplete="off" {...txt("emerg")} />
              </Campo>
              <Campo ctx={ctx} id="crua" rotulo="Rua" w2 anexo="Comprovante de Residência">
                <input id="crua" type="text" autoComplete="off" {...txt("rua")} />
              </Campo>
              <Campo ctx={ctx} id="cnum" rotulo="Número">
                <input id="cnum" type="text" autoComplete="off" {...txt("num")} />
              </Campo>
              <Campo ctx={ctx} id="cbairro" rotulo="Bairro">
                <input id="cbairro" type="text" autoComplete="off" {...txt("bairro")} />
              </Campo>
              <Campo ctx={ctx} id="ccidade" rotulo="Cidade">
                <input id="ccidade" type="text" autoComplete="off" {...txt("cidade")} />
              </Campo>
              <Campo ctx={ctx} id="ccep" rotulo="CEP">
                <input id="ccep" type="text" autoComplete="off" inputMode="numeric" {...txt("cep")} />
              </Campo>
              <Campo ctx={ctx} id="csetor" rotulo="Setor">
                <select id="csetor" value={f.setor} onChange={(e) => mudarSetor(e.target.value)}>
                  <option value="">Escolha</option>
                  <option value="ambiental">Ambiental</option>
                  <option value="administrativo">Administrativo</option>
                  <option value="manutencao">Manutenção Offshore</option>
                </select>
              </Campo>
            </div>
            <h4 className="fh4">Documentos</h4>
            <div className="fgrid">
              <Campo ctx={ctx} rotulo="Certidão de nascimento ou casamento" w2 anexo="Certidão de Nascimento / Certidão de casamento">
                <Anexar ctx={ctx} anexo="Certidão de Nascimento / Certidão de casamento" />
              </Campo>
              <Campo ctx={ctx} id="ctit" rotulo="Nº do título de eleitor" anexo="Título de Eleitor">
                <input id="ctit" type="text" autoComplete="off" {...txt("tit")} />
              </Campo>
              <Campo ctx={ctx} id="cctps" rotulo="Nº da CTPS (física ou digital)" anexo="CTPS física (e CTPS digital)">
                <input id="cctps" type="text" autoComplete="off" {...txt("ctps")} />
              </Campo>
              <Campo ctx={ctx} id="cescol" rotulo="Escolaridade" w2 anexo="Comprovante de Escolaridade">
                <select id="cescol" {...txt("escol")}>
                  <option value="">Escolha</option>
                  <option>Ensino fundamental</option>
                  <option>Ensino médio</option>
                  <option>Ensino técnico</option>
                  <option>Ensino superior</option>
                  <option>Pós-graduação</option>
                </select>
              </Campo>
            </div>
            <div className="fgrid" id="cdamb" hidden={!docsDo(f.setor).includes("CTF Ibama (atualizado)")}>
              <Campo ctx={ctx} id="cctf" rotulo="Nº do CTF Ibama (atualizado)" anexo="CTF Ibama (atualizado)">
                <input id="cctf" type="text" autoComplete="off" {...txt("ctf")} />
              </Campo>
              <Campo ctx={ctx} rotulo="Work Citation" anexo="Work Citation">
                <Anexar ctx={ctx} anexo="Work Citation" />
              </Campo>
            </div>
            <label className="fother">
              Outros documentos (PDF ou imagem, até 20 MB cada)
              <input
                type="file"
                id="cdocs"
                multiple
                accept={ACEITOS}
                onChange={(e) => {
                  const fs = Array.from(e.target.files || []);
                  e.target.value = "";
                  void aoOutros(fs);
                }}
              />
            </label>
            <div id="clistdocs" className="mute" style={{ marginBottom: 12 }}>
              {outros.map(({ d, i }, j) => (
                <span key={i}>
                  {j ? <br /> : null}
                  {d.name + " (" + Math.max(1, Math.round((d.size || 0) / 1024)) + " KB) "}
                  <button className="ghost" type="button" onClick={() => setDocs((x) => x.filter((_, k) => k !== i))}>
                    Remover
                  </button>
                </span>
              ))}
            </div>
          </section>

          <section hidden={sec !== "cursos"}>
            <h3 className="fh">Cursos e ASO</h3>
            <p className="mute fintro">Adicione os cursos e o ASO, informe a validade e anexe o certificado pelo clipe. Os arquivos vão para a pasta do colaborador ao salvar.</p>
            <div id="fcursos">
              <div className="row fcacts">
                <button type="button" onClick={() => addCurso("c")}>
                  Adicionar curso
                </button>
                <button type="button" className="ghost" onClick={() => addCurso("a")}>
                  Adicionar ASO
                </button>
              </div>
              {ccur.length ? (
                ccur.map((r, i) => {
                  const aso = /^ASO/i.test(r.name),
                    s = r.valid == null ? null : aso ? stAso({ valid: r.valid }, T) : courseState({ valid: r.valid }, T),
                    cp = r.name ? curCampo(r.name) : "";
                  const opts: [string, string][] = CURSOS.slice();
                  if (r.name && !opts.some((x) => x[0] === r.name)) opts.push([r.name, r.name + " (nome antigo)"]);
                  const temDoc = !!cp && docs.some((d) => d.campo === cp);
                  return (
                    <div className={"crow" + (r.req ? " req" : "")} key={i}>
                      <div className="ff">
                        <label htmlFor={"fcn" + i}>{r.req ? "Curso obrigatório do setor" : aso ? "Exame" : "Curso"}</label>
                        <div className="fin">
                          {r.req ? (
                            <input id={"fcn" + i} value={r.name} readOnly />
                          ) : aso ? (
                            <input id={"fcn" + i} value="ASO" readOnly />
                          ) : (
                            <select id={"fcn" + i} value={r.name} onChange={(e) => nomeCurso(i, e.target.value)}>
                              <option value="">Escolha o curso</option>
                              {opts.map((x) => (
                                <option key={x[0]} value={x[0]} disabled={x[0] !== r.name && ccur.some((y) => y.name === x[0])}>
                                  {x[1]}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                      <div className="ff">
                        <label htmlFor={"fcv" + i}>Validade</label>
                        <div className="fin">
                          <input type="date" id={"fcv" + i} value={r.valid == null ? "" : new Date(r.valid * 864e5).toISOString().slice(0, 10)} onChange={(e) => validadeCurso(i, e.target.value)} />
                        </div>
                      </div>
                      <div className="cst">{s ? <Chip k={s.k}>{s.t}</Chip> : r.req ? <Chip k="warn">Pendente</Chip> : <span className="mute">Sem validade</span>}</div>
                      <div className="cact">
                        {cp ? (
                          <button
                            type="button"
                            className={"clip" + (temDoc ? " on" : "") + (r.req && !temDoc ? " req" : "")}
                            aria-label={"Anexar certificado: " + r.name}
                            title={temDoc ? "Anexado: " + (docs.find((d) => d.campo === cp) as Documento).name + " (clique para trocar)" : "Anexar documento"}
                            onClick={() => ctx.anexar(cp)}
                          >
                            <IcClipe />
                          </button>
                        ) : null}
                        {r.req ? null : (
                          <button type="button" className="ghost" onClick={() => remCurso(i)}>
                            Remover
                          </button>
                        )}
                      </div>
                      {cp ? <FDoc ctx={ctx} campo={cp} className="fdoc cdoc" /> : null}
                    </div>
                  );
                })
              ) : (
                <p className="empty">Nenhum curso cadastrado. Use os botões acima para adicionar e depois anexe o certificado pelo clipe.</p>
              )}
            </div>
          </section>

          <section hidden={sec !== "embarques"}>
            <h3 className="fh">Embarques</h3>
            <p className="mute fintro">Escala, férias e todos os embarques do colaborador, do 1º ao mais recente.</p>
            <div id="cescala" hidden={!st?.escala}>
              <div className="fgrid">
                <div className="ff w2">
                  <label htmlFor="cbarco">Barco</label>
                  <div className="fin">
                    <select id="cbarco" {...txt("barco")}>
                      <option value="">Sem barco definido</option>
                      {(S.boats || []).map((b) => (
                        <option key={b.id} value={b.id}>
                          {unesc(b.name)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="ff">
                  <label htmlFor="cdata">Data do embarque atual ou do próximo</label>
                  <div className="fin">
                    <input type="date" id="cdata" {...txt("data")} />
                  </div>
                </div>
                <div className="ff">
                  <label htmlFor="cdias">Dias da escala</label>
                  <div className="fin">
                    <input type="number" id="cdias" min="1" max="120" {...txt("dias")} />
                  </div>
                </div>
              </div>
            </div>
            <p className="mute" id="cescoff" hidden={!!st?.escala}>
              A escala de embarque é obrigatória apenas para o setor Ambiental. O setor é escolhido em Dados pessoais.
            </p>
            <h4 className="fh4">Férias</h4>
            <div className="fgrid">
              <div className="ff">
                <label htmlFor="cfi">Início (opcional)</label>
                <div className="fin">
                  <input type="date" id="cfi" {...txt("fi")} />
                </div>
              </div>
              <div className="ff">
                <label htmlFor="cff">Fim</label>
                <div className="fin">
                  <input type="date" id="cff" {...txt("ff")} />
                </div>
              </div>
            </div>
            <h4 className="fh4">Embarques do colaborador</h4>
            <div className="scroll" id="fembs">
              <EmbarquesFicha S={S} p={p} />
            </div>
          </section>

          <section hidden={sec !== "vacinas"}>
            <h3 className="fh">Vacinas</h3>
            <p className="mute fintro">Informe a data e anexe o comprovante de cada vacina. Com os três comprovantes, o item de vacinação dos documentos obrigatórios fica completo.</p>
            <div className="fgrid">
              {VACS.map(([k, nome]) => {
                const id = { cov: "cvcov", dt: "cvdt", fa: "cvfa" }[k as ChaveVacina];
                const rot = nome + (k === "fa" ? " · data da dose" : " · data da última dose");
                return (
                  <Campo key={k} ctx={ctx} id={id} rotulo={rot} w2 anexo={"Vacina: " + nome}>
                    <input id={id} type="date" autoComplete="off" value={f.vac[k]} onChange={(e) => set("vac", { ...f.vac, [k]: e.target.value })} />
                  </Campo>
                );
              })}
            </div>
          </section>
        </div>
        <div className="ffoot">
          <p id="cerro" className="ferr" role="alert">
            {erro}
          </p>
          <button className="fbtn fx" id="cfechar" type="button" aria-label="Cancelar" title="Cancelar" onClick={aoFechar}>
            <IcFechar />
          </button>
          <button className="fbtn fok" id="csalvar" type="button" aria-label="Salvar" title="Salvar" onClick={salvar}>
            <IcOk />
          </button>
        </div>
      </div>
      <input
        type="file"
        id="canexo"
        hidden
        accept={ACEITOS}
        ref={inputAnexo}
        onChange={(e) => {
          const fl = e.target.files?.[0];
          e.target.value = "";
          void aoAnexar(fl);
        }}
      />
    </div>
  );
}

export function Ficha({ aberto, cedit, aoFechar }: { aberto: boolean; cedit: number | null; aoFechar: () => void }) {
  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} rotulo="t-cd" className="panel dlg ficha" foco="#cnome">
      <CorpoFicha cedit={cedit} aoFechar={aoFechar} />
    </Dialogo>
  );
}
