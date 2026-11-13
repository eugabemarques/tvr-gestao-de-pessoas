/** Diferença entre dois estados (patch) e aplicação, no mesmo protocolo do servidor. */

type Registro = Record<string, unknown>;
type Chave = (x: never) => string;

/** Chave de cada item nas coleções tratadas registro a registro. */
export const CHV: Record<string, Chave> = {
  people: (x: { id: unknown }) => String(x.id),
  boats: (x: { id: unknown }) => String(x.id),
  courses: (x: { pid: unknown; name: unknown }) => x.pid + "|" + x.name,
  hist: (x: { pid: unknown; ini: unknown }) => x.pid + "|" + x.ini,
  resolved: (x: unknown) => String(x),
};

const chave = (c: string, x: unknown): string => (CHV[c] as (x: unknown) => string)(x);

export type Op = { c: string; k: string; v: unknown } | { c: string; w: 1; v: unknown };

export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

export function diffEstado(a0: Registro | null | undefined, b0: Registro | null | undefined): Op[] {
  const a = a0 || {},
    b = b0 || {};
  const ops: Op[] = [],
    ks = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const c of ks) {
    const f = Object.prototype.hasOwnProperty.call(CHV, c);
    const ac = a[c] || [],
      bc = b[c] || [];
    if (f && Array.isArray(ac) && Array.isArray(bc)) {
      const ma = new Map(ac.map((x) => [chave(c, x), x])),
        mb = new Map(bc.map((x) => [chave(c, x), x]));
      for (const [k, v] of mb) {
        const o = ma.get(k);
        if (!o || JSON.stringify(o) !== JSON.stringify(v)) ops.push({ c, k, v });
      }
      for (const k of ma.keys()) if (!mb.has(k)) ops.push({ c, k, v: null });
    } else if (JSON.stringify(a[c]) !== JSON.stringify(b[c])) ops.push({ c, w: 1, v: b[c] === undefined ? null : b[c] });
  }
  return ops;
}

export function aplicarPatch<T extends Registro>(st: T, ops: Op[]): T {
  const s = st as Registro;
  for (const o of ops) {
    if ("w" in o || !Object.prototype.hasOwnProperty.call(CHV, o.c)) {
      s[o.c] = o.v;
      continue;
    }
    const arr = (s[o.c] = (s[o.c] as unknown[]) || []) as unknown[],
      i = arr.findIndex((x) => chave(o.c, x) === o.k);
    if (o.v == null) {
      if (i >= 0) arr.splice(i, 1);
    } else if (i >= 0) arr[i] = o.v;
    else arr.push(o.v);
  }
  return st;
}
