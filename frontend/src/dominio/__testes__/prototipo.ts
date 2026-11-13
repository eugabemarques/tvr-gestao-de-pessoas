/* eslint-disable */
// @ts-nocheck
/**
 * Cópia literal das fórmulas do protótipo (index.html), só com TODAY e S passados
 * como parâmetro, para comparar com a implementação em TypeScript.
 */
export function protoCycle(p, TODAY) {
  const dob = p.dobra || 0, base = p.base || 42, A = p.dias + dob;
  if (TODAY < p.embark) return { st: "future", next: p.embark, end: p.embark + A - 1, days: p.embark - TODAY, pos: 0, L: A, start: p.embark, first: true, dobra: dob };
  const off = TODAY - p.embark, first = off < 2 * A;
  const L = first ? A : base, pos = first ? off : (off - 2 * A) % (2 * base), start = TODAY - pos;
  const o = { pos, L, start, first, dobra: first ? dob : 0, next: start + 2 * L, days: start + 2 * L - TODAY };
  if (pos < L) return { ...o, st: "aboard", day: pos + 1, end: start + L - 1 };
  return { ...o, st: "rest", day: pos - L + 1, end: start + 2 * L + base - 1 };
}
export function protoCourseState(c, TODAY) {
  const d = c.valid - TODAY;
  if (d < 0) return { k: "bad", t: "Vencido há " + (-d) + " dias" };
  if (d <= 90) return { k: "warn", t: "Vence em " + d + " dias" };
  return { k: "ok", t: "Em dia" };
}
export function protoStAso(c, TODAY) { const d = c.valid - TODAY; return d < 0 ? { k: "bad", g: "bad", t: "Vencido há " + (-d) + " dias" } : d <= 60 ? { k: "warn", g: "w60", t: "Vence em " + d + " dias" } : d <= 90 ? { k: "warn", g: "w90", t: "Vence em " + d + " dias" } : { k: "ok", g: "ok", t: "Em dia" } }
export function protoPeriodos(S, p, ate) {
  const out = (S.hist || []).filter(h => h.pid == p.id).sort((a, b) => a.ini - b.ini).map(h => ({ ini: h.ini, dias: h.dias, dobra: h.dobra || 0, boat: h.boat !== undefined ? h.boat : p.boat, src: "Registrado" }));
  const base = p.base || 42; let next;
  if (out.length) { const l = out[out.length - 1]; next = l.ini + 2 * (l.dias + l.dobra) }
  else if (p.embark != null) { out.push({ ini: p.embark, dias: p.dias, dobra: p.dobra || 0, boat: p.boat, src: "Previsto" }); next = p.embark + 2 * (p.dias + (p.dobra || 0)) }
  else return out;
  while (next <= ate) { out.push({ ini: next, dias: base, dobra: 0, boat: p.boat, src: "Previsto" }); next += 2 * base }
  return out;
}
export function protoCalc(S, p, de0, ate) {
  const per = protoPeriodos(S, p, ate), de = de0 == null ? (per.length ? per[0].ini : ate) : de0, m = new Map();
  per.forEach(x => {
    const t = x.dias + x.dobra;
    for (let d = x.ini; d < x.ini + t; d++)m.set(d, { s: d >= x.ini + x.dias ? "Dobra" : "A bordo", src: x.src });
    for (let d = x.ini + t; d < x.ini + 2 * t; d++)m.set(d, { s: "Folga", src: x.src });
  });
  const dias = []; let ab = 0, dob = 0, fo = 0;
  for (let d = de; d <= ate; d++) { const v = m.get(d); if (!v) continue; dias.push([d, v.s, v.src]); if (v.s === "Folga") fo++; else { ab++; if (v.s === "Dobra") dob++ } }
  return { p, per, de, ate, dias, ab, dob, fo };
}
/** Avisos do render() do protótipo, sem o HTML. */
export function protoAvisos(S, TODAY) {
  const cy = S.people.filter(p => p.embark != null).map(p => ({ p, c: protoCycle(p, TODAY) }));
  const al = [];
  cy.forEach(({ p, c }) => {
    if (c.st !== "aboard" && c.days > 30) return;
    S.courses.filter(k => k.pid == p.id && k.valid <= c.end).forEach(k => {
      const before = k.valid < c.next && c.st !== "aboard";
      const key = p.id + "|" + k.name + "|" + k.valid;
      al.push({ key, res: (S.resolved || []).includes(key), bad: k.valid < TODAY || before });
    });
  });
  al.sort((a, b) => b.bad - a.bad);
  return al;
}
/** Clique em "Adicionar dobra" do protótipo. */
export function protoDobra(S, pid, n, TODAY) {
  const p = S.people.find(p => p.id == pid);
  const c = protoCycle(p, TODAY);
  if (c.first) { p.dobra = (p.dobra || 0) + n } else { p.embark = c.start; p.dias = c.L; p.dobra = n }
  S.hist = S.hist || []; const hh = S.hist.find(x => x.pid === p.id && x.ini === p.embark); if (hh) hh.dobra = p.dobra; else S.hist.push({ pid: p.id, ini: p.embark, dias: p.dias, dobra: p.dobra, boat: p.boat });
}
const CHV = { people: x => String(x.id), boats: x => String(x.id), courses: x => x.pid + "|" + x.name, hist: x => x.pid + "|" + x.ini, resolved: x => String(x) };
export function protoDiff(a, b) {
  a = a || {}; b = b || {}; const ops = [], ks = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const c of ks) {
    const f = CHV[c];
    if (f && Array.isArray(a[c] || []) && Array.isArray(b[c] || [])) {
      const ma = new Map((a[c] || []).map(x => [f(x), x])), mb = new Map((b[c] || []).map(x => [f(x), x]));
      for (const [k, v] of mb) { const o = ma.get(k); if (!o || JSON.stringify(o) !== JSON.stringify(v)) ops.push({ c, k, v }) }
      for (const k of ma.keys()) if (!mb.has(k)) ops.push({ c, k, v: null });
    } else if (JSON.stringify(a[c]) !== JSON.stringify(b[c])) ops.push({ c, w: 1, v: b[c] === undefined ? null : b[c] });
  }
  return ops;
}
