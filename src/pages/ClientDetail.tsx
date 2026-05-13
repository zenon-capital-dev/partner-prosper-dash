import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Plus, Pencil, MessageSquare,
  FileText, ShoppingBag, FileSignature, ClipboardList,
  History, Info, CreditCard, Sparkles, AlertCircle,
  Building2, UserCheck, TrendingUp, Activity,
  Clock, CheckCircle2, MoreVertical, ShieldAlert,
  ChevronRight, Phone, Mail, Globe, MapPin, 
  Wallet, PieChart, Star, Users
} from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import { toast } from "sonner";
import { formatBRL, initials, formatDate, formatDoc, formatPhone } from "@/lib/format";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { ClientOverview } from "@/components/clients/tabs/ClientOverview";
import { ClientProducts } from "@/components/clients/tabs/ClientProducts";
import { ClientDocuments } from "@/components/clients/tabs/ClientDocuments";
import { ClientContracts } from "@/components/clients/tabs/ClientContracts";
import { ClientFinancial } from "@/components/clients/tabs/ClientFinancial";
import { ClientTasks } from "@/components/clients/tabs/ClientTasks";
import { ClientHistory } from "@/components/clients/tabs/ClientHistory";
import { IntelligentSummary } from "@/components/clients/IntelligentSummary";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/PageHeader";

const TABS = [
  { id: "visao-geral", label: "Visão Geral", icon: Info },
  { id: "empresas", label: "Empresas", icon: Building2 },
  { id: "produtos", label: "Produtos/Demandas", icon: ShoppingBag },
  { id: "documentos", label: "Documentos", icon: FileText },
  { id: "entregas", label: "Entregas", icon: ClipboardList },
  { id: "financeiro", label: "Financeiro", icon: CreditCard },
  { id: "contratos", label: "Contratos", icon: FileSignature },
  { id: "relacionamento", label: "Relacionamento", icon: MessageSquare },
  { id: "historico", label: "Histórico", icon: History },
  { id: "observacoes", label: "Observações", icon: AlertCircle },
];

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [editOpen, setEditOpen] = useState(false);

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(`*, partners(id, full_name, email, commission_percent)`)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: clientProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["client-products", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_products")
        .select("*, products(id, name, description), steps:client_product_steps(*)")
        .eq("client_id", id!);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["client-payments", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("client_id", id!)
        .order("due_date", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["client-documents", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("*")
        .eq("client_id", id!);
      return data ?? [];
    },
    enabled: !!id,
  });

  const isLoading = clientLoading || productsLoading || paymentsLoading || docsLoading;

  const stats = useMemo(() => {
    if (!client) return null;

    const totalRevenue = clientProducts.reduce((s, x) => s + Number(x.value || 0), 0);
    const activeProducts = clientProducts.filter(p => p.status === 'ativo').length;
    const pendingDocs = documents.filter(d => d.status === 'solicitado' || d.status === 'pendente_correcao').length;
    const pendingPayments = payments.filter(p => p.status === 'pendente').length;
    const overduePayments = payments.filter(p => p.status !== 'pago' && p.due_date && new Date(p.due_date) < new Date()).length;
    
    // Find delayed demands (steps with SLA expired)
    const delayedDemands = clientProducts.filter(p => 
      p.steps?.some((s: any) => !s.completed && s.sla_due_date && new Date(s.sla_due_date) < new Date())
    ).length;

    const lastUpdate = client.updated_at ? formatDate(client.updated_at) : formatDate(client.created_at);

    // Next recommended action
    let nextAction = { title: "Nenhuma ação pendente", desc: "Tudo em dia com este cliente." };
    
    const unfinishedStep = clientProducts
      .flatMap(p => p.steps || [])
      .find((s: any) => !s.completed);

    if (unfinishedStep) {
      nextAction = { 
        title: (unfinishedStep as any).label || "Próxima Etapa", 
        desc: `Pendente em: ${clientProducts.find(p => p.id === unfinishedStep.client_product_id)?.products?.name || "Demanda"}`
      };
    } else if (pendingDocs > 0) {
      nextAction = { title: "Solicitar Documentos", desc: "Existem documentos pendentes de envio ou assinatura." };
    } else if (overduePayments > 0) {
      nextAction = { title: "Cobrar Pagamento", desc: "Há pagamentos vencidos que precisam de atenção." };
    }

    return { 
      totalRevenue, 
      activeProducts, 
      pendingDocs, 
      pendingPayments, 
      overduePayments, 
      delayedDemands, 
      lastUpdate,
      nextAction
    };
  }, [client, clientProducts, payments, documents]);


  if (isLoading) return (
    <div className="p-12 flex flex-col items-center justify-center min-h-[400px] animate-pulse">
      <div className="size-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin mb-4" />
      <p className="text-muted-foreground font-medium">Carregando dossiê do cliente...</p>
    </div>
  );
  
  if (!client || !stats) return (
    <div className="p-12 text-center flex flex-col items-center gap-4">
      <AlertCircle className="size-12 text-destructive/50" />
      <h2 className="text-xl font-bold">Cliente não encontrado</h2>
      <Button variant="outline" onClick={() => navigate("/clientes")}>Voltar para lista</Button>
    </div>
  );

  return (
    <div className="page-shell space-y-6 animate-fade-up">
      {/* Premium Header */}
      <header className="relative space-y-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/clientes")}
            className="rounded-xl border border-border/40 hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
            <Users className="size-3" />
            <span>CRM</span>
            <ChevronRight className="size-3" />
            <span>Dossiê do Cliente</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="size-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-3xl font-bold text-primary shadow-sm shrink-0">
               {initials(client.full_name)}
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
                {client.full_name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Building2 className="size-3.5" />
                  <span className="font-medium text-foreground/80">{client.company || "Pessoa Física"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="size-3.5" />
                  <span>{formatDoc(client.document)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap lg:justify-end">
             <Button
               variant="outline"
               className="gap-2 bg-emerald-500/5 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10"
               onClick={() => {
                 const ok = openWhatsApp({ phone: client.whatsapp || client.phone, message: `Olá ${client.full_name?.split(" ")[0] || ""}, tudo bem?` });
                 if (!ok) toast.error("Cliente sem telefone válido");
               }}
             >
               <MessageSquare className="size-4" /> WhatsApp
             </Button>
             
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <Button variant="outline" className="gap-2">
                   Ações <ChevronRight className="size-4 rotate-90" />
                 </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="w-56">
                 <DropdownMenuLabel>Ações do Cliente</DropdownMenuLabel>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem onClick={() => setEditOpen(true)}>
                   <Pencil className="size-4 mr-2" /> Editar Cadastro
                 </DropdownMenuItem>
                 <DropdownMenuItem onClick={() => setActiveTab("financeiro")}>
                   <Wallet className="size-4 mr-2" /> Gerar Cobrança
                 </DropdownMenuItem>
                 <DropdownMenuItem onClick={() => setActiveTab("documentos")}>
                   <FileText className="size-4 mr-2" /> Solicitar Documento
                 </DropdownMenuItem>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem className="text-destructive focus:text-destructive">
                   <AlertCircle className="size-4 mr-2" /> Suspender Cliente
                 </DropdownMenuItem>
               </DropdownMenuContent>
             </DropdownMenu>
          </div>
        </div>

        {/* Status Bar */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          <StatusCluster 
            label="Comercial" 
            value={client.status?.replace("_", " ")} 
            tone={client.status === 'ativo' ? 'success' : client.status === 'prospecto' ? 'warning' : 'danger'}
          />
          <StatusCluster 
            label="Operacional" 
            value={client.onboarding_status?.replace("_", " ")} 
            tone={client.onboarding_status === 'concluido' ? 'success' : client.onboarding_status === 'em_andamento' ? 'warning' : 'info'}
          />
          <StatusCluster 
            label="Financeiro" 
            value={client.payment_status?.replace("_", " ")} 
            tone={client.payment_status === 'pago' ? 'success' : client.payment_status === 'pendente' ? 'warning' : 'danger'}
          />
          <div className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-muted/40 border border-border/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Engajamento</span>
            <div className="flex items-center gap-2">
              <span className={cn("text-sm font-bold", 
                client.health_score >= 80 ? "text-emerald-500" : client.health_score >= 50 ? "text-amber-500" : "text-rose-500"
              )}>
                {client.health_score || 100}
              </span>
              <Progress value={client.health_score || 100} className="h-1.5 flex-1" />
            </div>
          </div>
          <StatusCluster 
            label="Risco Churn" 
            value={client.churn_risk || "Baixo"} 
            tone={client.churn_risk === 'Alto' ? 'danger' : client.churn_risk === 'Médio' ? 'warning' : 'success'}
          />
          <div className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-muted/40 border border-border/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Responsável</span>
            <div className="flex items-center gap-1.5 truncate">
              <UserCheck className="size-3.5 text-primary" />
              <span className="text-sm font-medium truncate">{(client as any).responsible?.full_name || "Sem atribuição"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MiniCard 
          label="Produtos Ativos" 
          value={stats.activeProducts} 
          icon={<ShoppingBag className="size-4" />}
          tone="primary"
        />
        <MiniCard 
          label="Doc. Pendentes" 
          value={stats.pendingDocs} 
          icon={<FileText className="size-4" />}
          tone={stats.pendingDocs > 0 ? "warning" : "success"}
        />
        <MiniCard 
          label="Pag. Pendentes" 
          value={stats.pendingPayments} 
          icon={<Wallet className="size-4" />}
          tone={stats.pendingPayments > 0 ? "warning" : "success"}
        />
        <MiniCard 
          label="Demandas Atrasadas" 
          value={stats.delayedDemands} 
          icon={<Clock className="size-4" />}
          tone={stats.delayedDemands > 0 ? "danger" : "success"}
        />
        <MiniCard 
          label="Última Atualização" 
          value={stats.lastUpdate} 
          icon={<Activity className="size-4" />}
          tone="info"
        />
        <div className="col-span-2 md:col-span-1 lg:col-span-1 rounded-2xl p-4 bg-primary/5 border border-primary/20 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Próxima Ação</span>
            <Sparkles className="size-3.5 text-primary" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-foreground truncate">{stats.nextAction.title}</p>
            <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2">{stats.nextAction.desc}</p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto pb-1 scrollbar-hide">
          <TabsList className="bg-transparent border-b border-border/60 w-full justify-start rounded-none h-12 p-0 gap-8">
            {TABS.map(tab => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-4 pt-2 gap-2 text-muted-foreground hover:text-foreground transition-all"
              >
                <tab.icon className="size-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="min-h-[500px] animate-in fade-in slide-in-from-bottom-2 duration-300">
          <TabsContent value="visao-geral" className="m-0 focus-visible:ring-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <IntelligentSummary clientId={id!} />
                <ClientOverview client={client} stats={{ totalRevenue: stats.totalRevenue }} />
              </div>
              <div className="space-y-6">
                <RelationshipSummary client={client} />
                <EngagementCard health={client.health_score} risk={client.churn_risk} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="empresas" className="m-0">
            <div className="cp-panel p-12 text-center space-y-4">
              <Building2 className="size-12 text-muted-foreground/20 mx-auto" />
              <div className="space-y-2">
                <h3 className="text-lg font-bold">Gestão de Empresas</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Vincule múltiplas empresas ou filiais a este cliente para centralizar faturamento e demandas.
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="size-4" /> Adicionar empresa
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="produtos" className="m-0">
            <ClientProducts clientId={id!} />
          </TabsContent>

          <TabsContent value="documentos" className="m-0">
            <ClientDocuments clientId={id!} user_id={client.user_id} />
          </TabsContent>

          <TabsContent value="entregas" className="m-0">
            <ClientTasks clientId={id!} />
          </TabsContent>

          <TabsContent value="financeiro" className="m-0">
            <ClientFinancial clientId={id!} />
          </TabsContent>

          <TabsContent value="contratos" className="m-0">
            <ClientContracts clientId={id!} />
          </TabsContent>

          <TabsContent value="relacionamento" className="m-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="cp-panel p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <MessageSquare className="size-4 text-indigo-500" /> Registro de Interações
                  </h3>
                  <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold uppercase tracking-wider">Novo Registro</Button>
                </div>
                <div className="space-y-4 py-4">
                  <div className="flex gap-4 p-4 rounded-xl bg-muted/30 border border-border/40">
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Phone className="size-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Chamada de Alinhamento</p>
                      <p className="text-[11px] text-muted-foreground">Realizada por {(client as any).responsible?.full_name || "Equipe"} • Ontem</p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 rounded-xl bg-muted/30 border border-border/40 opacity-60">
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="size-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Follow-up Financeiro</p>
                      <p className="text-[11px] text-muted-foreground">Enviado automaticamente • 3 dias atrás</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="cp-panel p-6 space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Star className="size-4 text-indigo-500" /> Satisfação (NPS)
                </h3>
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="size-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <TrendingUp className="size-8 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">9.2</p>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Score NPS Atual</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground italic">"Excelente atendimento e rapidez nas entregas."</p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="historico" className="m-0">
            <ClientHistory clientId={id!} />
          </TabsContent>

          <TabsContent value="observacoes" className="m-0">
            <div className="cp-panel p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Observações Internas</h3>
                <Button variant="outline" size="sm">Editar Notas</Button>
              </div>
              <div className="p-4 rounded-xl bg-muted/20 border border-border/40 min-h-[200px] text-sm leading-relaxed text-muted-foreground">
                {client.internal_notes || "Nenhuma observação interna registrada para este cliente."}
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <ClientFormDialog 
        open={editOpen} 
        onOpenChange={setEditOpen} 
        onCreated={() => qc.invalidateQueries({ queryKey: ["client", id] })} 
        client={client} 
      />
    </div>
  );
}

function StatusCluster({ label, value, tone }: { label: string; value?: string; tone: 'success' | 'warning' | 'danger' | 'info' }) {
  const colors = {
    success: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    info: 'bg-blue-500/10 text-blue-600 border-blue-500/20'
  };

  return (
    <div className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-muted/40 border border-border/40">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{label}</span>
      <Badge variant="outline" className={cn("w-fit h-5 px-1.5 text-[10px] font-bold uppercase tracking-widest", colors[tone])}>
        {value || "N/A"}
      </Badge>
    </div>
  );
}

function MiniCard({ label, value, icon, tone }: { label: string; value: string | number; icon: React.ReactNode; tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' }) {
  const colors = {
    primary: 'text-primary bg-primary/10',
    success: 'text-emerald-500 bg-emerald-500/10',
    warning: 'text-amber-500 bg-amber-500/10',
    danger: 'text-rose-500 bg-rose-500/10',
    info: 'text-blue-500 bg-blue-500/10'
  };

  return (
    <div className="rounded-2xl p-4 bg-card border border-border/60 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{label}</span>
        <div className={cn("size-8 rounded-xl flex items-center justify-center", colors[tone])}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function RelationshipSummary({ client }: any) {
  return (
    <div className="cp-panel p-6 space-y-4">
      <h3 className="text-sm font-bold flex items-center gap-2">
        <UserCheck className="size-4 text-primary" /> Relacionamento
      </h3>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {client.responsible?.avatar_url ? (
              <img src={client.responsible.avatar_url} alt="" className="size-full object-cover" />
            ) : (
              <UserCheck className="size-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Responsável</p>
            <p className="text-sm font-medium">{client.responsible?.full_name || "Sem atribuição"}</p>
          </div>
        </div>
        <div className="h-px bg-border/40" />
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <Mail className="size-3.5 text-muted-foreground" />
            <span className="truncate">{client.email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Phone className="size-3.5 text-muted-foreground" />
            <span>{formatPhone(client.phone)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Globe className="size-3.5 text-muted-foreground" />
            <span>{client.city} / {client.state}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EngagementCard({ health, risk }: { health: number; risk: string }) {
  return (
    <div className="cp-panel p-6 space-y-4">
      <h3 className="text-sm font-bold flex items-center gap-2">
        <PieChart className="size-4 text-indigo-500" /> Engajamento
      </h3>
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Engajamento do Cliente</span>
            <span className="font-bold">{health}%</span>
          </div>
          <Progress value={health} className={cn("h-2", 
            health >= 80 ? "[&>div]:bg-emerald-500" : health >= 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-rose-500"
          )} />
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/40">
          <span className="text-xs text-muted-foreground font-medium">Risco de Churn</span>
          <Badge className={cn("text-[10px] font-black uppercase tracking-widest", 
            risk === 'Alto' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : 
            risk === 'Médio' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 
            'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
          )}>
            {risk}
          </Badge>
        </div>
      </div>
    </div>
  );
}

