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
  const ymd = /^(\d{4}-\d{2}-\d{2})/.exec(s)?.[1];
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

/**
 * Retorna o mês de competência (YYYY-MM) do pagamento.
 * Prioridade: competence_month manual > due_date > paid_at.
 * Assim, um recebimento pago em julho referente a junho aparece no fluxo de junho.
 */
export function paymentCompetenceYm(payment: any): string | null {
  const raw = payment?.competence_month || payment?.due_date || payment?.paid_at;
  if (!raw) return null;
  const s = String(raw);
  // ISO date/datetime — pega YYYY-MM
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}


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