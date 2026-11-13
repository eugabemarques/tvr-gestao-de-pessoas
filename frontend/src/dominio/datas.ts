/** Datas como no protótipo: número de dias desde 01/01/1970 (UTC). */
export const DAY = 864e5;

export const pad = (n: number): string => String(n).padStart(2, "0");

/** Data local no formato AAAA-MM-DD. */
export const iso = (d: Date): string => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

/** "AAAA-MM-DD" → número do dia. */
export const toDay = (s: string): number => Math.floor(Date.parse(s + "T00:00:00Z") / DAY);

/** Número do dia → "AAAA-MM-DD" (valor de input type=date); vazio para nulo. */
export const diaIso = (n: number | null | undefined): string =>
  n == null ? "" : new Date(n * DAY).toISOString().slice(0, 10);

/** Número do dia → "dd/mm/aaaa". */
export const fmt = (n: number): string =>
  new Date(n * DAY).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });

/** Dia de hoje (horário local do navegador). */
export const hojeDia = (agora: Date = new Date()): number => toDay(iso(agora));

/** "Hoje é sexta-feira, 13 de novembro de 2026." */
export const textoHoje = (agora: Date): string =>
  "Hoje é " + agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + ".";
