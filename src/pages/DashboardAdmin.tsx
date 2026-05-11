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
        { label: "Receita Fechada", value: formatBRL(monthRevenue), sub: "Faturamento mensal", icon: CircleDollarSign, tone: "primary" as Tone },
        { label: "Pipeline Ponderado", value: formatBRL(weightedPipeline), sub: "Valor provável de fechamento", icon: Target, tone: "info" as Tone },
        { label: "Negociações Ativas", value: String(activeLeads.length), sub: "Oportunidades no funil", icon: Handshake, tone: "success" as Tone },
        { label: "Carteira Ativa", value: String(activeClients), sub: "Clientes com contrato", icon: Users, tone: "neutral" as Tone },
      ],
      revenue6m,
      alerts,
      upcomingActions,
      urgentDemands,
      recentActivity,
    };
  }, [clients, clientProducts, sales, payments, leads, proposals, contracts]);

  return (
    <div className="p-6 lg:p-10 space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      
      {/* === TOP BAR (EXECUTIVE COCKPIT HEADER) === */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-4 border-b border-white/[0.03]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="size-1 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500/80">Operação em Tempo Real</span>
            </div>
            <span className="text-[10px] font-medium text-zinc-500">{today}</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            {greeting}, {firstName}
            <span className="text-zinc-600 font-normal">/ Visão Executiva</span>
          </h1>
        </div>

        <div className="flex flex-1 max-w-md mx-auto hidden xl:block">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
            <input 
              type="text"
              placeholder="Pesquisar em toda a plataforma..."
              className="w-full h-10 pl-9 pr-4 bg-zinc-900/40 border border-white/[0.05] rounded-xl text-[13px] text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500/30 transition-all"
              onFocus={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }))}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link to="/leads?new=1" className="h-9 px-4 rounded-lg bg-zinc-900/50 border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all text-[12.5px] font-medium text-zinc-300 flex items-center gap-2">
            <Target className="size-3.5" /> Negociação
          </Link>
          <Link to="/vendas?new=1" className="h-9 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-all text-[12.5px] font-semibold text-white flex items-center gap-2 shadow-lg shadow-indigo-500/20">
            <TrendingUp className="size-3.5" /> Fechamento
          </Link>
        </div>
      </div>

      {/* === ROW 1: KPI COCKPIT === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.kpis.map((kpi, i) => (
          <div key={i} className="group relative p-4 rounded-xl border border-white/[0.05] bg-zinc-900/20 backdrop-blur-sm hover:border-white/[0.1] transition-all overflow-hidden">
            <div className={cn("absolute inset-y-0 left-0 w-1", toneStyles[kpi.tone].dot)} />
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{kpi.label}</p>
                <h3 className="text-xl font-bold text-white tabular-nums">{kpi.value}</h3>
                <p className="text-[11px] text-zinc-400">{kpi.sub}</p>
              </div>
              <div className={cn("p-2 rounded-lg", toneStyles[kpi.tone].bg)}>
                <kpi.icon className={cn("size-4", toneStyles[kpi.tone].icon)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* === ROW 2: CORE PERFORMANCE & ALERTS === */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue Performance */}
        <div className="lg:col-span-8 rounded-2xl border border-white/[0.05] bg-zinc-900/20 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-sm font-semibold text-white">Performance de Faturamento</h2>
              <p className="text-[11px] text-zinc-500">Últimos 6 meses de operação</p>
            </div>
            <Link to="/financeiro" className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
              Ver relatório completo <ExternalLink className="size-2.5" />
            </Link>
          </div>
          
          <div className="flex-1 min-h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.revenue6m} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#52525b", fontSize: 10, fontWeight: 600 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#52525b", fontSize: 10 }}
                  tickFormatter={(val) => `R$ ${val/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#09090b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                  itemStyle={{ color: "#fff" }}
                  cursor={{ stroke: "#ffffff10" }}
                  formatter={(value: number) => [formatBRL(value), "Receita"]}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#6366f1" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alerts & Priorities */}
        <div className="lg:col-span-4 rounded-2xl border border-white/[0.05] bg-zinc-900/20 p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Bell className="size-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-white">Central de Atenção</h2>
          </div>
          
          <div className="flex-1 space-y-3">
            {stats.alerts.length > 0 ? (
              stats.alerts.map((alert) => (
                <div key={alert.id} className={cn("p-3.5 rounded-xl border transition-all flex items-start gap-3", toneStyles[alert.tone].bg, toneStyles[alert.tone].border)}>
                  <div className={cn("p-1.5 rounded-lg bg-zinc-950/40", toneStyles[alert.tone].icon)}>
                    <alert.icon className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-white leading-none mb-1">{alert.title}</p>
                    <p className="text-[11px] text-zinc-400 truncate">{alert.sub}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 opacity-40">
                <CheckCircle2 className="size-8 text-emerald-500" />
                <p className="text-xs text-zinc-400">Tudo em dia.<br/>Nenhum alerta crítico pendente.</p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-white/[0.05]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">Prioridades de Hoje</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Reuniões agendadas</span>
                <span className="text-white font-medium">3</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Follow-ups pendentes</span>
                <span className="text-white font-medium">12</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === ROW 3: DETAILED OPERATIONS === */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Próximas Ações */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Próximas Ações</h3>
            <Link to="/leads" className="text-[10px] text-zinc-400 hover:text-white transition-colors">Ver todos</Link>
          </div>
          <div className="space-y-2">
            {stats.upcomingActions.map((l: any) => (
              <div key={l.id} className="p-3 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition-colors group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-white truncate max-w-[120px]">{l.full_name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold uppercase tracking-tighter">
                    {new Date(l.next_action_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </span>
                </div>
                <p className="text-[10.5px] text-zinc-400 line-clamp-1 group-hover:text-zinc-300 transition-colors">
                  {l.next_action || "Follow-up agendado"}
                </p>
              </div>
            ))}
            {stats.upcomingActions.length === 0 && (
              <p className="text-[11px] text-zinc-600 italic py-2">Sem ações agendadas.</p>
            )}
          </div>
        </div>

        {/* Demandas Urgentes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Demandas Críticas</h3>
            <Link to="/demandas" className="text-[10px] text-zinc-400 hover:text-white transition-colors">Ver todos</Link>
          </div>
          <div className="space-y-2">
            {stats.urgentDemands.map((d: any) => (
              <div key={d.id} className="p-3 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition-colors group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-white truncate max-w-[120px]">Ref: {d.id.slice(0, 8)}</span>
                  {d.deadline && (
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter", 
                      new Date(d.deadline) < new Date() ? "bg-rose-500/10 text-rose-400" : "bg-zinc-500/10 text-zinc-400"
                    )}>
                      {new Date(d.deadline).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-1 rounded-full bg-zinc-600" />
                  <p className="text-[10.5px] text-zinc-400 capitalize">{d.status.replace(/_/g, " ")}</p>
                </div>
              </div>
            ))}
            {stats.urgentDemands.length === 0 && (
              <p className="text-[11px] text-zinc-600 italic py-2">Nenhuma demanda pendente.</p>
            )}
          </div>
        </div>

        {/* Atividade Recente */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Fluxo Recente</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stats.recentActivity.map((act) => (
              <div key={act.id} className="p-3 rounded-xl border border-white/[0.04] bg-white/[0.01] flex items-center gap-3">
                <div className="size-8 rounded-lg bg-zinc-950/40 border border-white/[0.05] flex items-center justify-center shrink-0">
                  <act.icon className="size-3.5 text-zinc-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11.5px] font-medium text-white truncate">{act.title}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{act.sub} · {new Date(act.at).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
