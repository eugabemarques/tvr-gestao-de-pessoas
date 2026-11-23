/** Datas como no protótipo: número de dias desde 01/01/1970 (UTC). */
export const DAY = 864e5;

export const pad = (n: number): string => String(n).padStart(2, "0");

/** Data local no formato AAAA-MM-DD. */
export const iso = (d: Date): string => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

/** "AAAA-MM-DD" → número do dia. */
export const toDay = (s: string): number => Math.floor(Date.parse(s + "T00:00:00Z") / DAY);

/**
 * Dia utilizável: número finito dentro do intervalo que o Date aceita (±100 milhões de dias).
 * Uma data digitada pela metade ou com ano de 5 dígitos (o campo de data do navegador aceita)
 * vira NaN em toDay; sem esta checagem, toISOString lança erro e a tela inteira cai.
 */
export const diaOk = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1e8;

/** "AAAA-MM-DD" → número do dia, ou null se vazio ou inválido. */
export const diaOuNulo = (s: string | null | undefined): number | null => {
  if (!s) return null;
  const n = toDay(s);
  return diaOk(n) ? n : null;
};

/** Número do dia → "AAAA-MM-DD" (valor de input type=date); vazio para nulo ou inválido. */
export const diaIso = (n: number | null | undefined): string => (diaOk(n) ? new Date(n * DAY).toISOString().slice(0, 10) : "");

/** Número do dia → "dd/mm/aaaa"; vazio se inválido. */
export const fmt = (n: number): string =>
  diaOk(n) ? new Date(n * DAY).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }) : "";

/** Maior data aceita nos campos de data: impede o navegador de aceitar ano com 5 ou 6 dígitos. */
export const DATA_MAX = "9999-12-31";

/** Dia de hoje (horário local do navegador). */
export const hojeDia = (agora: Date = new Date()): number => toDay(iso(agora));

/** "Hoje é sexta-feira, 13 de novembro de 2026." */
export const textoHoje = (agora: Date): string =>
  "Hoje é " + agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + ".";
