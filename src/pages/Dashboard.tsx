import { useMemo, useState } from "react";
import {
  ArrowUpRight, Zap, Search, Bell, Calendar,
  DollarSign, Users, Wallet, Target, Activity,
  FileSignature, FileUp, MoreHorizontal, Clock
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { cn } from "@/lib/utils";
import ClientPanel from "./ClientPanel";
import PartnerPanel from "./PartnerPanel";

type RangeKey = "today" | "7d" | "30d" | "month";

function makeRange(key: RangeKey) {
  switch (key) {
    case "today": return { label: "HOJE" };
    case "7d": return { label: "7 DIAS" };
    case "30d": return { label: "30 DIAS" };
    case "month": default: return { label: "MÊS" };
  }
}

export default function Dashboard() {
  const { roles } = useAuth();
  const [rangeKey, setRangeKey] = useState<RangeKey>("month");
  const { data: stats, isLoading } = useDashboardStats();

  if (roles.includes("cliente")) return <ClientPanel />;
  if (roles.includes("parceiro")) return <PartnerPanel />;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background cp-grid-bg">
      <div className="p-8 flex items-center justify-end">
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/50">
          {(["today", "7d", "30d", "month"] as RangeKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setRangeKey(k)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                rangeKey === k 
                  ? "bg-background text-foreground shadow-sm border border-border/20" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {makeRange(k).label}
            </button>
          ))}
        </div>
      </div>

      <main className="p-8 space-y-8 max-w-[1600px] mx-auto animate-fade-up">
        {/* Breadcrumb / Info */}
        <div className="flex items-center gap-3 text-muted-foreground/60">
          <Calendar className="size-4" />
          <span className="text-[11px] font-bold uppercase tracking-widest">{format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</span>
          <span className="text-border">|</span>
          <Zap className="size-4 text-indigo-500" />
          <span className="text-[11px] font-bold uppercase tracking-widest">Painel de Comando Admin</span>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard 
            label="Receita Recebida" 
            value={formatBRL(stats?.financial.received || 0)} 
            delta="+8.4%" 
            trend="up"
            icon={<DollarSign className="size-5" />}
            color="indigo"
          />
          <KPICard 
            label="Novos Clientes" 
            value={String(stats?.clients.month || 0)} 
            delta="+12.5%" 
            trend="up"
            icon={<Users className="size-5" />}
            color="emerald"
          />
          <KPICard 
            label="Conv. Leads" 
            value={Math.round((stats?.leads.conversionRate || 0) * 100) + "%"} 
            delta="+2.1%" 
            trend="up"
            icon={<Target className="size-5" />}
            color="amber"
          />
          <KPICard 
            label="Ticket Médio" 
            value={formatBRL((stats?.financial.total || 0) / (stats?.clients.total || 1))} 
            delta="+5.2%" 
            trend="up"
            icon={<Wallet className="size-5" />}
            color="blue"
          />
        </div>

        {/* Secondary KPI Strip (Mini) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <MiniKPICard label="CONTRATOS ABERTOS" value={stats?.contracts.open || 0} color="blue" />
          <MiniKPICard label="DOCS PENDENTES" value={stats?.documents.pending || 0} color="amber" />
          <MiniKPICard label="TAREFAS EM ATRASO" value={stats?.tasks.overdue || 0} color="rose" />
          <MiniKPICard label="COMISSÕES PAGAR" value={formatBRL(stats?.commissions.pending || 0)} color="emerald" />
          <MiniKPICard label="TOTAL CLIENTES" value={stats?.clients.total || 0} color="slate" />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8 cp-panel p-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-base font-bold tracking-tight">Performance Financeira</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Fluxo de receita e ticket médio mensal</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-indigo-500" />
                <span className="text-[10px] font-bold text-muted-foreground">RECEITA REAL</span>
              </div>
            </div>
            <div className="h-[300px] w-full bg-muted/30 rounded-xl flex items-end justify-around p-6 gap-2 border border-border/40">
               {[40, 65, 45, 90, 55, 80, 70, 85, 60, 95, 75, 100].map((h, i) => (
                 <div key={i} className="flex-1 space-y-2 group">
                   <div className="relative w-full bg-primary/10 rounded-t-lg transition-all group-hover:bg-primary/20" style={{ height: `${h}%` }}>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        R${h}k
                      </div>
                   </div>
                   <p className="text-[9px] text-center font-bold text-muted-foreground/60">{['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</p>
                 </div>
               ))}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 cp-panel p-6">
            <h3 className="text-base font-bold tracking-tight mb-6">Origem dos Clientes</h3>
            <div className="space-y-5">
              <SourceItem label="Instagram" value={45} color="bg-pink-500" />
              <SourceItem label="Indicação de Parceiro" value={30} color="bg-indigo-500" />
              <SourceItem label="WhatsApp" value={15} color="bg-emerald-500" />
              <SourceItem label="Orgânico / Site" value={10} color="bg-slate-400" />
            </div>
            <div className="mt-8 pt-6 border-t border-border/40">
               <p className="text-[11px] text-muted-foreground leading-relaxed">
                 O tráfego vindo de <strong>redes sociais</strong> continua sendo o maior canal de aquisição deste trimestre.
               </p>
            </div>
          </div>
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
                    <h3 className="text-base font-bold tracking-tight">Histórico de Auditoria</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Últimas ações realizadas no sistema</p>
                  </div>
                </div>
                <button className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors">Ver Auditoria</button>
              </div>

              <div className="space-y-6">
                {stats?.recentActivities.length ? stats.recentActivities.map((activity) => (
                  <ActivityItem 
                    key={activity.id}
                    title={activity.title} 
                    desc={activity.desc} 
                    time={activity.time} 
                    icon={<Clock className="size-4 text-slate-500" />}
                  />
                )) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma atividade recente encontrada.</div>
                )}
              </div>
            </div>

            {/* Bottom Highlight Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Revenue Card */}
              <div className="bg-[#0f172a] rounded-2xl p-6 text-white relative overflow-hidden group border border-white/5">
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-4">RECEITA PREVISTA</p>
                    <h4 className="text-2xl font-bold tracking-tight mb-2">{formatBRL(stats?.financial.total || 0)}</h4>
                    <p className="text-xs text-white/40 font-medium">{formatBRL(stats?.financial.pending || 0)} ainda pendente</p>
                  </div>
                  <div className="mt-8 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-[11px] font-bold text-white/60">SAÚDE FINANCEIRA OK</span>
                    </div>
                  </div>
                </div>
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                  <Target className="size-32" />
                </div>
              </div>

              {/* Conversion Card */}
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white relative overflow-hidden group shadow-xl shadow-indigo-500/20">
                <div className="relative z-10">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-4">PERFORMANCE DE LEADS</p>
                  <h4 className="text-2xl font-bold tracking-tight mb-2">{stats?.leads.converted} de {stats?.leads.total} Leads</h4>
                  <p className="text-xs text-white/60 font-medium">Taxa de conversão em {Math.round((stats?.leads.conversionRate || 0) * 100)}%</p>
                  
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

          {/* Right Column: Status Summary */}
          <div className="col-span-12 lg:col-span-4 space-y-8">
            <div className="cp-panel p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="size-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                  <FileUp className="size-4 text-amber-600" />
                </div>
                <h3 className="text-sm font-bold tracking-tight">Status de Operação</h3>
              </div>

              <div className="space-y-4">
                <StatusItem label="Documentos em Análise" value={stats?.documents.analysis || 0} color="amber" />
                <StatusItem label="Aguardando Assinatura" value={stats?.contracts.pending || 0} color="blue" />
                <StatusItem label="Tarefas Abertas" value={stats?.tasks.open || 0} color="slate" isDark />
              </div>
            </div>

            <div className="cp-panel p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold tracking-tight">Vendas por Status</h3>
                <MoreHorizontal className="size-4 text-muted-foreground" />
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Contratos Assinados</span>
                  <span className="text-xs font-bold">{stats?.contracts.signed}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${(stats?.contracts.signed || 0) / (stats?.contracts.total || 1) * 100}%` }} />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Leads em Negociação</span>
                  <span className="text-xs font-bold">{stats?.leads.total - stats?.leads.converted}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${(stats?.leads.total - stats?.leads.converted) / (stats?.leads.total || 1) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* --- Components --- */

function KPICard({ label, value, delta, trend, icon, color }: any) {
  const gradients: any = {
    indigo: "from-indigo-500/10 to-transparent",
    emerald: "from-emerald-500/10 to-transparent",
    amber: "from-amber-500/10 to-transparent",
    blue: "from-blue-500/10 to-transparent",
  };
  
  const iconColors: any = {
    indigo: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10",
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10",
    blue: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10",
  };

  return (
    <div className={cn("vx-card-premium p-6 group cursor-pointer hover:border-primary/20", gradients[color])}>
      <div className="flex items-center justify-between mb-5">
        <div className={cn("size-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg", iconColors[color])}>
          {icon}
        </div>
        <div className={cn("cp-pill", trend === "up" ? "cp-pill-success" : "cp-pill-danger")}>
          <ArrowUpRight className={cn("size-3 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5")} />
          {delta}
        </div>
      </div>
      <p className="vx-kpi-label">{label}</p>
      <div className="flex items-baseline gap-2 mt-2">
        <h4 className="vx-kpi-value">{value}</h4>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="flex-1 h-1 bg-muted/30 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-1000 w-[65%]", {
            "bg-indigo-500": color === "indigo",
            "bg-emerald-500": color === "emerald",
            "bg-amber-500": color === "amber",
            "bg-blue-500": color === "blue",
          })} />
        </div>
        <span className="text-[10px] font-bold text-muted-foreground/40">65%</span>
      </div>
    </div>
  );
}


function MiniKPICard({ label, value, color }: any) {
  const colorMap: any = {
    blue: "text-blue-600 border-blue-100 bg-blue-50/30",
    emerald: "text-emerald-600 border-emerald-100 bg-emerald-50/30",
    amber: "text-amber-600 border-amber-100 bg-amber-50/30",
    rose: "text-rose-600 border-rose-100 bg-rose-50/30",
    slate: "text-slate-600 border-slate-100 bg-slate-50/30",
  };
  return (
    <div className={cn("border rounded-xl p-4 flex flex-col justify-between transition-colors", colorMap[color] || colorMap.slate)}>
      <p className="text-[9px] font-extrabold tracking-[0.15em] mb-1">{label}</p>
      <p className="text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function SourceItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-tight">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground">{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
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
          <h4 className="text-sm font-bold tracking-tight text-foreground truncate">{title}</h4>
          <span className="text-[11px] font-mono text-muted-foreground">{time}</span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{desc}</p>
      </div>
    </div>
  );
}

function StatusItem({ label, value, color, isDark }: any) {
  const colors: any = {
    rose: "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20",
    amber: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20",
    blue: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20",
    slate: "bg-slate-900 text-white border-slate-800",
  };
  
  return (
    <div className={cn("flex items-center justify-between p-4 rounded-xl border transition-all", colors[color])}>
      <span className="text-xs font-bold tracking-tight">{label}</span>
      <span className="text-lg font-bold tabular-nums">{value}</span>
    </div>
  );
}
