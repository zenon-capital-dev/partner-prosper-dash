import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  Handshake,
  DollarSign,
  Wallet,
  ArrowUpRight,
  TrendingUp,
  Calendar as CalendarIcon,
  Clock,
  CalendarDays,
  FileSignature,
  FileUp,
  FolderKanban,
  UserPlus,
  Coins,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ClipboardList,
  Activity,
  UserCheck,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import ClientPanel from "./ClientPanel";
import PartnerPanel from "./PartnerPanel";

const C = {
  primary: "hsl(var(--primary))",
  success: "hsl(var(--success))",
  info: "hsl(var(--info))",
  warning: "hsl(var(--warning))",
  destructive: "hsl(var(--destructive))",
};

type RangeKey = "today" | "7d" | "30d" | "month";

function makeRange(key: RangeKey): { from: Date; to: Date; label: string } {
  const now = new Date();
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const endOfDay   = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };

  switch (key) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now), label: "Hoje" };
    case "7d": {
      const f = new Date(now); f.setDate(f.getDate() - 6);
      return { from: startOfDay(f), to: endOfDay(now), label: "Últimos 7 dias" };
    }
    case "30d": {
      const f = new Date(now); f.setDate(f.getDate() - 29);
      return { from: startOfDay(f), to: endOfDay(now), label: "Últimos 30 dias" };
    }
    case "month":
    default: {
      const f = new Date(now.getFullYear(), now.getMonth(), 1);
      const t = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { from: f, to: t, label: format(now, "MMMM 'de' yyyy", { locale: ptBR }) };
    }
  }
}

export default function Dashboard() {
  const { user, roles } = useAuth();
  const [rangeKey, setRangeKey] = useState<RangeKey>("month");
  const range = useMemo(() => makeRange(rangeKey), [rangeKey]);

  const fromDate = range.from.toISOString().slice(0, 10);
  const toDate = range.to.toISOString().slice(0, 10);

  const { data: sales = [] } = useQuery({
    queryKey: ["dash-sales", fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("amount, sale_date, status")
        .gte("sale_date", fromDate)
        .lte("sale_date", toDate);
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["dash-clients", range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, created_at")
        .gte("created_at", range.from.toISOString())
        .lte("created_at", range.to.toISOString());
      return data ?? [];
    },
  });

  const { data: partnersCount = 0 } = useQuery({
    queryKey: ["dash-partners-count"],
    queryFn: async () => {
      const { count } = await supabase.from("partners").select("id", { count: "exact", head: true }).eq("active", true);
      return count ?? 0;
    },
  });

  const { data: pendingDocsCount = 0 } = useQuery({
    queryKey: ["dash-pending-docs"],
    queryFn: async () => {
      const { count } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .in("status", ["enviado", "em_analise"]);
      return count ?? 0;
    },
  });

  const { data: pendingTasksCount = 0 } = useQuery({
    queryKey: ["dash-pending-tasks"],
    queryFn: async () => {
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .in("status", ["Aberta", "Em andamento", "Atrasada"]);
      return count ?? 0;
    },
  });

  const totalRevenue = sales.reduce((s, x: any) => s + Number(x.amount), 0);
  const contractsClosed = sales.filter((s: any) => s.status === "concluida").length;
  const contractsPending = sales.filter((s: any) => s.status === "pendente").length;
  const contractsActive = sales.filter((s: any) => s.status === "em_andamento").length;

  const kpis = [
    { label: "Faturamento", value: formatBRL(totalRevenue), icon: DollarSign, tone: "bg-primary/10 text-primary" },
    { label: "Novos Clientes", value: String(clients.length), icon: Users, tone: "bg-emerald-500/10 text-emerald-500" },
    { label: "Parceiros Ativos", value: String(partnersCount), icon: Handshake, tone: "bg-amber-500/10 text-amber-500" },
    { label: "Ticket Médio", value: formatBRL(sales.length ? totalRevenue / sales.length : 0), icon: Wallet, tone: "bg-blue-500/10 text-blue-500" },
  ];

  const presets: { key: RangeKey; label: string; icon: any }[] = [
    { key: "today", label: "Hoje", icon: Clock },
    { key: "7d", label: "7 dias", icon: TrendingUp },
    { key: "30d", label: "30 dias", icon: CalendarDays },
    { key: "month", label: "Mês", icon: CalendarIcon },
  ];

  if (roles.includes("cliente")) return <ClientPanel />;
  if (roles.includes("parceiro")) return <PartnerPanel />;

  return (
    <div className="page-shell space-y-10 animate-fade-up">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
            Sistema de Inteligência Prosper
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-[1.1]">
            {(() => {
              const h = new Date().getHours();
              const greeting = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
              const name = (user?.user_metadata?.full_name as string)?.split(" ")[0] ?? "Gestor";
              return `${greeting}, ${name}`;
            })()}
          </h1>
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5 opacity-60" /> {range.label}</span>
            <div className="size-1 rounded-full bg-border" />
            <span className="flex items-center gap-1.5"><Activity className="size-3.5 text-success" /> Operação Online</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-card/40 p-1.5 rounded-2xl border border-border/40 backdrop-blur-sm self-start lg:self-end">
          {presets.map((p) => (
            <button
              key={p.key}
              onClick={() => setRangeKey(p.key)}
              className={cn(
                "h-9 px-4 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                rangeKey === p.key 
                  ? "bg-foreground text-background shadow-lg" 
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <p.icon className="size-3.5" />
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((k) => (
          <div key={k.label} className="vx-card p-6 lg:p-7 vx-card-hover group">
            <div className="flex items-center justify-between mb-6">
              <div className={cn("size-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 group-hover:rotate-3", k.tone)}>
                <k.icon className="size-5" />
              </div>
              <div className="text-[11px] font-bold text-success flex items-center gap-1 bg-success/5 px-2 py-1 rounded-lg">
                <ArrowUpRight className="size-3" />
                12.5%
              </div>
            </div>
            <div className="space-y-1">
              <p className="vx-kpi-label">{k.label}</p>
              <h3 className="vx-kpi-value">{k.value}</h3>
            </div>
            <div className="mt-4 h-1 w-full bg-muted/30 rounded-full overflow-hidden">
              <div className="h-full bg-primary/40 w-[70%] group-hover:w-[85%] transition-all duration-700" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="vx-card p-4 bg-blue-50/50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/50">
          <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Contratos Abertos</p>
          <p className="text-2xl font-bold mt-1">{contractsActive}</p>
        </div>
        <div className="vx-card p-4 bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/50">
          <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Contratos Fechados</p>
          <p className="text-2xl font-bold mt-1">{contractsClosed}</p>
        </div>
        <div className="vx-card p-4 bg-amber-50/50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/50">
          <p className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Contratos Pendentes</p>
          <p className="text-2xl font-bold mt-1">{contractsPending}</p>
        </div>
        <div className="vx-card p-4 bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800">
          <p className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Clientes no Período</p>
          <p className="text-2xl font-bold mt-1">{clients.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="vx-card overflow-hidden">
            <div className="p-6 border-b border-border/50 bg-muted/20 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold flex items-center gap-2">
                  <Activity className="size-5 text-primary" />
                  Atividades Recentes
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Acompanhamento operacional em tempo real</p>
              </div>
              <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold uppercase tracking-wider">
                Ver Todas
              </Button>
            </div>
            <div className="p-0">
              {[
                { type: 'sale', title: 'Novo contrato fechado', user: 'Douglas Santos', time: '14:20', detail: 'Gestão Financeira - R$ 12.500,00' },
                { type: 'doc', title: 'Documentos recebidos', user: 'Ana Paula (Cliente)', time: '11:05', detail: 'Regularização Imobiliária' },
                { type: 'partner', title: 'Nova indicação de parceiro', user: 'Consultoria ABC', time: 'Ontem', detail: 'Lead: Marcos Oliveira' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors border-b last:border-0 border-border/40 group">
                  <div className="mt-1 size-8 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    {item.type === 'sale' ? <FileSignature className="size-4" /> : item.type === 'doc' ? <FileUp className="size-4" /> : <UserPlus className="size-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold truncate">{item.title}</p>
                      <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">{item.time}</span>
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                      <span className="font-semibold text-foreground">{item.user}</span> • {item.detail}
                    </p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white">
            <div className="rounded-3xl p-6 bg-slate-950 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                 <Coins className="size-24" />
               </div>
               <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Meta de Faturamento</p>
               <div className="mt-4 space-y-3">
                 <div className="flex items-end justify-between">
                   <h4 className="text-2xl font-bold">R$ 842.000</h4>
                   <span className="text-xs font-medium text-emerald-400">84%</span>
                 </div>
                 <Progress value={84} className="h-2 bg-white/10" />
                 <p className="text-[11px] text-slate-500">Faltam R$ 158.000 para a meta do mês</p>
               </div>
            </div>

            <div className="rounded-3xl p-6 bg-primary relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform">
                 <Users className="size-24" />
               </div>
               <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground/70">Performance de Leads</p>
               <div className="mt-4 space-y-3">
                 <div className="flex items-end justify-between">
                   <h4 className="text-2xl font-bold">128 Leads</h4>
                   <span className="text-xs font-medium text-primary-foreground">+12%</span>
                 </div>
                 <div className="flex gap-1 h-2">
                   <div className="flex-1 bg-white/40 rounded-full" />
                   <div className="flex-1 bg-white/20 rounded-full" />
                   <div className="flex-1 bg-white/10 rounded-full" />
                 </div>
                 <p className="text-[11px] text-primary-foreground/60">Conversão de 18.5% este mês</p>
               </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="vx-card p-6">
            <h3 className="font-display text-lg font-bold flex items-center gap-2 mb-6">
              <ClipboardList className="size-5 text-amber-500" />
              Pendências Críticas
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Tarefas em Atraso/Pendentes', count: pendingTasksCount, tone: 'bg-destructive/10 text-destructive border-destructive/20' },
                { label: 'Documentos para Análise', count: pendingDocsCount, tone: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
                { label: 'Contas a Pagar (Hoje)', count: 2, tone: 'bg-slate-900 text-white border-slate-800 dark:bg-slate-800' },
              ].map((p, i) => (
                <div key={i} className={cn("flex items-center justify-between p-4 rounded-2xl border transition-all hover:scale-[1.02]", p.tone)}>
                  <span className="text-sm font-bold">{p.label}</span>
                  <span className="text-xl font-black">{p.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="vx-card p-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
            <h3 className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6">Controle de Equipe</h3>
            <div className="space-y-4">
              {[
                { name: 'Ricardo Melo', role: 'Colaborador', status: 'online' },
                { name: 'Juliana Costa', role: 'Vendedor', status: 'busy' },
                { name: 'Marcos Silva', role: 'Prestador', status: 'offline' },
              ].map((member, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="relative size-10 shrink-0">
                    <div className="size-full rounded-full bg-muted border border-border flex items-center justify-center font-bold text-xs">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className={cn(
                      "absolute bottom-0 right-0 size-3 rounded-full border-2 border-card",
                      member.status === 'online' ? 'bg-success' : member.status === 'busy' ? 'bg-amber-500' : 'bg-slate-300'
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{member.name}</p>
                    <p className="text-[11px] text-muted-foreground">{member.role}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="size-8 rounded-full">
                    <Activity className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" className="w-full mt-2 h-9 text-xs font-bold border-dashed">
                Gerenciar Equipe
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
