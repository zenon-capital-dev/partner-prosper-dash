import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { format as fnsFormat } from "date-fns";

/** Fuso oficial do app — todas as datas/horas exibidas devem usar este TZ. */
export const BR_TZ = "America/Sao_Paulo";

type DateInput = Date | string | number | null | undefined;

const toDate = (v: DateInput): Date | null => {
  if (v == null || v === "") return null;
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
