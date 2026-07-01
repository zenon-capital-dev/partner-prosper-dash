import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useClientsRef } from "@/hooks/useReferenceData";
import { useAuth } from "@/hooks/useAuth";
import { PageHero } from "@/components/PageHero";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { confirmAction } from "@/lib/confirm";
import {
  Banknote, TrendingUp, AlertTriangle, Wallet, Receipt, BarChart3,
  Search, RefreshCw, CheckCircle2, AlertCircle, X, Download, ArrowUp, ArrowDown, ArrowUpDown,
  Filter, FileX, CalendarRange,
} from "lucide-react";
import { RevenueMap } from "@/components/finance/RevenueMap";
import { PaymentFormDialog } from "@/components/payments/PaymentFormDialog";
import { Plus } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend,
} from "recharts";

const norm = (s: any) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const PAY_STATUS: Record<string, { label: string; cls: string }> = {
  em_aberto: { label: "Em aberto", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  pendente: { label: "Em aberto", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  pago: { label: "Pago", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  paga: { label: "Pago", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  parcial: { label: "Parcial", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  parcialmente_pago: { label: "Parcial", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  vencido: { label: "Vencido", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  atrasado: { label: "Vencido", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  cancelado: { label: "Cancelado", cls: "bg-slate-100 text-slate-500 border-slate-200" },
  reembolsado: { label: "Reembolsado", cls: "bg-violet-50 text-violet-700 border-violet-200" },
};

const OPEN_STATUSES = ["em_aberto", "pendente", "parcial", "parcialmente_pago"];
const PAID_STATUSES = ["pago", "paga"];
const isOpen = (s: string) => OPEN_STATUSES.includes(s);
const isPaid = (s: string) => PAID_STATUSES.includes(s);

const todayIsoStr = () => new Date().toISOString().slice(0, 10);

const effectiveStatus = (p: any, today: string) => {
  if (isOpen(p.status) && p.due_date && p.due_date < today) return "vencido";
  return p.status;
};

const downloadCsv = (filename: string, headers: string[], rows: any[][]) => {
  const csv = [headers, ...rows]
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(";")
    )
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

type SortDir = "asc" | "desc";

function SortableTh({ label, k, sortKey, sortDir, onSort, align = "left" }: any) {
  const active = sortKey === k;
  return (
    <th
      className={cn(
        "px-4 py-3 select-none text-[11px] uppercase tracking-wider font-semibold text-slate-500",
        align === "center" && "text-center",
        align === "right" && "text-right"
      )}
    >
      <button
        onClick={() => onSort(k)}
        className={cn("inline-flex items-center gap-1 hover:text-slate-700 transition-colors", active && "text-indigo-700")}
      >
        {label}
        {active ? (
          sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
        ) : (
          <ArrowUpDown className="size-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

export default function FinanceCenter() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "fluxo";
  const setTab = (t: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", t);
    setParams(next);
  };
  const setStatusAndTab = (t: string, st: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", t);
    next.set("status", st);
    setParams(next);
  };
  const qc = useQueryClient();
  const { isAdmin, isAdminSecondary } = useAuth();
  const canManage = isAdmin || isAdminSecondary;
  const [newPaymentOpen, setNewPaymentOpen] = useState(false);
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocPool, setAllocPool] = useState<string>("");
  const [allocAmount, setAllocAmount] = useState("");
  const [allocDesc, setAllocDesc] = useState("");
  const { data: poolsList = [] } = useQuery({
    queryKey: ["fin-pools-list"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("resource_pools")
        .select("id, name, current_balance, color")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });
  const submitAllocation = async () => {
    const amt = parseFloat(allocAmount.replace(",", "."));
    if (!allocPool) { toast.error("Selecione uma caixinha"); return; }
    if (!amt || amt <= 0) { toast.error("Valor inválido"); return; }
    const { error } = await (supabase as any).from("resource_pool_movements").insert({
      pool_id: allocPool,
      movement_type: "entrada",
      amount: amt,
      description: allocDesc || "Alocação a partir do saldo líquido",
      reference_type: "finance_allocation",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Valor destinado à caixinha");
    setAllocOpen(false); setAllocPool(""); setAllocAmount(""); setAllocDesc("");
    qc.invalidateQueries({ queryKey: ["fin-pools-list"] });
    qc.invalidateQueries({ queryKey: ["resource_pools"] });
    qc.invalidateQueries({ queryKey: ["resource_pool_movements"] });
  };
  type RangeMode = "week" | "month" | "specific" | "3m" | "6m" | "year" | "all";
  const nowMonthKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const [kpiRange, setKpiRange] = useState<RangeMode>(
    (typeof window !== "undefined" && (localStorage.getItem("fin:kpiRange") as any)) || "month"
  );
  const [specificMonth, setSpecificMonth] = useState<string>(
    (typeof window !== "undefined" && localStorage.getItem("fin:specificMonth")) || nowMonthKey()
  );
  useEffect(() => {
    try { localStorage.setItem("fin:kpiRange", kpiRange); } catch {}
  }, [kpiRange]);
  useEffect(() => {
    try { localStorage.setItem("fin:specificMonth", specificMonth); } catch {}
  }, [specificMonth]);
  const { rangeStartIso, rangeEndIso } = useMemo(() => {
    const d = new Date();
    let start = "0000-01-01";
    let end = "9999-12-31";
    if (kpiRange === "all") { /* both wide */ }
    else if (kpiRange === "specific") {
      const [y, m] = specificMonth.split("-").map(Number);
      const s = new Date(y, m - 1, 1);
      const e = new Date(y, m, 1);
      start = s.toISOString().slice(0, 10);
      end = e.toISOString().slice(0, 10);
    } else {
      if (kpiRange === "week") d.setDate(d.getDate() - 7);
      else if (kpiRange === "month") { d.setDate(1); }
      else if (kpiRange === "3m") d.setMonth(d.getMonth() - 3);
      else if (kpiRange === "6m") d.setMonth(d.getMonth() - 6);
      else if (kpiRange === "year") d.setMonth(d.getMonth() - 12);
      start = d.toISOString().slice(0, 10);
    }
    return { rangeStartIso: start, rangeEndIso: end };
  }, [kpiRange, specificMonth]);
  const specificMonthLabel = useMemo(() => {
    const [y, m] = specificMonth.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [specificMonth]);
  const rangeLabel: Record<RangeMode, string> = {
    week: "últimos 7 dias",
    month: "mês atual",
    specific: specificMonthLabel,
    "3m": "últimos 3 meses",
    "6m": "últimos 6 meses",
    year: "últimos 12 meses",
    all: "todo período",
  };


  const { data: payments = [], isLoading: loadingPay } = useQuery({
    queryKey: ["fin-payments"],
    queryFn: async () =>
      (
        await supabase
          .from("payments")
          .select("*, clients(id, full_name, company), products(name), client_products(custom_product_name)")
          .order("due_date", { ascending: false })
          .limit(300)
      ).data ?? [],
    staleTime: 60_000,
  });

  const { data: salesCosts = [] } = useQuery({
    queryKey: ["fin-sales-costs"],
    queryFn: async () =>
      (
        await supabase
          .from("sales")
          .select("id, zenon_cost, provider_cost, sale_date, status")
          .limit(500)
      ).data ?? [],
    staleTime: 60_000,
  });

  const loadCommissionDetails = ["comissoes", "relatorios"].includes(tab);

  const { data: commissionSummary = [] } = useQuery({
    queryKey: ["fin-commission-summary"],
    queryFn: async () =>
      (
        await supabase
          .from("commission_splits")
          .select("id, amount, status, beneficiary_type, paid_at, created_at")
          .order("created_at", { ascending: false })
          .limit(300)
      ).data ?? [],
    staleTime: 60_000,
  });

  const { data: commissions = [], isLoading: loadingCom } = useQuery({
    queryKey: ["fin-commissions"],
    enabled: loadCommissionDetails,
    queryFn: async () => {
      const [splitsRes, salesRes, partnersRes, profilesRes, referrersRes, providersRes, clientsRes, productsRes] = await Promise.all([
        supabase
          .from("commission_splits")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(300),
        supabase.from("sales").select("id, client_id, product_id, amount, sale_date").limit(300),
        supabase.from("partners").select("id, full_name").limit(500),
        supabase.from("profiles").select("id, full_name").limit(500),
        supabase.from("referrers").select("id, full_name").limit(500),
        supabase.from("service_providers").select("id, name").limit(500),
        supabase.from("clients").select("id, full_name, company").limit(300),
        supabase.from("products").select("id, name").limit(500),
      ]);
      const salesMap = new Map((salesRes.data ?? []).map((s: any) => [s.id, s]));
      const partnersMap = new Map((partnersRes.data ?? []).map((p: any) => [p.id, p]));
      const profilesMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
      const referrersMap = new Map((referrersRes.data ?? []).map((r: any) => [r.id, r]));
      const providersMap = new Map((providersRes.data ?? []).map((p: any) => [p.id, { id: p.id, full_name: p.name }]));
      const clientsMap = new Map((clientsRes.data ?? []).map((c: any) => [c.id, c]));
      const productsMap = new Map((productsRes.data ?? []).map((p: any) => [p.id, p]));

      return (splitsRes.data ?? []).map((s: any) => {
        const sale: any = salesMap.get(s.sale_id) || {};
        const partner = s.beneficiary_type === "partner" ? partnersMap.get(s.beneficiary_id) : null;
        const profile = s.beneficiary_type === "collaborator" ? profilesMap.get(s.beneficiary_id) : null;
        const referrer = s.beneficiary_type === "referrer" ? referrersMap.get(s.beneficiary_id) : null;
        const provider = s.beneficiary_type === "service_provider" ? providersMap.get(s.beneficiary_id) : null;
        const beneficiaryName = (partner as any)?.full_name || (profile as any)?.full_name || (referrer as any)?.full_name || (provider as any)?.full_name || "—";
        const beneficiaryLabel =
          s.beneficiary_type === "partner" ? "Parceiro" :
          s.beneficiary_type === "collaborator" ? "Colaborador" :
          s.beneficiary_type === "referrer" ? "Indicador" :
          s.beneficiary_type === "service_provider" ? "Prestador" : "—";
        return {
          ...s,
          workflow_status: s.status,
          partner_id: s.beneficiary_type === "partner" ? s.beneficiary_id : null,
          collaborator_id: s.beneficiary_type === "collaborator" ? s.beneficiary_id : null,
          referrer_id: s.beneficiary_type === "referrer" ? s.beneficiary_id : null,
          provider_id: s.beneficiary_type === "service_provider" ? s.beneficiary_id : null,
          partners: partner || null,
          profiles: profile || null,
          referrers: referrer || null,
          service_providers: provider || null,
          clients: clientsMap.get(sale.client_id) || null,
          products: productsMap.get(sale.product_id) || null,
          sale,
          beneficiary_name: beneficiaryName,
          beneficiary_label: beneficiaryLabel,
        };
      });
    },
    staleTime: 60_000,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["fin-alerts"],
    queryFn: async () =>
      (
        await supabase
          .from("financial_alerts")
          .select("*, clients(full_name)")
          .is("resolved_at", null)
          .order("created_at", { ascending: false })
          .limit(50)
      ).data ?? [],
    staleTime: 60_000,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["fin-expenses"],
    queryFn: async () =>
      (await supabase.from("expenses").select("*").order("expense_date", { ascending: false }).limit(300)).data ?? [],
    staleTime: 60_000,
  });

  const today = todayIsoStr();
  const commissionRows = loadCommissionDetails && commissions.length ? commissions : commissionSummary;

  const kpis = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const from = rangeStartIso;
    const to = rangeEndIso;
    const paidDate = (p: any) => (p.paid_at || p.payment_date || "") as string;
    const commDate = (c: any) => (c.paid_at || c.created_at || "") as string;
    const expDate = (e: any) => (e.expense_date || e.created_at || "") as string;
    const inRange = (d: string) => !!d && d >= from && d < to;

    const totalReceived = payments
      .filter((p: any) => isPaid(p.status) && inRange(paidDate(p)))
      .reduce((a: number, p: any) => a + Number(p.amount_paid || p.amount || 0), 0);
    const receivedThisMonth = payments
      .filter((p: any) => isPaid(p.status) && paidDate(p) >= startOfMonth)
      .reduce((a: number, p: any) => a + Number(p.amount_paid || p.amount || 0), 0);
    const totalReceivable = payments
      .filter((p: any) => isOpen(p.status))
      .reduce((a: number, p: any) => a + Number(p.amount || 0) - Number(p.amount_paid || 0), 0);
    const totalOverdue = payments
      .filter((p: any) => isOpen(p.status) && p.due_date && p.due_date < today)
      .reduce((a: number, p: any) => a + Number(p.amount || 0) - Number(p.amount_paid || 0), 0);
    // Recebido agregado por venda (dentro do range) — usado para prorratear comissões
    const receivedBySale = new Map<string, number>();
    for (const p of payments as any[]) {
      if (!isPaid(p.status) || !inRange(paidDate(p))) continue;
      const sid = p.sale_id;
      if (!sid) continue;
      receivedBySale.set(sid, (receivedBySale.get(sid) || 0) + Number(p.amount_paid || p.amount || 0));
    }
    // Comissão devida = comissão total * (recebido / valor da venda), limitada ao valor da comissão.
    // Isso reflete a regra: só pagamos comissão sobre o que efetivamente entrou.
    const accruedCommission = (c: any) => {
      const full = Number(c.amount || 0);
      const saleVal = Number(c.sale_value || 0);
      const sid = c.sale_id;
      if (!sid || saleVal <= 0) return isPaid(c.status) || isPaid(c.workflow_status) ? full : 0;
      const rec = receivedBySale.get(sid) || 0;
      const ratio = Math.max(0, Math.min(1, rec / saleVal));
      return full * ratio;
    };
    const commissionsPending = commissionRows
      .filter((c: any) => !isPaid(c.status) && !isPaid(c.workflow_status))
      .reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
    const commissionsPaid = commissionRows
      .filter((c: any) => (isPaid(c.status) || isPaid(c.workflow_status)) && inRange(commDate(c)))
      .reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
    // Custo de comissão para o cálculo do saldo líquido: prorrateado pelo recebido no range.
    const indicatorsPaid = commissionRows
      .filter((c: any) => c.beneficiary_type === "referrer")
      .reduce((a: number, c: any) => a + accruedCommission(c), 0);
    const commissionsOthersPaid = commissionRows
      .filter((c: any) => c.beneficiary_type !== "referrer")
      .reduce((a: number, c: any) => a + accruedCommission(c), 0);
    const variableExpenses = (expenses as any[])
      .filter((e) => inRange(expDate(e)))
      .reduce((a, e) => a + Number(e.amount || 0), 0);
    const salesCostsTotal = (salesCosts as any[])
      .filter((s) => s.status !== "cancelada" && inRange((s.sale_date || s.created_at || "") as string))
      .reduce((a, s) => a + Number(s.zenon_cost || 0) + Number(s.provider_cost || 0), 0);
    const zenonCostTotal = (salesCosts as any[])
      .filter((s) => s.status !== "cancelada" && inRange((s.sale_date || s.created_at || "") as string))
      .reduce((a, s) => a + Number(s.zenon_cost || 0), 0);
    const providerCostTotal = (salesCosts as any[])
      .filter((s) => s.status !== "cancelada" && inRange((s.sale_date || s.created_at || "") as string))
      .reduce((a, s) => a + Number(s.provider_cost || 0), 0);
    const netRevenue = totalReceived - indicatorsPaid - commissionsOthersPaid - variableExpenses - salesCostsTotal;
    return {
      totalReceived,
      receivedThisMonth,
      totalReceivable,
      totalOverdue,
      commissionsPending,
      commissionsPaid,
      indicatorsPaid,
      commissionsOthersPaid,
      variableExpenses,
      salesCostsTotal,
      zenonCostTotal,
      providerCostTotal,
      netRevenue,
    };
  }, [payments, commissionRows, expenses, salesCosts, today, rangeStartIso]);

  const counts = useMemo(() => {
    const recebidos = payments.filter((p: any) => isPaid(p.status)).length;
    const aReceber = payments.filter((p: any) => isOpen(p.status)).length;
    const inadimplencia = payments.filter(
      (p: any) =>
        ["vencido", "atrasado"].includes(p.status) ||
        (isOpen(p.status) && p.due_date && p.due_date < today)
    ).length;
    const comissoesPend = commissionRows.filter((c: any) => !isPaid(c.status) && !isPaid(c.workflow_status)).length;
    return {
      fluxo: 0,
      receitas: payments.length,
      recebidos,
      a_receber: aReceber,
      comissoes: comissoesPend,
      inadimplencia,
      por_cliente: 0,
      relatorios: 0,
    };
  }, [payments, commissionRows, today]);

  const processAlerts = async () => {
    const { data, error } = await supabase.functions.invoke("process-alerts");
    if (error) toast.error("Erro ao processar alertas");
    else {
      toast.success(`${data?.alerts_processed ?? 0} alertas atualizados`);
      qc.invalidateQueries({ queryKey: ["fin-alerts"] });
      qc.invalidateQueries({ queryKey: ["fin-payments"] });
    }
  };

  const TABS = [
    { id: "fluxo", label: "Fluxo de caixa", icon: TrendingUp },
    { id: "mapa", label: "Mapa de receitas", icon: CalendarRange },
    { id: "receitas", label: "Receitas", icon: Banknote, count: counts.receitas },
    { id: "recebidos", label: "Recebidos", icon: CheckCircle2, count: counts.recebidos },
    { id: "a_receber", label: "A receber", icon: Receipt, count: counts.a_receber },
    { id: "comissoes", label: "Comissões", icon: Wallet, count: counts.comissoes },
    { id: "inadimplencia", label: "Inadimplência", icon: AlertTriangle, count: counts.inadimplencia },
    { id: "por_cliente", label: "Por cliente", icon: BarChart3 },
    { id: "relatorios", label: "Relatórios", icon: BarChart3 },
  ];

  const statusFromUrl = params.get("status") || "todos";

  return (
    <div className="min-h-dvh bg-slate-50/60 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <PaymentFormDialog
        open={newPaymentOpen}
        onOpenChange={setNewPaymentOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["fin-payments"] })}
      />
      <Dialog open={allocOpen} onOpenChange={setAllocOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Destinar valor para caixinha</DialogTitle>
            <DialogDescription>Registra uma entrada na caixinha selecionada. O saldo é atualizado automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Caixinha</Label>
              <Select value={allocPool} onValueChange={setAllocPool}>
                <SelectTrigger><SelectValue placeholder="Selecione uma caixinha" /></SelectTrigger>
                <SelectContent>
                  {poolsList.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {formatBRL(Number(p.current_balance || 0))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input inputMode="decimal" placeholder="0,00" value={allocAmount} onChange={(e) => setAllocAmount(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Descrição (opcional)</Label>
              <Textarea rows={2} value={allocDesc} onChange={(e) => setAllocDesc(e.target.value)} placeholder="Ex.: Reserva de impostos de junho" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocOpen(false)}>Cancelar</Button>
            <Button onClick={submitAllocation}>Destinar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PageHero
        eyebrow="Financeiro"
        category="Operações"
        title="Central Financeira"
        description="Receitas, contas a receber, comissões, inadimplência e relatórios em um só lugar."
        icon={<Banknote className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={kpiRange} onValueChange={(v) => setKpiRange(v as any)}>
              <SelectTrigger className="h-9 w-[170px] bg-white border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Últimos 7 dias</SelectItem>
                <SelectItem value="month">Mês atual</SelectItem>
                <SelectItem value="3m">Últimos 3 meses</SelectItem>
                <SelectItem value="6m">Últimos 6 meses</SelectItem>
                <SelectItem value="year">Últimos 12 meses</SelectItem>
                <SelectItem value="all">Todo período</SelectItem>
              </SelectContent>
            </Select>
            {canManage && (
              <>
                <Button onClick={() => setNewPaymentOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="h-4 w-4 mr-2" /> Lançar pendência
                </Button>
                <Button onClick={processAlerts} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" /> Atualizar alertas
                </Button>
              </>
            )}
          </div>
        }
        kpis={[
          {
            label: `Recebido (${rangeLabel[kpiRange]})`,
            value: formatBRL(kpis.totalReceived),
            tone: "success",
            onClick: () => setStatusAndTab("recebidos", "todos"),
            hint: `Filtro: ${rangeLabel[kpiRange]}`,
          } as any,
          {
            label: "Recebido (mês)",
            value: formatBRL(kpis.receivedThisMonth),
            tone: "success",
            onClick: () => setStatusAndTab("recebidos", "todos"),
            hint: "Somente pagamentos com data no mês corrente",
          } as any,
          {
            label: "Saldo líquido (Zenon)",
            value: formatBRL(kpis.netRevenue),
            tone: "primary",
            onClick: () => setTab("relatorios"),
            hint: `Bruto ${formatBRL(kpis.totalReceived)} − Custos ${formatBRL(kpis.salesCostsTotal)} − Indicadores ${formatBRL(kpis.indicatorsPaid)} − Comissões ${formatBRL(kpis.commissionsOthersPaid)} − Variáveis ${formatBRL(kpis.variableExpenses)}`,
          } as any,
          {
            label: "A receber",
            value: formatBRL(kpis.totalReceivable),
            tone: "info",
            onClick: () => setStatusAndTab("a_receber", "todos"),
          } as any,
          {
            label: "Vencido",
            value: formatBRL(kpis.totalOverdue),
            tone: "danger",
            onClick: () => setStatusAndTab("inadimplencia", "vencido"),
          } as any,
          {
            label: "Comissões a pagar",
            value: formatBRL(kpis.commissionsPending),
            tone: "warning",
            onClick: () => setTab("comissoes"),
          } as any,
        ]}
      />

      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 space-y-6 pb-10">
        <div className="rounded-lg border border-slate-200/70 bg-white shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h3 className="font-display text-base font-semibold text-slate-900">Saldo líquido — Zenon</h3>
              <p className="text-xs text-slate-500 mt-0.5">Bruto recebido menos custos de venda (Zenon + Prestador), comissões pagas a indicadores/parceiros e despesas variáveis.</p>
            </div>
            <div className="text-left sm:text-right shrink-0 flex items-start gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Saldo líquido</p>
                <p className={cn("font-mono text-2xl font-bold tabular-nums", kpis.netRevenue >= 0 ? "text-emerald-700" : "text-rose-700")}>{formatBRL(kpis.netRevenue)}</p>
              </div>
              {canManage && (
                <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={() => setAllocOpen(true)}>
                  <Wallet className="size-3.5" /> Destinar p/ caixinha
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <button type="button" onClick={() => setStatusAndTab("recebidos", "todos")} className="text-left rounded-md border border-slate-200/70 bg-slate-50 p-3 hover:border-slate-300 hover:shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-200">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Bruto recebido</p>
              <p className="font-mono text-base font-semibold text-slate-900 mt-1 tabular-nums">{formatBRL(kpis.totalReceived)}</p>
            </button>
            <button type="button" onClick={() => setTab("relatorios")} className="text-left rounded-md border border-amber-200/70 bg-amber-50/60 p-3 hover:border-amber-300 hover:shadow-sm transition focus:outline-none focus:ring-2 focus:ring-amber-200">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-700">− Custos venda</p>
              <p className="font-mono text-base font-semibold text-amber-800 mt-1 tabular-nums">{formatBRL(kpis.salesCostsTotal)}</p>
              <p className="text-[10px] text-amber-600/80 mt-0.5">Zenon {formatBRL(kpis.zenonCostTotal)} · Prestador {formatBRL(kpis.providerCostTotal)}</p>
            </button>
            <button type="button" onClick={() => setStatusAndTab("comissoes", "todos")} className="text-left rounded-md border border-amber-200/70 bg-amber-50/60 p-3 hover:border-amber-300 hover:shadow-sm transition focus:outline-none focus:ring-2 focus:ring-amber-200">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-700">− Indicadores</p>
              <p className="font-mono text-base font-semibold text-amber-800 mt-1 tabular-nums">{formatBRL(kpis.indicatorsPaid)}</p>
            </button>
            <button type="button" onClick={() => setStatusAndTab("comissoes", "todos")} className="text-left rounded-md border border-indigo-200/70 bg-indigo-50/60 p-3 hover:border-indigo-300 hover:shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-200">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-indigo-700">− Comissões</p>
              <p className="font-mono text-base font-semibold text-indigo-800 mt-1 tabular-nums">{formatBRL(kpis.commissionsOthersPaid)}</p>
              <p className="text-[10px] text-indigo-600/80 mt-0.5">Parceiros, colaboradores e prestadores</p>
            </button>
            <button type="button" onClick={() => setTab("relatorios")} className="text-left rounded-md border border-rose-200/70 bg-rose-50/60 p-3 hover:border-rose-300 hover:shadow-sm transition focus:outline-none focus:ring-2 focus:ring-rose-200">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-rose-700">− Variáveis</p>
              <p className="font-mono text-base font-semibold text-rose-800 mt-1 tabular-nums">{formatBRL(kpis.variableExpenses)}</p>
              <p className="text-[10px] text-rose-600/80 mt-0.5">Despesas operacionais</p>
            </button>
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="rounded-lg border border-amber-200/70 bg-amber-50 p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-700" />
                <span className="font-semibold text-sm text-amber-900">
                  {alerts.length} alerta(s) financeiro(s) ativo(s)
                </span>
              </div>
              <button
                onClick={() => setTab("inadimplencia")}
                className="text-xs font-semibold text-amber-800 hover:text-amber-900 underline"
              >
                Ver inadimplência
              </button>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
              {alerts.slice(0, 6).map((a: any) => (
                <div key={a.id} className="rounded-md bg-white border border-amber-200/60 p-2">
                  <div className="font-medium text-slate-800">{a.title}</div>
                  {a.clients?.full_name && <div className="text-slate-500">{a.clients.full_name}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-1 overflow-x-auto">
            <TabsList className="flex w-max gap-1 bg-transparent h-auto p-0">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="gap-2 px-3 py-2 text-sm font-medium text-slate-600 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 rounded-md"
                >
                  <t.icon className="h-4 w-4" /> {t.label}
                  {t.count != null && t.count > 0 && (
                    <span className="ml-1 text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {t.count}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="fluxo" className="mt-6">
            <CashFlow payments={payments} commissions={commissionRows} />
          </TabsContent>
          <TabsContent value="mapa" className="mt-6">
            <RevenueMap payments={payments} />
          </TabsContent>
          <TabsContent value="receitas" className="mt-6">
            <PaymentsTable
              payments={payments}
              loading={loadingPay}
              title="Receitas"
              initialStatus={statusFromUrl}
              filterFn={() => true}
              canManage={canManage}
            />
          </TabsContent>
          <TabsContent value="recebidos" className="mt-6">
            <PaymentsTable
              payments={payments}
              loading={loadingPay}
              title="Pagamentos recebidos"
              filterFn={(p) => isPaid(p.status)}
              canManage={canManage}
            />
          </TabsContent>
          <TabsContent value="a_receber" className="mt-6">
            <PaymentsTable
              payments={payments}
              loading={loadingPay}
              title="Contas a receber"
              filterFn={(p) => isOpen(p.status)}
              canManage={canManage}
            />
          </TabsContent>
          <TabsContent value="comissoes" className="mt-6">
            <CommissionsTable commissions={commissions} loading={loadingCom} canManage={canManage} />
          </TabsContent>
          <TabsContent value="inadimplencia" className="mt-6">
            <PaymentsTable
              payments={payments}
              loading={loadingPay}
              title="Inadimplência"
              initialStatus={statusFromUrl}
              filterFn={(p) =>
                ["vencido", "atrasado"].includes(p.status) ||
                (isOpen(p.status) && p.due_date && p.due_date < today)
              }
              canManage={canManage}
            />
          </TabsContent>
          <TabsContent value="por_cliente" className="mt-6">
            <ByClient payments={payments} canManage={canManage} />
          </TabsContent>
          <TabsContent value="relatorios" className="mt-6">
            <Reports payments={payments} commissions={commissionRows} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// -------------------- Payments table --------------------
type ConfirmDialogState =
  | { kind: "confirm"; payment: any }
  | { kind: "cancel"; payment: any }
  | { kind: "refund"; payment: any }
  | { kind: "commissions"; payment: any; commissions: any[] }
  | null;

function PaymentsTable({
  payments,
  loading,
  title,
  filterFn,
  canManage,
  initialStatus,
}: {
  payments: any[];
  loading: boolean;
  title: string;
  filterFn: (p: any) => boolean;
  canManage: boolean;
  initialStatus?: string;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus || "todos");
  const [methodFilter, setMethodFilter] = useState("todos");
  const [recurringFilter, setRecurringFilter] = useState("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<string>("due_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<ConfirmDialogState>(null);
  const qc = useQueryClient();
  const today = todayIsoStr();

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
    setPage(1);
  };

  const methodOptions = useMemo(() => {
    const set = new Set<string>();
    payments.forEach((p: any) => p.payment_method && set.add(p.payment_method));
    return Array.from(set);
  }, [payments]);

  const enriched = useMemo(
    () => payments.map((p: any) => ({ ...p, _status: effectiveStatus(p, today) })),
    [payments, today]
  );

  const filtered = useMemo(() => {
    const q = norm(search);
    return enriched.filter((p: any) => {
      if (!filterFn(p)) return false;
      if (statusFilter !== "todos" && p._status !== statusFilter) return false;
      if (methodFilter !== "todos" && (p.payment_method || "") !== methodFilter) return false;
      if (recurringFilter === "sim" && !p.is_recurring) return false;
      if (recurringFilter === "nao" && p.is_recurring) return false;
      if (dateFrom && (!p.due_date || p.due_date < dateFrom)) return false;
      if (dateTo && (!p.due_date || p.due_date > dateTo)) return false;
      if (q) {
        const hay = norm(
          `${p.clients?.full_name ?? ""} ${p.clients?.company ?? ""} ${p.products?.name ?? ""} ${
            p.client_products?.custom_product_name ?? ""
          } ${p.payment_method ?? ""} ${p.installment_number ?? ""}/${p.installments_count ?? ""}`
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, filterFn, statusFilter, methodFilter, recurringFilter, dateFrom, dateTo, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a: any, b: any) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "client":
          av = a.clients?.full_name ?? "";
          bv = b.clients?.full_name ?? "";
          break;
        case "product":
          av = a.products?.name ?? a.client_products?.custom_product_name ?? "";
          bv = b.products?.name ?? b.client_products?.custom_product_name ?? "";
          break;
        case "amount":
          av = Number(a.amount || 0);
          bv = Number(b.amount || 0);
          break;
        case "installment":
          av = Number(a.installment_number || 0);
          bv = Number(b.installment_number || 0);
          break;
        case "status":
          av = a._status;
          bv = b._status;
          break;
        case "due_date":
        default:
          av = a.due_date || "";
          bv = b.due_date || "";
      }
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalAmount = useMemo(
    () => sorted.reduce((a, p: any) => a + Number(p.amount || 0), 0),
    [sorted]
  );

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const activeChips: { label: string; clear: () => void }[] = [];
  if (search) activeChips.push({ label: `Busca: "${search}"`, clear: () => setSearch("") });
  if (statusFilter !== "todos")
    activeChips.push({
      label: `Status: ${PAY_STATUS[statusFilter]?.label ?? statusFilter}`,
      clear: () => setStatusFilter("todos"),
    });
  if (methodFilter !== "todos")
    activeChips.push({ label: `Método: ${methodFilter}`, clear: () => setMethodFilter("todos") });
  if (recurringFilter !== "todos")
    activeChips.push({
      label: `Recorrência: ${recurringFilter === "sim" ? "Sim" : "Não"}`,
      clear: () => setRecurringFilter("todos"),
    });
  if (dateFrom) activeChips.push({ label: `De ${dateFrom}`, clear: () => setDateFrom("") });
  if (dateTo) activeChips.push({ label: `Até ${dateTo}`, clear: () => setDateTo("") });

  const clearAll = () => {
    setSearch("");
    setStatusFilter("todos");
    setMethodFilter("todos");
    setRecurringFilter("todos");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const exportCsv = () => {
    if (sorted.length === 0) {
      toast.error("Nada para exportar");
      return;
    }
    const headers = ["Cliente", "Empresa", "Produto", "Valor", "Pago", "Vencimento", "Parcela", "Método", "Recorrência", "Status"];
    const rows = sorted.map((p: any) => [
      p.clients?.full_name ?? "",
      p.clients?.company ?? "",
      p.products?.name ?? p.client_products?.custom_product_name ?? "",
      Number(p.amount || 0).toFixed(2),
      Number(p.amount_paid || 0).toFixed(2),
      p.due_date ?? "",
      `${p.installment_number ?? 1}/${p.installments_count ?? 1}`,
      p.payment_method ?? "",
      p.is_recurring ? p.recurrence_period ?? "Sim" : "Não",
      PAY_STATUS[p._status]?.label ?? p._status,
    ]);
    downloadCsv(`${title.toLowerCase().replace(/\s+/g, "_")}_${today}.csv`, headers, rows);
    toast.success(`${sorted.length} registro(s) exportado(s)`);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["fin-payments"] });
    qc.invalidateQueries({ queryKey: ["fin-alerts"] });
    qc.invalidateQueries({ queryKey: ["fin-commissions"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["dash-payments"] });
    qc.invalidateQueries({ queryKey: ["dash-commissions"] });
    qc.invalidateQueries({ queryKey: ["dash-sales"] });
  };

  const submitConfirm = async (paymentId: string, amountPaid: number, paidAt: string) => {
    const payment = (payments as any[]).find((p: any) => p.id === paymentId);
    const { error } = await supabase
      .from("payments")
      .update({
        status: "pago",
        paid_at: new Date(paidAt).toISOString(),
        amount_paid: amountPaid,
      })
      .eq("id", paymentId);
    if (error) return toast.error(error.message);
    toast.success("Pagamento confirmado");
    invalidate();

    // After confirming the client payment, surface related commissions so the
    // admin can pay everyone now or postpone individual splits.
    if (payment?.sale_id) {
      const { data: splits } = await supabase
        .from("commission_splits")
        .select("id, amount, percent, status, beneficiary_type, beneficiary_id")
        .eq("sale_id", payment.sale_id);
      if (splits && splits.length > 0) {
        const partnerIds = Array.from(new Set(splits.filter((s: any) => s.beneficiary_type === "partner").map((s: any) => s.beneficiary_id)));
        const collabIds = Array.from(new Set(splits.filter((s: any) => s.beneficiary_type === "collaborator").map((s: any) => s.beneficiary_id)));
        const refIds = Array.from(new Set(splits.filter((s: any) => s.beneficiary_type === "referrer").map((s: any) => s.beneficiary_id)));
        const provIds = Array.from(new Set(splits.filter((s: any) => s.beneficiary_type === "service_provider").map((s: any) => s.beneficiary_id)));
        const [partnersRes, collabsRes, refsRes, provsRes] = await Promise.all([
          partnerIds.length ? supabase.from("partners").select("id, full_name").in("id", partnerIds) : Promise.resolve({ data: [] as any[] }),
          collabIds.length ? supabase.from("profiles").select("id, full_name").in("id", collabIds) : Promise.resolve({ data: [] as any[] }),
          refIds.length ? supabase.from("referrers").select("id, full_name").in("id", refIds) : Promise.resolve({ data: [] as any[] }),
          provIds.length ? supabase.from("service_providers").select("id, name").in("id", provIds) : Promise.resolve({ data: [] as any[] }),
        ]);
        const pMap = new Map((partnersRes.data ?? []).map((x: any) => [x.id, x.full_name]));
        const cMap = new Map((collabsRes.data ?? []).map((x: any) => [x.id, x.full_name]));
        const rMap = new Map((refsRes.data ?? []).map((x: any) => [x.id, x.full_name]));
        const spMap = new Map((provsRes.data ?? []).map((x: any) => [x.id, x.name]));
        const enriched = splits.map((s: any) => ({
          ...s,
          _beneficiary:
            (s.beneficiary_type === "partner" && `Parceiro · ${pMap.get(s.beneficiary_id) ?? "—"}`) ||
            (s.beneficiary_type === "collaborator" && `Colaborador · ${cMap.get(s.beneficiary_id) ?? "—"}`) ||
            (s.beneficiary_type === "referrer" && `Indicador · ${rMap.get(s.beneficiary_id) ?? "—"}`) ||
            (s.beneficiary_type === "service_provider" && `Prestador · ${spMap.get(s.beneficiary_id) ?? "—"}`) ||
            "Beneficiário",
        }));
        setDialog({ kind: "commissions", payment, commissions: enriched });
        return;
      }
    }
    setDialog(null);
  };

  const submitCommissionDecisions = async (
    decisions: { id: string; payNow: boolean }[]
  ) => {
    const payNowIds = decisions.filter((d) => d.payNow).map((d) => d.id);
    const postponeIds = decisions.filter((d) => !d.payNow).map((d) => d.id);
    const nowIso = new Date().toISOString();

    if (payNowIds.length > 0) {
      const { error } = await supabase
        .from("commission_splits")
        .update({ status: "pago" as any, paid_at: nowIso })
        .in("id", payNowIds);
      if (error) return toast.error(error.message);
    }
    if (postponeIds.length > 0) {
      const { error } = await supabase
        .from("commission_splits")
        .update({ status: "pendente" as any, paid_at: null })
        .in("id", postponeIds);
      if (error) return toast.error(error.message);
    }
    toast.success(
      payNowIds.length > 0
        ? `${payNowIds.length} comissão(ões) marcada(s) como paga(s)`
        : "Comissões mantidas como pendentes"
    );
    invalidate();
    setDialog(null);
  };

  const submitCancel = async (paymentId: string, reason: string) => {
    const { error } = await supabase
      .from("payments")
      .update({ status: "cancelado", cancellation_reason: reason || null })
      .eq("id", paymentId);
    if (error) return toast.error(error.message);
    toast.success("Pagamento cancelado");
    invalidate();
    setDialog(null);
  };

  const submitRefund = async (paymentId: string, amount: number) => {
    const { error } = await supabase
      .from("payments")
      .update({
        status: "reembolsado",
        refunded_at: new Date().toISOString(),
        refund_amount: amount,
      })
      .eq("id", paymentId);
    if (error) return toast.error(error.message);
    toast.success("Reembolso registrado");
    invalidate();
    setDialog(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-slate-400" />
            <span className="font-semibold text-sm text-slate-800">{title}</span>
            <span className="text-xs text-slate-500 font-mono">
              {sorted.length} {sorted.length === 1 ? "registro" : "registros"} ·{" "}
              <span className="text-slate-700">{formatBRL(totalAmount)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} className="h-9">
              <Download className="size-3.5 mr-1.5" /> CSV
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              className="pl-9 h-9 bg-white border-slate-200"
              placeholder="Buscar cliente, produto, método..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 bg-white border-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="em_aberto">Em aberto</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
              <SelectItem value="reembolsado">Reembolsado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="h-9 bg-white border-slate-200">
              <SelectValue placeholder="Método" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos métodos</SelectItem>
              {methodOptions.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            className="h-9 bg-white border-slate-200"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="De"
          />
          <Input
            type="date"
            className="h-9 bg-white border-slate-200"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="Até"
          />
        </div>

        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {activeChips.map((c, i) => (
              <button
                key={i}
                onClick={c.clear}
                className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5 hover:bg-indigo-100"
              >
                {c.label} <X className="size-3" />
              </button>
            ))}
            <button
              onClick={clearAll}
              className="text-[11px] text-slate-500 hover:text-slate-700 underline ml-1"
            >
              Limpar tudo
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200/70">
              <tr>
                <SortableTh label="Cliente" k="client" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Produto" k="product" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Valor" k="amount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <SortableTh label="Vencimento" k="due_date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Parcela" k="installment" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500">Forma</th>
                <SortableTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-semibold text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-4 py-3">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 text-sm">
                    <FileX className="size-8 mx-auto mb-2 text-slate-300" />
                    {activeChips.length > 0 ? (
                      <>
                        Nenhum resultado com esses filtros.{" "}
                        <button onClick={clearAll} className="text-indigo-600 underline">
                          Limpar filtros
                        </button>
                      </>
                    ) : (
                      "Nenhum pagamento registrado."
                    )}
                  </td>
                </tr>
              ) : (
                pageRows.map((p: any) => {
                  const meta = PAY_STATUS[p._status] ?? PAY_STATUS.em_aberto;
                  const productName = p.products?.name ?? p.client_products?.custom_product_name ?? "—";
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{p.clients?.full_name ?? "—"}</div>
                        {p.clients?.company && <div className="text-xs text-slate-500">{p.clients.company}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{productName}</td>
                      <td className="px-4 py-3 text-right font-medium font-mono tabular-nums text-slate-800">
                        {formatBRL(p.amount)}
                        {Number(p.amount_paid || 0) > 0 && Number(p.amount_paid) < Number(p.amount) && (
                          <div className="text-[10px] text-slate-500">Pago {formatBRL(p.amount_paid)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {p.due_date ? formatDate(p.due_date) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-600">
                        {p.installment_number ?? 1}/{p.installments_count ?? 1}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {p.payment_method ?? "—"}
                        {p.is_recurring && (
                          <div className="text-[10px] text-indigo-600">{p.recurrence_period ?? "Recorrente"}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={cn("font-normal border", meta.cls)}>{meta.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {canManage && p._status !== "pago" && p._status !== "cancelado" && p._status !== "reembolsado" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => setDialog({ kind: "confirm", payment: p })}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-slate-500 hover:text-slate-700"
                                onClick={() => setDialog({ kind: "cancel", payment: p })}
                              >
                                Cancelar
                              </Button>
                            </>
                          )}
                          {canManage && p._status === "pago" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-violet-700 hover:text-violet-800"
                              onClick={() => setDialog({ kind: "refund", payment: p })}
                            >
                              Reembolsar
                            </Button>
                          )}
                          {p.receipt_url && (
                            <button
                              type="button"
                              onClick={async () => {
                                const { data, error } = await supabase.storage.from("documents").createSignedUrl(p.receipt_url, 120);
                                if (error || !data) { toast.error("Não foi possível abrir o comprovante"); return; }
                                window.open(data.signedUrl, "_blank");
                              }}
                              className="text-xs text-indigo-600 underline"
                            >
                              Comprovante
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <PaginationControl
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={sorted.length}
          itemsPerPage={pageSize}
        />
      </div>

      <PaymentActionDialog
        state={dialog}
        onClose={() => setDialog(null)}
        onConfirm={submitConfirm}
        onCancel={submitCancel}
        onRefund={submitRefund}
        onCommissions={submitCommissionDecisions}
      />
    </div>
  );
}

function PaymentActionDialog({
  state,
  onClose,
  onConfirm,
  onCancel,
  onRefund,
  onCommissions,
}: {
  state: ConfirmDialogState;
  onClose: () => void;
  onConfirm: (id: string, amountPaid: number, paidAt: string) => void;
  onCancel: (id: string, reason: string) => void;
  onRefund: (id: string, amount: number) => void;
  onCommissions: (decisions: { id: string; payNow: boolean }[]) => void;
}) {
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayIsoStr());
  const [reason, setReason] = useState("");
  const [commDecisions, setCommDecisions] = useState<Record<string, boolean>>({});

  useMemo(() => {
    if (!state) return;
    if (state.kind === "confirm") {
      setAmount(String(state.payment.amount ?? ""));
      setPaidAt(todayIsoStr());
    } else if (state.kind === "refund") {
      setAmount(String(state.payment.amount_paid || state.payment.amount || ""));
    } else if (state.kind === "cancel") {
      setReason("");
    } else if (state.kind === "commissions") {
      const init: Record<string, boolean> = {};
      state.commissions.forEach((c: any) => { init[c.id] = true; });
      setCommDecisions(init);
    }
  }, [state?.kind, (state as any)?.payment?.id]);

  if (!state) return null;
  const { kind, payment } = state;

  const isComm = kind === "commissions";
  const commissions = isComm ? (state as any).commissions as any[] : [];
  const totalNow = commissions
    .filter((c) => commDecisions[c.id])
    .reduce((a, c) => a + Number(c.amount || 0), 0);

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn("bg-white border-slate-200/70", isComm ? "max-w-lg" : "max-w-md")}>
        <DialogHeader>
          <DialogTitle>
            {kind === "confirm" && "Confirmar pagamento"}
            {kind === "cancel" && "Cancelar pagamento"}
            {kind === "refund" && "Registrar reembolso"}
            {kind === "commissions" && "Pagar comissões desta venda"}
          </DialogTitle>
          <DialogDescription>
            {payment.clients?.full_name ?? "Cliente"} · Valor original:{" "}
            <span className="font-mono">{formatBRL(payment.amount)}</span>
          </DialogDescription>
        </DialogHeader>

        {kind === "confirm" && (
          <div className="space-y-3">
            <div>
              <Label>Valor pago (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Data do pagamento</Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
          </div>
        )}

        {kind === "cancel" && (
          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Por que está cancelando?"
            />
          </div>
        )}

        {kind === "refund" && (
          <div className="space-y-2">
            <Label>Valor a reembolsar (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              Máximo: {formatBRL(Number(payment.amount_paid || payment.amount || 0))}
            </p>
          </div>
        )}

        {isComm && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              O pagamento do cliente foi registrado. Marque quais comissões deseja pagar agora —
              as desmarcadas ficarão pendentes na Central Financeira para pagar depois.
            </p>
            <div className="space-y-2 max-h-72 overflow-auto rounded-md border border-slate-200 divide-y divide-slate-100">
              {commissions.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={!!commDecisions[c.id]}
                      onChange={(e) =>
                        setCommDecisions((s) => ({ ...s, [c.id]: e.target.checked }))
                      }
                      className="size-4 accent-emerald-600"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">
                        {c._beneficiary}
                      </div>
                      <div className="text-xs text-slate-500">
                        {c.rule_type ?? "comissão"}
                      </div>
                    </div>
                  </div>
                  <div className="font-mono text-sm text-slate-700 whitespace-nowrap">
                    {formatBRL(Number(c.amount || 0))}
                  </div>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                className="text-indigo-600 hover:underline"
                onClick={() => {
                  const allOn = commissions.every((c) => commDecisions[c.id]);
                  const next: Record<string, boolean> = {};
                  commissions.forEach((c) => { next[c.id] = !allOn; });
                  setCommDecisions(next);
                }}
              >
                {commissions.every((c) => commDecisions[c.id]) ? "Desmarcar todas" : "Marcar todas"}
              </button>
              <span className="font-mono text-slate-700">
                A pagar agora: {formatBRL(totalNow)}
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {isComm ? "Concluir depois" : "Voltar"}
          </Button>
          {kind === "confirm" && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                const n = Number(amount);
                if (!Number.isFinite(n) || n <= 0) return toast.error("Valor inválido");
                onConfirm(payment.id, n, paidAt);
              }}
            >
              Confirmar
            </Button>
          )}
          {kind === "cancel" && (
            <Button
              variant="destructive"
              onClick={async () => {
                if (!(await confirmAction("Cancelar este pagamento?"))) return;
                onCancel(payment.id, reason);
              }}
            >
              Cancelar pagamento
            </Button>
          )}
          {kind === "refund" && (
            <Button
              className="bg-violet-600 hover:bg-violet-700 text-white"
              onClick={() => {
                const n = Number(amount);
                const max = Number(payment.amount_paid || payment.amount || 0);
                if (!Number.isFinite(n) || n <= 0) return toast.error("Valor inválido");
                if (n > max) return toast.error(`Máximo ${formatBRL(max)}`);
                onRefund(payment.id, n);
              }}
            >
              Reembolsar
            </Button>
          )}
          {isComm && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() =>
                onCommissions(
                  commissions.map((c) => ({ id: c.id, payNow: !!commDecisions[c.id] }))
                )
              }
            >
              Aplicar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// -------------------- Commissions to pay --------------------
function CommissionsTable({
  commissions,
  loading,
  canManage,
}: {
  commissions: any[];
  loading: boolean;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState<string>("todos");
  const [beneficiaryFilter, setBeneficiaryFilter] = useState<string>("todos");

  // Reset beneficiary when type changes
  useEffect(() => {
    setBeneficiaryFilter("todos");
  }, [typeFilter]);

  const beneficiaryOptions = useMemo(() => {
    const pool = typeFilter === "todos" ? commissions : commissions.filter((c: any) => c.beneficiary_type === typeFilter);
    const map = new Map<string, string>();
    pool.forEach((c: any) => {
      if (c.beneficiary_id && c.beneficiary_name) map.set(c.beneficiary_id, c.beneficiary_name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [commissions, typeFilter]);

  const filtered = useMemo(() => {
    const q = norm(search);
    return commissions.filter((c: any) => {
      const paid = isPaid(c.status) || isPaid(c.workflow_status);
      if (statusFilter === "pendente" && paid) return false;
      if (statusFilter === "pago" && !paid) return false;
      if (typeFilter !== "todos" && c.beneficiary_type !== typeFilter) return false;
      if (beneficiaryFilter !== "todos" && c.beneficiary_id !== beneficiaryFilter) return false;
      if (q) {
        const hay = norm(
          `${c.partners?.full_name ?? ""} ${c.profiles?.full_name ?? ""} ${c.referrers?.full_name ?? ""} ${c.clients?.full_name ?? ""} ${c.products?.name ?? ""} ${c.status ?? ""}`
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [commissions, search, statusFilter, typeFilter, beneficiaryFilter]);

  const pending = filtered.filter((c: any) => !isPaid(c.status) && !isPaid(c.workflow_status));
  const paid = filtered.filter((c: any) => isPaid(c.status) || isPaid(c.workflow_status));

  const totals = useMemo(() => {
    const totalAll = filtered.reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
    const totalPaid = paid.reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
    const totalPending = pending.reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
    return { totalAll, totalPaid, totalPending, count: filtered.length };
  }, [filtered, paid, pending]);

  const byBeneficiary = useMemo(() => {
    const map = new Map<string, { id: string; name: string; type: string; label: string; total: number; pago: number; pendente: number; count: number }>();
    filtered.forEach((c: any) => {
      const key = `${c.beneficiary_type}:${c.beneficiary_id}`;
      if (!map.has(key)) {
        map.set(key, {
          id: c.beneficiary_id,
          name: c.beneficiary_name ?? "—",
          type: c.beneficiary_type,
          label: c.beneficiary_label ?? "—",
          total: 0,
          pago: 0,
          pendente: 0,
          count: 0,
        });
      }
      const row = map.get(key)!;
      const amt = Number(c.amount || 0);
      row.total += amt;
      row.count += 1;
      if (isPaid(c.status) || isPaid(c.workflow_status)) row.pago += amt;
      else row.pendente += amt;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const hasFilter = statusFilter !== "todos" || typeFilter !== "todos" || beneficiaryFilter !== "todos" || !!search;
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("todos");
    setTypeFilter("todos");
    setBeneficiaryFilter("todos");
  };

  const markPaid = async (c: any) => {
    if (!(await confirmAction(`Marcar comissão de ${formatBRL(c.amount)} para ${c.beneficiary_name} como paga?`))) return;
    const { error } = await supabase
      .from("commission_splits")
      .update({ status: "pago" as any, paid_at: new Date().toISOString() })
      .eq("id", c.id);
    if (error) {
      toast.error("Erro ao marcar paga: " + error.message);
      return;
    }
    toast.success("Comissão marcada como paga");
    qc.invalidateQueries({ queryKey: ["fin-commissions"] });
    qc.invalidateQueries({ queryKey: ["fin-payments"] });
    qc.invalidateQueries({ queryKey: ["dash-commissions"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const Block = ({ rows, title, action }: { rows: any[]; title: string; action: boolean }) => (
    <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200/70 text-sm font-semibold text-slate-800 flex items-center justify-between">
        <span>
          {title} <span className="text-slate-500 font-mono text-xs">({rows.length})</span>
        </span>
        <span className="font-mono text-xs text-slate-600 tabular-nums">
          {formatBRL(rows.reduce((a: number, c: any) => a + Number(c.amount || 0), 0))}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="text-left px-4 py-2 font-semibold">Beneficiário</th>
              <th className="text-left px-4 py-2 font-semibold">Tipo</th>
              <th className="text-left px-4 py-2 font-semibold">Cliente</th>
              <th className="text-left px-4 py-2 font-semibold">Produto</th>
              <th className="text-right px-4 py-2 font-semibold">%</th>
              <th className="text-right px-4 py-2 font-semibold">Valor</th>
              <th className="text-left px-4 py-2 font-semibold">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={8} className="px-4 py-3"><Skeleton className="h-6 w-full" /></td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-500 text-xs">
                  Sem registros.
                </td>
              </tr>
            ) : (
              rows.map((c: any) => {
                const typeColor =
                  c.beneficiary_type === "partner" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                  c.beneficiary_type === "collaborator" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  c.beneficiary_type === "referrer" ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-slate-50 text-slate-700 border-slate-200";
                return (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 text-slate-800 font-medium">{c.beneficiary_name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${typeColor}`}>
                        {c.beneficiary_label ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{c.clients?.full_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-700">{c.products?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">{Number(c.percent || 0).toFixed(2)}%</td>
                    <td className="px-4 py-2.5 text-right font-semibold font-mono tabular-nums">{formatBRL(c.amount)}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="text-xs">{c.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {action && canManage && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markPaid(c)}>
                          Marcar paga
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            className="pl-9 h-9 bg-white border-slate-200"
            placeholder="Buscar parceiro, cliente, produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-[170px] bg-white border-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos tipos</SelectItem>
            <SelectItem value="collaborator">Colaboradores</SelectItem>
            <SelectItem value="partner">Parceiros</SelectItem>
            <SelectItem value="referrer">Indicadores</SelectItem>
            <SelectItem value="service_provider">Prestadores</SelectItem>
          </SelectContent>
        </Select>
        <Select value={beneficiaryFilter} onValueChange={setBeneficiaryFilter}>
          <SelectTrigger className="h-9 w-[220px] bg-white border-slate-200">
            <SelectValue placeholder="Beneficiário" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="todos">Todos beneficiários</SelectItem>
            {beneficiaryOptions.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[140px] bg-white border-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="pago">Pagas</SelectItem>
          </SelectContent>
        </Select>
        {hasFilter && (
          <button onClick={clearFilters} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            Limpar filtros
          </button>
        )}
      </div>

      {/* Totais do filtro */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200/70 bg-white shadow-sm p-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Registros</p>
          <p className="font-mono text-lg font-bold text-slate-900 mt-1 tabular-nums">{totals.count}</p>
        </div>
        <div className="rounded-lg border border-indigo-200/70 bg-indigo-50/50 shadow-sm p-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-indigo-700">Total do filtro</p>
          <p className="font-mono text-lg font-bold text-indigo-800 mt-1 tabular-nums">{formatBRL(totals.totalAll)}</p>
        </div>
        <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/50 shadow-sm p-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700">Pago</p>
          <p className="font-mono text-lg font-bold text-emerald-800 mt-1 tabular-nums">{formatBRL(totals.totalPaid)}</p>
        </div>
        <div className="rounded-lg border border-amber-200/70 bg-amber-50/50 shadow-sm p-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-700">Pendente</p>
          <p className="font-mono text-lg font-bold text-amber-800 mt-1 tabular-nums">{formatBRL(totals.totalPending)}</p>
        </div>
      </div>

      {/* Breakdown por beneficiário */}
      {byBeneficiary.length > 1 && (
        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200/70 text-sm font-semibold text-slate-800">
            Total por beneficiário <span className="text-slate-500 font-mono text-xs">({byBeneficiary.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-2 font-semibold">Beneficiário</th>
                  <th className="text-left px-4 py-2 font-semibold">Tipo</th>
                  <th className="text-right px-4 py-2 font-semibold">Lançamentos</th>
                  <th className="text-right px-4 py-2 font-semibold">Pago</th>
                  <th className="text-right px-4 py-2 font-semibold">Pendente</th>
                  <th className="text-right px-4 py-2 font-semibold">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byBeneficiary.map((b) => {
                  const typeColor =
                    b.type === "partner" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                    b.type === "collaborator" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    b.type === "referrer" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    "bg-slate-50 text-slate-700 border-slate-200";
                  return (
                    <tr key={`${b.type}:${b.id}`} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 text-slate-800 font-medium">{b.name}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${typeColor}`}>{b.label}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">{b.count}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-700">{formatBRL(b.pago)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-amber-700">{formatBRL(b.pendente)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">{formatBRL(b.total)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => { setTypeFilter(b.type); setBeneficiaryFilter(b.id); }}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                          Filtrar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Block rows={pending} title="Pendentes" action />
      <Block rows={paid} title="Pagas" action={false} />
    </div>
  );
}

// -------------------- Cash flow --------------------
function CashFlow({ payments, commissions }: { payments: any[]; commissions: any[] }) {
  const [days, setDays] = useState(30);
  const data = useMemo(() => {
    const map: Record<string, { label: string; entrada: number; saida: number; saldo: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map[key] = { label: key.slice(5), entrada: 0, saida: 0, saldo: 0 };
    }
    payments
      .filter((p: any) => isPaid(p.status))
      .forEach((p: any) => {
        const key = (p.paid_at || "").slice(0, 10);
        if (map[key]) map[key].entrada += Number(p.amount_paid || p.amount || 0);
      });
    commissions
      .filter((c: any) => isPaid(c.status) || isPaid(c.workflow_status))
      .forEach((c: any) => {
        const key = (c.paid_at || "").slice(0, 10);
        if (map[key]) map[key].saida += Number(c.amount || 0);
      });
    let acc = 0;
    return Object.values(map).map((d) => {
      acc += d.entrada - d.saida;
      return { ...d, saldo: acc };
    });
  }, [payments, commissions, days]);

  return (
    <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-800">Fluxo de caixa</h3>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-[140px] h-9 bg-white border-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="60">Últimos 60 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" fontSize={11} stroke="#94a3b8" />
            <YAxis fontSize={11} stroke="#94a3b8" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(v: any) => formatBRL(v)}
              contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="entrada" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.18} name="Entradas" />
            <Area type="monotone" dataKey="saida" stroke="#e11d48" fill="#e11d48" fillOpacity={0.15} name="Saídas" />
            <Area type="monotone" dataKey="saldo" stroke="#059669" fill="transparent" name="Saldo acumulado" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// -------------------- Reports --------------------
function Reports({ payments, commissions }: { payments: any[]; commissions: any[] }) {
  const [months, setMonths] = useState(6);
  const monthly = useMemo(() => {
    const map: Record<string, { label: string; receita: number; comissao: number; liquida: number }> = {};
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = { label: key, receita: 0, comissao: 0, liquida: 0 };
    }
    payments
      .filter((p: any) => isPaid(p.status))
      .forEach((p: any) => {
        const key = (p.paid_at || "").slice(0, 7);
        if (map[key]) map[key].receita += Number(p.amount_paid || p.amount || 0);
      });
    commissions
      .filter((c: any) => isPaid(c.status) || isPaid(c.workflow_status))
      .forEach((c: any) => {
        const key = (c.paid_at || "").slice(0, 7);
        if (map[key]) map[key].comissao += Number(c.amount || 0);
      });
    Object.keys(map).forEach((k) => {
      map[k].liquida = map[k].receita - map[k].comissao;
    });
    return Object.values(map);
  }, [payments, commissions, months]);

  const exportSummary = () => {
    downloadCsv(
      `relatorio_financeiro_${todayIsoStr()}.csv`,
      ["Mês", "Receita", "Comissão", "Líquida"],
      monthly.map((m) => [m.label, m.receita.toFixed(2), m.comissao.toFixed(2), m.liquida.toFixed(2)])
    );
    toast.success("Relatório exportado");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
          <SelectTrigger className="w-[160px] h-9 bg-white border-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Últimos 3 meses</SelectItem>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportSummary} className="h-9">
          <Download className="size-3.5 mr-1.5" /> CSV
        </Button>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-6">
          <h3 className="text-base font-semibold mb-4 text-slate-800">Receita vs comissão</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" fontSize={11} stroke="#94a3b8" />
                <YAxis fontSize={11} stroke="#94a3b8" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: any) => formatBRL(v)}
                  contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="receita" fill="#4f46e5" name="Receita" />
                <Bar dataKey="comissao" fill="#e11d48" name="Comissão" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-6 space-y-1">
          <h3 className="text-base font-semibold mb-3 text-slate-800">Resumo mensal</h3>
          {monthly.map((m, i) => (
            <div
              key={i}
              className="flex justify-between items-center text-sm border-b border-slate-100 py-3 hover:bg-slate-50/60 px-2 rounded transition-colors"
            >
              <span className="font-medium text-slate-700 font-mono">{m.label}</span>
              <div className="text-right">
                <div className="flex gap-4 text-xs">
                  <span className="text-slate-500">
                    Receita: <span className="font-mono">{formatBRL(m.receita)}</span>
                  </span>
                  <span className="text-rose-600/80">
                    Comissão: <span className="font-mono">{formatBRL(m.comissao)}</span>
                  </span>
                </div>
                <div className="font-bold text-emerald-600 mt-1 font-mono">
                  Líquida: {formatBRL(m.liquida)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// -------------------- Per-client summary --------------------
function ByClient({ payments, canManage }: { payments: any[]; canManage: boolean }) {
  const [clientId, setClientId] = useState<string>("");
  const [clientSearch, setClientSearch] = useState("");

  const { data: clients = [] } = useClientsRef();

  const { data: clientProducts = [] } = useQuery({
    queryKey: ["fin-client-products", clientId],
    enabled: !!clientId,
    queryFn: async () =>
      (
        await supabase
          .from("client_products")
          .select("id, value, status, products(name), custom_product_name")
          .eq("client_id", clientId)
      ).data ?? [],
  });

  const today = todayIsoStr();
  const clientPayments = payments.filter((p: any) => p.client_id === clientId);
  const filteredClients = useMemo(() => {
    const q = norm(clientSearch);
    if (!q) return clients;
    return clients.filter((c: any) => norm(`${c.full_name} ${c.company ?? ""}`).includes(q));
  }, [clients, clientSearch]);

  const summary = useMemo(() => {
    const contracted = clientProducts.reduce((a: number, c: any) => a + Number(c.value || 0), 0);
    const paid = clientPayments
      .filter((p: any) => isPaid(p.status))
      .reduce((a: number, p: any) => a + Number(p.amount_paid || p.amount || 0), 0);
    const pending = clientPayments
      .filter((p: any) => isOpen(p.status))
      .reduce((a: number, p: any) => a + Number(p.amount || 0) - Number(p.amount_paid || 0), 0);
    const overdue = clientPayments
      .filter(
        (p: any) =>
          ["vencido", "atrasado"].includes(p.status) ||
          (isOpen(p.status) && p.due_date && p.due_date < today)
      )
      .reduce((a: number, p: any) => a + Number(p.amount || 0) - Number(p.amount_paid || 0), 0);
    return { contracted, paid, pending, overdue };
  }, [clientProducts, clientPayments, today]);

  const exportExtrato = () => {
    if (clientPayments.length === 0) return toast.error("Nada para exportar");
    const cli = clients.find((c: any) => c.id === clientId);
    const headers = ["Produto", "Valor", "Pago", "Vencimento", "Status"];
    const rows = clientPayments.map((p: any) => [
      p.products?.name ?? p.client_products?.custom_product_name ?? "",
      Number(p.amount || 0).toFixed(2),
      Number(p.amount_paid || 0).toFixed(2),
      p.due_date ?? "",
      effectiveStatus(p, today),
    ]);
    downloadCsv(`extrato_${(cli?.full_name ?? "cliente").replace(/\s+/g, "_")}_${today}.csv`, headers, rows);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            className="pl-9 h-9 bg-white border-slate-200"
            placeholder="Buscar cliente..."
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
          />
        </div>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="w-[320px] h-9 bg-white border-slate-200">
            <SelectValue placeholder="Selecione um cliente" />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {filteredClients.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>
                {c.full_name}
                {c.company ? ` — ${c.company}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {clientId && (
          <Button variant="outline" size="sm" onClick={exportExtrato} className="h-9">
            <Download className="size-3.5 mr-1.5" /> CSV
          </Button>
        )}
      </div>

      {clientId && (
        <>
          <div className="grid md:grid-cols-4 gap-3">
            <Stat label="Contratado" value={formatBRL(summary.contracted)} />
            <Stat label="Pago" value={formatBRL(summary.paid)} tone="success" />
            <Stat label="Pendente" value={formatBRL(summary.pending)} tone="warning" />
            <Stat label="Vencido" value={formatBRL(summary.overdue)} tone="danger" />
          </div>

          <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200/70 text-sm font-semibold text-slate-800">
              Pagamentos do cliente <span className="text-slate-500 font-mono text-xs">({clientPayments.length})</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Produto</th>
                    <th className="text-right px-4 py-2 font-semibold">Valor</th>
                    <th className="text-left px-4 py-2 font-semibold">Vencimento</th>
                    <th className="text-left px-4 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clientPayments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-500 text-xs">
                        Sem pagamentos registrados.
                      </td>
                    </tr>
                  ) : (
                    clientPayments.map((p: any) => {
                      const s = effectiveStatus(p, today);
                      const meta = PAY_STATUS[s] ?? PAY_STATUS.em_aberto;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2.5 text-slate-700">
                            {p.products?.name ?? p.client_products?.custom_product_name ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">{formatBRL(p.amount)}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                            {p.due_date ? formatDate(p.due_date) : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge className={cn("font-normal border", meta.cls)}>{meta.label}</Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!clientId && (
        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-12 text-center text-sm text-slate-500">
          Selecione um cliente para ver o extrato financeiro.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "danger" }) {
  const cls =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
      ? "text-amber-700"
      : tone === "danger"
      ? "text-rose-700"
      : "text-slate-800";
  return (
    <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-4">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={cn("text-xl font-bold mt-1 font-mono", cls)}>{value}</div>
    </div>
  );
}
