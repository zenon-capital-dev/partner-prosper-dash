import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CircleDollarSign, Users, Clock, FileSignature, Target, Plus, ArrowUpRight,
  CalendarClock, AlertTriangle, FileText, ChevronRight, Sparkles, UserPlus,
  PiggyBank, Receipt, Wallet, ArrowRight, ClipboardList, CheckCircle2,
  TrendingUp, TrendingDown, Activity, Briefcase, Layers, Zap, MoreHorizontal,
  ArrowDownRight,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import { PageHero } from "@/components/PageHero";
import { useMemo, useState, useEffect, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend,
} from "recharts";

type Tone = "primary" | "success" | "warning" | "danger" | "info" | "violet";

const tones: Record<Tone, { text: string; soft: string; ring: string; chart: string; grad: string }> = {
  primary: { text: "text-indigo-700 dark:text-indigo-300", soft: "bg-indigo-50 dark:bg-indigo-500/10", ring: "ring-indigo-100 dark:ring-indigo-500/20", chart: "#4f46e5", grad: "from-indigo-500 to-indigo-600" },
  success: { text: "text-emerald-700 dark:text-emerald-300", soft: "bg-emerald-50 dark:bg-emerald-500/10", ring: "ring-emerald-100 dark:ring-emerald-500/20", chart: "#10b981", grad: "from-emerald-500 to-emerald-600" },
  warning: { text: "text-amber-700 dark:text-amber-300", soft: "bg-amber-50 dark:bg-amber-500/10", ring: "ring-amber-100 dark:ring-amber-500/20", chart: "#f59e0b", grad: "from-amber-500 to-amber-600" },
  danger:  { text: "text-rose-700 dark:text-rose-300", soft: "bg-rose-50 dark:bg-rose-500/10", ring: "ring-rose-100 dark:ring-rose-500/20", chart: "#f43f5e", grad: "from-rose-500 to-rose-600" },
  info:    { text: "text-sky-700 dark:text-sky-300", soft: "bg-sky-50 dark:bg-sky-500/10", ring: "ring-sky-100 dark:ring-sky-500/20", chart: "#0ea5e9", grad: "from-sky-500 to-sky-600" },
  violet:  { text: "text-violet-700 dark:text-violet-300", soft: "bg-violet-50 dark:bg-violet-500/10", ring: "ring-violet-100 dark:ring-violet-500/20", chart: "#8b5cf6", grad: "from-violet-500 to-violet-600" },
};

export default function DashboardAdmin() {
  const { user } = useAuth();
  const [rangeKey, setRangeKey] = useState<"HOJE" | "7D" | "30D" | "MÊS">("7D");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const brasiliaToday = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
    const [y, m, d] = fmt.format(new Date()).split("-").map(Number);
    return new Date(y, m - 1, d);
  }, []);

  const fullName = user?.user_metadata?.full_name || user?.email || "Admin";
  const firstName = String(fullName).split(/[ @]/)[0];
  const hour = parseInt(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date()), 10);
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  // ===== Queries =====
  const { data: clients = [] } = useQuery({ queryKey: ["dash-clients"], queryFn: async () => (await supabase.from("clients").select("*")).data ?? [] });
  const { data: clientProducts = [] } = useQuery({ queryKey: ["dash-demands"], queryFn: async () => (await supabase.from("client_products").select("*")).data ?? [] });
  const { data: sales = [] } = useQuery({ queryKey: ["dash-sales"], queryFn: async () => (await supabase.from("sales").select("*").order("sale_date", { ascending: false }).limit(200)).data ?? [] });
  const { data: leads = [] } = useQuery({ queryKey: ["dash-leads"], queryFn: async () => (await supabase.from("leads").select("*")).data ?? [] });
  const { data: commissions = [] } = useQuery({ queryKey: ["dash-commissions"], queryFn: async () => (await supabase.from("commissions").select("*")).data ?? [] });
  const { data: tasks = [] } = useQuery({ queryKey: ["dash-tasks"], queryFn: async () => (await supabase.from("tasks").select("*")).data ?? [] });
  const { data: contracts = [] } = useQuery({ queryKey: ["dash-contracts"], queryFn: async () => (await supabase.from("contracts").select("id, status, name, created_at")).data ?? [] });
  const { data: docRequests = [] } = useQuery({ queryKey: ["dash-doc-requests"], queryFn: async () => (await supabase.from("document_requests").select("id, status, created_at")).data ?? [] });
  const { data: payments = [] } = useQuery({ queryKey: ["dash-payments"], queryFn: async () => (await supabase.from("payments").select("id, status, amount, amount_paid, due_date")).data ?? [] });
  const { data: activityLogs = [] } = useQuery({
    queryKey: ["dash-activity"],
    queryFn: async () => (await supabase.from("activity_logs").select("*, profiles(full_name)").order("created_at", { ascending: false }).limit(8)).data ?? [],
  });

  const stats = useMemo(() => {
    const now = new Date();
    const toISO = (d: Date) => d.toISOString().slice(0, 10);
    let rangeStart = new Date(brasiliaToday);
    const rangeEnd = new Date(brasiliaToday);
    if (rangeKey === "7D") rangeStart.setDate(brasiliaToday.getDate() - 6);
    else if (rangeKey === "30D") rangeStart.setDate(brasiliaToday.getDate() - 29);
    else if (rangeKey === "MÊS") rangeStart = new Date(brasiliaToday.getFullYear(), brasiliaToday.getMonth(), 1);
    const startISO = toISO(rangeStart);
    const endISO = toISO(rangeEnd);

    const filteredSales = sales.filter((s: any) => s.sale_date && s.sale_date >= startISO && s.sale_date <= endISO);
    const rangeRevenue = filteredSales.reduce((a, s: any) => a + Number(s.amount || 0), 0);

    // Período anterior para comparativo
    const periodDays = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1);
    const prevStart = new Date(rangeStart); prevStart.setDate(prevStart.getDate() - periodDays);
    const prevEnd = new Date(rangeStart); prevEnd.setDate(prevEnd.getDate() - 1);
    const prevRevenue = sales
      .filter((s: any) => s.sale_date && s.sale_date >= toISO(prevStart) && s.sale_date <= toISO(prevEnd))
      .reduce((a, s: any) => a + Number(s.amount || 0), 0);
    const revenueDelta = prevRevenue > 0 ? ((rangeRevenue - prevRevenue) / prevRevenue) * 100 : (rangeRevenue > 0 ? 100 : 0);

    const activeClients = clients.filter((c: any) => c.status === "ativo").length;
    const newClientsRange = clients.filter((c: any) => c.created_at && c.created_at.slice(0,10) >= startISO).length;

    const delayedDemands = clientProducts.filter((p: any) =>
      p.status === "atrasado" ||
      (p.deadline && new Date(p.deadline) < now && !["concluido", "cancelado"].includes(p.status))
    ).length;
    const activeDemands = clientProducts.filter((p: any) => ["em_andamento", "aguardando_inicio"].includes(p.status)).length;
    const completedDemands = clientProducts.filter((p: any) => p.status === "concluido").length;

    const pipelineTotal = leads.reduce((a, l: any) => a + Number(l.estimated_value || 0), 0);
    const wonLeads = leads.filter((l: any) => l.status === "ganho" || l.status === "convertido").length;
    const lostLeads = leads.filter((l: any) => l.status === "perdido").length;
    const conversionRate = leads.length > 0 ? (wonLeads / leads.length) * 100 : 0;

    const openContracts = contracts.filter((c: any) => ["criado", "enviado", "aguardando_assinatura"].includes(c.status)).length;
    const waitingSignatureContracts = contracts.filter((c: any) => ["aguardando_assinatura", "enviado"].includes(c.status)).length;
    const signedContracts = contracts.filter((c: any) => c.status === "assinado").length;
    const pendingDocs = docRequests.filter((d: any) => ["solicitado", "pendente_correcao", "pendente", "enviado", "em_analise"].includes(d.status)).length;
    const overdueTasks = tasks.filter((t: any) =>
      t.status !== "concluida" && t.status !== "completed" && t.due_date && new Date(t.due_date) < now
    ).length;
    const todayTasks = tasks.filter((t: any) => {
      if (!t.due_date) return false;
      return new Date(t.due_date).toDateString() === now.toDateString();
    }).length;
    const openTasks = tasks.filter((t: any) => t.status !== "concluida" && t.status !== "completed").length;

    const commissionsToPay = commissions
      .filter((c: any) => ["pendente", "gerada", "em_analise", "aprovada", "pending"].includes(c.status))
      .reduce((a, c: any) => a + Number(c.amount || 0), 0);
    const commissionsCount = commissions.filter((c: any) => ["pendente", "gerada", "em_analise", "aprovada", "pending"].includes(c.status)).length;

    const in7d = new Date(brasiliaToday); in7d.setDate(brasiliaToday.getDate() + 7);
    const todayISO = toISO(brasiliaToday);
    const in7ISO = toISO(in7d);
    const receivable7d = payments
      .filter((p: any) => ["pendente", "em_aberto", "parcialmente_pago"].includes(p.status) && p.due_date && p.due_date >= todayISO && p.due_date <= in7ISO)
      .reduce((a, p: any) => a + (Number(p.amount || 0) - Number(p.amount_paid || 0)), 0);
    const receivable7dCount = payments.filter((p: any) => ["pendente", "em_aberto", "parcialmente_pago"].includes(p.status) && p.due_date && p.due_date >= todayISO && p.due_date <= in7ISO).length;
    const overdueAmount = payments
      .filter((p: any) => ["pendente", "em_aberto", "atrasado", "vencido", "parcialmente_pago"].includes(p.status) && p.due_date && p.due_date < todayISO)
      .reduce((a, p: any) => a + (Number(p.amount || 0) - Number(p.amount_paid || 0)), 0);
    const overdueCount = payments.filter((p: any) => ["pendente", "em_aberto", "atrasado", "vencido", "parcialmente_pago"].includes(p.status) && p.due_date && p.due_date < todayISO).length;
    const receivedTotal = payments
      .filter((p: any) => p.status === "pago")
      .reduce((a, p: any) => a + Number(p.amount_paid || 0), 0);

    // Last 6 months chart
    const chartData = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const name = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
      const value = sales.filter((s: any) => s.sale_date && s.sale_date.startsWith(d.toISOString().slice(0, 7))).reduce((a, s: any) => a + Number(s.amount || 0), 0);
      const count = sales.filter((s: any) => s.sale_date && s.sale_date.startsWith(d.toISOString().slice(0, 7))).length;
      return { name, value, count };
    });

    const demandsByStatus = [
      { name: "Em andamento", value: clientProducts.filter((p: any) => p.status === "em_andamento").length, color: "#6366f1" },
      { name: "Aguardando", value: clientProducts.filter((p: any) => p.status === "aguardando_inicio").length, color: "#f59e0b" },
      { name: "Concluídas", value: completedDemands, color: "#10b981" },
      { name: "Atrasadas", value: delayedDemands, color: "#f43f5e" },
    ].filter(d => d.value > 0);

    // Funil de leads
    const leadsByStage = [
      { name: "Novos", value: leads.filter((l: any) => l.status === "novo" || l.status === "new").length },
      { name: "Qualificados", value: leads.filter((l: any) => l.status === "qualificado").length },
      { name: "Proposta", value: leads.filter((l: any) => l.status === "proposta" || l.status === "negociacao").length },
      { name: "Ganhos", value: wonLeads },
    ];

    const recentSalesEnriched = filteredSales.slice(0, 6).map((s: any) => ({
      ...s,
      client: clients.find((c: any) => c.id === s.client_id)?.full_name || "Cliente",
    }));

    // Top clients by revenue
    const clientRevenue: Record<string, number> = {};
    sales.forEach((s: any) => {
      if (s.client_id) clientRevenue[s.client_id] = (clientRevenue[s.client_id] || 0) + Number(s.amount || 0);
    });
    const topClients = Object.entries(clientRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, total]) => ({
        id,
        name: clients.find((c: any) => c.id === id)?.full_name || "Cliente",
        total,
      }));

    const healthScore = (() => {
      const totalDemands = clientProducts.length || 1;
      const healthy = clientProducts.filter((p: any) => !["atrasado"].includes(p.status)).length;
      return Math.round((healthy / totalDemands) * 100);
    })();

    return {
      rangeRevenue, revenueDelta, prevRevenue,
      activeClients, totalClients: clients.length, newClientsRange,
      delayedDemands, activeDemands, completedDemands,
      pipelineTotal, leadsCount: leads.length, wonLeads, lostLeads, conversionRate,
      openContracts, waitingSignatureContracts, signedContracts,
      pendingDocs, overdueTasks, todayTasks, openTasks,
      commissionsToPay, commissionsCount,
      receivable7d, receivable7dCount, overdueAmount, overdueCount, receivedTotal,
      chartData, demandsByStatus, leadsByStage,
      recentSales: recentSalesEnriched, topClients, healthScore,
    };
  }, [clients, clientProducts, sales, leads, commissions, tasks, contracts, docRequests, payments, rangeKey, brasiliaToday]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-indigo-100 selection:text-indigo-900 admin-shell">
      <PageHero
        eyebrow="Dashboard"
        category="Visão Geral"
        title={`${greeting}, ${firstName}`}
        description="Acompanhe o pulso operacional e financeiro do seu negócio em tempo real."
        icon={<Sparkles className="size-6" />}
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center bg-card border border-border rounded-lg p-0.5 shadow-sm">
              {(["HOJE", "7D", "30D", "MÊS"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setRangeKey(k)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[11px] font-bold transition-all uppercase tracking-wider",
                    rangeKey === k
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <Link
              to="/vendas?new=1"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-indigo-600 text-white font-semibold text-[12.5px] shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <Plus className="size-4 stroke-[2.5]" />
              Nova Venda
            </Link>
          </div>
        }
        kpis={[
          { label: "Receita do período", value: formatBRL(stats.rangeRevenue), tone: "primary", icon: <CircleDollarSign className="size-4" />, hint: `${stats.revenueDelta >= 0 ? "▲" : "▼"} ${Math.abs(stats.revenueDelta).toFixed(1)}% vs período anterior` },
          { label: "Clientes ativos", value: stats.activeClients.toString(), tone: "success", icon: <Users className="size-4" />, hint: `${stats.newClientsRange} novos no período` },
          { label: "Pipeline aberto", value: formatBRL(stats.pipelineTotal), tone: "warning", icon: <Target className="size-4" />, hint: `${stats.leadsCount} leads · ${stats.conversionRate.toFixed(1)}% conversão` },
          { label: "Demandas atrasadas", value: stats.delayedDemands.toString(), tone: "danger", icon: <Clock className="size-4" />, hint: `${stats.activeDemands} em andamento` },
        ]}
      />

      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 py-6 space-y-6">

        {/* OPERACIONAL */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MiniStat label="Contratos abertos" value={stats.openContracts} hint={`${stats.waitingSignatureContracts} aguardando assinatura`} icon={FileSignature} to="/contratos" tone="primary" />
          <MiniStat label="Documentos pendentes" value={stats.pendingDocs} hint="Solicitações em aberto" icon={FileText} to="/documentos" tone="info" />
          <MiniStat label="Tarefas em atraso" value={stats.overdueTasks} hint={`${stats.todayTasks} previstas para hoje`} icon={ClipboardList} to="/tarefas" tone="danger" />
          <MiniStat label="Comissões a pagar" value={formatBRL(stats.commissionsToPay)} hint={`${stats.commissionsCount} lançamento(s)`} icon={Wallet} to="/comissoes" tone="warning" />
        </div>

        {/* CHART + STATUS PIE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Crescimento de receita"
              subtitle="Últimos 6 meses · valores consolidados"
              right={
                <div className="flex items-center gap-3 text-[11px] font-semibold">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full bg-indigo-600" /> Receita
                  </span>
                  <Link to="/financeiro" className="text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">
                    Ver detalhes <ArrowUpRight className="size-3" />
                  </Link>
                </div>
              }
            />
            <div className="h-[280px] w-full px-2">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.08} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 11, fontWeight: 600 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`} width={55} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 30px -10px rgb(0 0 0 / 0.15)', padding: '10px 12px', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', fontSize: '12px' }}
                      formatter={(v: any) => [formatBRL(Number(v)), "Receita"]}
                      cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '3 3' }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 4, fill: "hsl(var(--card))", stroke: "#6366f1", strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0, fill: "#6366f1" }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Status das demandas" subtitle="Distribuição operacional" />
            <div className="h-[200px] w-full flex items-center justify-center">
              {mounted && stats.demandsByStatus.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.demandsByStatus} innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                      {stats.demandsByStatus.map((e, i) => (<Cell key={i} fill={e.color} />))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-muted-foreground">Sem demandas no momento</p>
              )}
            </div>
            <div className="px-5 pb-5 space-y-2">
              {stats.demandsByStatus.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="font-medium text-muted-foreground">{s.name}</span>
                  </div>
                  <span className="font-bold text-foreground tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* FINANCEIRO + FUNIL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader title="Resumo financeiro" subtitle="Situação atual da tesouraria" right={<Link to="/financeiro" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">Central financeira <ArrowUpRight className="size-3" /></Link>} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-5 pt-0">
              <FinanceCell label="A receber (7 dias)" value={formatBRL(stats.receivable7d)} sub={`${stats.receivable7dCount} título(s)`} tone="success" icon={PiggyBank} to="/financeiro" />
              <FinanceCell label="Inadimplência" value={formatBRL(stats.overdueAmount)} sub={`${stats.overdueCount} vencido(s)`} tone="danger" icon={AlertTriangle} to="/financeiro" />
              <FinanceCell label="Comissões a liberar" value={formatBRL(stats.commissionsToPay)} sub={`${stats.commissionsCount} lançamento(s)`} tone="warning" icon={Receipt} to="/comissoes" />
            </div>
            <div className="border-t border-border px-5 py-4 flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground font-medium">Recebido total acumulado</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatBRL(stats.receivedTotal)}</span>
            </div>
          </Card>

          <Card>
            <CardHeader title="Funil de leads" subtitle={`${stats.conversionRate.toFixed(1)}% conversão`} />
            <div className="p-5 pt-2 space-y-3">
              {stats.leadsByStage.map((stage, i) => {
                const max = Math.max(...stats.leadsByStage.map(s => s.value), 1);
                const pct = (stage.value / max) * 100;
                const colors = ["bg-sky-500", "bg-indigo-500", "bg-violet-500", "bg-emerald-500"];
                return (
                  <div key={stage.name}>
                    <div className="flex items-center justify-between text-[12px] mb-1.5">
                      <span className="font-semibold text-foreground">{stage.name}</span>
                      <span className="font-bold tabular-nums text-muted-foreground">{stage.value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-700", colors[i])} style={{ width: `${Math.max(pct, 4)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-border px-5 py-3 flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <TrendingUp className="size-3" /> {stats.wonLeads} ganhos
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold">
                <TrendingDown className="size-3" /> {stats.lostLeads} perdidos
              </span>
            </div>
          </Card>
        </div>

        {/* VENDAS RECENTES + TOP CLIENTES + ATIVIDADES */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader title="Vendas recentes" subtitle="Últimas vendas no período selecionado" right={<Link to="/vendas" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">Ver todas <ArrowUpRight className="size-3" /></Link>} />
            <div className="divide-y divide-border">
              {stats.recentSales.length > 0 ? stats.recentSales.map((s: any, i: number) => (
                <Link to={`/vendas`} key={i} className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[13px] shadow-sm shrink-0">
                      {String(s.client || "C").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">{s.client}</p>
                      <p className="text-[11px] text-muted-foreground font-medium">{s.sale_date ? format(new Date(s.sale_date), "dd 'de' MMM, yyyy", { locale: ptBR }) : "—"}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-bold text-foreground tabular-nums">{formatBRL(s.amount)}</p>
                    <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Confirmado</p>
                  </div>
                </Link>
              )) : (
                <div className="py-12 text-center">
                  <p className="text-xs text-muted-foreground font-medium">Nenhuma venda no período selecionado</p>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Top clientes" subtitle="Por receita acumulada" />
            <div className="divide-y divide-border">
              {stats.topClients.length > 0 ? stats.topClients.map((c, i) => (
                <Link to={`/clientes/${c.id}`} key={c.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground tabular-nums w-4">#{i + 1}</span>
                    <span className="text-[12.5px] font-semibold text-foreground truncate">{c.name}</span>
                  </div>
                  <span className="text-[12px] font-bold tabular-nums text-indigo-600 dark:text-indigo-400 shrink-0">{formatBRL(c.total)}</span>
                </Link>
              )) : (
                <div className="py-10 text-center"><p className="text-xs text-muted-foreground">Sem dados de receita</p></div>
              )}
            </div>
          </Card>
        </div>

        {/* SAÚDE + ATIVIDADES + ATALHOS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader title="Saúde operacional" subtitle="Indicadores chave do dia" />
            <div className="p-5 pt-2 space-y-4">
              <div>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Health Score</span>
                  <span className="font-display text-3xl font-extrabold tabular-nums text-foreground">{stats.healthScore}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className={cn(
                    "h-full rounded-full transition-all duration-700",
                    stats.healthScore >= 80 ? "bg-emerald-500" : stats.healthScore >= 60 ? "bg-amber-500" : "bg-rose-500"
                  )} style={{ width: `${stats.healthScore}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <HealthCell icon={CheckCircle2} label="Concluídas" value={stats.completedDemands} tone="success" />
                <HealthCell icon={Activity} label="Ativas" value={stats.activeDemands} tone="primary" />
                <HealthCell icon={Clock} label="Atrasadas" value={stats.delayedDemands} tone="danger" />
                <HealthCell icon={ClipboardList} label="Tarefas" value={stats.openTasks} tone="warning" />
              </div>
            </div>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader title="Atividades recentes" subtitle="Eventos do sistema" right={<Link to="/auditoria" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">Log <ArrowUpRight className="size-3" /></Link>} />
            <div className="divide-y divide-border max-h-[280px] overflow-y-auto">
              {activityLogs.length > 0 ? activityLogs.map((a: any) => (
                <div key={a.id} className="px-5 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="size-7 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-foreground truncate">{a.action}</p>
                      <p className="text-[10.5px] text-muted-foreground font-medium truncate">
                        {a.profiles?.full_name || "Sistema"} · {a.entity_type}
                      </p>
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground tabular-nums shrink-0">
                      {format(new Date(a.created_at), "HH:mm")}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="py-10 text-center"><p className="text-xs text-muted-foreground">Nenhuma atividade recente</p></div>
              )}
            </div>
          </Card>

          <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 p-5 text-white shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-base font-bold tracking-tight">Atalhos rápidos</h3>
                <p className="text-[11px] font-medium text-indigo-200 mt-0.5">Crie em um clique</p>
              </div>
              <div className="size-9 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-sm">
                <Sparkles className="size-4" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 flex-1">
              <QuickAction label="Novo lead" to="/leads?new=1" icon={UserPlus} />
              <QuickAction label="Tarefa" to="/tarefas?new=1" icon={ClipboardList} />
              <QuickAction label="Contrato" to="/contratos?new=1" icon={FileSignature} />
              <QuickAction label="Documento" to="/documentos" icon={FileText} />
            </div>
            <Link to="/financeiro" className="mt-3 flex items-center justify-between p-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="size-7 rounded-md bg-white flex items-center justify-center">
                  <Wallet className="size-3.5 text-indigo-600" />
                </div>
                <span className="text-[12px] font-bold">Central Financeira</span>
              </div>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ COMPONENTS ============ */

function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn(
      "rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-colors",
      className
    )}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
      <div className="min-w-0">
        <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">{title}</h3>
        {subtitle && <p className="text-[11.5px] text-muted-foreground font-medium mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function MiniStat({ label, value, hint, icon: Icon, to, tone }: { label: string; value: string | number; hint: string; icon: any; to: string; tone: Tone }) {
  const t = tones[tone];
  return (
    <Link to={to} className="group block rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md hover:border-foreground/15 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className={cn("size-9 rounded-lg flex items-center justify-center ring-1", t.soft, t.text, t.ring)}>
          <Icon className="size-4 stroke-[2.2]" />
        </div>
        <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-[0.16em] mb-1.5">{label}</p>
      <p className="font-display text-[22px] font-extrabold text-foreground tracking-tight tabular-nums leading-none">{value}</p>
      <p className="text-[11px] font-medium text-muted-foreground mt-2 truncate">{hint}</p>
    </Link>
  );
}

function FinanceCell({ label, value, sub, tone, icon: Icon, to }: { label: string; value: string; sub: string; tone: Tone; icon: any; to: string }) {
  const t = tones[tone];
  return (
    <Link to={to} className="group block rounded-lg border border-border bg-card p-4 hover:border-foreground/15 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground mb-1.5">{label}</p>
          <p className="font-display text-[20px] font-extrabold tabular-nums text-foreground tracking-tight truncate">{value}</p>
          <p className="text-[11px] font-medium text-muted-foreground mt-1.5">{sub}</p>
        </div>
        <div className={cn("size-9 rounded-lg flex items-center justify-center ring-1 shrink-0", t.soft, t.text, t.ring)}>
          <Icon className="size-4 stroke-[2.2]" />
        </div>
      </div>
      <div className={cn("mt-3 h-0.5 rounded-full bg-gradient-to-r opacity-70 group-hover:opacity-100 transition-opacity", t.grad)} />
    </Link>
  );
}

function HealthCell({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: Tone }) {
  const t = tones[tone];
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn("size-6 rounded-md flex items-center justify-center", t.soft, t.text)}>
          <Icon className="size-3.5 stroke-[2.2]" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{label}</span>
      </div>
      <p className="font-display text-lg font-extrabold tabular-nums text-foreground leading-none">{value}</p>
    </div>
  );
}

function QuickAction({ label, to, icon: Icon }: { label: string; to: string; icon: any }) {
  return (
    <Link to={to} className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition-all text-center">
      <Icon className="size-4" />
      <span className="text-[10.5px] font-bold">{label}</span>
    </Link>
  );
}
