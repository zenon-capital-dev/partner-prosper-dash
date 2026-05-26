import { formatBR as format } from "@/lib/datetime";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  AlertCircle, Clock, Users, FileText, Banknote, 
  Wallet, FileSignature, CheckCircle2, MessageSquare,
  Zap, MoreHorizontal, ExternalLink,
  PlusCircle, CheckSquare, UserCheck, DollarSign,
  RefreshCcw, ShieldAlert, Send, Paperclip, MessageCircle,
  Search, History as HistoryIcon, ArrowRight, UserPlus, Eye, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { isToday, isBefore, subDays, startOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CockpitItem {
  id: string;
  type: 'demand' | 'client' | 'document' | 'payment' | 'commission' | 'contract' | 'task' | 'request' | 'report';
  title: string;
  subtitle: string;
  status?: string;
  date?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata: any;
}

export default function OperationalCockpit() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // --- Data Fetching ---
  
  // 1. Demandas vencendo hoje/atrasadas
  const { data: demands = [], isLoading: loadingDemands } = useQuery({
    queryKey: ["cockpit-demands"],
    queryFn: async () => {
      const today = new Date();
      const { data, error } = await supabase
        .from("client_products")
        .select(`
          id, status, deadline, sla_due_date, end_date, 
          client:clients(id, full_name, user_id),
          product:products(name)
        `)
        .not("status", "in", '("concluido", "cancelado")');
      
      if (error) throw error;
      
      return data.filter(d => {
        const dueRaw = d.deadline || d.sla_due_date || d.end_date;
        if (!dueRaw) return false;
        const deadline = new Date(dueRaw);
        return isToday(deadline) || isBefore(deadline, startOfDay(today));
      }).map(d => ({
        id: d.id,
        type: 'demand',
        title: (d.product as any)?.name || "Produto",
        subtitle: (d.client as any)?.full_name || "Cliente",
        status: d.status,
        date: d.deadline || d.sla_due_date || d.end_date,
        severity: isBefore(new Date(d.deadline || d.sla_due_date || d.end_date), startOfDay(today)) ? 'critical' : 'high',
        metadata: d
      })) as CockpitItem[];
    }
  });

  // 2. Clientes sem atualização recente (7 dias)
  const { data: stagnantClients = [], isLoading: loadingClients } = useQuery({
    queryKey: ["cockpit-stagnant-clients"],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, updated_at, status, user_id")
        .lt("updated_at", sevenDaysAgo)
        .eq("status", "ativo");
      
      if (error) throw error;
      
      return data.map(c => ({
        id: c.id,
        type: 'client',
        title: c.full_name,
        subtitle: "Sem atualização há mais de 7 dias",
        status: c.status,
        date: c.updated_at,
        severity: 'medium',
        metadata: c
      })) as CockpitItem[];
    }
  });

  // 3. Documentos aguardando análise/reprovados
  const { data: docs = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["cockpit-docs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          id, status, name, created_at, client_id,
          client:clients(id, full_name)
        `)
        .in("status", ["solicitado", "enviado", "em_analise", "reprovado"]);
      
      if (error) throw error;
      
      return (data as any[])
        .filter(d => d.client_id) // skip orphans
        .map(d => ({
        id: d.id,
        type: 'document',
        title: d.name || "Documento",
        subtitle: `${d.client?.full_name || 'Cliente desconhecido'} - ${d.status === 'enviado' ? 'Aguardando Análise' : d.status === 'reprovado' ? 'Reprovado / Reenvio' : d.status === 'em_analise' ? 'Em Análise' : 'Solicitado'}`,
        status: d.status,
        date: d.created_at,
        severity: d.status === 'reprovado' ? 'high' : 'medium',
        metadata: d
      })) as CockpitItem[];
    }
  });

  // 4. Pagamentos vencidos
  const { data: latePayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["cockpit-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          id, status, amount, due_date,
          client:clients(id, full_name)
        `)
        .neq("status", "pago")
        .lt("due_date", new Date().toISOString());
      
      if (error) throw error;
      
      return data.map(p => ({
        id: p.id,
        type: 'payment',
        title: `R$ ${p.amount.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
        subtitle: (p.client as any)?.full_name,
        status: p.status,
        date: p.due_date,
        severity: 'critical',
        metadata: p
      })) as CockpitItem[];
    }
  });

  // 5. Comissões aguardando liberação
  const { data: commissions = [], isLoading: loadingComs } = useQuery({
    queryKey: ["cockpit-commissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commissions")
        .select(`
          id, status, workflow_status, amount, created_at,
          partner:partners(id, full_name, user_id)
        `)
        .in("workflow_status", ["aguardando_confirmacao", "pendente", "liberada", "em_pagamento"]);
      
      if (error) throw error;
      
      return data.map(c => ({
        id: c.id,
        type: 'commission',
        title: `Comissão R$ ${Number(c.amount || 0).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
        subtitle: (c.partner as any)?.full_name || 'Parceiro desconhecido',
        status: (c as any).workflow_status || c.status,
        date: c.created_at,
        severity: 'medium',
        metadata: c
      })) as CockpitItem[];
    }
  });

  // 6. Contratos pendentes
  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ["cockpit-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          id, status, name, created_at, client_id,
          client:clients(id, full_name)
        `)
        .in("status", ["rascunho", "criado", "enviado", "aguardando_assinatura", "pendente_correcao"]);
      
      if (error) throw error;
      
      return (data as any[])
        .filter(c => c.client_id)
        .map(c => ({
          id: c.id,
          type: 'contract',
          title: c.name || "Contrato",
          subtitle: c.client?.full_name || 'Cliente desconhecido',
          status: c.status,
          date: c.created_at,
          severity: c.status === 'pendente_correcao' ? 'critical' : 'high',
          metadata: c
        })) as CockpitItem[];
    }
  });

  // 7. Tarefas urgentes (vencidas ou alta/urgente vencendo em 3 dias)
  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["cockpit-tasks"],
    queryFn: async () => {
      const now = new Date();
      const in3days = addDays(now, 3).toISOString();
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .neq("status", "concluido")
        .not("due_date", "is", null)
        .lte("due_date", in3days);
      
      if (error) throw error;
      
      return data
        .filter(t => {
          const overdue = isBefore(new Date(t.due_date), startOfDay(now));
          const highPriority = t.priority === 'alta' || t.priority === 'urgente';
          return overdue || highPriority;
        })
        .map(t => ({
          id: t.id,
          type: 'task',
          title: t.title,
          subtitle: t.description || "Sem descrição",
          status: t.status,
          date: t.due_date,
          severity: (isBefore(new Date(t.due_date), startOfDay(now)) ? 'critical' : (t.priority === 'urgente' ? 'critical' : 'high')) as any,
          metadata: t
        })) as CockpitItem[];
    }
  });

  // 8. Solicitações de documento abertas
  const { data: requests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ["cockpit-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_requests")
        .select(`
          id, status, request_title, requested_at, client_id,
          client:clients(id, full_name)
        `)
        .in("status", ["pendente", "enviado", "em_analise"]);
      
      if (error) throw error;
      
      return (data as any[])
        .filter(r => r.client_id)
        .map(r => ({
          id: r.id,
          type: 'request',
          title: r.request_title || "Solicitação de Documento",
          subtitle: r.client?.full_name || 'Cliente desconhecido',
          status: r.status,
          date: r.requested_at,
          severity: 'medium',
          metadata: r
        })) as CockpitItem[];
    }
  });

  // 9. Prestadores sem reporte (3 dias)
  const { data: reportAlerts = [], isLoading: loadingReports } = useQuery({
    queryKey: ["cockpit-reports"],
    queryFn: async () => {
      const threeDaysAgo = subDays(new Date(), 3).toISOString();
      const { data, error } = await supabase
        .from("client_products")
        .select(`
          id, status, 
          client:clients(full_name),
          product:products(name),
          provider:service_providers(id, name, user_id)
        `)
        .eq("status", "em_andamento")
        .not("service_provider_id", "is", null);
      
      if (error) throw error;
      
      const { data: recentReports } = await supabase
        .from("client_product_status_reports")
        .select("client_product_id, created_at")
        .gte("created_at", threeDaysAgo);

      const itemsWithRecentReports = new Set(recentReports?.map(r => r.client_product_id) || []);
      
      return data
        .filter(d => !itemsWithRecentReports.has(d.id))
        .map(d => ({
          id: d.id,
          type: 'report',
          title: `Reporte Pendente: ${(d.product as any)?.name}`,
          subtitle: `Prestador: ${(d.provider as any)?.name} | Cliente: ${(d.client as any)?.full_name}`,
          status: 'pendente',
          severity: 'high',
          metadata: d
        })) as CockpitItem[];
    }
  });

  // --- Actions ---

  const [detailItem, setDetailItem] = useState<CockpitItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<CockpitItem | null>(null);

  const notifyMutation = useMutation({
    mutationFn: async ({ userId, title, message }: { userId: string, title: string, message: string }) => {
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        title,
        message,
        read: false
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notificação enviada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao enviar notificação: " + error.message);
    }
  });

  const tableByType: Record<string, string | null> = {
    demand: 'client_products',
    document: 'documents',
    payment: 'payments',
    commission: 'commissions',
    contract: 'contracts',
    task: 'tasks',
    request: 'document_requests',
    client: null,   // não excluir cliente daqui
    report: null,   // alerta derivado
  };

  const deleteMutation = useMutation({
    mutationFn: async (item: CockpitItem) => {
      const table = tableByType[item.type];
      if (!table) throw new Error('Este tipo de alerta não pode ser excluído daqui.');
      const { error } = await supabase.from(table as any).delete().eq('id', item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item excluído.");
      queryClient.invalidateQueries();
      setDeleteItem(null);
      setDetailItem(null);
    },
    onError: (e: any) => toast.error("Erro ao excluir: " + e.message),
  });

  const openItem = (item: CockpitItem) => {
    switch (item.type) {
      case 'demand':
      case 'report':
        navigate(`/demandas/${item.id}`); break;
      case 'client':
        navigate(`/clientes/${item.id}`); break;
      case 'document':
      case 'request':
        navigate(`/documentos`); break;
      case 'payment':
        navigate(`/financeiro`); break;
      case 'commission':
        navigate(`/comissoes`); break;
      case 'contract':
        navigate(`/contratos`); break;
      case 'task':
        navigate(`/tarefas`); break;
    }
  };

  const handleAction = (action: string, item: CockpitItem) => {
    switch (action) {
      case 'open':
        openItem(item); break;
      case 'view-details':
        setDetailItem(item); break;
      case 'delete':
        setDeleteItem(item); break;
      case 'notify-client': {
        const clientUserId = item.metadata.client?.user_id || item.metadata.user_id;
        if (clientUserId) {
          notifyMutation.mutate({
            userId: clientUserId,
            title: `Atenção: ${item.title}`,
            message: `Olá, precisamos da sua atenção para: ${item.subtitle}`
          });
        } else {
          toast.error("Usuário do cliente não encontrado.");
        }
        break;
      }
      case 'notify-provider': {
        const providerUserId = item.metadata.provider?.user_id || item.metadata.service_provider_id;
        if (providerUserId) {
          notifyMutation.mutate({
            userId: providerUserId,
            title: `Urgente: ${item.title}`,
            message: `Olá, esta demanda requer sua atenção imediata: ${item.subtitle}`
          });
        } else {
          toast.error("Usuário do prestador não encontrado.");
        }
        break;
      }
      case 'create-task':
        navigate(`/tarefas`); break;
      case 'view-history':
        navigate(`/auditoria`); break;
      default:
        toast.info(`Ação "${action}" em desenvolvimento.`);
    }
  };

  // --- Filtering & Totals ---

  const allItems = useMemo(() => {
    return [
      ...demands, ...stagnantClients, ...docs, 
      ...latePayments, ...commissions, ...contracts, 
      ...tasks, ...requests, ...reportAlerts
    ].sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [demands, stagnantClients, docs, latePayments, commissions, contracts, tasks, requests, reportAlerts]);

  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      const matchesSearch = 
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.subtitle.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTab = activeTab === "all" || item.type === activeTab;
      
      return matchesSearch && matchesTab;
    });
  }, [allItems, searchTerm, activeTab]);

  const stats = {
    critical: allItems.filter(i => i.severity === 'critical').length,
    high: allItems.filter(i => i.severity === 'high').length,
    medium: allItems.filter(i => i.severity === 'medium').length,
    total: allItems.length
  };

  if (loadingDemands || loadingClients || loadingDocs || loadingPayments || loadingComs || loadingContracts || loadingTasks || loadingRequests || loadingReports) {
    return (
      <div className="page-shell bg-premium min-h-screen space-y-8 animate-fade-up">
        <PageHeader title="Alertas" description="Carregando seus alertas prioritários..." />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell bg-premium min-h-screen space-y-8 animate-fade-up pb-20">
      <PageHeader 
        eyebrow="​"
        title="Alertas"
        description="Gestão diária de pendências e ações prioritárias."
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline" className="rounded-2xl gap-2 border-slate-200" onClick={() => queryClient.invalidateQueries()}>
              <RefreshCcw className="size-4" /> Atualizar
            </Button>
            <Button className="btn-premium rounded-2xl gap-2" onClick={() => navigate("/tarefas")}>
              <PlusCircle className="size-4" /> Nova Tarefa
            </Button>
          </div>
        }
      />

      {/* KPI GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile 
          label="Total de Alertas" 
          value={stats.total} 
          icon={Zap} 
          tone="primary" 
          onClick={() => { setActiveTab("all"); setSearchTerm(""); }}
        />
        <StatTile 
          label="Críticos" 
          value={stats.critical} 
          icon={ShieldAlert} 
          tone="danger" 
          onClick={() => { setActiveTab("all"); setSearchTerm("crítico"); }}
        />
        <StatTile 
          label="Alta Prioridade" 
          value={stats.high} 
          icon={AlertCircle} 
          tone="warning" 
          onClick={() => { setActiveTab("all"); setSearchTerm(""); }}
        />
        <StatTile 
          label="Em Dia" 
          value={stats.total === 0 ? "100%" : `${Math.round(((stats.total - stats.critical - stats.high) / stats.total) * 100)}%`} 
          icon={CheckCircle2} 
          tone="success" 
        />
      </div>

      {/* FILTER BAR */}
      <div className="vx-card p-4 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-4 z-10 bg-white/80 backdrop-blur-md">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por cliente, produto ou motivo..." 
            className="pl-10 rounded-xl border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList className="bg-slate-100 rounded-xl p-1 flex-wrap h-auto">
            <TabsTrigger value="all" className="rounded-lg text-xs">Todos</TabsTrigger>
            <TabsTrigger value="demand" className="rounded-lg text-xs">Demandas</TabsTrigger>
            <TabsTrigger value="document" className="rounded-lg text-xs">Documentos</TabsTrigger>
            <TabsTrigger value="request" className="rounded-lg text-xs">Solicitações</TabsTrigger>
            <TabsTrigger value="payment" className="rounded-lg text-xs">Financeiro</TabsTrigger>
            <TabsTrigger value="commission" className="rounded-lg text-xs">Comissões</TabsTrigger>
            <TabsTrigger value="contract" className="rounded-lg text-xs">Contratos</TabsTrigger>
            <TabsTrigger value="task" className="rounded-lg text-xs">Tarefas</TabsTrigger>
            <TabsTrigger value="client" className="rounded-lg text-xs">Clientes</TabsTrigger>
            <TabsTrigger value="report" className="rounded-lg text-xs">Reportes</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* MAIN LIST */}
      <div className="space-y-4">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <CockpitRow 
              key={`${item.type}-${item.id}`} 
              item={item} 
              onAction={(action) => handleAction(action, item)} 
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-50">
            <div className="size-20 rounded-full bg-slate-100 flex items-center justify-center">
              <CheckCircle2 className="size-10 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Parabéns!</h3>
              <p className="text-sm text-muted-foreground">Não há itens que precisem de sua atenção imediata.</p>
            </div>
            <Button variant="outline" onClick={() => { setActiveTab("all"); setSearchTerm(""); }}>
              Limpar Filtros
            </Button>
          </div>
        )}
      </div>

      {/* DETAILS SHEET */}
      <Sheet open={!!detailItem} onOpenChange={(o) => !o && setDetailItem(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detailItem && (
            <>
              <SheetHeader>
                <SheetTitle>{detailItem.title}</SheetTitle>
                <SheetDescription>{detailItem.subtitle}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-3 text-sm">
                <DetailRow label="Tipo" value={detailItem.type} />
                {detailItem.status && <DetailRow label="Status" value={String(detailItem.status)} />}
                <DetailRow label="Severidade" value={detailItem.severity} />
                {detailItem.date && (
                  <DetailRow label="Data" value={format(new Date(detailItem.date), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
                )}
                <div className="pt-4 border-t">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Dados completos</p>
                  <pre className="text-[11px] bg-slate-50 p-3 rounded-lg overflow-auto max-h-72 border border-slate-200">
{JSON.stringify(detailItem.metadata, null, 2)}
                  </pre>
                </div>
              </div>
              <SheetFooter className="mt-6 flex-row gap-2 sm:flex-row">
                <Button className="flex-1" onClick={() => { openItem(detailItem); setDetailItem(null); }}>
                  <ExternalLink className="size-4 mr-2" /> Abrir página
                </Button>
                {tableByType[detailItem.type] && (
                  <Button variant="destructive" onClick={() => setDeleteItem(detailItem)}>
                    <Trash2 className="size-4 mr-2" /> Excluir
                  </Button>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* DELETE CONFIRM */}
      <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este item?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteItem?.title} — {deleteItem?.subtitle}. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-slate-900 text-right break-all">{value}</span>
    </div>
  );
}

function StatTile({ label, value, icon: Icon, tone, onClick }: any) {
  const tones = {
    primary: "bg-primary/10 text-primary border-primary/20",
    success: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "vx-card p-6 flex flex-col gap-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98]",
        onClick ? "cursor-pointer" : "cursor-default"
      )}
    >
      <div className={cn("size-10 rounded-xl flex items-center justify-center border", tones[tone as keyof typeof tones])}>
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-3xl font-black tracking-tighter text-slate-900 mt-1">{value}</p>
      </div>
    </button>
  );
}

function CockpitRow({ item, onAction }: { item: CockpitItem, onAction: (action: string) => void }) {
  const navigate = useNavigate();
  const typeConfig = {
    demand: { icon: Zap, label: 'Demanda', color: 'bg-indigo-500/10 text-indigo-500' },
    client: { icon: Users, label: 'Cliente', color: 'bg-blue-500/10 text-blue-500' },
    document: { icon: FileText, label: 'Documento', color: 'bg-amber-500/10 text-amber-500' },
    payment: { icon: Banknote, label: 'Financeiro', color: 'bg-emerald-500/10 text-emerald-500' },
    commission: { icon: Wallet, label: 'Comissão', color: 'bg-indigo-500/10 text-indigo-500' },
    contract: { icon: FileSignature, label: 'Contrato', color: 'bg-orange-500/10 text-orange-500' },
    task: { icon: CheckSquare, label: 'Tarefa', color: 'bg-rose-500/10 text-rose-500' },
    request: { icon: MessageSquare, label: 'Solicitação', color: 'bg-cyan-500/10 text-cyan-500' },
    report: { icon: HistoryIcon, label: 'Reporte', color: 'bg-slate-500/10 text-slate-500' },
  };

  const severityColors = {
    low: 'bg-slate-100 text-slate-500',
    medium: 'bg-blue-500/10 text-blue-500',
    high: 'bg-amber-500/10 text-amber-500',
    critical: 'bg-rose-500/10 text-rose-500 animate-pulse',
  };

  const config = typeConfig[item.type];
  const Icon = config.icon;

  return (
    <div className="vx-card group flex flex-col md:flex-row items-center gap-4 p-4 transition-all hover:bg-slate-50 border-slate-100">
      <div className={cn("size-12 rounded-2xl flex items-center justify-center shrink-0", config.color)}>
        <Icon className="size-6" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-widest h-5 px-2 rounded-md", config.color, "border-none")}>
            {config.label}
          </Badge>
          <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-widest h-5 px-2 rounded-md border-none", severityColors[item.severity])}>
            {item.severity}
          </Badge>
          {item.date && (
            <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" /> 
              {format(new Date(item.date), "dd 'de' MMM", { locale: ptBR })}
            </span>
          )}
        </div>
        <h3 className="text-base font-bold text-slate-900 mt-1 group-hover:text-primary transition-colors truncate">
          {item.title}
        </h3>
        <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button 
          variant="ghost" 
          size="sm" 
          className="rounded-xl h-9 gap-2 text-xs font-bold" 
          onClick={() => onAction('view-details')}
        >
          <Eye className="size-3.5" /> Detalhes
        </Button>
        <Button 
          variant="default" 
          size="sm" 
          className="rounded-xl h-9 gap-2 text-xs font-bold" 
          onClick={() => onAction('open')}
        >
          <ExternalLink className="size-3.5" /> Abrir
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl">
            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest opacity-40 px-3 py-2">
              Ações Rápidas
            </DropdownMenuLabel>

            <DropdownMenuItem onClick={() => onAction('open')} className="gap-2.5 cursor-pointer">
              <ExternalLink className="size-4 text-primary" /> Abrir
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('view-details')} className="gap-2.5 cursor-pointer">
              <Eye className="size-4" /> Ver Detalhes
            </DropdownMenuItem>

            {(item.type === 'demand' || item.type === 'report') && (
              <>
                <DropdownMenuItem onClick={() => onAction('notify-provider')} className="gap-2.5 cursor-pointer">
                  <UserCheck className="size-4 text-blue-500" /> Notificar Prestador
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAction('notify-client')} className="gap-2.5 cursor-pointer">
                  <MessageCircle className="size-4 text-emerald-500" /> Notificar Cliente
                </DropdownMenuItem>
              </>
            )}

            {item.type === 'client' && (
              <DropdownMenuItem onClick={() => onAction('notify-client')} className="gap-2.5 cursor-pointer">
                <MessageCircle className="size-4 text-emerald-500" /> Notificar Cliente
              </DropdownMenuItem>
            )}

            {item.type === 'document' && (
              <DropdownMenuItem onClick={() => onAction('notify-client')} className="gap-2.5 cursor-pointer">
                <Send className="size-4 text-blue-500" /> Notificar Reenvio
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={() => onAction('create-task')} className="gap-2.5 cursor-pointer">
              <CheckSquare className="size-4" /> Criar Tarefa
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => onAction('view-history')} className="gap-2.5 cursor-pointer">
              <HistoryIcon className="size-4" /> Ver Histórico
            </DropdownMenuItem>

            {item.type !== 'client' && item.type !== 'report' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onAction('delete')} className="gap-2.5 cursor-pointer text-rose-600 focus:text-rose-600">
                  <Trash2 className="size-4" /> Excluir
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
