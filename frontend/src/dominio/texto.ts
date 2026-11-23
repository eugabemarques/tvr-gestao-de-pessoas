/** Escape HTML usado pelo protótipo ao gravar textos digitados. */
export const esc = (s: unknown): string =>
  String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m] as string);

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Desfaz o escape (equivalente ao `unesc` do protótipo, sem depender do DOM). */
export const unesc = (s: unknown): string =>
  s == null
    ? ""
    : String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
        if (e[0] === "#") {
          const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
          return Number.isFinite(n) ? String.fromCodePoint(n) : m;
        }
        const v = ENT[e.toLowerCase()];
        return v ?? m;
      });

/** Compara nomes em ordem alfabética, sem diferenciar acentos e maiúsculas ("Álvaro" = "alvaro"). */
export const compararNomes = (a: unknown, b: unknown): number => unesc(a).localeCompare(unesc(b), "pt-BR", { sensitivity: "base" });

/** Cópia da lista (colaboradores, barcos…) em ordem alfabética do nome. */
export const porNome = <T extends { name: string }>(l: readonly T[] | null | undefined): T[] => [...(l || [])].sort((a, b) => compararNomes(a.name, b.name));

/** Iniciais (primeira e última palavra), como o avatar do protótipo. */
export const iniciais = (nome: string): string => {
  const w = nome.trim().split(/\s+/).filter(Boolean);
  return w.length ? (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase() : "";
};

/** Nome de arquivo da ficha: ficha_<nome>.txt. */
export const nomeArquivoFicha = (nome: string): string =>
  "ficha_" + unesc(nome).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "") + ".txt";
