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
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  const { user } = useAuth();
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

  return (
    <div className="page-shell space-y-7">
      <header className="flex items-end justify-between gap-4 flex-wrap pb-2">
        <div className="min-w-0 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <span className="vx-live-dot" />
            Painel administrativo
          </div>
          <h1 className="font-display text-[34px] sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.02] text-foreground">
            {(() => {
              const h = new Date().getHours();
              const greeting = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
              const name = (user?.user_metadata?.full_name as string)?.split(" ")[0] ?? "";
              return name ? `${greeting}, ${name}` : greeting;
            })()}
          </h1>
          <div className="flex items-center gap-2.5 text-[12px] text-muted-foreground">
            <CalendarDays className="size-3.5 text-primary" />
            {range.label}
          </div>
        </div>

        <div className="flex items-center gap-2 bg-card/50 p-1 rounded-xl border border-border/50">
          {presets.map((p) => (
            <button
              key={p.key}
              onClick={() => setRangeKey(p.key)}
              className={cn(
                "h-8 px-3 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
                rangeKey === p.key ? "bg-slate-900 text-white shadow-lg" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <p.icon className="size-3" />
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="vx-card p-5 group hover:border-primary/20 transition-all">
            <div className={cn("p-2 w-fit rounded-xl", k.tone)}>
              <k.icon className="size-5" />
            </div>
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">{k.label}</p>
              <h3 className="text-2xl font-bold mt-1 tracking-tight">{k.value}</h3>
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
        <div className="lg:col-span-2 vx-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-lg font-bold">Atividades Recentes</h3>
            <Button variant="ghost" size="sm" className="text-xs">Ver todas</Button>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center py-8">Acompanhe aqui as movimentações do sistema em tempo real.</p>
          </div>
        </div>
        
        <div className="vx-card p-6">
          <h3 className="font-display text-lg font-bold mb-6">Pendências</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/5 border border-destructive/10">
              <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
                <Clock className="size-4" />
              </div>
              <div>
                <p className="text-sm font-bold">Aguardando Documentos</p>
                <p className="text-[11px] text-muted-foreground">3 solicitações pendentes</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
