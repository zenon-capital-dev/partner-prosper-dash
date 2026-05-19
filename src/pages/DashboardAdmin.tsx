import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, TrendingDown, CircleDollarSign, Users, Activity, Clock,
  CheckCircle2, FileWarning, CreditCard, FileSignature, Target, Handshake,
  Plus, ArrowUpRight, Phone, CalendarClock, AlertTriangle, Bell,
  FileText, ChevronRight, Crown, Briefcase, ClipboardList, Sparkles,
  Mail, MessageSquare, UserPlus, PiggyBank, Receipt, BarChart3, Filter, Zap,
  Calendar as CalendarIcon, Wallet, Layers, ArrowRight,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import { PageHero } from "@/components/PageHero";
import { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie,
} from "recharts";

type Tone = "primary" | "success" | "warning" | "danger" | "info";

const toneColor: Record<Tone, { text: string; bg: string; border: string; chart: string; soft: string; grad: string; ring: string }> = {
  primary: { text: "text-indigo-700", bg: "bg-indigo-600", border: "border-indigo-100", chart: "#4f46e5", soft: "bg-indigo-50", grad: "from-indigo-600 to-indigo-700", ring: "ring-indigo-100" },
  success: { text: "text-emerald-700", bg: "bg-emerald-600", border: "border-emerald-100", chart: "#10b981", soft: "bg-emerald-50", grad: "from-emerald-500 to-emerald-600", ring: "ring-emerald-100" },
  warning: { text: "text-amber-700", bg: "bg-amber-600", border: "border-amber-100", chart: "#f59e0b", soft: "bg-amber-50", grad: "from-amber-500 to-amber-600", ring: "ring-amber-100" },
  danger: { text: "text-rose-700", bg: "bg-rose-600", border: "border-rose-100", chart: "#f43f5e", soft: "bg-rose-50", grad: "from-rose-500 to-rose-600", ring: "ring-rose-100" },
  info: { text: "text-sky-700", bg: "bg-sky-600", border: "border-sky-100", chart: "#0ea5e9", soft: "bg-sky-50", grad: "from-sky-500 to-sky-600", ring: "ring-sky-100" },
};

export default function DashboardAdmin() {
  const { user } = useAuth();
  const [rangeKey, setRangeKey] = useState<"HOJE" | "7 DIAS" | "30 DIAS" | "MÊS" | "PERSONALIZADO">("HOJE");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [customOpen, setCustomOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const brasiliaToday = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
    const formatted = fmt.format(new Date());
    const [y, m, d] = formatted.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, []);

  const fullName = user?.user_metadata?.full_name || user?.email || "Admin";
  const firstName = String(fullName).split(/[ @]/)[0];
  const hourStr = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date());
  const hour = parseInt(hourStr, 10);
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  // ===== Queries =====
  const { data: clients = [] } = useQuery({
    queryKey: ["dash-clients"],
    queryFn: async () => (await supabase.from("clients").select("*")).data ?? [],
  });
  const { data: clientProducts = [] } = useQuery({
    queryKey: ["dash-demands"],
    queryFn: async () => (await supabase.from("client_products").select("*")).data ?? [],
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["dash-sales"],
    queryFn: async () => (await supabase.from("sales").select("*").order("sale_date", { ascending: false }).limit(200)).data ?? [],
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["dash-leads"],
    queryFn: async () => (await supabase.from("leads").select("*")).data ?? [],
  });
  const { data: commissions = [] } = useQuery({
    queryKey: ["dash-commissions"],
    queryFn: async () => (await supabase.from("commissions").select("*")).data ?? [],
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["dash-tasks"],
    queryFn: async () => (await supabase.from("tasks").select("*")).data ?? [],
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["dash-contracts"],
    queryFn: async () => (await supabase.from("contracts").select("id, status, name, created_at")).data ?? [],
  });
  const { data: docRequests = [] } = useQuery({
    queryKey: ["dash-doc-requests"],
    queryFn: async () => (await supabase.from("document_requests").select("id, status, created_at")).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["dash-payments"],
    queryFn: async () => (await supabase.from("payments").select("id, status, amount, amount_paid, due_date")).data ?? [],
  });

  const stats = useMemo(() => {
    const now = new Date();
    const toISO = (d: Date) => d.toISOString().slice(0, 10);
    let rangeStart = new Date(brasiliaToday);
    let rangeEnd = new Date(brasiliaToday);
    if (rangeKey === "7 DIAS") {
      rangeStart.setDate(brasiliaToday.getDate() - 6);
    } else if (rangeKey === "30 DIAS") {
      rangeStart.setDate(brasiliaToday.getDate() - 29);
    } else if (rangeKey === "MÊS") {
      rangeStart = new Date(brasiliaToday.getFullYear(), brasiliaToday.getMonth(), 1);
    } else if (rangeKey === "PERSONALIZADO") {
      if (customRange.from) rangeStart = customRange.from;
      if (customRange.to) rangeEnd = customRange.to;
    }
    const startISO = toISO(rangeStart);
    const endISO = toISO(rangeEnd);

    const filteredSales = sales.filter((s: any) => s.sale_date && s.sale_date >= startISO && s.sale_date <= endISO);
    const rangeRevenue = filteredSales.reduce((a, s: any) => a + Number(s.amount || 0), 0);
    const activeClients = clients.filter((c: any) => c.status === "ativo").length;

    const delayedDemands = clientProducts.filter((p: any) =>
      p.status === "atrasado" ||
      (p.deadline && new Date(p.deadline) < now && !["concluido", "cancelado"].includes(p.status))
    ).length;

    const pipelineTotal = leads.reduce((a, l: any) => a + Number(l.estimated_value || 0), 0);

    // === Novos indicadores ===
    const openContracts = contracts.filter((c: any) =>
      ["criado", "enviado", "aguardando_assinatura"].includes(c.status)
    ).length;
    const waitingSignatureContracts = contracts.filter((c: any) =>
      c.status === "aguardando_assinatura" || c.status === "enviado"
    ).length;
    const pendingDocs = docRequests.filter((d: any) =>
      ["solicitado", "pendente_correcao", "pendente", "enviado", "em_analise"].includes(d.status)
    ).length;
    const overdueTasks = tasks.filter((t: any) =>
      t.status !== "concluida" && t.status !== "completed" && t.due_date && new Date(t.due_date) < now
    ).length;
    const todayTasks = tasks.filter((t: any) => {
      if (!t.due_date) return false;
      const due = new Date(t.due_date);
      return due.toDateString() === now.toDateString();
    }).length;
    const commissionsToPay = commissions
      .filter((c: any) => ["pendente", "gerada", "em_analise", "aprovada", "pending"].includes(c.status))
      .reduce((a, c: any) => a + Number(c.amount || 0), 0);
    const commissionsCount = commissions.filter((c: any) =>
      ["pendente", "gerada", "em_analise", "aprovada", "pending"].includes(c.status)
    ).length;

    // Financeiro
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

    // Chart data (last 6 months)
    const chartData = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const name = d.toLocaleString("pt-BR", { month: "short" }).toUpperCase();
      const value = sales
        .filter((s: any) => s.sale_date && s.sale_date.startsWith(d.toISOString().slice(0, 7)))
        .reduce((a, s: any) => a + Number(s.amount || 0), 0);
      return { name, value };
    });

    const demandsByStatus = [
      { name: "Andamento", value: clientProducts.filter(p => p.status === "em_andamento").length, color: "#6366f1" },
      { name: "Aguardando", value: clientProducts.filter(p => p.status === "aguardando_inicio").length, color: "#fbbf24" },
      { name: "Concluído", value: clientProducts.filter(p => p.status === "concluido").length, color: "#10b981" },
      { name: "Atrasado", value: delayedDemands, color: "#f43f5e" },
    ];

    const recentSalesEnriched = filteredSales.slice(0, 5).map(s => ({
      ...s,
      client: clients.find(c => c.id === s.client_id)?.full_name || "Cliente"
    }));

    return {
      rangeRevenue, activeClients, delayedDemands, pipelineTotal,
      chartData, demandsByStatus, recentSales: recentSalesEnriched,
      leadsCount: leads.length,
      openContracts, waitingSignatureContracts,
      pendingDocs, overdueTasks, todayTasks,
      commissionsToPay, commissionsCount,
      receivable7d, receivable7dCount,
      overdueAmount, overdueCount,
      totalClients: clients.length,
    };
  }, [clients, clientProducts, sales, leads, commissions, tasks, contracts, docRequests, payments, rangeKey, customRange, brasiliaToday]);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-background text-slate-900 dark:text-foreground font-sans selection:bg-indigo-100 selection:text-indigo-900 admin-shell">
      <PageHero
        eyebrow="Dashboard"
        category="Visão Geral"
        title={`${greeting}, ${firstName}`}
        description="Aqui está o pulso do seu negócio hoje."
        icon={<Sparkles className="size-6" />}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex bg-white dark:bg-card p-1 rounded-2xl border border-slate-200 dark:border-border shadow-sm mr-2">
              {(["HOJE", "7 DIAS", "30 DIAS", "MÊS"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setRangeKey(k)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black transition-all uppercase",
                    rangeKey === k ? "bg-slate-900 dark:bg-primary text-white dark:text-primary-foreground shadow-lg" : "text-slate-400 dark:text-muted-foreground hover:text-slate-600 dark:hover:text-foreground"
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <Link
              to="/vendas?new=1"
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:shadow-indigo-200 transition-all active:scale-95"
            >
              <Plus className="size-4 stroke-[3]" />
              NOVA VENDA
            </Link>
          </div>
        }
        kpis={[
          { label: "Receita", value: formatBRL(stats.rangeRevenue), tone: "primary", icon: <CircleDollarSign className="size-4" />, hint: "Vendas no período" },
          { label: "Ativos", value: stats.activeClients.toString(), tone: "success", icon: <Users className="size-4" />, hint: `${stats.totalClients} total` },
          { label: "Pipeline", value: formatBRL(stats.pipelineTotal), tone: "warning", icon: <Target className="size-4" />, hint: `${stats.leadsCount} leads` },
          { label: "Atrasos", value: stats.delayedDemands.toString(), tone: "danger", icon: <Clock className="size-4" />, hint: "Fora do prazo" },
        ]}
      />

      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 py-5 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">


        {/* === LINHA 2: OPERACIONAL DETALHADO === */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <MiniStat label="Contratos abertos" value={stats.openContracts} hint={`${stats.waitingSignatureContracts} aguardando assinatura`} icon={FileSignature} to="/contratos" tone="primary" />
          <MiniStat label="Docs pendentes" value={stats.pendingDocs} hint="Solicitações em aberto" icon={FileText} to="/documentos" tone="info" />
          <MiniStat label="Tarefas em atraso" value={stats.overdueTasks} hint={`${stats.todayTasks} previstas para hoje`} icon={ClipboardList} to="/tarefas" tone="danger" />
          <MiniStat label="Comissões a pagar" value={formatBRL(stats.commissionsToPay)} hint={`${stats.commissionsCount} lançamento(s)`} icon={Wallet} to="/comissoes" tone="warning" />
        </div>

        {/* === LINHA 2: RESUMO FINANCEIRO === */}
        <div className="vx-card p-6 bg-white dark:bg-card space-y-6">
           <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-foreground tracking-tight">Resumo Financeiro</h3>
              <p className="text-slate-400 dark:text-muted-foreground text-sm font-medium">Situação atual da tesouraria e conciliação</p>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <FinanceCard
                label="A RECEBER (7 DIAS)"
                value={formatBRL(stats.receivable7d)}
                sub={`${stats.receivable7dCount} título(s) a vencer`}
                icon={PiggyBank}
                tone="success"
                to="/financeiro"
              />
              <FinanceCard
                label="INADIMPLÊNCIA"
                value={formatBRL(stats.overdueAmount)}
                sub={`${stats.overdueCount} título(s) vencido(s)`}
                icon={AlertTriangle}
                tone="danger"
                to="/financeiro"
              />
              <FinanceCard
                label="COMISSÕES A LIBERAR"
                value={formatBRL(stats.commissionsToPay)}
                sub="Aguardando liberação"
                icon={Receipt}
                tone="warning"
                to="/comissoes"
              />
           </div>
        </div>

        {/* BENTO GRID START */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">


          {/* REVENUE CHART - LARGE */}
          <div className="md:col-span-2 lg:col-span-3 bg-white dark:bg-card rounded-[32px] p-8 border border-slate-200 dark:border-border shadow-sm overflow-hidden relative group">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-foreground tracking-tight">Crescimento de Receita</h3>
                <p className="text-slate-400 dark:text-muted-foreground text-sm font-medium">Histórico consolidado dos últimos 6 meses</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-indigo-600" />
                  <span className="text-[11px] font-bold text-slate-500 dark:text-muted-foreground uppercase">Receita Real</span>
                </div>
              </div>
            </div>
            
            <div className="h-[320px] w-full">
              {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.chartData}>
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 11, fontWeight: 700 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 11 }} 
                    tickFormatter={(v) => `R$${v/1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#6366f1" 
                    strokeWidth={4} 
                    fill="url(#chartGradient)" 
                    dot={{ r: 6, fill: "#fff", stroke: "#6366f1", strokeWidth: 3 }}
                    activeDot={{ r: 8, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* STATUS PIE - SMALL */}
          <div className="bg-white dark:bg-card rounded-[32px] p-8 border border-slate-200 dark:border-border shadow-sm flex flex-col items-center justify-between">
            <div className="w-full text-center">
              <h3 className="text-lg font-black text-slate-900 dark:text-foreground tracking-tight">Status de Demandas</h3>
              <p className="text-slate-400 text-[11px] font-bold uppercase mt-1">Divisão Operacional</p>
            </div>
            
            <div className="h-48 w-full">
              {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.demandsByStatus}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {stats.demandsByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              )}
            </div>

            <div className="w-full space-y-2 mt-4">
              {stats.demandsByStatus.map(s => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-xs font-bold text-slate-600 dark:text-muted-foreground">{s.name}</span>
                  </div>
                  <span className="text-xs font-black text-slate-900 dark:text-foreground">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* RECENT SALES - LIST */}
          <div className="md:col-span-2 bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Vendas Recentes</h3>
              <Link to="/vendas" className="text-indigo-600 font-bold text-xs uppercase hover:underline">Ver todas</Link>
            </div>
            <div className="space-y-4">
              {stats.recentSales.length > 0 ? stats.recentSales.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-900 font-black shadow-sm group-hover:scale-110 transition-transform">
                      {s.client.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 truncate max-w-[150px]">{s.client}</p>
                      <p className="text-[11px] font-bold text-slate-400">{format(new Date(s.sale_date), "dd MMM, yyyy")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-indigo-600">{formatBRL(s.amount)}</p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <div className="size-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Confirmado</span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="py-10 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">Nenhuma venda no período</div>
              )}
            </div>
          </div>

          {/* QUICK ACTIONS - GRID */}
          <div className="md:col-span-1 bg-indigo-600 rounded-[32px] p-8 text-white shadow-xl shadow-indigo-200">
            <h3 className="text-xl font-black mb-6 tracking-tight">Atalhos Rápidos</h3>
            <div className="grid grid-cols-2 gap-3">
              <QuickAction label="Lead" to="/leads?new=1" icon={UserPlus} />
              <QuickAction label="Tarefa" to="/tarefas?new=1" icon={ClipboardList} />
              <QuickAction label="Contrato" to="/contratos?new=1" icon={FileSignature} />
              <QuickAction label="Doc" to="/documentos" icon={FileText} />
            </div>
            <Link to="/financeiro" className="mt-6 w-full flex items-center justify-between p-4 rounded-2xl bg-indigo-500/50 border border-indigo-400/30 hover:bg-indigo-400/50 transition-all">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-white flex items-center justify-center">
                  <Wallet className="size-4 text-indigo-600" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider">Central Financeira</span>
              </div>
              <ArrowRight className="size-4" />
            </Link>
          </div>

          {/* TASKS / ALERTS - SUMMARY */}
          <div className="md:col-span-1 bg-slate-900 rounded-[32px] p-8 text-white shadow-xl">
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black tracking-tight">Alertas</h3>
                <div className="px-2 py-0.5 rounded-md bg-rose-500 text-[10px] font-black uppercase">Crítico</div>
             </div>
             <div className="space-y-4">
                <AlertItem icon={Clock} title="Atraso Operacional" count={stats.delayedDemands} />
                <AlertItem icon={Wallet} title="Comissões Pendentes" value={formatBRL(stats.commissionsToPay)} />
                <AlertItem icon={ClipboardList} title="Tarefas de Hoje" count={tasks.length} />
             </div>
             <div className="mt-10 p-5 rounded-2xl bg-white/5 border border-white/10 text-center">
                <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest mb-1">Health Score Médio</p>
                <p className="text-3xl font-black text-white">92%</p>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ============ INTERNAL COMPONENTS ============ */

function StatCard({ label, value, trend, icon: Icon, tone, subText }: { 
  label: string; value: string; trend: string; icon: any; tone: Tone; subText: string;
}) {
  const t = toneColor[tone];
  return (
    <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
      <div className="flex items-center justify-between mb-6">
        <div className={cn("size-12 rounded-2xl flex items-center justify-center shadow-inner", t.soft, t.text)}>
          <Icon className="size-6 stroke-[2.5]" />
        </div>
        <div className={cn("px-2.5 py-1 rounded-full text-[10px] font-black border", t.text, t.bg, t.border)}>
          {trend}
        </div>
      </div>
      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <h4 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">{value}</h4>
      <p className="text-[11px] font-bold text-slate-400">{subText}</p>
    </div>
  );
}

function QuickAction({ label, to, icon: Icon }: { label: string; to: string; icon: any }) {
  return (
    <Link to={to} className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/20 transition-all text-center">
      <Icon className="size-5" />
      <span className="text-[10px] font-black uppercase tracking-tight">{label}</span>
    </Link>
  );
}

function AlertItem({ icon: Icon, title, count, value }: { icon: any; title: string; count?: number; value?: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
      <div className="flex items-center gap-3">
        <Icon className="size-4 text-slate-400" />
        <span className="text-xs font-bold text-slate-300">{title}</span>
      </div>
      <span className="text-xs font-black text-white">{count ?? value}</span>
    </div>
  );
}

function MiniStat({ label, value, hint, icon: Icon, to, tone }: { label: string; value: string | number; hint: string; icon: any; to: string; tone: Tone }) {
  const t = toneColor[tone];
  return (
    <Link to={to} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300 transition-all duration-300 group block">
      <div className="flex items-center justify-between mb-3">
        <div className={cn("size-9 rounded-xl flex items-center justify-center", t.soft, t.text)}>
          <Icon className="size-4 stroke-[2.5]" />
        </div>
        <ChevronRight className="size-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{value}</p>
      <p className="text-[11px] font-bold text-slate-400 mt-1 truncate">{hint}</p>
    </Link>
  );
}

function FinanceCard({ label, value, sub, icon: Icon, tone, to }: { label: string; value: string; sub: string; icon: any; tone: Tone; to: string }) {
  const t = toneColor[tone];
  return (
    <Link to={to} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 group block">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
          <p className="text-3xl font-black text-slate-900 tracking-tight tabular-nums truncate">{value}</p>
          <p className="text-xs font-bold text-slate-500 mt-2">{sub}</p>
        </div>
        <div className={cn("size-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner", t.soft, t.text)}>
          <Icon className="size-6 stroke-[2.5]" />
        </div>
      </div>
      <div className={cn("mt-4 h-1 rounded-full bg-gradient-to-r opacity-70", t.grad)} />
    </Link>
  );
}
