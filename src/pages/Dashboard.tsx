import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowUpRight, ArrowDownRight, Zap, MoreHorizontal,
  Search, Filter, Download, FileUp, Activity, FileSignature, 
  Wallet, Users, TrendingUp, Calendar, ChevronRight,
  Target, BarChart3, Clock, DollarSign, Bell
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import ClientPanel from "./ClientPanel";
import PartnerPanel from "./PartnerPanel";

type RangeKey = "today" | "7d" | "30d" | "month";

function makeRange(key: RangeKey) {
  const now = new Date();
  switch (key) {
    case "today": return { label: "HOJE" };
    case "7d": return { label: "7 DIAS" };
    case "30d": return { label: "30 DIAS" };
    case "month": default: return { label: "MÊS" };
  }
}

export default function Dashboard() {
  const { user, roles } = useAuth();
  const [rangeKey, setRangeKey] = useState<RangeKey>("month");
  const range = useMemo(() => makeRange(rangeKey), [rangeKey]);

  const { data: sales = [] } = useQuery({
    queryKey: ["dash-sales"],
    queryFn: async () => {
      const { data } = await supabase.from("sales").select("*");
      return data ?? [];
    },
  });

  const { data: clientsTotal = 0 } = useQuery({
    queryKey: ["dash-clients-total"],
    queryFn: async () => {
      const { count } = await supabase.from("clients").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const totalRevenue = sales.reduce((s, x: any) => s + Number(x.amount), 0);
  const avgTicket = sales.length ? totalRevenue / sales.length : 0;

  if (roles.includes("cliente")) return <ClientPanel />;
  if (roles.includes("parceiro")) return <PartnerPanel />;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] cp-grid-bg">
      {/* Top Header / Search Bar */}
      <header className="h-16 border-b border-border/40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4 flex-1 max-w-xl">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Buscar clientes, parceiros, produtos..." 
              className="w-full h-10 pl-10 pr-4 bg-slate-100 dark:bg-slate-900 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="size-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center justify-center text-muted-foreground transition-colors relative">
            <Bell className="size-5" />
            <span className="absolute top-2.5 right-2.5 size-2 bg-indigo-500 rounded-full border-2 border-white dark:border-slate-950" />
          </button>
          <div className="h-6 w-px bg-border/60 mx-1" />
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
            {(["today", "7d", "30d", "month"] as RangeKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setRangeKey(k)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                  rangeKey === k 
                    ? "bg-white dark:bg-slate-800 text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {makeRange(k).label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="p-8 space-y-8 max-w-[1600px] mx-auto animate-fade-up">
        {/* Breadcrumb / Info */}
        <div className="flex items-center gap-3 text-muted-foreground/60">
          <Calendar className="size-4" />
          <span className="text-[11px] font-bold uppercase tracking-widest">{format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</span>
          <span className="text-border">|</span>
          <Zap className="size-4 text-indigo-500" />
          <span className="text-[11px] font-bold uppercase tracking-widest">Sistema Operacional</span>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard 
            label="Faturamento" 
            value={formatBRL(totalRevenue)} 
            delta="+12.5%" 
            trend="up"
            icon={<DollarSign className="size-4 text-indigo-600" />}
            color="indigo"
          />
          <KPICard 
            label="Novos Clientes" 
            value={String(clientsTotal)} 
            delta="+12.5%" 
            trend="up"
            icon={<Users className="size-4 text-emerald-600" />}
            color="emerald"
          />
          <KPICard 
            label="Parceiros Ativos" 
            value="11" 
            delta="+12.5%" 
            trend="up"
            icon={<HandshakeIcon />}
            color="amber"
          />
          <KPICard 
            label="Ticket Médio" 
            value={formatBRL(avgTicket)} 
            delta="+12.5%" 
            trend="up"
            icon={<Wallet className="size-4 text-blue-600" />}
            color="blue"
          />
        </div>

        {/* Secondary KPI Strip (Mini) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <MiniKPICard label="CONTRATOS ABERTOS" value="0" color="blue" />
          <MiniKPICard label="CONTRATOS FECHADOS" value="0" color="emerald" />
          <MiniKPICard label="CONTRATOS PENDENTES" value="0" color="amber" />
          <MiniKPICard label="CLIENTES NO PERÍODO" value="0" color="slate" />
        </div>

        {/* Main Content Sections */}
        <div className="grid grid-cols-12 gap-8">
          {/* Left Column: Recent Activities */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            <div className="cp-panel p-6">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                    <Activity className="size-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold tracking-tight">Atividades Recentes</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Acompanhamento operacional em tempo real</p>
                  </div>
                </div>
                <button className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors">Ver todas</button>
              </div>

              <div className="space-y-6">
                <ActivityItem 
                  title="Novo contrato fechado" 
                  desc="Douglas Santos • Gestão Financeira - R$ 12.500,00" 
                  time="14:20" 
                  icon={<FileSignature className="size-4 text-indigo-600" />}
                />
                <ActivityItem 
                  title="Documentos recebidos" 
                  desc="Ana Paula (Cliente) • Regularização Imobiliária" 
                  time="11:05" 
                  icon={<FileUp className="size-4 text-blue-600" />}
                />
                <ActivityItem 
                  title="Nova indicação de parceiro" 
                  desc="Consultoria ABC • Lead: Marcos Oliveira" 
                  time="Ontem" 
                  icon={<UserPlusIcon />}
                />
              </div>
            </div>

            {/* Bottom Highlight Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Revenue Target Card */}
              <div className="bg-[#0f172a] rounded-2xl p-6 text-white relative overflow-hidden group border border-white/5">
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-4">META DE FATURAMENTO</p>
                    <h4 className="text-2xl font-bold tracking-tight mb-2">R$ 842.000</h4>
                    <p className="text-xs text-white/40 font-medium">Faltam R$ 158.000 para a meta do mês</p>
                  </div>
                  <div className="mt-8 flex items-center justify-between">
                    <div className="size-12 rounded-full border-4 border-white/10 flex items-center justify-center text-xs font-bold text-emerald-400">
                      84%
                    </div>
                    <div className="flex -space-x-2">
                      <div className="size-8 rounded-full bg-indigo-500 border-2 border-[#0f172a]" />
                      <div className="size-8 rounded-full bg-emerald-500 border-2 border-[#0f172a]" />
                      <div className="size-8 rounded-full bg-amber-500 border-2 border-[#0f172a]" />
                    </div>
                  </div>
                </div>
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                  <Target className="size-32" />
                </div>
              </div>

              {/* Lead Performance Card */}
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white relative overflow-hidden group shadow-xl shadow-indigo-500/20">
                <div className="relative z-10">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-4">PERFORMANCE DE LEADS</p>
                  <h4 className="text-2xl font-bold tracking-tight mb-2">128 Leads</h4>
                  <p className="text-xs text-white/60 font-medium">Conversão de 18.5% este mês</p>
                  
                  <div className="mt-8 h-12 flex items-end gap-1">
                    {[40, 60, 45, 70, 55, 80, 65].map((h, i) => (
                      <div key={i} className="flex-1 bg-white/20 rounded-t-sm" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div className="absolute -bottom-4 -right-4 size-32 bg-white/10 rounded-full blur-3xl" />
              </div>
            </div>
          </div>

          {/* Right Column: Alerts & Team */}
          <div className="col-span-12 lg:col-span-4 space-y-8">
            <div className="cp-panel p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="size-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                  <Bell className="size-4 text-amber-600" />
                </div>
                <h3 className="text-sm font-bold tracking-tight">Pendências Críticas</h3>
              </div>

              <div className="space-y-4">
                <AlertItem label="Tarefas em Atraso/Pendentes" value="0" color="rose" />
                <AlertItem label="Documentos para Análise" value="0" color="amber" />
                <AlertItem label="Contas a Pagar (Hoje)" value="2" color="slate" isDark />
              </div>
            </div>

            <div className="cp-panel p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold tracking-tight">Controle de Equipe</h3>
                <MoreHorizontal className="size-4 text-muted-foreground" />
              </div>
              
              <div className="space-y-4">
                <TeamMember name="Ricardo Melo" role="Colaborador" />
                <TeamMember name="Juliana Costa" role="Vendedor" />
                <TeamMember name="Bruno Silva" role="Parceiro" />
              </div>

              <button className="w-full mt-6 py-2.5 rounded-xl border border-dashed border-border hover:border-indigo-500/50 hover:bg-indigo-50/30 transition-all text-xs font-bold text-muted-foreground hover:text-indigo-600">
                Gerenciar Equipe
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* --- Components --- */

function KPICard({ label, value, delta, trend, icon, color }: any) {
  return (
    <div className="cp-panel p-6 group hover:translate-y-[-2px] transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("size-10 rounded-xl flex items-center justify-center bg-opacity-10", {
          "bg-indigo-500": color === "indigo",
          "bg-emerald-500": color === "emerald",
          "bg-amber-500": color === "amber",
          "bg-blue-500": color === "blue",
        })}>
          {icon}
        </div>
        <div className={cn("cp-pill", trend === "up" ? "cp-pill-success" : "cp-pill-danger")}>
          <ArrowUpRight className="size-3" />
          {delta}
        </div>
      </div>
      <p className="cp-stat-label">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <h4 className="cp-stat-value">{value}</h4>
      </div>
      <p className="text-[10px] text-muted-foreground/60 mt-2 font-medium tracking-wide">+12.5% vs. período anterior</p>
    </div>
  );
}

function MiniKPICard({ label, value, color }: any) {
  const colorMap: any = {
    blue: "text-blue-600 border-blue-100 bg-blue-50/30",
    emerald: "text-emerald-600 border-emerald-100 bg-emerald-50/30",
    amber: "text-amber-600 border-amber-100 bg-amber-50/30",
    slate: "text-slate-600 border-slate-100 bg-slate-50/30",
  };
  return (
    <div className={cn("border rounded-xl p-4 flex flex-col justify-between transition-colors", colorMap[color] || colorMap.slate)}>
      <p className="text-[9px] font-extrabold tracking-[0.15em] mb-1">{label}</p>
      <p className="text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function ActivityItem({ title, desc, time, icon }: any) {
  return (
    <div className="flex items-start gap-4 group">
      <div className="size-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border/40 flex items-center justify-center shrink-0 group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors shadow-sm">
        {icon}
      </div>
      <div className="flex-1 min-w-0 border-b border-border/40 pb-5 group-last:border-none group-last:pb-0">
        <div className="flex items-center justify-between gap-4 mb-1">
          <h4 className="text-sm font-bold tracking-tight text-foreground">{title}</h4>
          <span className="text-[11px] font-mono text-muted-foreground">{time}</span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{desc}</p>
      </div>
    </div>
  );
}

function AlertItem({ label, value, color, isDark }: any) {
  const colors: any = {
    rose: "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20",
    amber: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20",
    slate: "bg-slate-900 text-white border-slate-800",
  };
  
  return (
    <div className={cn("flex items-center justify-between p-4 rounded-xl border transition-all", colors[color])}>
      <span className="text-xs font-bold tracking-tight">{label}</span>
      <span className="text-lg font-bold tabular-nums">{value}</span>
    </div>
  );
}

function TeamMember({ name, role }: any) {
  return (
    <div className="flex items-center gap-3">
      <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-[10px] font-bold text-indigo-600">
        {name.split(" ").map((n: string) => n[0]).join("")}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold tracking-tight leading-none">{name}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{role}</p>
      </div>
      <Activity className="size-3 text-emerald-500" />
    </div>
  );
}

const HandshakeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 text-amber-600">
    <path d="m11 17 2 2 6-6" />
    <path d="m18 19 2 2" />
    <path d="m5 10 3-3 5 5" />
    <path d="m17 10 3-3" />
    <circle cx="8" cy="8" r="2" />
    <path d="m13 13-5-5" />
    <path d="m12 18-5-5" />
  </svg>
);

const UserPlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 text-indigo-600">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);
