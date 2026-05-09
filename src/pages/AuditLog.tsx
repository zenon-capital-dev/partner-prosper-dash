import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { 
  History, 
  Search, 
  Filter, 
  ShieldCheck, 
  User as UserIcon, 
  Calendar as CalendarIcon, 
  ArrowRight, 
  Eye, 
  ChevronDown,
  Info,
  Database,
  Activity,
  Download,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AuditLog() {
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<any>(null);

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
        .limit(1000);
      return data ?? [];
    },
  });

  const exportToCSV = () => {
    const headers = ["ID", "Usuario", "Acao", "Entidade", "Data"];
    const rows = filteredLogs.map((log: any) => [
      log.id,
      log.profiles?.full_name || "Sistema",
      log.action,
      log.entity_type,
      format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")
    ]);
    
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_logs_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const { data: users = [] } = useQuery({
    queryKey: ["audit-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      return data ?? [];
    },
  });

  const entities = useMemo(() => {
    const set = new Set(logs.map((l: any) => l.entity_type));
    return ["all", ...Array.from(set)];
  }, [logs]);

  const actions = useMemo(() => {
    const set = new Set(logs.map((l: any) => l.action));
    return ["all", ...Array.from(set)];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log: any) => {
      if (entityFilter !== "all" && log.entity_type !== entityFilter) return false;
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      
      if (search) {
        const q = search.toLowerCase();
        return (
          log.action.toLowerCase().includes(q) ||
          log.entity_type.toLowerCase().includes(q) ||
          log.profiles?.full_name?.toLowerCase().includes(q) ||
          log.profiles?.email?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, search, entityFilter, actionFilter]);

  const formatValue = (val: any) => {
    if (val === null || val === undefined) return <span className="text-muted-foreground italic">null</span>;
    if (typeof val === 'object') return <pre className="text-[10px] bg-muted p-1 rounded overflow-auto max-h-32">{JSON.stringify(val, null, 2)}</pre>;
    return String(val);
  };

  return (
    <div className="page-shell space-y-7 animate-fade-in">
      <header className="flex items-end justify-between gap-4 flex-wrap pb-2">
        <div className="min-w-0 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <ShieldCheck className="size-3 text-primary" />
            Governança e Transparência
          </div>
          <h1 className="font-display text-[34px] sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.02] text-foreground">
            Logs e Auditoria
          </h1>
          <p className="text-sm text-muted-foreground">Monitoramento detalhado de todas as alterações críticas na base de dados.</p>
        </div>
      </header>

      {/* Filtros */}
      <div className="vx-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-11 px-4 gap-2 border-border/50 hover:bg-muted"
            onClick={exportToCSV}
          >
            <Download className="size-4" />
            Exportar CSV
          </Button>

          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              className="pl-10 h-11 text-sm bg-muted/20 border-border/50 focus:bg-background transition-all" 
              placeholder="Buscar por usuário, ação ou entidade..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Entidade</p>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-[180px] h-11 bg-muted/20 border-border/50 capitalize">
                  <SelectValue placeholder="Todas Entidades" />
                </SelectTrigger>
                <SelectContent>
                  {entities.map(e => (
                    <SelectItem key={e} value={e} className="capitalize">
                      {e === "all" ? "Todas Entidades" : e.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Ação</p>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[180px] h-11 bg-muted/20 border-border/50 capitalize">
                  <SelectValue placeholder="Todas Ações" />
                </SelectTrigger>
                <SelectContent>
                  {actions.map(a => (
                    <SelectItem key={a} value={a} className="capitalize">
                      {a === "all" ? "Todas Ações" : a.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="vx-card overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Linha do Tempo</h3>
          </div>
          <span className="text-[10px] text-muted-foreground">{filteredLogs.length} registros encontrados</span>
        </div>
        
        <div className="divide-y divide-border/40">
          {isLoading ? (
            <div className="p-20 text-center space-y-4">
              <div className="size-10 rounded-full bg-primary/10 animate-pulse mx-auto flex items-center justify-center">
                <Database className="size-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground animate-pulse">Carregando logs do sistema...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-20 text-center space-y-4">
              <div className="size-10 rounded-full bg-muted mx-auto flex items-center justify-center text-muted-foreground/40">
                <Info className="size-5" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhum registro encontrado para os filtros selecionados.</p>
              <Button variant="link" size="sm" onClick={() => { setSearch(""); setEntityFilter("all"); setActionFilter("all"); }}>
                Limpar filtros
              </Button>
            </div>
          ) : (
            filteredLogs.map((log: any) => (
              <div key={log.id} className="flex items-start gap-4 p-5 hover:bg-muted/10 transition-colors group">
                <div className="mt-1 size-10 rounded-xl bg-muted border border-border/50 flex items-center justify-center shrink-0 group-hover:bg-background group-hover:border-primary/30 transition-all">
                  <Database className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-foreground">
                          {log.profiles?.full_name || "Sistema"}
                        </span>
                        <Badge variant="secondary" className="text-[9px] uppercase tracking-tighter px-1.5 py-0 h-4 bg-primary/5 text-primary border-primary/10">
                          {log.action.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">em</span>
                        <span className="text-xs font-semibold capitalize text-foreground/80">
                          {log.entity_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <CalendarIcon className="size-3" />
                          {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                        </div>
                        {log.ip_address && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Globe className="size-3" />
                            {log.ip_address}
                          </div>
                        )}
                        {log.entity_id && (
                          <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/60 bg-muted/30 px-1.5 rounded">
                            ID: {log.entity_id.slice(0, 8)}
                          </div>
                        )}
                      </div>
                    </div>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="size-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <History className="size-5 text-primary" />
                            Detalhes da Auditoria
                          </DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-6 py-4">
                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Usuário</p>
                              <p className="font-bold">{log.profiles?.full_name || "Sistema"}</p>
                              <p className="text-xs text-muted-foreground">{log.profiles?.email || "—"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Data/Hora</p>
                              <p className="text-sm">{format(new Date(log.created_at), "PPPP 'às' HH:mm:ss", { locale: ptBR })}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ação</p>
                              <Badge variant="outline" className="mt-1 capitalize">{log.action.replace(/_/g, ' ')}</Badge>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Entidade</p>
                              <p className="text-sm font-bold capitalize">{log.entity_type.replace(/_/g, ' ')}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ID da Entidade</p>
                               <p className="text-[11px] font-mono bg-muted p-1.5 rounded break-all">{log.entity_id || "—"}</p>
                            </div>
                            {log.ip_address && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Endereço IP</p>
                                <p className="text-sm font-mono">{log.ip_address}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Alterações Realizadas</p>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <p className="text-[9px] font-bold text-muted-foreground bg-muted/50 px-2 py-1 rounded">ESTADO ANTERIOR</p>
                              <ScrollArea className="h-[200px] w-full rounded-md border p-3 bg-muted/20">
                                {log.old_data ? (
                                  <pre className="text-[11px] leading-relaxed">
                                    {JSON.stringify(log.old_data, null, 2)}
                                  </pre>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">Nenhum dado anterior</p>
                                )}
                              </ScrollArea>
                            </div>
                            <div className="space-y-2">
                              <p className="text-[9px] font-bold text-primary bg-primary/5 px-2 py-1 rounded">ESTADO NOVO</p>
                              <ScrollArea className="h-[200px] w-full rounded-md border border-primary/20 p-3 bg-primary/[0.02]">
                                {log.new_data ? (
                                  <pre className="text-[11px] leading-relaxed">
                                    {JSON.stringify(log.new_data, null, 2)}
                                  </pre>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">Nenhum dado novo</p>
                                )}
                              </ScrollArea>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {log.action === "CONTRACT_UPDATE" && (
                    <div className="flex items-center gap-3 py-1 px-3 bg-primary/5 rounded-lg border border-primary/10 w-fit">
                      <p className="text-[11px] font-medium">
                        Status do contrato alterado para <span className="font-bold text-primary">{log.new_data?.status}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
