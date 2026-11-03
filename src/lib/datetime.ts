import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { format as fnsFormat } from "date-fns";

/** Fuso oficial do app — todas as datas/horas exibidas devem usar este TZ. */
export const BR_TZ = "America/Sao_Paulo";

type DateInput = Date | string | number | null | undefined;

const toDate = (v: DateInput): Date | null => {
  if (v == null || v === "") return null;
  // "2026-11-10" (data sem hora, ex.: vencimento) é um dia do calendário, não meia-noite UTC.
  // Sem isso, no fuso de Brasília a data aparecia um dia antes (09/11).
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const day = new Date(`${v}T12:00:00-03:00`);
    return isNaN(day.getTime()) ? null : day;
  }
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Substituto drop-in para `date-fns#format`, mas sempre rendendo no fuso de Brasília.
 * Use `import { formatBR as format } from "@/lib/datetime"`.
 */
export function formatBR(date: DateInput, pattern: string, options?: any): string {
  const d = toDate(date);
  if (!d) return "";
  return formatInTimeZone(d, BR_TZ, pattern, options);
}

/** Converte um timestamp absoluto para Date com paredes em horário BR (útil para cálculos baseados em "hoje"). */
export const toBR = (date: DateInput): Date => {
  const d = toDate(date) ?? new Date();
  return toZonedTime(d, BR_TZ);
};

/** Agora em BR-tz como Date. */
export const nowBR = (): Date => toZonedTime(new Date(), BR_TZ);

/** Chave yyyy-MM-dd no fuso BR. */
export const ymdBR = (date: DateInput = new Date()): string => formatBR(date ?? new Date(), "yyyy-MM-dd");

/** É hoje no fuso BR? */
export const isTodayBR = (date: DateInput): boolean => {
  const d = toDate(date);
  if (!d) return false;
  return formatBR(d, "yyyy-MM-dd") === formatBR(new Date(), "yyyy-MM-dd");
};

/** Formatadores prontos para exibir em UI. */
export const formatBRDate = (v: DateInput) => (toDate(v) ? formatBR(v, "dd/MM/yyyy") : "—");
export const formatBRDateTime = (v: DateInput) => (toDate(v) ? formatBR(v, "dd/MM/yyyy HH:mm") : "—");
export const formatBRTime = (v: DateInput) => (toDate(v) ? formatBR(v, "HH:mm") : "—");

// Soma meses a uma data yyyy-MM-dd mantendo o dia, limitado ao último dia do mês
// (31/01 + 1 mês = 28/02, e não 03/03).
export function addMonthsYmd(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(Math.min(d, lastDay))}`;
}
