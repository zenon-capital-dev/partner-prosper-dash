/**
 * MOTOR FINANCEIRO DO CRM ZENON — único lugar com as fórmulas financeiras.
 * Funções puras (sem Supabase): recebem os dados e devolvem os números.
 * As telas (Vendas, Central, Dashboard, ficha do cliente, painéis) devem usar só isto.
 *
 * DECISÕES DO DOUGLAS (03/11/2026)
 *  Q1  Venda REALIZADA = status "concluida".
 *  Q2  "pendente" e "em_andamento" = PROJETADAS (só expectativa, sem fluxo de pagamento).
 *  Q3  A venda entra no mês da data da venda (sale_date).
 *  Q4  O recebido entra no mês em que o dinheiro entrou (paid_at, caixa).
 *  Q5  Comissão devida = proporcional ao que o cliente pagou (comissão "liberada").
 *  Q6  Comissão PAGA ao beneficiário = marcação manual (botão "Pagar"). A marcação automática
 *      do banco ao receber do cliente significa "liberada", não "repassada".
 *  Q7  Recorrente projetada: valor distribuído em todos os meses do contrato.
 *  Q8  Líquido = recebido − custos − comissões − impostos. Despesas e caixinhas ficam no
 *      "Resultado do mês", separado.
 *  Q9  Cobrança avulsa (sem venda) entra como "Outras receitas" nas Realizadas.
 *  Q10 Venda cancelada: o que já foi pago continua como recebido; o saldo é cancelado.
 *  Q11 Padrão ao abrir: Realizadas · Todos os meses.
 *  Q12 Abas visíveis da Central: A receber/Vencido, Despesas, Por cliente, Mapa de receitas
 *      (as demais no menu "Mais"; os cartões de resumo ficam no topo).
 *  Q13 Comissões da tabela antiga "commissions": migrar e deixar só leitura.
 *  +   Pagou a mais: o excedente abate as próximas parcelas da mesma venda.
 *  +   Voltar de Concluída para projetada com valor pago: bloqueado.
 */

export type FinanceView = "realizadas" | "projetadas" | "todas";
export type Period = { kind: "all" } | { kind: "month"; ym: string }; // ym = "2026-11"
export type SaleKind = "realizada" | "projetada" | "cancelada" | "outra";

export interface FSale {
  id: string;
  status: string | null;
  amount: number | null;
  sale_date: string | null;
  zenon_cost?: number | null;
  provider_cost?: number | null;
  revenue_type?: string | null;       // "avulso" | "recorrente"
  recurrence_months?: number | null;
  recurrence_start?: string | null;
  partner_id?: string | null;
  referrer_id?: string | null;
  collaborator_id?: string | null;
  commission_percent?: number | null;  // parceiro
  referrer_percent?: number | null;
  collaborator_percent?: number | null;
  client_id?: string | null;
}

export interface FPayment {
  id: string;
  sale_id: string | null;
  amount: number | null;
  amount_paid: number | null;
  status: string | null;
  due_date: string | null;
  paid_at: string | null;
  refund_amount?: number | null;
  client_id?: string | null;
}

export interface FSplit {
  id: string;
  sale_id: string | null;      // comissão lançada por venda (manual)
  payment_id: string | null;   // comissão gerada automaticamente por pagamento (trigger)
  amount: number | null;
  status: string | null;       // "pendente" | "pago" | "cancelado"
  beneficiary_type: string | null;
  beneficiary_id?: string | null;
  paid_out_at?: string | null; // repasse ao beneficiário (comissões automáticas) — ver Q6
}

export interface FExpense { amount: number | null; expense_date: string | null }
export interface FReserve { amount: number | null; reference_month: string | null }

export interface FinanceData {
  sales: FSale[];
  payments: FPayment[];
  splits: FSplit[];
  expenses?: FExpense[];
  reserves?: FReserve[];
  taxRatePercent?: number;
}

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v: number) => Math.round(v * 100) / 100;
const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

/** Dia (yyyy-MM-dd) no fuso de Brasília. */
export function ymdInBrazil(value: string | Date): string | null {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export const todayInBrazil = (now: Date = new Date()) => ymdInBrazil(now)!;

export function inPeriod(ymd: string | null, period: Period): boolean {
  if (!ymd) return false;
  return period.kind === "all" || ymd.slice(0, 7) === period.ym;
}

const addMonthsYm = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

// ───────────────────────── Vendas ─────────────────────────

export function saleKind(s: Pick<FSale, "status">): SaleKind {
  const st = String(s.status ?? "");
  if (st === "concluida") return "realizada";
  if (st === "pendente" || st === "em_andamento") return "projetada";
  if (st === "cancelada") return "cancelada";
  return "outra";
}

export function saleMatchesView(s: FSale, view: FinanceView): boolean {
  const k = saleKind(s);
  if (view === "realizadas") return k === "realizada";
  if (view === "projetadas") return k === "projetada";
  return k === "realizada" || k === "projetada";
}

/** Valor da venda que cai no período (Q3; recorrente projetada distribuída por mês — Q7). */
export function saleAmountInPeriod(s: FSale, period: Period): number {
  const amount = num(s.amount);
  if (amount <= 0) return 0;
  const recurring = s.revenue_type === "recorrente" && num(s.recurrence_months) > 1;
  if (saleKind(s) === "projetada" && recurring) {
    if (period.kind === "all") return amount;
    const months = Math.round(num(s.recurrence_months));
    const start = (s.recurrence_start || s.sale_date || "").slice(0, 7);
    if (!start) return 0;
    const totalCents = Math.round(amount * 100);
    const base = Math.floor(totalCents / months);
    for (let i = 0; i < months; i++) {
      if (addMonthsYm(start, i) === period.ym) return (base + (i === months - 1 ? totalCents - base * months : 0)) / 100;
    }
    return 0;
  }
  return inPeriod(s.sale_date, period) ? amount : 0;
}

/** Comissão prevista de uma venda (percentuais só valem com beneficiário definido). */
export function expectedCommission(s: FSale): number {
  const amount = num(s.amount);
  const pct = (s.partner_id ? num(s.commission_percent) : 0)
    + (s.referrer_id ? num(s.referrer_percent) : 0)
    + (s.collaborator_id ? num(s.collaborator_percent) : 0);
  return round2(amount * pct / 100);
}

export const saleCosts = (s: FSale) => num(s.zenon_cost) + num(s.provider_cost);

// ───────────────────────── Pagamentos ─────────────────────────

const VOID = ["cancelado", "cancelada", "reembolsado", "estornado"];

/**
 * Valor recebido de um pagamento até hoje.
 * - Pagamento com data futura ainda não entrou (agendado).
 * - Cancelado: o que já tinha sido pago continua contando (Q10).
 * - Reembolsado: recebido − valor reembolsado (reembolso parcial não zera tudo).
 */
export function paymentReceived(p: FPayment, today: string): number {
  const paidDay = p.paid_at ? ymdInBrazil(p.paid_at) : null;
  if (paidDay && paidDay > today) return 0;
  const st = String(p.status ?? "");
  let received = num(p.amount_paid);
  if (received <= 0 && (st === "pago" || st === "paga")) received = num(p.amount);
  if (st === "reembolsado") {
    const refund = p.refund_amount == null ? received : num(p.refund_amount);
    received -= refund;
  }
  if (st === "estornado") received = 0;
  return Math.max(0, round2(received));
}

/** Saldo em aberto (0 para cancelado, reembolsado e estornado). */
export function paymentOutstanding(p: FPayment): number {
  if (VOID.includes(String(p.status ?? ""))) return 0;
  return Math.max(0, round2(num(p.amount) - num(p.amount_paid)));
}

// ───────────────────────── Comissões ─────────────────────────

export interface CommissionTotals { released: number; paid: number; toPay: number }

/**
 * Comissões liberadas (Q5) e pagas ao beneficiário (Q6), sem contar em dobro.
 * Por venda + beneficiário: se existe comissão lançada na venda (manual), ela vale e é
 * liberada na proporção do recebido; senão valem as comissões automáticas por pagamento,
 * liberadas quando aquele pagamento foi recebido.
 */
export function commissionTotals(data: FinanceData, period: Period, today: string, saleFilter: (s: FSale) => boolean): CommissionTotals {
  const salesById = new Map(data.sales.map((s) => [s.id, s]));
  const payById = new Map(data.payments.map((p) => [p.id, p]));
  const paysBySale = new Map<string, FPayment[]>();
  for (const p of data.payments) if (p.sale_id) paysBySale.set(p.sale_id, [...(paysBySale.get(p.sale_id) ?? []), p]);

  const receivedOf = (saleId: string, onlyPeriod: boolean) =>
    (paysBySale.get(saleId) ?? []).reduce((sum, p) => {
      const day = p.paid_at ? ymdInBrazil(p.paid_at) : null;
      if (onlyPeriod && !inPeriod(day, period)) return sum;
      return sum + paymentReceived(p, today);
    }, 0);

  const manualKeys = new Set<string>();
  for (const c of data.splits) if (c.sale_id && !c.payment_id) manualKeys.add(`${c.sale_id}|${c.beneficiary_type}|${c.beneficiary_id ?? ""}`);

  let released = 0, paid = 0;
  for (const c of data.splits) {
    if (String(c.status ?? "") === "cancelado") continue;
    const amt = num(c.amount);
    if (c.sale_id && !c.payment_id) {
      const s = salesById.get(c.sale_id);
      if (!s || !saleFilter(s) || saleKind(s) !== "realizada") continue;
      const saleAmount = num(s.amount);
      if (saleAmount <= 0) continue;
      released += amt * clamp01(receivedOf(s.id, true) / saleAmount);
      if (String(c.status) === "pago" && (period.kind === "all" || inPeriod(c.paid_out_at ? ymdInBrazil(c.paid_out_at) : null, period))) paid += amt;
    } else if (c.payment_id) {
      const p = payById.get(c.payment_id);
      if (!p) continue;
      const s = p.sale_id ? salesById.get(p.sale_id) : undefined;
      if (s && (!saleFilter(s) || saleKind(s) !== "realizada")) continue;
      if (s && manualKeys.has(`${s.id}|${c.beneficiary_type}|${c.beneficiary_id ?? ""}`)) continue; // evita contar em dobro
      const payAmount = num(p.amount);
      const got = paymentReceived(p, today);
      const day = p.paid_at ? ymdInBrazil(p.paid_at) : null;
      if (got > 0 && payAmount > 0 && inPeriod(day, period)) released += amt * clamp01(got / payAmount);
      if (c.paid_out_at && inPeriod(ymdInBrazil(c.paid_out_at), period)) paid += amt;
    }
  }
  released = round2(released); paid = round2(paid);
  return { released, paid, toPay: round2(Math.max(0, released - paid)) };
}

// ───────────────────────── Indicadores ─────────────────────────

export interface RealizedKpis {
  sold: number;            // Vendido
  received: number;        // Recebido (inclui outras receitas e o já pago de vendas canceladas)
  otherIncome: number;     // Outras receitas (cobranças avulsas) — parte do recebido
  outstanding: number;     // A receber
  overdue: number;         // Vencido
  costs: number;           // custos reconhecidos (proporcional ao recebido)
  taxes: number;
  commissions: CommissionTotals;
  net: number;             // Líquido (Q8)
  salesCount: number;
}
export interface ProjectedKpis { value: number; count: number; expectedCommission: number; expectedCosts: number; expectedNet: number }
export interface MonthResult { net: number; expenses: number; reserves: number; result: number }

export function realizedKpis(data: FinanceData, period: Period, today: string, saleFilter: (s: FSale) => boolean = () => true): RealizedKpis {
  const salesById = new Map(data.sales.map((s) => [s.id, s]));
  const realized = data.sales.filter((s) => saleKind(s) === "realizada" && saleFilter(s));
  const sold = realized.reduce((sum, s) => sum + saleAmountInPeriod(s, period), 0);
  const salesCount = realized.filter((s) => saleAmountInPeriod(s, period) > 0).length;

  let received = 0, otherIncome = 0, outstanding = 0, overdue = 0;
  const receivedBySale = new Map<string, number>();
  for (const p of data.payments) {
    const s = p.sale_id ? salesById.get(p.sale_id) : undefined;
    if (p.sale_id && !s) continue;                     // venda inexistente: ignora
    if (s && !saleFilter(s)) continue;
    const kind = s ? saleKind(s) : "avulsa";
    if (kind === "projetada" || kind === "outra") continue; // projetada não tem fluxo
    const day = p.paid_at ? ymdInBrazil(p.paid_at) : null;
    const got = paymentReceived(p, today);
    if (got > 0 && inPeriod(day, period)) {
      received += got;
      if (!s) otherIncome += got;
      if (s && kind === "realizada") receivedBySale.set(s.id, (receivedBySale.get(s.id) ?? 0) + got);
    }
    if (kind === "cancelada") continue;                // saldo de venda cancelada não é cobrado
    const open = paymentOutstanding(p);
    if (open > 0 && (period.kind === "all" || inPeriod(p.due_date, period))) {
      outstanding += open;
      if (p.due_date && p.due_date < today) overdue += open;
    }
  }
  const costs = realized.reduce((sum, s) => {
    const amount = num(s.amount);
    return amount > 0 ? sum + saleCosts(s) * clamp01((receivedBySale.get(s.id) ?? 0) / amount) : sum;
  }, 0);
  const taxes = received * num(data.taxRatePercent) / 100;
  const commissions = commissionTotals(data, period, today, saleFilter);
  const net = received - costs - commissions.released - taxes;
  return {
    sold: round2(sold), received: round2(received), otherIncome: round2(otherIncome),
    outstanding: round2(outstanding), overdue: round2(overdue), costs: round2(costs), taxes: round2(taxes),
    commissions, net: round2(net), salesCount,
  };
}

export function projectedKpis(data: FinanceData, period: Period, saleFilter: (s: FSale) => boolean = () => true): ProjectedKpis {
  let value = 0, count = 0, expectedCommissionSum = 0, expectedCostsSum = 0;
  for (const s of data.sales) {
    if (saleKind(s) !== "projetada" || !saleFilter(s)) continue;
    const v = saleAmountInPeriod(s, period);
    if (v <= 0) continue;
    const share = num(s.amount) > 0 ? v / num(s.amount) : 0;
    value += v; count += 1;
    expectedCommissionSum += expectedCommission(s) * share;
    expectedCostsSum += saleCosts(s) * share;
  }
  return {
    value: round2(value), count, expectedCommission: round2(expectedCommissionSum), expectedCosts: round2(expectedCostsSum),
    expectedNet: round2(value - expectedCommissionSum - expectedCostsSum),
  };
}

/** Visão "Todas": realizado e projetado separados, e o total esperado. */
export function allKpis(data: FinanceData, period: Period, today: string, saleFilter?: (s: FSale) => boolean) {
  const r = realizedKpis(data, period, today, saleFilter);
  const p = projectedKpis(data, period, saleFilter);
  return { realized: r.sold, projected: p.value, expectedTotal: round2(r.sold + p.value), realizedKpis: r, projectedKpis: p };
}

/** Resultado do mês (Q8): líquido − despesas operacionais − caixinhas. */
export function monthResult(data: FinanceData, period: Period, today: string, saleFilter?: (s: FSale) => boolean): MonthResult {
  const net = realizedKpis(data, period, today, saleFilter).net;
  const expenses = (data.expenses ?? []).reduce((s, e) => s + (inPeriod(e.expense_date ? ymdInBrazil(e.expense_date) : null, period) ? num(e.amount) : 0), 0);
  const reserves = (data.reserves ?? []).reduce((s, r) => s + (inPeriod(r.reference_month ? r.reference_month.slice(0, 10) : null, period) ? num(r.amount) : 0), 0);
  return { net, expenses: round2(expenses), reserves: round2(reserves), result: round2(net - expenses - reserves) };
}

// ───────────────────────── Validações de gravação ─────────────────────────

/** Voltar de Concluída para projetada só sem valor pago. */
export function canRevertToProjected(saleId: string, payments: FPayment[], today: string): boolean {
  return !payments.some((p) => p.sale_id === saleId && paymentReceived(p, today) > 0);
}

/**
 * Pagamento a mais: distribui o valor recebido pela parcela e, o excedente, pelas próximas
 * parcelas abertas da mesma venda (ordem de vencimento). Devolve quanto aplicar em cada uma.
 */
export function allocatePayment(target: FPayment, value: number, salePayments: FPayment[]): { id: string; add: number }[] {
  const queue = [target, ...salePayments
    .filter((p) => p.id !== target.id && paymentOutstanding(p) > 0)
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))];
  let left = round2(value);
  const out: { id: string; add: number }[] = [];
  for (const p of queue) {
    if (left <= 0) break;
    const add = round2(Math.min(left, paymentOutstanding(p)));
    if (add > 0) { out.push({ id: p.id, add }); left = round2(left - add); }
  }
  if (left > 0) out.push({ id: target.id, add: left }); // sobra sem parcela: fica na própria (crédito)
  return out;
}
