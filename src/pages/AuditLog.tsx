import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { History, Search, Filter, ShieldCheck, User, Calendar, ArrowRight, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";

export default function AuditLog() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select(`
          *,
          profiles(full_name, email)
        `)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const filteredLogs = useMemo(() => {
    return logs.filter((log: any) => {
      if (typeFilter !== "all" && log.entity_type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          log.action.toLowerCase().includes(q) ||
          log.entity_type.toLowerCase().includes(q) ||
          log.profiles?.full_name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, search, typeFilter]);

  return (
    <div className="page-shell space-y-7 animate-fade-in">
      <header className="flex items-end justify-between gap-4 flex-wrap pb-2">
        <div className="min-w-0 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <ShieldCheck className="size-3 text-primary" />
            Segurança e Conformidade
          </div>
          <h1 className="font-display text-[34px] sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.02] text-foreground">
            Histórico / Auditoria
          </h1>
          <p className="text-sm text-muted-foreground">Rastreie todas as ações, alterações e acessos realizados no sistema.</p>
        </div>

        <div className="flex items-center gap-2 bg-card border border-border p-1 rounded-xl">
           <Button variant="ghost" size="sm" onClick={() => setTypeFilter("all")} className={typeFilter === "all" ? "bg-muted" : ""}>Geral</Button>
           <Button variant="ghost" size="sm" onClick={() => setTypeFilter("login")} className={typeFilter === "login" ? "bg-muted" : ""}>Acessos</Button>
           <Button variant="ghost" size="sm" onClick={() => setTypeFilter("client")} className={typeFilter === "client" ? "bg-muted" : ""}>Clientes</Button>
           <Button variant="ghost" size="sm" onClick={() => setTypeFilter("finance")} className={typeFilter === "finance" ? "bg-muted" : ""}>Financeiro</Button>
        </div>
      </header>

      <div className="vx-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              className="pl-10 h-10 text-sm" 
              placeholder="Buscar por usuário, ação ou entidade..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" className="h-10 text-xs font-bold px-4 gap-2">
              <Calendar className="size-3.5 text-muted-foreground" />
              Período
            </Button>
          </div>
        </div>
      </div>

      <div className="vx-card overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Linha do Tempo de Atividades</h3>
        </div>
        <div className="p-0">
          {isLoading ? (
             <div className="p-10 text-center text-muted-foreground">Carregando histórico...</div>
          ) : filteredLogs.length === 0 ? (
             <div className="p-10 text-center text-muted-foreground">Nenhuma atividade registrada no período.</div>
          ) : (
            filteredLogs.map((log: any, i: number) => (
              <div key={log.id} className="flex items-start gap-4 p-5 border-b last:border-0 border-border/40 hover:bg-muted/20 transition-colors group">
                <div className="mt-1 size-9 rounded-full bg-slate-50 dark:bg-slate-900 border border-border flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                  <History className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold">
                      <span className="text-primary">{log.profiles?.full_name || "Sistema"}</span> {log.action.toLowerCase()}
                    </p>
                    <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[9px] h-4 px-1 uppercase tracking-tighter bg-muted/50">
                      {log.entity_type}
                    </Badge>
                    {log.entity_id && (
                      <span className="text-[10px] text-muted-foreground font-mono">ID: {log.entity_id.slice(0, 8)}</span>
                    )}
                  </div>
                  {log.old_value || log.new_value ? (
                    <div className="mt-2 p-2 bg-muted/30 rounded text-xs space-y-1">
                       {log.old_value && (
                         <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Anterior:</span>
                            <span className="line-through opacity-60 italic">{JSON.stringify(log.old_value)}</span>
                         </div>
                       )}
                       {log.new_value && (
                         <div className="flex items-center gap-2">
                            <span className="text-muted-foreground font-bold">Novo:</span>
                            <span className="text-foreground">{JSON.stringify(log.new_value)}</span>
                         </div>
                       )}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
