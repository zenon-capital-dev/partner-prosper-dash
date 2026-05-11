import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, TrendingDown, CircleDollarSign, Users, Activity, Wallet, Clock,
  CheckCircle2, FileWarning, CreditCard, FileSignature, Target, Handshake, Briefcase,
  BarChart3, Plus, Bell, ArrowUpRight, ArrowRight, AlertCircle, Phone, MapPin, CalendarClock,
  ExternalLink, Calendar, FileText, Search,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";

/* ============================================================
   Premium Executive Cockpit
   ============================================================ */

type Tone = "primary" | "success" | "warning" | "danger" | "info" | "neutral";

const toneStyles: Record<Tone, { bg: string; border: string; icon: string; text: string; dot: string }> = {
  primary: { bg: "bg-indigo-500/5", border: "border-indigo-500/20", icon: "text-indigo-400", text: "text-indigo-200", dot: "bg-indigo-400" },
  success: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", icon: "text-emerald-400", text: "text-emerald-200", dot: "bg-emerald-400" },
  warning: { bg: "bg-amber-500/5", border: "border-amber-500/20", icon: "text-amber-400", text: "text-amber-200", dot: "bg-amber-400" },
  danger:  { bg: "bg-rose-500/5", border: "border-rose-500/20", icon: "text-rose-400", text: "text-rose-200", dot: "bg-rose-400" },
  info:    { bg: "bg-sky-500/5", border: "border-sky-500/20", icon: "text-sky-400", text: "text-sky-200", dot: "bg-sky-400" },
  neutral: { bg: "bg-zinc-500/5", border: "border-zinc-500/20", icon: "text-zinc-400", text: "text-zinc-200", dot: "bg-zinc-400" },
};

export default function DashboardAdmin() {
  const { user } = useAuth();
  const fullName = user?.user_metadata?.full_name || user?.email || "Admin";
  const firstName = String(fullName).split(/[ @]/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long"
  });

  // ===== Queries =====
  const { data: clients = [] } = useQuery({
    queryKey: ["dash-clients"],
    queryFn: async () => (await supabase.from("clients").select("id, status, source, origin, created_at, health_score")).data ?? [],
  });
  const { data: clientProducts = [] } = useQuery({
    queryKey: ["dash-demands"],
    queryFn: async () => (await supabase.from("client_products").select("id, status, deadline, service_provider_id, product_id, value, created_at")).data ?? [],
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["dash-sales"],
    queryFn: async () => (await supabase.from("sales").select("amount, sale_date, status, product_id, partner_id")).data ?? [],
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["dash-leads"],
    queryFn: async () => (await supabase.from("leads").select("id, full_name, company, status, estimated_value, close_probability, next_action, next_action_date, source, created_at, converted_to_client_id").order("next_action_date", { ascending: true, nullsFirst: false }).limit(100)).data ?? [],
  });
  const { data: proposals = [] } = useQuery({
    queryKey: ["dash-proposals"],
    queryFn: async () => (await supabase.from("proposals").select("id, status, total, created_at, sent_at, approved_at, valid_until")).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["dash-payments"],
    queryFn: async () => (await supabase.from("payments").select("amount, status, due_date")).data ?? [],
  });
  const { data: commissions = [] } = useQuery({
    queryKey: ["dash-commissions"],
    queryFn: async () => (await supabase.from("commissions").select("amount, status, partner_id, partner:partners(full_name)")).data ?? [],
  });
  const { data: documents = [] } = useQuery({
    queryKey: ["dash-documents"],
    queryFn: async () => (await supabase.from("documents").select("id, status, name, created_at, client_id").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["dash-contracts"],
    queryFn: async () => (await supabase.from("contracts").select("id, status, client_id")).data ?? [],
  });
  const { data: dashTasks = [] } = useQuery({
    queryKey: ["dash-tasks"],
    queryFn: async () => (await supabase.from("tasks").select("id, title, due_date, priority, status_new, assigned_to, created_at").order("due_date", { ascending: true, nullsFirst: false }).limit(20)).data ?? [],
  });

  // ===== Stats & Logic =====
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const monthRevenue = sales
      .filter((s: any) => {
        if (!s.sale_date) return false;
        const d = new Date(s.sale_date);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      })
      .reduce((acc, s: any) => acc + Number(s.amount || 0), 0);

    const activeClients = clients.filter((c: any) => c.status === "ativo").length;
    const inProgress = clientProducts.filter((p: any) => p.status === "em_andamento").length;
    const delayed = clientProducts.filter((p: any) => 
      p.status === "atrasado" || 
      (p.deadline && new Date(p.deadline) < now && !["concluido", "cancelado"].includes(p.status))
    ).length;

    const LOST_STATUSES = ["perdido", "lost", "descartado", "cancelado"];
    const WON_STATUSES = ["ganho", "won", "convertido", "fechado"];
    const activeLeads = leads.filter((l: any) => 
      !LOST_STATUSES.includes(String(l.status || "").toLowerCase()) && 
      !WON_STATUSES.includes(String(l.status || "").toLowerCase()) &&
      !l.converted_to_client_id
    );
    const weightedPipeline = activeLeads.reduce(
      (a, l: any) => a + (Number(l.estimated_value || 0) * (Number(l.close_probability || 0) / 100)), 
      0
    );

    const overduePayments = payments.filter((p: any) => 
      p.status === "vencido" || 
      (["em_aberto", "pendente", "parcial"].includes(p.status) && p.due_date && new Date(p.due_date) < now)
    );
    const overdueAmount = overduePayments.reduce((a, p: any) => a + Number(p.amount || 0), 0);

    // Timeline chart
    const revenue6m = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(thisYear, thisMonth - (5 - i), 1);
      const label = d.toLocaleString("pt-BR", { month: "short" }).toUpperCase();
      const total = sales
        .filter((s: any) => s.sale_date && new Date(s.sale_date).getMonth() === d.getMonth() && new Date(s.sale_date).getFullYear() === d.getFullYear())
        .reduce((acc, s: any) => acc + Number(s.amount || 0), 0);
      return { name: label, value: total };
    });

    // Alerts panel
    const alerts: Array<{ id: string; title: string; sub: string; tone: Tone; icon: any }> = [];
    const contractsAwaiting = contracts.filter((c: any) => ["aguardando_assinatura", "enviado"].includes(c.status)).length;
    if (contractsAwaiting > 0) alerts.push({ id: "c1", title: "Contratos pendentes", sub: `${contractsAwaiting} aguardam assinatura`, tone: "warning", icon: FileSignature });
    
    const staleLeads = activeLeads.filter((l: any) => l.next_action_date && new Date(l.next_action_date) < now).length;
    if (staleLeads > 0) alerts.push({ id: "l1", title: "Follow-ups atrasados", sub: `${staleLeads} negociações estagnadas`, tone: "danger", icon: CalendarClock });
    
    if (delayed > 0) alerts.push({ id: "d1", title: "Entregas em atraso", sub: `${delayed} demandas críticas`, tone: "danger", icon: Clock });
    if (overdueAmount > 0) alerts.push({ id: "p1", title: "Inadimplência detectada", sub: `${formatBRL(overdueAmount)} em atraso`, tone: "danger", icon: CreditCard });

    // Rows 3 sections
    const upcomingActions = activeLeads
      .filter((l: any) => l.next_action_date)
      .sort((a: any, b: any) => new Date(a.next_action_date).getTime() - new Date(b.next_action_date).getTime())
      .slice(0, 5);

    const urgentDemands = clientProducts
      .filter((p: any) => !["concluido", "cancelado"].includes(p.status))
      .sort((a: any, b: any) => (a.deadline ? new Date(a.deadline).getTime() : 0) - (b.deadline ? new Date(b.deadline).getTime() : 0))
      .slice(0, 5);

    const recentActivity = [
      ...proposals.slice(0, 5).map((p: any) => ({ id: `p-${p.id}`, title: `Proposta enviada`, sub: formatBRL(p.total), at: p.sent_at || p.created_at, icon: FileText })),
      ...leads.slice(0, 5).map((l: any) => ({ id: `l-${l.id}`, title: `Nova negociação`, sub: l.full_name, at: l.created_at, icon: Target })),
    ].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime()).slice(0, 5);

    return {
      kpis: [
        { 
          label: "Receita Fechada", 
          value: formatBRL(monthRevenue), 
          change: "+12.5%", 
          changeType: "up", 
          sub: "Faturamento mensal", 
          icon: CircleDollarSign, 
          tone: "primary" as Tone,
          context: "vs. mês anterior"
        },
        { 
          label: "Pipeline Ponderado", 
          value: formatBRL(weightedPipeline), 
          change: "+8.2%", 
          changeType: "up", 
          sub: "Probabilidade de fechamento", 
          icon: Target, 
          tone: "info" as Tone,
          context: "8 negociações ativas"
        },
        { 
          label: "Taxa de Conversão", 
          value: "24%", 
          change: "-2.1%", 
          changeType: "down", 
          sub: "Leads para fechamento", 
          icon: Activity, 
          tone: "success" as Tone,
          context: "Meta: 30%"
        },
        { 
          label: "Pagamentos em Atraso", 
          value: formatBRL(overdueAmount), 
          change: overdueAmount > 0 ? "Crítico" : "Saudável", 
          changeType: overdueAmount > 0 ? "down" : "up", 
          sub: "Inadimplência total", 
          icon: FileWarning, 
          tone: "danger" as Tone,
          context: `${overduePayments.length} títulos vencidos`
        },
      ],
      revenue6m,
      alerts,
      upcomingActions,
      urgentDemands,
      recentActivity,
    };
  }, [clients, clientProducts, sales, payments, leads, proposals, contracts]);

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      
      {/* === TOP BAR: EXECUTIVE COCKPIT HEADER === */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-white/[0.02]">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{today}</span>
            <div className="h-2 w-px bg-white/[0.05]" />
            <div className="flex items-center gap-1">
              <div className={cn("size-1 rounded-full", stats.alerts.length > 0 ? "bg-amber-500" : "bg-emerald-500")} />
              <span className="text-[10px] text-zinc-400 font-medium">
                {stats.alerts.length > 0 ? `${stats.alerts.length} notificações prioritárias` : "Operação estável"}
              </span>
            </div>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-white">
            {greeting}, <span className="text-indigo-400">{firstName}</span>
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link to="/leads?new=1" className="h-8 px-3 rounded-lg bg-zinc-900 border border-white/[0.05] hover:bg-zinc-800 transition-all text-[11px] font-medium text-zinc-300 flex items-center gap-2">
            <Plus className="size-3" /> Nova Negociação
          </Link>
          <Link to="/vendas?new=1" className="h-8 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-all text-[11px] font-semibold text-white flex items-center gap-2 shadow-sm">
            <TrendingUp className="size-3" /> Registrar Fechamento
          </Link>
        </div>
      </div>

      {/* === ROW 1: KPI GRID === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.kpis.map((kpi, i) => (
          <div key={i} className="relative p-4 rounded-xl border border-white/[0.03] bg-gradient-to-br from-zinc-900/40 to-zinc-900/20 backdrop-blur-md group hover:border-white/[0.08] transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className={cn("p-1.5 rounded-lg bg-zinc-950/50 border border-white/[0.03]", toneStyles[kpi.tone].icon)}>
                <kpi.icon className="size-3.5" />
              </div>
              <div className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-tight border",
                kpi.changeType === "up" 
                  ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/10" 
                  : "bg-rose-500/5 text-rose-400 border-rose-500/10"
              )}>
                {kpi.changeType === "up" ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
                {kpi.change}
              </div>
            </div>
            
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">{kpi.label}</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-xl font-bold text-white tracking-tight tabular-nums">{kpi.value}</h3>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-zinc-400">{kpi.sub}</span>
                <span className="text-[10px] text-zinc-600">·</span>
                <span className="text-[10px] text-zinc-500 italic">{kpi.context}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* === ROW 2: PERFORMANCE & CRITICAL ATTENTION === */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue Performance - 60% approximate */}
        <div className="lg:col-span-8 rounded-2xl border border-white/[0.03] bg-gradient-to-b from-zinc-900/40 to-transparent p-6 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">Performance de Faturamento</h2>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Visão consolidada · 6 meses</p>
            </div>
            <Link to="/financeiro" className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5 uppercase tracking-tighter">
              Relatório Completo <ArrowUpRight className="size-3" />
            </Link>
          </div>
          
          <div className="flex-1 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.revenue6m} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#3f3f46", fontSize: 10, fontWeight: 700 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#3f3f46", fontSize: 10 }}
                  tickFormatter={(val) => `R$ ${val/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#09090b", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", fontSize: "11px" }}
                  itemStyle={{ color: "#fff" }}
                  cursor={{ stroke: "#ffffff05" }}
                  formatter={(value: number) => [formatBRL(value), "Receita"]}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#6366f1" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alerts & Priorities - 40% approximate */}
        <div className="lg:col-span-4 rounded-2xl border border-white/[0.03] bg-zinc-900/20 p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <div className="size-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
            <h2 className="text-sm font-semibold text-white tracking-tight">Painel de Controle</h2>
          </div>
          
          <div className="flex-1 space-y-3">
            {stats.alerts.length > 0 ? (
              stats.alerts.map((alert) => (
                <div key={alert.id} className={cn("p-3.5 rounded-xl border border-white/[0.02] transition-all flex items-start gap-3 bg-white/[0.01] hover:bg-white/[0.03]", toneStyles[alert.tone].text)}>
                  <div className={cn("p-2 rounded-lg bg-zinc-950/50 border border-white/[0.03]", toneStyles[alert.tone].icon)}>
                    <alert.icon className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-zinc-100 leading-none mb-1.5">{alert.title}</p>
                    <p className="text-[10px] text-zinc-500 font-medium truncate">{alert.sub}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-8 border border-dashed border-white/[0.05] rounded-2xl bg-white/[0.01]">
                <div className="size-12 rounded-full bg-emerald-500/5 flex items-center justify-center mb-4">
                  <CheckCircle2 className="size-6 text-emerald-500/40" />
                </div>
                <h4 className="text-[13px] font-semibold text-zinc-300 mb-1">Tudo Sob Controle</h4>
                <p className="text-[11px] text-zinc-500 max-w-[180px]">Não há alertas críticos ou pendências urgentes para hoje.</p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-white/[0.03]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Métricas Rápidas</span>
              <span className="text-[9px] text-zinc-500 italic">Atualizado agora</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.02]">
                <p className="text-[9px] text-zinc-500 uppercase font-bold mb-1">Follow-ups</p>
                <p className="text-sm font-bold text-white">12</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.02]">
                <p className="text-[9px] text-zinc-500 uppercase font-bold mb-1">Reuniões</p>
                <p className="text-sm font-bold text-white">3</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === ROW 3: OPERATIONAL COCKPIT === */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Próximas Ações */}
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-white/[0.03] pb-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Próximas Reuniões</h3>
            <Link to="/leads" className="text-[9px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-tighter">Ver Agenda</Link>
          </div>
          <div className="space-y-3">
            {stats.upcomingActions.length > 0 ? (
              stats.upcomingActions.map((l: any) => (
                <div key={l.id} className="group flex items-start gap-3 min-w-0">
                  <div className="size-8 rounded-lg bg-zinc-900 border border-white/[0.03] flex flex-col items-center justify-center shrink-0 group-hover:border-indigo-500/30 transition-colors">
                    <span className="text-[8px] font-bold text-zinc-600 uppercase leading-none mb-0.5">{new Date(l.next_action_date).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
                    <span className="text-[12px] font-bold text-white leading-none">{new Date(l.next_action_date).getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">{l.full_name}</p>
                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">{l.next_action || "Follow-up agendado"}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[10px] text-zinc-600 italic">Sem compromissos agendados.</p>
            )}
          </div>
        </div>

        {/* Demandas Críticas */}
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-white/[0.03] pb-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Demandas Críticas</h3>
            <Link to="/demandas" className="text-[9px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-tighter">Gerenciar</Link>
          </div>
          <div className="space-y-3">
            {stats.urgentDemands.length > 0 ? (
              stats.urgentDemands.map((d: any) => (
                <div key={d.id} className="flex items-center gap-3 group">
                  <div className={cn(
                    "size-2 rounded-full shrink-0 shadow-[0_0_5px_rgba(0,0,0,0.5)]",
                    new Date(d.deadline || 0) < new Date() ? "bg-rose-500 animate-pulse" : "bg-zinc-700"
                  )} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11.5px] font-medium text-zinc-300 truncate">Ref: {d.id.slice(0, 8)}</p>
                      <span className="text-[9px] font-bold text-zinc-600 uppercase">{d.deadline ? new Date(d.deadline).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "--/--"}</span>
                    </div>
                    <div className="w-full h-1 bg-white/[0.02] rounded-full mt-1.5 overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-1000", d.status === "concluido" ? "w-full bg-emerald-500/50" : "w-1/3 bg-indigo-500/30")} />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[10px] text-zinc-600 italic">Tudo em dia.</p>
            )}
          </div>
        </div>

        {/* Follow-ups */}
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-white/[0.03] pb-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Follow-ups Ativos</h3>
            <span className="text-[9px] font-bold text-indigo-500/80 uppercase tracking-tighter">Prioridade</span>
          </div>
          <div className="space-y-3">
            {stats.upcomingActions.slice(2, 5).map((l: any) => (
              <div key={l.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/[0.03]">
                <div className="size-7 rounded-full bg-zinc-950/50 border border-white/[0.05] flex items-center justify-center text-[10px] font-bold text-zinc-500 shrink-0">
                  {l.full_name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-zinc-300 truncate">{l.full_name}</p>
                  <p className="text-[9px] text-zinc-600 truncate">Último contato: há 2 dias</p>
                </div>
                <button className="size-6 rounded-md bg-white/[0.03] hover:bg-white/[0.08] flex items-center justify-center transition-colors">
                  <Phone className="size-3 text-zinc-500" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Atividade Recente */}
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-white/[0.03] pb-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Fluxo Recente</h3>
            <Activity className="size-3 text-zinc-600" />
          </div>
          <div className="space-y-3">
            {stats.recentActivity.slice(0, 4).map((act) => (
              <div key={act.id} className="relative pl-5 before:absolute before:left-0 before:top-1 before:bottom-0 before:w-px before:bg-white/[0.05]">
                <div className="absolute left-[-2px] top-1.5 size-1 rounded-full bg-zinc-700" />
                <p className="text-[11px] font-medium text-zinc-300 truncate">{act.title}</p>
                <p className="text-[9px] text-zinc-600 mt-0.5">{act.sub} · {new Date(act.at).toLocaleDateString("pt-BR")}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
