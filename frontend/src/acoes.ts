/** Ações que abrem os diálogos, disponíveis para todas as telas. */
import { createContext, useContext } from "react";

export interface Acoes {
  abrirPasta(id: number): void;
  abrirColab(id?: number | null): void;
  abrirBarco(id?: number | null): void;
  /** `chave` = "pid|nome" do curso em edição, ou null para novo. */
  abrirCurso(chave: string | null, tipo: "c" | "a"): void;
  abrirDobra(id: number): void;
  info(titulo: string, texto: string): void;
}

export const AcoesCtx = createContext<Acoes | null>(null);

export function useAcoes(): Acoes {
  const a = useContext(AcoesCtx);
  if (!a) throw new Error("AcoesCtx ausente");
  return a;
}
