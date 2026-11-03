import { ymdInBrazil } from "./financeEngine";

export const FINALIZED_SALE_STATUS = "concluida";
export const ACTIVE_PAYMENT_STATUSES = ["pendente", "em_aberto", "parcial", "parcialmente_pago", "atrasado", "vencido", "pago", "paga"];
export const OPEN_PAYMENT_STATUSES = ["em_aberto", "pendente", "parcial", "parcialmente_pago", "atrasado", "vencido"];
export const PAID_PAYMENT_STATUSES = ["pago", "paga"];
export const VOID_PAYMENT_STATUSES = ["cancelado", "cancelada", "reembolsado", "estornado"];

export function saleIsFinalized(saleOrStatus: any) {
  const status = typeof saleOrStatus === "string" ? saleOrStatus : saleOrStatus?.status;
  return String(status || "") === FINALIZED_SALE_STATUS;
}

export function paymentSaleIsFinalized(payment: any) {
  if (!payment?.sale_id) return true;
  return saleIsFinalized(payment.sales || payment.sale);
}

export function isOpenPaymentStatus(status: any) {
  return OPEN_PAYMENT_STATUSES.includes(String(status || ""));
}

export function isPaidPaymentStatus(status: any) {
  return PAID_PAYMENT_STATUSES.includes(String(status || ""));
}

export function isVoidedPaymentStatus(status: any) {
  return VOID_PAYMENT_STATUSES.includes(String(status || ""));
}

export function isPaymentPaidInFuture(payment: any) {
  // Um pagamento "quitado" com data futura ainda NÃO foi recebido — é um agendamento.
  // Comparação por YMD em America/Sao_Paulo, evitando problemas de timezone.
  const raw = payment?.paid_at;
  if (!raw) return false;
  const s = String(raw);
  const ymd = ymdInBrazil(s);
  if (!ymd) return false;
  try {
    const todayYmd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    return ymd > todayYmd;
  } catch {
    return false;
  }
}

export function paymentReceivedAmount(payment: any) {
  if (isVoidedPaymentStatus(payment?.status)) return 0;
  // Se a data de pagamento é no futuro, ainda não foi recebido — trata como agendado/pendente.
  if (isPaymentPaidInFuture(payment)) return 0;
  const paidAmount = Number(payment?.amount_paid || 0);
  if (paidAmount > 0) return paidAmount;
  return isPaidPaymentStatus(payment?.status) ? Number(payment?.amount || 0) : 0;
}

/** Mês do caixa: somente a data efetiva da entrada, em Brasília. */
export function paymentReceivedYm(payment: { paid_at?: string | null }): string | null {
  return payment.paid_at ? ymdInBrazil(payment.paid_at)?.slice(0, 7) ?? null : null;
}

/** @deprecated Use paymentReceivedYm; competência não define recebido. */
export const paymentCompetenceYm = paymentReceivedYm;


export function clampRatio(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function saleReceivedAmount(saleId: string, receiptsBySale: Map<string, any>) {
  return Number(receiptsBySale.get(saleId)?.received || receiptsBySale.get(saleId) || 0);
}

export function finalizedSaleRatio(sale: any, receiptsBySale: Map<string, any>) {
  const amount = Number(sale?.amount || 0);
  if (!saleIsFinalized(sale) || amount <= 0) return 0;
  return clampRatio(saleReceivedAmount(sale.id, receiptsBySale) / amount);
}

export function paymentOutstandingAmount(payment: any) {
  return Math.max(Number(payment?.amount || 0) - Number(payment?.amount_paid || 0), 0);
}