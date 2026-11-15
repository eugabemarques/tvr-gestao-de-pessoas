/** Peças reutilizadas: diálogo nativo, chips de situação e aviso rápido. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { fmt } from "../dominio/datas";
import { pendDocs, setor } from "../dominio/documentos";
import type { Situacao } from "../dominio/escala";
import { unesc as unescTexto } from "../dominio/texto";
import type { Pessoa } from "../dominio/tipos";
import { ouvirToast } from "../loja";

/**
 * <dialog> modal nativo (mantém o ::backdrop do protótipo). O conteúdo só existe
 * enquanto está aberto, então cada abertura começa com o formulário novo.
 */
export function Dialogo(props: {
  aberto: boolean;
  aoFechar: () => void;
  rotulo: string;
  className?: string;
  /** Seletor do elemento que recebe o foco ao abrir. */
  foco?: string;
  selecionar?: boolean;
  children: ReactNode;
}) {
  const { aberto, aoFechar, rotulo, className = "panel dlg", foco, selecionar, children } = props;
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) {
      d.showModal();
      if (foco) {
        const el = d.querySelector<HTMLElement>(foco);
        el?.focus();
        if (selecionar && el instanceof HTMLInputElement) el.select();
      }
    } else if (!aberto && d.open) d.close();
  }, [aberto, foco, selecionar]);
  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={rotulo}
      onClose={() => {
        if (aberto) aoFechar();
      }}
    >
      {aberto ? children : null}
    </dialog>
  );
}

export const Chip = ({ k, children }: { k: string; children: ReactNode }) => <span className={"chip c-" + k}>{children}</span>;

/** Chip e linha de apoio da situação (equivalente ao `status()` do protótipo). */
export function ChipSituacao({ z, semBarco }: { z: Situacao; semBarco?: boolean }) {
  if (z.k === "ferias") return <Chip k="vac">Férias</Chip>;
  if (z.k === "none") return <span className="mute">Sem escala</span>;
  if (z.k === "emb") return <Chip k="sea">{"Embarcado" + (!semBarco && z.barco ? " · " + unescTexto(z.barco) : "")}</Chip>;
  return <Chip k="ok">Folga</Chip>;
}

export const subSituacao = (z: Situacao): string =>
  z.k === "ferias" ? "até " + fmt(z.fim) : z.k === "emb" ? "até " + fmt(z.fim) : z.k === "folga" ? "embarca em " + fmt(z.proximo) : "";

/** Chip de documentos pendentes do setor. */
export function ChipPendencias({ p }: { p: Pessoa }) {
  if (!setor(p.setor)) return null;
  const n = pendDocs(p).length;
  return <div>{n ? <Chip k="warn">{n + (n > 1 ? " documentos pendentes" : " documento pendente")}</Chip> : <Chip k="ok">Documentos completos</Chip>}</div>;
}

export function Toast() {
  const [m, setM] = useState("");
  const [on, setOn] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = ouvirToast((x) => {
      setM(x);
      setOn(true);
      clearTimeout(t);
      t = setTimeout(() => setOn(false), 2400);
    });
    return () => {
      off();
      clearTimeout(t);
    };
  }, []);
  return (
    <div className={"toast" + (on ? " on" : "")} id="toast" role="status">
      {m}
    </div>
  );
}
