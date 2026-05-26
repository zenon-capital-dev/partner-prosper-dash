import { formatBR as format } from "@/lib/datetime";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
;
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import {
  Zap, Clock, AlertTriangle, PauseCircle, CheckCircle2, User, Calendar,
  ChevronRight, Search, ListFilter, TrendingDown, Timer, CalendarOff, ArrowUpRight, X,
} from "lucide-react";
import { calculateSLA } from "@/lib/sla";
import { AutoStatusBadge } from "@/components/StatusBadge";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Bucket = "todos" | "atrasado" | "vence_hoje" | "atencao" | "no_prazo" | "pausado" | "sem_prazo";

const BUCKETS: { key: Bucket; label: string; icon: any; tone: string }[] = [
  { key: "todos", label: "Todas", icon: ListFilter, tone: "text-slate-600" },
  { key: "atrasado", label: "Atrasadas", icon: AlertTriangle, tone: "text-rose-600" },
  { key: "vence_hoje", label: "Vencem Hoje", icon: Clock, tone: "text-amber-600" },
  { key: "atencao", label: "Em Atenção", icon: Zap, tone: "text-yellow-600" },
  { key: "no_prazo", label: "No Prazo", icon: CheckCircle2, tone: "text-emerald-600" },
  { key: "pausado", label: "Pausadas", icon: PauseCircle, tone: "text-slate-500" },
  { key: "sem_prazo", label: "Sem Prazo", icon: CalendarOff, tone: "text-slate-500" },
];

const isNoDueDate = (d: any) =>
  d.sla?.daysRemaining == null && d.sla?.status !== "pausado" && d.sla?.status !== "concluido";

export default function SLAPages() {
  const navigate = useNavigate();
  const [bucket, setBucket] = useState<Bucket>("todos");
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<string | null>(null);

  const { data: demands = [], isLoading } = useQuery({
    queryKey: ["admin-sla-demands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_products")
        .select(`
          *,
          clients(full_name, company),
          products(name, default_sla_days, sla_day_type),
          service_providers:service_provider_id(name)
        `)
        .neq("status", "concluido")
        .order("sla_due_date", { ascending: true });

      if (error) throw error;

      return (data || []).map((d) => {
        const sla = calculateSLA(
          d.sla_start_date || d.created_at,
          d.sla_due_date,
          d.status,
          (d.products as any)?.sla_day_type || "working"
        );
        return { ...d, sla };
      });
    },
  });

  const stats = useMemo(() => ({
    total: demands.length,
    atrasado: demands.filter((d) => d.sla?.status === "atrasado").length,
    vence_hoje: demands.filter((d) => d.sla?.status === "vence_hoje").length,
    atencao: demands.filter((d) => d.sla?.status === "atencao").length,
    no_prazo: demands.filter((d) => d.sla?.status === "no_prazo").length,
    pausado: demands.filter((d) => d.status === "pausado").length,
    sem_prazo: demands.filter(isNoDueDate).length,
  }), [demands]);

  const onTimeRate = stats.total > 0 ? Math.round(((stats.no_prazo + stats.atencao) / stats.total) * 100) : 0;
  const avgDaysOver = useMemo(() => {
    const late = demands.filter((d) => d.sla?.status === "atrasado" && d.sla?.daysRemaining != null);
    if (!late.length) return 0;
    const avg = Math.abs(Math.round(late.reduce((s, d) => s + (d.sla?.daysRemaining ?? 0), 0) / late.length));
    return Math.max(1, avg);
  }, [demands]);

  const filtered = useMemo(() => {
    let list = demands;
    if (bucket === "pausado") list = list.filter((d) => d.status === "pausado");
    else if (bucket === "sem_prazo") list = list.filter(isNoDueDate);
    else if (bucket !== "todos") list = list.filter((d) => d.sla?.status === bucket);

    if (providerFilter) {
      list = list.filter((d: any) => d.service_providers?.name === providerFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d: any) =>
        d.clients?.full_name?.toLowerCase().includes(q) ||
        d.clients?.company?.toLowerCase().includes(q) ||
        d.products?.name?.toLowerCase().includes(q) ||
        d.service_providers?.name?.toLowerCase().includes(q)
      );
    }

    // Ordenação por urgência: atrasados primeiro, sem prazo no fim
    return [...list].sort((a: any, b: any) => {
      const da = a.sla?.daysRemaining;
      const db = b.sla?.daysRemaining;
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
  }, [demands, bucket, search, providerFilter]);

  const providersWithDelays = useMemo(() => {
    const map: Record<string, number> = {};
    demands.forEach((d: any) => {
      if (d.sla?.status === "atrasado" && d.service_providers?.name) {
        map[d.service_providers.name] = (map[d.service_providers.name] || 0) + 1;
      }
    });
    return Object.entries(map).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 5);
  }, [demands]);

  const clearFilters = () => {
    setBucket("todos");
    setProviderFilter(null);
    setSearch("");
  };

  return (
    <div className="page-shell space-y-8 animate-fade-up">
      <PageHero
        eyebrow="Operations"
        category="Prazos"
        title="Controle de Prazos"
        description="Visualize, filtre e priorize todas as demandas pelo status do SLA."
        icon={<Zap className="size-6 text-primary fill-primary/20" />}
        kpis={[
          {
            label: "On-Time Rate",
            value: `${onTimeRate}%`,
            tone: onTimeRate >= 80 ? "success" : onTimeRate >= 60 ? "warning" : "danger",
            icon: <TrendingDown className="size-4" />,
            onClick: () => setBucket("no_prazo"),
          },
          {
            label: "Atrasadas",
            value: stats.atrasado,
            tone: "danger",
            icon: <AlertTriangle className="size-4" />,
            onClick: () => setBucket("atrasado"),
          },
          {
            label: "Vence Hoje",
            value: stats.vence_hoje,
            tone: "warning",
            icon: <Clock className="size-4" />,
            onClick: () => setBucket("vence_hoje"),
          },
          {
            label: "Atraso Médio",
            value: `${avgDaysOver}d`,
            tone: "default" as any,
            icon: <Timer className="size-4" />,
          },
        ]}
      />

      {/* Filtros — abas por status do SLA */}
      <div className="vx-card p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {BUCKETS.map((b) => {
            const count = b.key === "todos" ? stats.total : (stats as any)[b.key];
            const active = bucket === b.key;
            return (
              <button
                key={b.key}
                onClick={() => setBucket(b.key)}
                className={cn(
                  "h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all",
                  active
                    ? "bg-foreground text-background border-foreground shadow-sm"
                    : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
                )}
              >
                <b.icon className={cn("size-3.5", !active && b.tone)} />
                {b.label}
                <span className={cn("ml-1 px-1.5 rounded-md text-[10px] tabular-nums", active ? "bg-background/20" : "bg-background/60 text-foreground")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, empresa, produto ou prestador..."
            className="pl-10 h-11 bg-muted/20 border-border/50"
          />
        </div>
        {(providerFilter || bucket !== "todos" || search) && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Filtros ativos:</span>
            {bucket !== "todos" && (
              <Badge variant="outline" className="gap-1">
                {BUCKETS.find(b => b.key === bucket)?.label}
                <button onClick={() => setBucket("todos")}><X className="size-3" /></button>
              </Badge>
            )}
            {providerFilter && (
              <Badge variant="outline" className="gap-1">
                Prestador: {providerFilter}
                <button onClick={() => setProviderFilter(null)}><X className="size-3" /></button>
              </Badge>
            )}
            {search && (
              <Badge variant="outline" className="gap-1">
                "{search}"
                <button onClick={() => setSearch("")}><X className="size-3" /></button>
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={clearFilters}>Limpar tudo</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lista principal */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "demanda" : "demandas"}
            </h3>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="vx-card p-12 text-center border-dashed border-2">
              <CheckCircle2 className="size-10 text-emerald-500/40 mx-auto mb-3" />
              {demands.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-muted-foreground mb-4">
                    Nenhuma demanda ativa no momento.
                  </p>
                  <Button onClick={() => navigate("/demandas")} variant="outline">
                    Ir para Demandas
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-muted-foreground mb-4">
                    Nenhuma demanda neste filtro.
                  </p>
                  <Button onClick={clearFilters} variant="outline">Ver todas</Button>
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((d: any) => {
                const isLate = d.sla?.status === "atrasado";
                const isToday = d.sla?.status === "vence_hoje";
                const isPaused = d.status === "pausado";
                const noDue = isNoDueDate(d);
                return (
                  <div
                    key={d.id}
                    onClick={() => navigate(`/demandas/${d.id}`)}
                    className={cn(
                      "vx-card p-5 group cursor-pointer hover:border-primary/30 transition-all border-l-4",
                      isLate && "border-l-rose-500 bg-rose-500/[0.02]",
                      isToday && !isLate && "border-l-amber-500 bg-amber-500/[0.02]",
                      d.sla?.status === "atencao" && "border-l-yellow-500",
                      d.sla?.status === "no_prazo" && "border-l-emerald-500",
                      isPaused && "border-l-slate-400 opacity-80",
                      noDue && "border-l-slate-300",
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                            {d.products?.name}
                          </span>
                          {!noDue && <AutoStatusBadge status={d.sla?.status} className="h-5" />}
                          {isPaused && <Badge variant="outline" className="h-5 text-[9px]">Pausada</Badge>}
                          {noDue && (
                            <Badge variant="outline" className="h-5 text-[9px] gap-1">
                              <CalendarOff className="size-3" /> Sem prazo definido
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {d.clients?.full_name}
                          {d.clients?.company && (
                            <span className="text-muted-foreground font-medium"> · {d.clients.company}</span>
                          )}
                        </h4>
                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                            <User className="size-3" />
                            {d.service_providers?.name || "Não atribuído"}
                          </span>
                          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                            <Calendar className="size-3" />
                            {d.sla?.dueDate ? format(d.sla.dueDate, "dd/MM/yyyy") : "Sem prazo"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div
                            className={cn(
                              "text-2xl font-display font-black tracking-tight tabular-nums",
                              isLate ? "text-rose-500" :
                                isToday ? "text-amber-500" :
                                d.sla?.status === "atencao" ? "text-yellow-600" :
                                noDue ? "text-slate-400" : "text-emerald-600"
                            )}
                          >
                            {d.sla?.daysRemaining != null
                              ? d.sla.daysRemaining < 0
                                ? d.sla.daysRemaining
                                : `+${d.sla.daysRemaining}`
                              : "—"}
                          </div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            dias
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="opacity-0 group-hover:opacity-100 md:opacity-0 sm:opacity-100 transition-opacity gap-1"
                          onClick={(e) => { e.stopPropagation(); navigate(`/demandas/${d.id}`); }}
                        >
                          Abrir <ArrowUpRight className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar — ranking + dicas */}
        <div className="space-y-6">
          <section className="vx-card p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <AlertTriangle className="size-24 rotate-12" />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-6 flex items-center gap-2">
              <AlertTriangle className="size-3.5 text-rose-500" />
              Prestadores com Mais Atrasos
            </h3>

            <div className="space-y-2">
              {providersWithDelays.length > 0 ? (
                providersWithDelays.map(([name, count]) => {
                  const active = providerFilter === name;
                  return (
                    <button
                      key={name}
                      onClick={() => setProviderFilter(active ? null : (name as string))}
                      className={cn(
                        "w-full flex items-center justify-between px-2 py-2 rounded-lg border transition-all text-left",
                        active
                          ? "bg-rose-50 border-rose-200"
                          : "bg-transparent border-transparent hover:bg-slate-50 hover:border-slate-200"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-700 shrink-0">
                          {(name as string).charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-slate-700 truncate">{name}</span>
                      </div>
                      <Badge className="bg-rose-50 text-rose-600 border border-rose-200 font-black tabular-nums shrink-0">
                        {count as number}
                      </Badge>
                    </button>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground italic">Nenhum atraso por prestador.</p>
              )}
            </div>
          </section>

          <section className="vx-card p-6 border-dashed border-2 bg-muted/30">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-4">
              Como o SLA é calculado
            </h3>
            <ul className="space-y-3">
              {[
                "O contador inicia na data de início da demanda (ou na criação, se vazia).",
                "Demandas pausadas congelam a contagem do SLA.",
                "Status 'Em atenção' aparece quando faltam 2 dias ou menos para o prazo.",
                "Produtos podem usar dias úteis ou corridos — configurável em cada produto.",
              ].map((text, i) => (
                <li key={i} className="flex gap-2 text-[11px] font-medium text-muted-foreground">
                  <ChevronRight className="size-3 text-primary shrink-0 mt-0.5" />
                  {text}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
