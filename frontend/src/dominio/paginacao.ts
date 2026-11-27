/** Paginação de listas (ex.: Colaboradores, 10 por página). */

export interface Pagina<T> {
  /** Itens da página atual. */
  itens: T[];
  /** Página atual (1 em diante), já ajustada ao total. */
  pagina: number;
  /** Total de páginas (pelo menos 1). */
  paginas: number;
  /** Posição do primeiro e do último item mostrados (1 em diante; 0 quando a lista está vazia). */
  de: number;
  ate: number;
  total: number;
}

/** Recorta `lista` na página `pagina`; página fora do intervalo vai para a primeira ou a última. */
export function paginar<T>(lista: T[], pagina: number, porPagina: number): Pagina<T> {
  const total = lista.length,
    paginas = Math.max(1, Math.ceil(total / porPagina)),
    p = Math.min(Math.max(1, Math.floor(pagina) || 1), paginas),
    ini = (p - 1) * porPagina,
    itens = lista.slice(ini, ini + porPagina);
  return { itens, pagina: p, paginas, de: total ? ini + 1 : 0, ate: ini + itens.length, total };
}

/** Números de página para os botões: todas se forem poucas; senão a primeira, a última e as vizinhas da atual, com null no lugar das reticências. */
export function botoesPagina(pagina: number, paginas: number): (number | null)[] {
  if (paginas <= 7) return Array.from({ length: paginas }, (_, i) => i + 1);
  const set = new Set([1, paginas, pagina - 1, pagina, pagina + 1].filter((n) => n >= 1 && n <= paginas));
  const ns = [...set].sort((a, b) => a - b),
    out: (number | null)[] = [];
  ns.forEach((n, i) => {
    if (i && n - ns[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}
