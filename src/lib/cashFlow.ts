import { supabase } from "@/integrations/supabase/client";

/**
 * Operações do fluxo de caixa. As regras ficam todas no banco
 * (migration 20261104120000_fluxo_de_caixa.sql); aqui só chamamos as funções.
 */
export type CashSourceType = "payment" | "expense" | "commission_split" | "other_income";
export type CashSituation = "liquidado" | "parcial" | "parcial_atrasado" | "atrasado" | "pendente";

export interface CashLine {
  source_type: CashSourceType;
  source_id: string;
  direction: "entrada" | "saida";
  description: string;
  counterparty: string | null;
  origin_label: string;
  sale_id: string | null;
  client_id: string | null;
  due_date: string;
  amount: number;
  settled: number;
  balance: number;
  is_estimate: boolean;
  in_projection: boolean;
  effective_in_month: number;
  last_effective: string | null;
  situation: CashSituation;
  from_previous_month: boolean;
}

export interface CashMonth {
  month: string;
  period: "passado" | "atual" | "futuro";
  cutoff: string;
  include_overdue: boolean;
  opening_configured: boolean;
  opening_reference_date: string | null;
  opening: number | null;
  opening_projected: boolean;
  entradas_realizadas: number;
  saidas_realizadas: number;
  resultado_realizado: number;
  saldo_realizado: number | null;
  entradas_pendentes: number;
  saidas_pendentes: number;
  saldo_projetado: number | null;
  atrasados_receber: number;
  atrasados_pagar: number;
  saldo_sem_cronograma: number;
  nao_confirmado: number;
  vendido_mes: number;
  lancamentos_sinalizados: number;
  lines: CashLine[];
}

export interface CashSettlement {
  id: string;
  kind: "liquidacao" | "estorno" | "devolucao";
  reverses_id: string | null;
  amount: number;
  effective_date: string;
  payment_method: string | null;
  notes: string | null;
  reason: string | null;
  origin: "acao" | "captura" | "historico";
  verified: boolean;
  created_at: string;
}

const rpc = (name: string, args?: Record<string, unknown>) => (supabase as any).rpc(name, args);

async function call<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw error;
  return data as T;
}

/** A migration ainda não foi aplicada neste banco. */
export function isCashSchemaMissing(error: any): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

/** Uma chave por tentativa de envio: repetir o envio não duplica o lançamento. */
export const newIdempotencyKey = () => crypto.randomUUID();

export const cashCanAccess = () => call<boolean>("cash_can_access");

export const cashMonth = (ym: string, includeOverdue: boolean) =>
  call<CashMonth>("cash_month", { p_month: `${ym}-01`, p_include_overdue: includeOverdue });

export const cashSettle = (args: {
  sourceType: CashSourceType;
  sourceId: string;
  amount: number;
  date: string;
  method?: string | null;
  notes?: string | null;
  key: string;
}) =>
  call<string>("cash_settle", {
    p_source_type: args.sourceType,
    p_source_id: args.sourceId,
    p_amount: args.amount,
    p_effective_date: args.date,
    p_payment_method: args.method ?? null,
    p_notes: args.notes ?? null,
    p_idempotency_key: args.key,
  });

export const cashReceiveForSale = (args: {
  saleId: string;
  amount: number;
  date: string;
  method?: string | null;
  notes?: string | null;
  key: string;
}) =>
  call<number>("cash_receive_for_sale", {
    p_sale_id: args.saleId,
    p_amount: args.amount,
    p_effective_date: args.date,
    p_payment_method: args.method ?? null,
    p_notes: args.notes ?? null,
    p_idempotency_key: args.key,
  });

export const cashReverse = (args: {
  settlementId: string;
  amount: number;
  reason: string;
  date?: string;
  kind?: "estorno" | "devolucao";
  key: string;
}) =>
  call<string>("cash_reverse", {
    p_settlement_id: args.settlementId,
    p_amount: args.amount,
    p_reason: args.reason,
    p_effective_date: args.date ?? null,
    p_kind: args.kind ?? "estorno",
    p_idempotency_key: args.key,
  });

export const cashReverseSource = (sourceType: CashSourceType, sourceId: string, reason: string) =>
  call<void>("cash_reverse_source", { p_source_type: sourceType, p_source_id: sourceId, p_reason: reason });

export const cashRefundPayment = (paymentId: string, amount: number, reason: string) =>
  call<void>("cash_refund_payment", { p_payment_id: paymentId, p_amount: amount, p_reason: reason });

export const cashConfirmHistoric = (settlementId: string) =>
  call<void>("cash_confirm_historic", { p_settlement_id: settlementId });

export const cashCreateEntry = (args: {
  direction: "entrada" | "saida";
  description: string;
  amount: number;
  date: string;
  realized: boolean;
  category?: string | null;
  counterparty?: string | null;
  notes?: string | null;
  method?: string | null;
  key: string;
}) =>
  call<string>("cash_create_entry", {
    p_direction: args.direction,
    p_description: args.description,
    p_amount: args.amount,
    p_date: args.date,
    p_realized: args.realized,
    p_category: args.category ?? null,
    p_counterparty: args.counterparty ?? null,
    p_client_id: null,
    p_notes: args.notes ?? null,
    p_payment_method: args.method ?? null,
    p_idempotency_key: args.key,
  });

export const cashSetOpeningBalance = (date: string, amount: number, reason: string) =>
  call<string>("cash_set_opening_balance", { p_reference_date: date, p_amount: amount, p_reason: reason });

export async function cashHistory(sourceType: CashSourceType, sourceId: string): Promise<CashSettlement[]> {
  const { data, error } = await (supabase as any)
    .from("cash_settlements")
    .select("id, kind, reverses_id, amount, effective_date, payment_method, notes, reason, origin, verified, created_at")
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Datas do caixa são dias de calendário: nunca passam por Date, para não mudar de dia com o fuso. */
export const formatCashDate = (ymd: string | null | undefined) =>
  ymd ? ymd.slice(0, 10).split("-").reverse().join("/") : "—";

export function cashCsv(month: CashMonth): string {
  const headers = ["Tipo", "Descrição", "Cliente ou favorecido", "Origem", "Vencimento", "Última data efetiva", "Valor", "Liquidado", "Saldo pendente", "Situação", "Efetivo no mês"];
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const money = (v: number) => Number(v).toFixed(2).replace(".", ",");
  const rows = month.lines.map((l) => [
    l.direction === "entrada" ? "Entrada" : "Saída", l.description, l.counterparty, l.origin_label,
    formatCashDate(l.due_date), formatCashDate(l.last_effective), money(l.amount), money(l.settled), money(l.balance),
    SITUATION_LABEL[l.situation], money(l.effective_in_month),
  ]);
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(";")).join("\n");
}

export const SITUATION_LABEL: Record<CashSituation, string> = {
  liquidado: "Liquidado",
  parcial: "Parcial",
  parcial_atrasado: "Parcial atrasado",
  atrasado: "Atrasado",
  pendente: "Pendente",
};
