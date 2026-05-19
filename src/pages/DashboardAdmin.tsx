import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CircleDollarSign, Users, Clock, FileSignature, Target, Plus, ArrowUpRight,
  FileText, ChevronRight, UserPlus,
  Receipt, Wallet, ClipboardList, CheckCircle2,
  TrendingUp, TrendingDown, Activity, Zap, Sparkles,
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
  const [rangeKey, setRangeKey] = useState<"HOJE" | "7D" | "30D" | "MÊS">("30D");
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
    const avgTicket = filteredSales.length > 0 ? rangeRevenue / filteredSales.length : 0;

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

    const len = rangeKey === "HOJE" ? 14 : rangeKey === "7D" ? 14 : 30;
    const chartData = Array.from({ length: len }).map((_, i) => {
      const d = new Date(brasiliaToday); d.setDate(brasiliaToday.getDate() - (len - 1 - i));
      const iso = toISO(d);
      const value = sales.filter((s: any) => s.sale_date === iso).reduce((a, s: any) => a + Number(s.amount || 0), 0);
      return { name: format(d, "dd/MM"), value };
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

    const recentSalesEnriched = filteredSales.slice(0, 7).map((s: any) => ({
      ...s,
      client: clients.find((c: any) => c.id === s.client_id)?.full_name || "Cliente",
    }));

    const clientRevenue: Record<string, number> = {};
    sales.forEach((s: any) => { if (s.client_id) clientRevenue[s.client_id] = (clientRevenue[s.client_id] || 0) + Number(s.amount || 0); });
    const topClients = Object.entries(clientRevenue).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, total]) => ({
      id, name: clients.find((c: any) => c.id === id)?.full_name || "Cliente", total,
    }));
    const maxTopClient = topClients[0]?.total || 1;

    const totalDemands = clientProducts.length || 1;
    const healthy = clientProducts.filter((p: any) => p.status !== "atrasado").length;
    const healthScore = Math.round((healthy / totalDemands) * 100);

    return {
      rangeRevenue, revenueDelta, prevRevenue, avgTicket,
      activeClients, totalClients: clients.length, newClientsRange,
      delayedDemands, activeDemands, completedDemands,
      pipelineTotal, leadsCount: leads.length, wonLeads, lostLeads, conversionRate,
      openContracts, waitingSignatureContracts, pendingDocs, overdueTasks, todayTasks, openTasks,
      commissionsToPay, commissionsCount,
      receivable7d, receivable7dCount, overdueAmount, overdueCount, receivedTotal,
      chartData, demandsByStatus, leadsByStage,
      recentSales: recentSalesEnriched, topClients, maxTopClient, healthScore,
      salesCount: filteredSales.length,
    };
  }, [clients, clientProducts, sales, leads, commissions, tasks, contracts, docRequests, payments, rangeKey, brasiliaToday]);

  return (
    <div className="min-h-screen bg-background text-foreground admin-shell overflow-x-hidden">
      <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 sm:pt-10 pb-14 space-y-6 sm:space-y-8">

        {/* ============ HEADER ============ */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="min-w-0 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-700">Painel ativo</span>
              <span className="text-slate-300">·</span>
              <span className="text-[10px] text-slate-500 capitalize font-semibold truncate max-w-[150px] sm:max-w-none">{todayLabel}</span>
            </div>
            <h1 className="font-display text-[32px] sm:text-[36px] lg:text-[44px] font-bold tracking-[-0.025em] text-slate-900 leading-[1.1]">
              {greeting}, <span className="text-indigo-600">{firstName}</span>.
            </h1>
            <p className="text-[13.5px] sm:text-[14px] text-slate-600 leading-relaxed max-w-xl">
              Visão consolidada de receita, operação e pipeline. Tudo o que importa, em um único lugar.
            </p>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0 scrollbar-none">
            <div className="inline-flex items-center bg-white border border-slate-200/80 rounded-xl p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)] shrink-0">
              {(["HOJE", "7D", "30D", "MÊS"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setRangeKey(k)}
                  className={cn(
                    "px-3 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-[11.5px] font-bold transition-all tracking-wide shrink-0",
                    rangeKey === k
                      ? "bg-slate-900 text-white shadow-[0_2px_8px_-2px_rgba(15,23,42,0.3)]"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <Link
              to="/vendas?new=1"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-indigo-600 text-white font-semibold text-[13px] shadow-[0_2px_4px_rgba(79,70,229,0.25),0_8px_24px_-6px_rgba(79,70,229,0.4)] hover:bg-indigo-700 hover:-translate-y-0.5 transition-all shrink-0"
            >
              <Plus className="size-4 stroke-[2.5]" />
              <span className="whitespace-nowrap">Nova venda</span>
            </Link>
          </div>
        </header>

        {/* ============ HERO BAND — Featured Revenue + 3 KPIs ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Featured Revenue Card with sparkline */}
          <div className="lg:col-span-6 relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(79,70,229,0.18)]">
            {/* subtle gradient wash */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_55%)] pointer-events-none" />
            <div className="relative p-7 lg:p-8 flex flex-col h-full">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="size-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-[0_4px_12px_-2px_rgba(79,70,229,0.45)]">
                      <CircleDollarSign className="size-4.5 text-white stroke-[2.2]" />
                    </div>
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-slate-500">Receita no período</p>
                      <p className="text-[11px] text-slate-400 font-medium">{stats.salesCount} venda(s) registrada(s)</p>
                    </div>
                  </div>
                </div>
                <DeltaBadge value={stats.revenueDelta} />
              </div>

              <div className="flex items-baseline gap-3 mb-1">
                <p className="font-display text-[44px] lg:text-[52px] font-bold tabular-nums leading-none tracking-[-0.03em] text-slate-900">
                  {formatBRL(stats.rangeRevenue)}
                </p>
              </div>
              <p className="text-[12px] text-slate-500 font-medium">
                vs. <span className="text-slate-700 font-semibold tabular-nums">{formatBRL(stats.prevRevenue)}</span> no período anterior
              </p>

              {/* mini sparkline */}
              <div className="mt-6 h-[110px] -mx-2">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Tooltip
                        contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 12px 32px -12px rgba(15,23,42,0.18)', padding: '8px 10px', backgroundColor: '#fff', fontSize: '11.5px' }}
                        formatter={(v: any) => [formatBRL(Number(v)), "Receita"]}
                        cursor={{ stroke: '#4f46e5', strokeWidth: 1, strokeDasharray: '3 3' }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2.5} fill="url(#heroGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: "#4f46e5" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* footer stats */}
              <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-100">
                <FooterStat label="Ticket médio" value={formatBRL(stats.avgTicket)} />
                <FooterStat label="A receber 7d" value={formatBRL(stats.receivable7d)} accent="emerald" />
                <FooterStat label="Inadimplência" value={formatBRL(stats.overdueAmount)} accent={stats.overdueAmount > 0 ? "rose" : undefined} />
              </div>
            </div>
          </div>

          {/* 3 stacked side KPIs */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SideKpi
              label="Clientes ativos"
              value={stats.activeClients.toString()}
              sub={`${stats.newClientsRange} novos · ${stats.totalClients} totais`}
              icon={Users}
              accent="emerald"
            />
            <SideKpi
              label="Pipeline aberto"
              value={formatBRL(stats.pipelineTotal)}
              sub={`${stats.leadsCount} leads · ${stats.conversionRate.toFixed(1)}% conv.`}
              icon={Target}
              accent="indigo"
              compact
            />
            <SideKpi
              label="Demandas atrasadas"
              value={stats.delayedDemands.toString()}
              sub={`${stats.activeDemands} em andamento`}
              icon={Clock}
              accent={stats.delayedDemands > 0 ? "rose" : "slate"}
            />
          </div>
        </section>

        {/* ============ OPERATIONAL ROW ============ */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MiniStat label="Contratos abertos" value={stats.openContracts} hint={`${stats.waitingSignatureContracts} aguardando assinatura`} icon={FileSignature} to="/contratos" />
          <MiniStat label="Documentos pendentes" value={stats.pendingDocs} hint="Solicitações em aberto" icon={FileText} to="/documentos" />
          <MiniStat label="Tarefas em atraso" value={stats.overdueTasks} hint={`${stats.todayTasks} previstas para hoje`} icon={ClipboardList} to="/tarefas" negative={stats.overdueTasks > 0} />
          <MiniStat label="Comissões a pagar" value={formatBRL(stats.commissionsToPay)} hint={`${stats.commissionsCount} lançamento(s)`} icon={Wallet} to="/comissoes" />
        </section>

        {/* ============ CHART + STATUS PIE ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Performance comercial"
              subtitle={`Receita diária · ${rangeKey === "HOJE" ? "hoje" : rangeKey === "7D" ? "últimos 14 dias" : "últimos 30 dias"}`}
              right={
                <Link to="/financeiro" className="text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">
                  Central financeira <ArrowUpRight className="size-3.5" />
                </Link>
              }
            />
            <div className="h-[320px] w-full px-3 pb-3">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dy={8} interval="preserveStartEnd" minTickGap={20} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`} width={60} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 12px 32px -12px rgba(15,23,42,0.18)', padding: '12px 14px', backgroundColor: '#fff', fontSize: '12px' }}
                      labelStyle={{ color: '#64748b', fontWeight: 600, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}
                      formatter={(v: any) => [formatBRL(Number(v)), "Receita"]}
                      cursor={{ stroke: '#4f46e5', strokeWidth: 1, strokeDasharray: '4 3' }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: "#4f46e5" }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Status das demandas" subtitle="Distribuição operacional" />
            <div className="px-6 pb-6">
              <div className="h-[200px] w-full flex items-center justify-center relative">
                {mounted && stats.demandsByStatus.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stats.demandsByStatus} innerRadius={62} outerRadius={88} paddingAngle={2.5} dataKey="value" stroke="none">
                          {stats.demandsByStatus.map((e, i) => (<Cell key={i} fill={e.color} />))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="font-display text-[28px] font-bold tabular-nums text-slate-900 leading-none">
                        {stats.demandsByStatus.reduce((a, x) => a + x.value, 0)}
                      </p>
                      <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-slate-500 mt-1">Total</p>
                    </div>
                  </>
                ) : (
                  <p className="text-[12px] text-slate-400 font-medium">Sem demandas registradas</p>
                )}
              </div>
              <div className="space-y-2.5 mt-4">
                {stats.demandsByStatus.length > 0 ? stats.demandsByStatus.map((s) => {
                  const total = stats.demandsByStatus.reduce((a, x) => a + x.value, 0);
                  const pct = total > 0 ? (s.value / total) * 100 : 0;
                  return (
                    <div key={s.name} className="flex items-center justify-between text-[12.5px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="font-semibold text-slate-700 truncate">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-slate-400 tabular-nums">{pct.toFixed(0)}%</span>
                        <span className="font-display font-bold text-slate-900 tabular-nums w-7 text-right">{s.value}</span>
                      </div>
                    </div>
                  );
                }) : null}
              </div>
            </div>
          </Card>
        </section>

        {/* ============ VENDAS RECENTES + FUNIL ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Vendas recentes"
              subtitle="Últimas transações registradas no período"
              right={<Link to="/vendas" className="text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">Ver todas <ArrowUpRight className="size-3.5" /></Link>}
            />
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {stats.recentSales.length > 0 ? stats.recentSales.map((s: any, i: number) => (
                <Link to="/vendas" key={i} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/70 transition-colors group">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="size-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 ring-1 ring-slate-200 flex items-center justify-center text-slate-700 font-bold text-[14px] shrink-0">
                      {String(s.client || "C").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-slate-900 truncate">{s.client}</p>
                      <p className="text-[11.5px] text-slate-500 font-medium">{s.sale_date ? format(new Date(s.sale_date), "dd 'de' MMM, yyyy", { locale: ptBR }) : "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="font-display text-[15px] font-bold text-slate-900 tabular-nums leading-none">{formatBRL(s.amount)}</p>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-1.5">● Confirmado</p>
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
            <CardHeader title="Funil de leads" subtitle={`${stats.conversionRate.toFixed(1)}% taxa de conversão`} />
            <div className="px-6 pb-4 space-y-3.5">
              {stats.leadsByStage.map((stage, i) => {
                const max = Math.max(...stats.leadsByStage.map(s => s.value), 1);
                const pct = (stage.value / max) * 100;
                const opacity = 0.45 + (i * 0.18);
                return (
                  <div key={stage.name}>
                    <div className="flex items-center justify-between text-[12.5px] mb-1.5">
                      <span className="font-semibold text-slate-700">{stage.name}</span>
                      <span className="font-display font-bold tabular-nums text-slate-900">{stage.value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all duration-700"
                        style={{ width: `${Math.max(pct, 4)}%`, opacity }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-slate-100 px-6 py-3.5 flex items-center justify-between text-[11.5px] bg-slate-50/40">
              <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold">
                <TrendingUp className="size-3.5" /> {stats.wonLeads} ganhos
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-600 font-bold">
                <TrendingDown className="size-3.5" /> {stats.lostLeads} perdidos
              </span>
            </div>
          </Card>
        </section>

        {/* ============ TOP CLIENTES + ATIVIDADES + ATALHOS ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader title="Top clientes" subtitle="Maior receita acumulada" />
            <div className="px-6 pb-5 pt-1 space-y-3">
              {stats.topClients.length > 0 ? stats.topClients.map((c, i) => {
                const pct = (c.total / stats.maxTopClient) * 100;
                const medal = ["bg-amber-500", "bg-slate-400", "bg-amber-700/70", "bg-slate-300", "bg-slate-300"];
                return (
                  <Link to={`/clientes/${c.id}`} key={c.id} className="block group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={cn("size-5 rounded-md text-white text-[10px] font-bold tabular-nums flex items-center justify-center shrink-0", medal[i])}>
                          {i + 1}
                        </span>
                        <span className="text-[12.5px] font-semibold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">{c.name}</span>
                      </div>
                      <span className="font-display text-[12px] font-bold tabular-nums text-slate-900 shrink-0">{formatBRL(c.total)}</span>
                    </div>
                    <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                );
              }) : (
                <EmptyRow message="Sem dados de receita" />
              )}
            </div>
            {/* Health score footer */}
            <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/40">
              <div className="flex items-end justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Health operacional</span>
                <span className="font-display text-[20px] font-bold tabular-nums text-slate-900 leading-none">
                  {stats.healthScore}<span className="text-[12px] text-slate-400 font-semibold ml-0.5">%</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200/70 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    stats.healthScore >= 80 ? "bg-emerald-500" : stats.healthScore >= 60 ? "bg-amber-500" : "bg-rose-500"
                  )}
                  style={{ width: `${stats.healthScore}%` }}
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Atividades recentes" subtitle="Eventos do sistema" right={<Link to="/auditoria" className="text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">Log <ArrowUpRight className="size-3.5" /></Link>} />
            <div className="divide-y divide-slate-100 border-t border-slate-100 max-h-[340px] overflow-y-auto">
              {activityLogs.length > 0 ? activityLogs.map((a: any) => (
                <div key={a.id} className="px-6 py-3">
                  <div className="flex items-start gap-3">
                    <div className="size-7 rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="size-3.5 stroke-[2.2]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-semibold text-slate-800 truncate">{a.action}</p>
                      <p className="text-[11px] text-slate-500 font-medium truncate">
                        {a.profiles?.full_name || "Sistema"} · {a.entity_type}
                      </p>
                    </div>
                    <span className="text-[10.5px] font-semibold text-slate-400 tabular-nums shrink-0">
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
            <CardHeader title="Atalhos rápidos" subtitle="Crie em um clique" right={<Sparkles className="size-3.5 text-indigo-500" />} />
            <div className="px-6 pb-6 grid grid-cols-2 gap-2.5">
              <Shortcut label="Novo lead" to="/leads?new=1" icon={UserPlus} />
              <Shortcut label="Tarefa" to="/tarefas?new=1" icon={ClipboardList} />
              <Shortcut label="Contrato" to="/contratos?new=1" icon={FileSignature} />
              <Shortcut label="Documento" to="/documentos" icon={FileText} />
              <Shortcut label="Cliente" to="/clientes?new=1" icon={Users} />
              <Shortcut label="Comissão" to="/comissoes" icon={Receipt} />
            </div>
            <div className="border-t border-slate-100 px-6 py-3.5 bg-gradient-to-r from-indigo-50/60 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Activity className="size-3.5 text-indigo-600 shrink-0" />
                <span className="text-[11.5px] font-semibold text-slate-700">{stats.openTasks} tarefa(s) ativa(s)</span>
              </div>
              <Link to="/tarefas" className="text-[11.5px] font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 shrink-0">
                Abrir <ArrowUpRight className="size-3" />
              </Link>
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
      "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_-8px_rgba(15,23,42,0.06)] overflow-hidden",
      className
    )}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4">
      <div className="min-w-0">
        <h3 className="font-display text-[15px] font-bold tracking-[-0.01em] text-slate-900">{title}</h3>
        {subtitle && <p className="text-[12px] text-slate-500 font-medium mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function DeltaBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <div className={cn(
      "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full font-bold tabular-nums text-[11.5px] ring-1",
      positive ? "bg-emerald-50 text-emerald-700 ring-emerald-200/60" : "bg-rose-50 text-rose-700 ring-rose-200/60"
    )}>
      {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {Math.abs(value).toFixed(1)}%
    </div>
  );
}

function FooterStat({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "rose" }) {
  const color = accent === "emerald" ? "text-emerald-600" : accent === "rose" ? "text-rose-600" : "text-slate-900";
  return (
    <div>
      <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={cn("font-display text-[15px] font-bold tabular-nums mt-1 leading-none", color)}>{value}</p>
    </div>
  );
}

function SideKpi({ label, value, sub, icon: Icon, accent, compact }: { label: string; value: string; sub: string; icon: any; accent: "indigo" | "emerald" | "rose" | "slate"; compact?: boolean }) {
  const accents: Record<string, { iconBg: string; iconColor: string; ring: string; dot: string }> = {
    indigo: { iconBg: "bg-indigo-50", iconColor: "text-indigo-600", ring: "ring-indigo-100", dot: "bg-indigo-500" },
    emerald: { iconBg: "bg-emerald-50", iconColor: "text-emerald-600", ring: "ring-emerald-100", dot: "bg-emerald-500" },
    rose: { iconBg: "bg-rose-50", iconColor: "text-rose-600", ring: "ring-rose-100", dot: "bg-rose-500" },
    slate: { iconBg: "bg-slate-100", iconColor: "text-slate-600", ring: "ring-slate-200", dot: "bg-slate-400" },
  };
  const a = accents[accent];
  return (
    <div className="group relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] hover:border-slate-300/80 transition-all flex flex-col">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full", a.dot)} />
          <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span>
        </span>
        <div className={cn("size-9 rounded-xl flex items-center justify-center ring-1 transition-transform group-hover:scale-105", a.iconBg, a.iconColor, a.ring)}>
          <Icon className="size-4 stroke-[2]" />
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center py-4">
        <p className={cn(
          "font-display font-bold tabular-nums leading-none tracking-[-0.025em] text-slate-900",
          compact ? "text-[28px]" : "text-[34px]"
        )}>
          {value}
        </p>
        <p className="text-[11.5px] text-slate-500 font-medium mt-2 truncate">{sub}</p>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Atualizado agora</span>
        <span className={cn("inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider", a.iconColor)}>
          <span className={cn("size-1.5 rounded-full animate-pulse", a.dot)} />
          ao vivo
        </span>
      </div>
    </div>
  );
}

function MiniStat({ label, value, hint, icon: Icon, to, negative }: { label: string; value: string | number; hint: string; icon: any; to: string; negative?: boolean }) {
  return (
    <Link to={to} className="group block rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300/80 hover:shadow-[0_4px_14px_-6px_rgba(15,23,42,0.1)] transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className={cn(
          "size-8 rounded-lg flex items-center justify-center ring-1",
          negative && Number(value) > 0 ? "bg-rose-50 text-rose-600 ring-rose-100" : "bg-slate-50 text-slate-600 ring-slate-100"
        )}>
          <Icon className="size-4 stroke-[2.2]" />
        </div>
        <ChevronRight className="size-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-[0.16em] mb-1.5">{label}</p>
      <p className={cn(
        "font-display text-[24px] font-bold tracking-[-0.025em] tabular-nums leading-none",
        negative && Number(value) > 0 ? "text-rose-600" : "text-slate-900"
      )}>{value}</p>
      <p className="text-[11.5px] font-medium text-slate-500 mt-2 truncate">{hint}</p>
    </Link>
  );
}

function Shortcut({ label, to, icon: Icon }: { label: string; to: string; icon: any }) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-start justify-between gap-2.5 p-3 rounded-xl border border-slate-200/70 bg-white hover:bg-indigo-50/40 hover:border-indigo-200 hover:shadow-[0_2px_8px_-2px_rgba(79,70,229,0.15)] transition-all min-h-[88px]"
    >
      <div className="size-8 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">
        <Icon className="size-4 stroke-[2.2]" />
      </div>
      <span className="text-[12px] font-semibold text-slate-700 group-hover:text-indigo-700 transition-colors">{label}</span>
    </Link>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-[12px] text-slate-400 font-medium">{message}</p>
    </div>
  );
}
