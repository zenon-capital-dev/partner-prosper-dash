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

export function paymentReceivedAmount(payment: any) {
  if (isVoidedPaymentStatus(payment?.status)) return 0;
  const paidAmount = Number(payment?.amount_paid || 0);
  if (paidAmount > 0) return paidAmount;
  return isPaidPaymentStatus(payment?.status) ? Number(payment?.amount || 0) : 0;
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