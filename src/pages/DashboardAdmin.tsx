import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CircleDollarSign, Users, Clock, FileSignature, Target, Plus, ArrowUpRight,
  AlertTriangle, FileText, ChevronRight, UserPlus,
  Receipt, Wallet, ClipboardList, CheckCircle2,
  TrendingUp, TrendingDown, Activity, Zap,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import { useMemo, useState, useEffect, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

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
  const todayLabel = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

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
    const pendingDocs = docRequests.filter((d: any) => ["solicitado", "pendente_correcao", "pendente", "enviado", "em_analise"].includes(d.status)).length;
    const overdueTasks = tasks.filter((t: any) => t.status !== "concluida" && t.status !== "completed" && t.due_date && new Date(t.due_date) < now).length;
    const todayTasks = tasks.filter((t: any) => t.due_date && new Date(t.due_date).toDateString() === now.toDateString()).length;
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
    const receivedTotal = payments.filter((p: any) => p.status === "pago").reduce((a, p: any) => a + Number(p.amount_paid || 0), 0);

    const chartData = Array.from({ length: rangeKey === "HOJE" ? 1 : rangeKey === "7D" ? 7 : 30 }).map((_, i) => {
      const len = rangeKey === "HOJE" ? 1 : rangeKey === "7D" ? 7 : 30;
      const d = new Date(brasiliaToday); d.setDate(brasiliaToday.getDate() - (len - 1 - i));
      const iso = toISO(d);
      const value = sales.filter((s: any) => s.sale_date === iso).reduce((a, s: any) => a + Number(s.amount || 0), 0);
      return { name: format(d, len > 14 ? "dd/MM" : "dd/MM", { locale: ptBR }), value };
    });

    const demandsByStatus = [
      { name: "Em andamento", value: clientProducts.filter((p: any) => p.status === "em_andamento").length, color: "#4f46e5" },
      { name: "Aguardando", value: clientProducts.filter((p: any) => p.status === "aguardando_inicio").length, color: "#f59e0b" },
      { name: "Concluídas", value: completedDemands, color: "#10b981" },
      { name: "Atrasadas", value: delayedDemands, color: "#f43f5e" },
    ].filter(d => d.value > 0);

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

    const clientRevenue: Record<string, number> = {};
    sales.forEach((s: any) => { if (s.client_id) clientRevenue[s.client_id] = (clientRevenue[s.client_id] || 0) + Number(s.amount || 0); });
    const topClients = Object.entries(clientRevenue).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, total]) => ({
      id, name: clients.find((c: any) => c.id === id)?.full_name || "Cliente", total,
    }));

    const totalDemands = clientProducts.length || 1;
    const healthy = clientProducts.filter((p: any) => p.status !== "atrasado").length;
    const healthScore = Math.round((healthy / totalDemands) * 100);

    return {
      rangeRevenue, revenueDelta, prevRevenue,
      activeClients, totalClients: clients.length, newClientsRange,
      delayedDemands, activeDemands, completedDemands,
      pipelineTotal, leadsCount: leads.length, wonLeads, lostLeads, conversionRate,
      openContracts, waitingSignatureContracts, pendingDocs, overdueTasks, todayTasks, openTasks,
      commissionsToPay, commissionsCount,
      receivable7d, receivable7dCount, overdueAmount, overdueCount, receivedTotal,
      chartData, demandsByStatus, leadsByStage,
      recentSales: recentSalesEnriched, topClients, healthScore,
    };
  }, [clients, clientProducts, sales, leads, commissions, tasks, contracts, docRequests, payments, rangeKey, brasiliaToday]);

  return (
    <div className="min-h-screen bg-background text-foreground admin-shell">
      <div className="max-w-[1500px] mx-auto px-5 lg:px-8 pt-8 pb-10 space-y-6">

        {/* ============ HEADER ============ */}
        <header className="flex flex-wrap items-end justify-between gap-4 pb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.22em] text-slate-500">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Painel operacional
              <span className="text-slate-300">·</span>
              <span className="capitalize text-slate-600">{todayLabel}</span>
            </div>
            <h1 className="mt-2 font-display text-[28px] lg:text-[32px] font-bold tracking-[-0.02em] text-slate-900 leading-tight">
              {greeting}, {firstName}.
            </h1>
            <p className="text-[13.5px] text-slate-600 mt-1.5 leading-relaxed">
              Visão consolidada de receita, operação e pipeline em tempo real.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              {(["HOJE", "7D", "30D", "MÊS"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setRangeKey(k)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[11.5px] font-semibold transition-all tracking-wide",
                    rangeKey === k
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <Link
              to="/vendas?new=1"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-indigo-600 text-white font-semibold text-[12.5px] shadow-[0_1px_2px_rgba(79,70,229,0.3),0_4px_12px_-2px_rgba(79,70,229,0.25)] hover:bg-indigo-700 transition-colors"
            >
              <Plus className="size-3.5 stroke-[2.5]" />
              Nova venda
            </Link>
          </div>
        </header>

        {/* ============ KPI HERO ============ */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <HeroKpi
            label="Receita no período"
            value={formatBRL(stats.rangeRevenue)}
            delta={stats.revenueDelta}
            icon={CircleDollarSign}
            sub={`${stats.recentSales.length} venda(s) · período anterior ${formatBRL(stats.prevRevenue)}`}
          />
          <HeroKpi
            label="Clientes ativos"
            value={stats.activeClients}
            sub={`${stats.newClientsRange} novo(s) no período · ${stats.totalClients} totais`}
            icon={Users}
          />
          <HeroKpi
            label="Pipeline aberto"
            value={formatBRL(stats.pipelineTotal)}
            sub={`${stats.leadsCount} leads · ${stats.conversionRate.toFixed(1)}% conversão`}
            icon={Target}
          />
          <HeroKpi
            label="Demandas atrasadas"
            value={stats.delayedDemands}
            sub={`${stats.activeDemands} em andamento · ${stats.openTasks} tarefas abertas`}
            icon={Clock}
            negative={stats.delayedDemands > 0}
          />
        </section>

        {/* ============ OPERACIONAL ROW ============ */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniStat label="Contratos abertos" value={stats.openContracts} hint={`${stats.waitingSignatureContracts} aguardando assinatura`} icon={FileSignature} to="/contratos" />
          <MiniStat label="Documentos pendentes" value={stats.pendingDocs} hint="Solicitações em aberto" icon={FileText} to="/documentos" />
          <MiniStat label="Tarefas em atraso" value={stats.overdueTasks} hint={`${stats.todayTasks} previstas para hoje`} icon={ClipboardList} to="/tarefas" negative={stats.overdueTasks > 0} />
          <MiniStat label="Comissões a pagar" value={formatBRL(stats.commissionsToPay)} hint={`${stats.commissionsCount} lançamento(s)`} icon={Wallet} to="/comissoes" />
        </section>

        {/* ============ CHART + STATUS PIE ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Fluxo de receita"
              subtitle={`Diário · ${rangeKey === "HOJE" ? "hoje" : rangeKey === "7D" ? "últimos 7 dias" : rangeKey === "30D" ? "últimos 30 dias" : "este mês"}`}
              right={
                <div className="flex items-center gap-4 text-[11px]">
                  <div className="flex flex-col items-end">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Total</span>
                    <span className="font-display text-[15px] font-bold tabular-nums text-slate-900">{formatBRL(stats.rangeRevenue)}</span>
                  </div>
                  <Link to="/financeiro" className="text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 font-semibold">
                    Detalhes <ArrowUpRight className="size-3" />
                  </Link>
                </div>
              }
            />
            <div className="h-[260px] w-full px-2 pb-2">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10.5, fontWeight: 600 }} dy={8} interval="preserveStartEnd" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10.5 }} tickFormatter={(v) => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`} width={55} />
                    <Tooltip
                      contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 12px 32px -12px rgba(15,23,42,0.18)', padding: '10px 12px', backgroundColor: '#fff', fontSize: '12px' }}
                      labelStyle={{ color: '#64748b', fontWeight: 600, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}
                      formatter={(v: any) => [formatBRL(Number(v)), "Receita"]}
                      cursor={{ stroke: '#4f46e5', strokeWidth: 1, strokeDasharray: '4 3' }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2.25} fill="url(#revGrad)" dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: "#4f46e5" }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Status das demandas" subtitle="Distribuição operacional" />
            <div className="px-5 pb-5">
              <div className="h-[180px] w-full flex items-center justify-center">
                {mounted && stats.demandsByStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.demandsByStatus} innerRadius={52} outerRadius={75} paddingAngle={2} dataKey="value" stroke="none">
                        {stats.demandsByStatus.map((e, i) => (<Cell key={i} fill={e.color} />))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-[11.5px] text-slate-400">Sem demandas registradas</p>
                )}
              </div>
              <div className="space-y-2 mt-2">
                {stats.demandsByStatus.length > 0 ? stats.demandsByStatus.map((s) => {
                  const total = stats.demandsByStatus.reduce((a, x) => a + x.value, 0);
                  const pct = total > 0 ? (s.value / total) * 100 : 0;
                  return (
                    <div key={s.name} className="flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="font-medium text-slate-600 truncate">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-[10.5px] text-slate-400 tabular-nums">{pct.toFixed(0)}%</span>
                        <span className="font-bold text-slate-900 tabular-nums w-6 text-right">{s.value}</span>
                      </div>
                    </div>
                  );
                }) : null}
              </div>
            </div>
          </Card>
        </section>

        {/* ============ FINANCEIRO + FUNIL ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Resumo financeiro"
              subtitle="Situação atual da tesouraria"
              right={<Link to="/financeiro" className="text-[11.5px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">Central financeira <ArrowUpRight className="size-3" /></Link>}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 border-t border-slate-100">
              <FinanceCell label="A receber (7 dias)" value={formatBRL(stats.receivable7d)} sub={`${stats.receivable7dCount} título(s)`} tone="positive" />
              <FinanceCell label="Inadimplência" value={formatBRL(stats.overdueAmount)} sub={`${stats.overdueCount} vencido(s)`} tone="negative" />
              <FinanceCell label="Comissões a liberar" value={formatBRL(stats.commissionsToPay)} sub={`${stats.commissionsCount} lançamento(s)`} tone="warning" />
            </div>
            <div className="border-t border-slate-100 px-5 py-3.5 flex items-center justify-between text-[12px] bg-slate-50/50">
              <span className="text-slate-500 font-medium inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                Recebido total acumulado
              </span>
              <span className="font-display font-bold text-emerald-600 tabular-nums">{formatBRL(stats.receivedTotal)}</span>
            </div>
          </Card>

          <Card>
            <CardHeader title="Funil de leads" subtitle={`${stats.conversionRate.toFixed(1)}% taxa de conversão`} />
            <div className="px-5 pb-4 space-y-3">
              {stats.leadsByStage.map((stage, i) => {
                const max = Math.max(...stats.leadsByStage.map(s => s.value), 1);
                const pct = (stage.value / max) * 100;
                return (
                  <div key={stage.name}>
                    <div className="flex items-center justify-between text-[12px] mb-1.5">
                      <span className="font-semibold text-slate-700">{stage.name}</span>
                      <span className="font-bold tabular-nums text-slate-900">{stage.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all duration-700"
                        style={{ width: `${Math.max(pct, 4)}%`, opacity: 0.4 + (i * 0.2) }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between text-[11px] bg-slate-50/50">
              <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold">
                <TrendingUp className="size-3" /> {stats.wonLeads} ganhos
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-600 font-semibold">
                <TrendingDown className="size-3" /> {stats.lostLeads} perdidos
              </span>
            </div>
          </Card>
        </section>

        {/* ============ VENDAS + TOP CLIENTES ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Vendas recentes"
              subtitle="Últimas transações no período"
              right={<Link to="/vendas" className="text-[11.5px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">Ver todas <ArrowUpRight className="size-3" /></Link>}
            />
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {stats.recentSales.length > 0 ? stats.recentSales.map((s: any, i: number) => (
                <Link to="/vendas" key={i} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/70 transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-lg bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center text-slate-700 font-bold text-[12.5px] shrink-0">
                      {String(s.client || "C").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900 truncate">{s.client}</p>
                      <p className="text-[11px] text-slate-500 font-medium">{s.sale_date ? format(new Date(s.sale_date), "dd 'de' MMM, yyyy", { locale: ptBR }) : "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-[13px] font-bold text-slate-900 tabular-nums font-display">{formatBRL(s.amount)}</p>
                      <p className="text-[9.5px] font-bold text-emerald-600 uppercase tracking-wider">Confirmado</p>
                    </div>
                    <ChevronRight className="size-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              )) : (
                <EmptyRow message="Nenhuma venda no período selecionado" />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Top clientes" subtitle="Por receita acumulada" />
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {stats.topClients.length > 0 ? stats.topClients.map((c, i) => (
                <Link to={`/clientes/${c.id}`} key={c.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="size-5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold tabular-nums flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-[12.5px] font-semibold text-slate-800 truncate">{c.name}</span>
                  </div>
                  <span className="text-[12px] font-bold tabular-nums text-slate-900 shrink-0 font-display">{formatBRL(c.total)}</span>
                </Link>
              )) : (
                <EmptyRow message="Sem dados de receita" />
              )}
            </div>
          </Card>
        </section>

        {/* ============ SAÚDE + ATIVIDADES + ATALHOS ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader title="Saúde operacional" subtitle="Indicadores do dia" />
            <div className="px-5 pb-5 space-y-4">
              <div>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Health score</span>
                  <span className="font-display text-[28px] font-bold tabular-nums text-slate-900 leading-none">
                    {stats.healthScore}<span className="text-[14px] text-slate-400 font-semibold ml-0.5">%</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      stats.healthScore >= 80 ? "bg-emerald-500" : stats.healthScore >= 60 ? "bg-amber-500" : "bg-rose-500"
                    )}
                    style={{ width: `${stats.healthScore}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <HealthCell icon={CheckCircle2} label="Concluídas" value={stats.completedDemands} />
                <HealthCell icon={Activity} label="Ativas" value={stats.activeDemands} />
                <HealthCell icon={Clock} label="Atrasadas" value={stats.delayedDemands} negative={stats.delayedDemands > 0} />
                <HealthCell icon={ClipboardList} label="Tarefas" value={stats.openTasks} />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Atividades recentes" subtitle="Eventos do sistema" right={<Link to="/auditoria" className="text-[11.5px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">Log <ArrowUpRight className="size-3" /></Link>} />
            <div className="divide-y divide-slate-100 border-t border-slate-100 max-h-[260px] overflow-y-auto">
              {activityLogs.length > 0 ? activityLogs.map((a: any) => (
                <div key={a.id} className="px-5 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="size-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="size-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-slate-800 truncate">{a.action}</p>
                      <p className="text-[10.5px] text-slate-500 font-medium truncate">
                        {a.profiles?.full_name || "Sistema"} · {a.entity_type}
                      </p>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 tabular-nums shrink-0">
                      {format(new Date(a.created_at), "HH:mm")}
                    </span>
                  </div>
                </div>
              )) : (
                <EmptyRow message="Nenhuma atividade recente" />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Atalhos rápidos" subtitle="Crie em um clique" />
            <div className="px-5 pb-5 grid grid-cols-2 gap-2">
              <Shortcut label="Novo lead" to="/leads?new=1" icon={UserPlus} />
              <Shortcut label="Tarefa" to="/tarefas?new=1" icon={ClipboardList} />
              <Shortcut label="Contrato" to="/contratos?new=1" icon={FileSignature} />
              <Shortcut label="Documento" to="/documentos" icon={FileText} />
              <Shortcut label="Cliente" to="/clientes?new=1" icon={Users} />
              <Shortcut label="Comissão" to="/comissoes" icon={Receipt} />
            </div>
          </Card>
        </section>

      </div>
    </div>
  );
}

/* ============ COMPONENTS ============ */

function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn(
      "rounded-xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden",
      className
    )}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div className="min-w-0">
        <h3 className="font-display text-[14px] font-bold tracking-tight text-slate-900">{title}</h3>
        {subtitle && <p className="text-[11.5px] text-slate-500 font-medium mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function HeroKpi({ label, value, sub, icon: Icon, delta, negative }: { label: string; value: string | number; sub?: string; icon: any; delta?: number; negative?: boolean }) {
  return (
    <div className="group relative rounded-xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] hover:border-slate-300/80 transition-all">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 truncate">{label}</p>
        <div className={cn(
          "size-8 rounded-lg flex items-center justify-center ring-1 transition-transform group-hover:scale-105",
          negative ? "bg-rose-50 text-rose-600 ring-rose-100" : "bg-slate-50 text-slate-700 ring-slate-100"
        )}>
          <Icon className="size-4 stroke-[2]" />
        </div>
      </div>
      <p className={cn(
        "font-display text-[26px] font-bold tabular-nums leading-none tracking-[-0.02em]",
        negative && Number(value) > 0 ? "text-rose-600" : "text-slate-900"
      )}>
        {value}
      </p>
      <div className="flex items-center gap-2 mt-3 text-[11px] min-h-[14px]">
        {typeof delta === "number" && (
          <span className={cn(
            "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-bold tabular-nums text-[10.5px]",
            delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          )}>
            {delta >= 0 ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-slate-500 font-medium truncate">{sub}</span>}
      </div>
    </div>
  );
}

function MiniStat({ label, value, hint, icon: Icon, to, negative }: { label: string; value: string | number; hint: string; icon: any; to: string; negative?: boolean }) {
  return (
    <Link to={to} className="group block rounded-xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300/80 hover:shadow-[0_4px_14px_-6px_rgba(15,23,42,0.1)] transition-all">
      <div className="flex items-center justify-between mb-2.5">
        <div className={cn(
          "size-7 rounded-md flex items-center justify-center",
          negative && Number(value) > 0 ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-600"
        )}>
          <Icon className="size-3.5 stroke-[2.2]" />
        </div>
        <ChevronRight className="size-3.5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.16em] mb-1">{label}</p>
      <p className={cn(
        "font-display text-[20px] font-bold tracking-[-0.02em] tabular-nums leading-none",
        negative && Number(value) > 0 ? "text-rose-600" : "text-slate-900"
      )}>{value}</p>
      <p className="text-[11px] font-medium text-slate-500 mt-1.5 truncate">{hint}</p>
    </Link>
  );
}

function FinanceCell({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "positive" | "negative" | "warning" }) {
  const toneClass = tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : "text-amber-600";
  const dot = tone === "positive" ? "bg-emerald-500" : tone === "negative" ? "bg-rose-500" : "bg-amber-500";
  return (
    <div className="p-5">
      <div className="flex items-center gap-1.5 mb-2">
        <span className={cn("size-1.5 rounded-full", dot)} />
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      </div>
      <p className={cn("font-display text-[22px] font-bold tabular-nums tracking-[-0.02em] truncate leading-none", toneClass)}>{value}</p>
      <p className="text-[11px] font-medium text-slate-500 mt-1.5">{sub}</p>
    </div>
  );
}

function HealthCell({ icon: Icon, label, value, negative }: { icon: any; label: string; value: number; negative?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200/70 bg-slate-50/50 p-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={cn("size-3 stroke-[2.4]", negative && value > 0 ? "text-rose-500" : "text-slate-500")} />
        <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 truncate">{label}</span>
      </div>
      <p className={cn(
        "font-display text-[16px] font-bold tabular-nums leading-none",
        negative && value > 0 ? "text-rose-600" : "text-slate-900"
      )}>{value}</p>
    </div>
  );
}

function Shortcut({ label, to, icon: Icon }: { label: string; to: string; icon: any }) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-start justify-between gap-2 p-3 rounded-lg border border-slate-200/70 bg-slate-50/40 hover:bg-white hover:border-indigo-200 hover:shadow-[0_2px_8px_-2px_rgba(79,70,229,0.15)] transition-all"
    >
      <div className="size-7 rounded-md bg-white border border-slate-200 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">
        <Icon className="size-3.5 stroke-[2.2]" />
      </div>
      <span className="text-[11.5px] font-semibold text-slate-700 group-hover:text-slate-900">{label}</span>
    </Link>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-[11.5px] text-slate-400 font-medium">{message}</p>
    </div>
  );
}
