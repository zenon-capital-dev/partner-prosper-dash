import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Banknote, TrendingUp, AlertTriangle, Wallet, Receipt, BarChart3,
  Search, RefreshCw, CheckCircle2, AlertCircle, Calendar,
} from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend,
} from "recharts";

const PAY_STATUS: Record<string, { label: string; cls: string }> = {
  em_aberto: { label: "Em aberto", cls: "bg-blue-500/15 text-blue-600" },
  pendente: { label: "Em aberto", cls: "bg-blue-500/15 text-blue-600" },
  pago: { label: "Pago", cls: "bg-emerald-500/15 text-emerald-600" },
  parcial: { label: "Parcial", cls: "bg-amber-500/15 text-amber-700" },
  parcialmente_pago: { label: "Parcial", cls: "bg-amber-500/15 text-amber-700" },
  vencido: { label: "Vencido", cls: "bg-rose-500/15 text-rose-600" },
  atrasado: { label: "Vencido", cls: "bg-rose-500/15 text-rose-600" },
  cancelado: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
  reembolsado: { label: "Reembolsado", cls: "bg-indigo-500/15 text-indigo-600" },
};

const TABS = [
  { id: "fluxo", label: "Fluxo de caixa", icon: TrendingUp },
  { id: "receitas", label: "Receitas", icon: Banknote },
  { id: "recebidos", label: "Pagamentos recebidos", icon: CheckCircle2 },
  { id: "a_receber", label: "Contas a receber", icon: Receipt },
  { id: "comissoes", label: "Comissões a pagar", icon: Wallet },
  { id: "inadimplencia", label: "Inadimplência", icon: AlertTriangle },
  { id: "por_cliente", label: "Por cliente", icon: BarChart3 },
  { id: "relatorios", label: "Relatórios", icon: BarChart3 },
];

export default function FinanceCenter() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "fluxo";
  const setTab = (t: string) => setParams({ tab: t });
  const qc = useQueryClient();

  const { data: payments = [], isLoading: loadingPay } = useQuery({
    queryKey: ["fin-payments"],
    queryFn: async () => (await supabase
      .from("payments")
      .select("*, clients(id, full_name, company), products(name), client_products(custom_product_name)")
      .order("due_date", { ascending: false })).data ?? [],
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["fin-commissions"],
    queryFn: async () => (await supabase
      .from("commissions")
      .select("*, partners(full_name), products(name), clients(full_name)")
      .order("created_at", { ascending: false })).data ?? [],
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["fin-alerts"],
    queryFn: async () => (await supabase
      .from("financial_alerts")
      .select("*, clients(full_name)")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(50)).data ?? [],
  });

  const todayIso = new Date().toISOString().slice(0, 10);

  const kpis = useMemo(() => {
    const isOpen = (s: string) => ["em_aberto", "pendente", "parcial", "parcialmente_pago"].includes(s);
    const isPaid = (s: string) => s === "pago";
    const isOverdue = (p: any) => isOpen(p.status) && p.due_date && p.due_date < todayIso;
    const totalReceived = payments.filter((p: any) => isPaid(p.status)).reduce((a: number, p: any) => a + Number(p.amount_paid || p.amount || 0), 0);
    const totalReceivable = payments.filter((p: any) => isOpen(p.status)).reduce((a: number, p: any) => a + Number(p.amount || 0) - Number(p.amount_paid || 0), 0);
    const totalOverdue = payments.filter(isOverdue).reduce((a: number, p: any) => a + Number(p.amount || 0) - Number(p.amount_paid || 0), 0);
    const commissionsPending = commissions.filter((c: any) => c.status !== "pago").reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
    const commissionsPaid = commissions.filter((c: any) => c.status === "pago").reduce((a: number, c: any) => a + Number(c.amount || 0), 0);
    const netCommission = totalReceived - commissionsPaid;
    return { totalReceived, totalReceivable, totalOverdue, commissionsPending, netCommission };
  }, [payments, commissions, todayIso]);

  const processAlerts = async () => {
    const { data, error } = await supabase.functions.invoke("process-alerts");
    if (error) toast.error("Erro ao processar alertas");
    else {
      toast.success(`${data?.alerts_processed ?? 0} alertas atualizados`);
      qc.invalidateQueries({ queryKey: ["fin-alerts"] });
    }
  };

  return (
    <div className="page-shell space-y-6 animate-fade-up">
      <PageHero
        eyebrow="Financeiro"
        title="Central Financeira"
        description="Receitas, contas a receber, comissões, inadimplência e relatórios em um só lugar."
        icon={<Banknote className="h-5 w-5" />}
        actions={
          <Button variant="outline" onClick={processAlerts}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar alertas
          </Button>
        }
        kpis={[
          { label: "Recebido (Bruto)", value: formatBRL(kpis.totalReceived), tone: "success" },
          { label: "Comissão Líquida", value: formatBRL(kpis.netCommission), tone: "primary" },
          { label: "A receber", value: formatBRL(kpis.totalReceivable), tone: "info" },
          { label: "Vencido", value: formatBRL(kpis.totalOverdue), tone: "danger" },
          { label: "Comissões a pagar", value: formatBRL(kpis.commissionsPending), tone: "warning" },
        ]}
      />

      {alerts.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span className="font-medium text-sm">{alerts.length} alerta(s) ativo(s)</span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {alerts.slice(0, 6).map((a: any) => (
              <div key={a.id} className="rounded-md bg-card border p-2">
                <div className="font-medium">{a.title}</div>
                {a.clients?.full_name && <div className="text-muted-foreground">{a.clients.full_name}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          {TABS.map(t => (
            <TabsTrigger key={t.id} value={t.id} className="gap-2">
              <t.icon className="h-4 w-4" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="fluxo" className="mt-6"><CashFlow payments={payments} commissions={commissions} /></TabsContent>
        <TabsContent value="receitas" className="mt-6"><PaymentsTable payments={payments} loading={loadingPay} title="Receitas" filterFn={() => true} /></TabsContent>
        <TabsContent value="recebidos" className="mt-6"><PaymentsTable payments={payments} loading={loadingPay} title="Pagamentos recebidos" filterFn={(p) => p.status === "pago"} /></TabsContent>
        <TabsContent value="a_receber" className="mt-6"><PaymentsTable payments={payments} loading={loadingPay} title="Contas a receber" filterFn={(p) => ["em_aberto", "pendente", "parcial", "parcialmente_pago"].includes(p.status)} /></TabsContent>
        <TabsContent value="comissoes" className="mt-6"><CommissionsTable commissions={commissions} /></TabsContent>
        <TabsContent value="inadimplencia" className="mt-6"><PaymentsTable payments={payments} loading={loadingPay} title="Inadimplência" filterFn={(p) => ["vencido", "atrasado"].includes(p.status) || (["em_aberto", "pendente", "parcial", "parcialmente_pago"].includes(p.status) && p.due_date && p.due_date < todayIso)} /></TabsContent>
        <TabsContent value="por_cliente" className="mt-6"><ByClient payments={payments} /></TabsContent>
        <TabsContent value="relatorios" className="mt-6"><Reports payments={payments} commissions={commissions} /></TabsContent>
      </Tabs>
    </div>
  );
}

// -------------------- Payments table --------------------
function PaymentsTable({
  payments, loading, title, filterFn,
}: { payments: any[]; loading: boolean; title: string; filterFn: (p: any) => boolean; }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const qc = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const enriched = payments.map((p: any) => {
    let status = p.status;
    if (["em_aberto", "pendente", "parcial", "parcialmente_pago"].includes(status) && p.due_date && p.due_date < today) {
      status = "vencido";
    }
    return { ...p, _status: status };
  });

  const filtered = enriched.filter((p: any) => {
    if (!filterFn(p)) return false;
    if (statusFilter !== "todos" && p._status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const t = `${p.clients?.full_name ?? ""} ${p.products?.name ?? ""} ${p.client_products?.custom_product_name ?? ""}`.toLowerCase();
      if (!t.includes(s)) return false;
    }
    return true;
  });

  const total = filtered.reduce((a, p) => a + Number(p.amount || 0), 0);

  const markPaid = async (id: string, amount: number) => {
    const { error } = await supabase.from("payments").update({
      status: "pago", 
      paid_at: new Date().toISOString(),
      amount_paid: amount,
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Pagamento confirmado"); qc.invalidateQueries({ queryKey: ["fin-payments"] }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 w-[220px]" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
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
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Cliente</th>
              <th className="text-left px-4 py-3 font-medium">Produto</th>
              <th className="text-right px-4 py-3 font-medium">Valor</th>
              <th className="text-left px-4 py-3 font-medium">Vencimento</th>
              <th className="text-left px-4 py-3 font-medium">Parcela</th>
              <th className="text-left px-4 py-3 font-medium">Forma</th>
              <th className="text-left px-4 py-3 font-medium">Recorrência</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Nada encontrado.</td></tr>
            )}
            {filtered.map((p: any) => {
              const meta = PAY_STATUS[p._status] ?? PAY_STATUS.em_aberto;
              const productName = p.products?.name ?? p.client_products?.custom_product_name ?? "—";
              return (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.clients?.full_name ?? "—"}</div>
                    {p.clients?.company && <div className="text-xs text-muted-foreground">{p.clients.company}</div>}
                  </td>
                  <td className="px-4 py-3">{productName}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatBRL(p.amount)}</td>
                  <td className="px-4 py-3">{p.due_date ? formatDate(p.due_date) : "—"}</td>
                  <td className="px-4 py-3 text-xs">{p.installment_number ?? 1}/{p.installments_count ?? 1}</td>
                  <td className="px-4 py-3 text-xs">{p.payment_method ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{p.is_recurring ? (p.recurrence_period ?? "Sim") : "—"}</td>
                  <td className="px-4 py-3"><Badge className={cn("font-normal", meta.cls)}>{meta.label}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    {p._status !== "pago" && p._status !== "cancelado" && (
                      <Button size="sm" variant="outline" onClick={() => markPaid(p.id)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmar
                      </Button>
                    )}
                    {p.receipt_url && (
                      <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-primary ml-2 underline">Comprovante</a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="bg-muted/30">
              <tr>
                <td colSpan={2} className="px-4 py-2 text-sm font-medium">Total ({filtered.length})</td>
                <td className="px-4 py-2 text-right font-bold">{formatBRL(total)}</td>
                <td colSpan={6}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// -------------------- Commissions to pay --------------------
function CommissionsTable({ commissions }: { commissions: any[] }) {
  const qc = useQueryClient();
  const pending = commissions.filter((c: any) => c.status !== "pago");
  const paid = commissions.filter((c: any) => c.status === "pago");

  const markPaid = async (id: string) => {
    const { error } = await supabase.from("commissions").update({
      status: "pago", paid_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Comissão paga"); qc.invalidateQueries({ queryKey: ["fin-commissions"] }); }
  };

  const Block = ({ rows, title, action }: { rows: any[]; title: string; action: boolean }) => (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-2 bg-muted/40 text-sm font-medium">{title} ({rows.length})</div>
      <table className="w-full text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Parceiro</th>
            <th className="text-left px-4 py-2 font-medium">Cliente</th>
            <th className="text-left px-4 py-2 font-medium">Produto</th>
            <th className="text-right px-4 py-2 font-medium">Valor</th>
            <th className="text-left px-4 py-2 font-medium">Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground text-xs">Sem registros.</td></tr>}
          {rows.map((c: any) => (
            <tr key={c.id} className="border-t">
              <td className="px-4 py-2">{c.partners?.full_name ?? "—"}</td>
              <td className="px-4 py-2">{c.clients?.full_name ?? "—"}</td>
              <td className="px-4 py-2">{c.products?.name ?? "—"}</td>
              <td className="px-4 py-2 text-right font-medium">{formatBRL(c.amount)}</td>
              <td className="px-4 py-2"><Badge variant="outline">{c.status}</Badge></td>
              <td className="px-4 py-2 text-right">
                {action && (
                  <Button size="sm" variant="outline" onClick={() => markPaid(c.id)}>
                    Marcar paga
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="page-shell space-y-6 animate-fade-up">
      <Block rows={pending} title="Pendentes" action />
      <Block rows={paid} title="Pagas" action={false} />
    </div>
  );
}

// -------------------- Cash flow --------------------
function CashFlow({ payments, commissions }: { payments: any[]; commissions: any[] }) {
  const data = useMemo(() => {
    const map: Record<string, { label: string; entrada: number; saida: number; saldo: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map[key] = { label: key.slice(5), entrada: 0, saida: 0, saldo: 0 };
    }
    payments.filter((p: any) => p.status === "pago").forEach((p: any) => {
      const key = (p.paid_at || "").slice(0, 10);
      if (map[key]) map[key].entrada += Number(p.amount_paid || p.amount || 0);
    });
    commissions.filter((c: any) => c.status === "pago").forEach((c: any) => {
      const key = (c.paid_at || "").slice(0, 10);
      if (map[key]) map[key].saida += Number(c.amount || 0);
    });
    let acc = 0;
    return Object.values(map).map(d => { acc += d.entrada - d.saida; return { ...d, saldo: acc }; });
  }, [payments, commissions]);

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="text-base font-semibold mb-4">Fluxo de caixa — últimos 30 dias</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: any) => formatBRL(v)} />
            <Legend />
            <Area type="monotone" dataKey="entrada" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.2)" name="Entradas" />
            <Area type="monotone" dataKey="saida" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive)/0.2)" name="Saídas" />
            <Area type="monotone" dataKey="saldo" stroke="hsl(var(--success, 142 71% 45%))" fill="transparent" name="Saldo acumulado" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// -------------------- Reports --------------------
function Reports({ payments, commissions }: { payments: any[]; commissions: any[] }) {
  const monthly = useMemo(() => {
    const map: Record<string, { label: string; receita: number; comissao: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = { label: key, receita: 0, comissao: 0 };
    }
    payments.filter((p: any) => p.status === "pago").forEach((p: any) => {
      const key = (p.paid_at || "").slice(0, 7);
      if (map[key]) map[key].receita += Number(p.amount_paid || p.amount || 0);
    });
    commissions.filter((c: any) => c.status === "pago").forEach((c: any) => {
      const key = (c.paid_at || "").slice(0, 7);
      if (map[key]) map[key].comissao += Number(c.amount || 0);
    });
    return Object.values(map);
  }, [payments, commissions]);

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-base font-semibold mb-4">Receita vs comissão (últimos 6 meses)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => formatBRL(v)} />
              <Legend />
              <Bar dataKey="receita" fill="hsl(var(--primary))" name="Receita" />
              <Bar dataKey="comissao" fill="hsl(var(--destructive))" name="Comissão" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <h3 className="text-base font-semibold">Resumo geral</h3>
        {monthly.map((m, i) => (
          <div key={i} className="flex justify-between text-sm border-b pb-2">
            <span>{m.label}</span>
            <span className="text-muted-foreground">Receita {formatBRL(m.receita)} · Comissão {formatBRL(m.comissao)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// -------------------- Per-client summary --------------------
function ByClient({ payments }: { payments: any[] }) {
  const [clientId, setClientId] = useState<string>("");

  const { data: clients = [] } = useQuery({
    queryKey: ["fin-clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, full_name, company").order("full_name")).data ?? [],
  });

  const { data: clientProducts = [] } = useQuery({
    queryKey: ["fin-client-products", clientId],
    enabled: !!clientId,
    queryFn: async () => (await supabase
      .from("client_products")
      .select("id, value, status, products(name), custom_product_name")
      .eq("client_id", clientId)).data ?? [],
  });

  const today = new Date().toISOString().slice(0, 10);
  const clientPayments = payments.filter((p: any) => p.client_id === clientId);

  const summary = useMemo(() => {
    const contracted = clientProducts.reduce((a: number, c: any) => a + Number(c.value || 0), 0);
    const paid = clientPayments.filter((p: any) => p.status === "pago").reduce((a: number, p: any) => a + Number(p.amount_paid || p.amount || 0), 0);
    const pending = clientPayments.filter((p: any) => ["em_aberto", "pendente", "parcial", "parcialmente_pago"].includes(p.status)).reduce((a: number, p: any) => a + Number(p.amount || 0) - Number(p.amount_paid || 0), 0);
    const overdue = clientPayments.filter((p: any) => ["vencido", "atrasado"].includes(p.status) || (["em_aberto", "pendente", "parcial", "parcialmente_pago"].includes(p.status) && p.due_date && p.due_date < today)).reduce((a: number, p: any) => a + Number(p.amount || 0) - Number(p.amount_paid || 0), 0);
    const productsPaid = clientProducts.filter((c: any) => c.status === "concluido" || c.status === "pago");
    const productsPending = clientProducts.filter((c: any) => c.status !== "concluido" && c.status !== "pago" && c.status !== "cancelado");
    return { contracted, paid, pending, overdue, productsPaid, productsPending };
  }, [clientProducts, clientPayments, today]);

  return (
    <div className="space-y-4">
      <Select value={clientId} onValueChange={setClientId}>
        <SelectTrigger className="w-[300px]"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
        <SelectContent>
          {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}{c.company ? ` — ${c.company}` : ""}</SelectItem>)}
        </SelectContent>
      </Select>

      {clientId && (
        <>
          <div className="grid md:grid-cols-4 gap-3">
            <Stat label="Total contratado" value={formatBRL(summary.contracted)} />
            <Stat label="Total pago" value={formatBRL(summary.paid)} tone="success" />
            <Stat label="Total pendente" value={formatBRL(summary.pending)} tone="warning" />
            <Stat label="Total vencido" value={formatBRL(summary.overdue)} tone="danger" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <h4 className="font-semibold mb-3">Produtos pagos ({summary.productsPaid.length})</h4>
              {summary.productsPaid.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum produto quitado.</p> : (
                <ul className="space-y-1 text-sm">
                  {summary.productsPaid.map((c: any) => (
                    <li key={c.id} className="flex justify-between border-b py-1">
                      <span>{c.products?.name ?? c.custom_product_name}</span>
                      <span className="text-muted-foreground">{formatBRL(c.value)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h4 className="font-semibold mb-3">Produtos pendentes ({summary.productsPending.length})</h4>
              {summary.productsPending.length === 0 ? <p className="text-xs text-muted-foreground">Sem pendências.</p> : (
                <ul className="space-y-1 text-sm">
                  {summary.productsPending.map((c: any) => (
                    <li key={c.id} className="flex justify-between border-b py-1">
                      <span>{c.products?.name ?? c.custom_product_name}</span>
                      <Badge variant="outline" className="text-xs">{c.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "warning" | "danger" }) {
  const toneCls = {
    default: "text-foreground",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-rose-600",
  }[tone];
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-bold mt-1", toneCls)}>{value}</div>
    </div>
  );
}
