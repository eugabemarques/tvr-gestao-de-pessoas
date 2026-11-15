/** Instância única do estado sincronizado e ganchos React para lê-lo. */
import { useSyncExternalStore } from "react";
import { hojeDia } from "./dominio/datas";
import { enviarPatch, obterEstado, obterVersao } from "./servidor/api";
import { Sincronizador } from "./servidor/sincronizacao";

export const loja = new Sincronizador(
  { enviarPatch, obterEstado, obterVersao },
  { dialogoAberto: () => !!document.querySelector("dialog[open]"), oculto: () => document.hidden },
);

/** Data de abertura da página, como o protótipo (TODAY). */
export const AGORA = new Date();
export const T = hojeDia(AGORA);

export const useEstado = () => useSyncExternalStore(loja.assinar, loja.obter);
export const useStatusSync = () => useSyncExternalStore(loja.assinar, loja.obterStatus);

/* ---------- aviso rápido (toast) ---------- */
type OuvinteToast = (m: string) => void;
const ouvintesToast = new Set<OuvinteToast>();
export const toast = (m: string): void => ouvintesToast.forEach((f) => f(m));
export const ouvirToast = (f: OuvinteToast): (() => void) => {
  ouvintesToast.add(f);
  return () => ouvintesToast.delete(f);
};
